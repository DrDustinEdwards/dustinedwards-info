import { readFile, readdir, mkdir, rm, stat } from "node:fs/promises";
import { classifySqliteTables } from "./lib/sqlite-tables.mjs";
import { retryRead } from "./lib/retry.mjs";
import { resolveD1Address } from "./lib/d1-address.mjs";
import { runWrangler, wranglerTail as tail } from "./lib/wrangler-run.mjs";
import { downloadAllObjects, listAllObjects } from "./lib/r2.mjs";
import path from "node:path";
import os from "node:os";

const DB_NAME = "dustinedwards";
const MIGRATIONS_DIR = "drizzle";
/** The OG bucket is deliberately not pulled: every card is regenerable. */
const MEDIA_BUCKET = "dustinedwards-media";

/** D1 and wrangler bookkeeping: no migration declares them and a content restore excludes them. */
const PLATFORM_TABLES = new Set([
  "_cf_KV",
  "sqlite_sequence",
  "d1_migrations",
  // Local only: miniflare creates it and remote D1 does not have it.
  "_cf_METADATA",
]);

/** Bounded, so a hung wrangler fails the gate instead of hanging it: retryRead's timer cannot fire here. */
const wrangler = (/** @type {string} */ args) => runWrangler(args, { timeoutMs: 10 * 60_000 });

let DB_ADDRESS = DB_NAME;

/**
 * Virtual tables are excluded: they cannot be exported and are rebuilt from their content table.
 *
 * @returns {Promise<Set<string>>}
 */
async function expectedTables() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  if (files.length === 0) {
    throw new Error(`no migration files found in ${MIGRATIONS_DIR}/`);
  }
  /** @type {Set<string>} */
  const tables = new Set();
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    // Strip line comments so a commented-out CREATE TABLE is not counted.
    const live = sql.replace(/^\s*--.*$/gm, "");
    for (const match of live.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/gi,
    )) {
      tables.add(match[1]);
    }
    for (const match of live.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/gi)) {
      tables.delete(match[1]);
    }
  }
  if (tables.size === 0) {
    throw new Error("parsed zero tables out of the migrations, which cannot be right");
  }
  return tables;
}

/**
 * Shadow tables are found by prefix, so a future fts5 table brings its own shadows along.
 *
 * @param {string} target
 * @returns {Promise<{ real: Set<string>, virtual: Set<string>, shadow: Set<string> }>}
 */
async function actualTables(target) {
  // Retried once: this read has died with a transient open failure. Nothing that writes is wrapped.
  const result = await retryRead(
    () => {
      const r = wrangler(
        `d1 execute ${DB_ADDRESS} ${target} --json --command ` +
          `"SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name;"`,
      );
      // A non-zero status is the failure here, not a throw, so it is raised
      // deliberately: retryRead can only see a rejection.
      if (r.status !== 0) throw new Error(tail(r.output));
      return r;
    },
    { label: `check:backup sqlite_master read (${target})` },
  );
  const match = result.stdout.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`could not parse sqlite_master output:\n${result.output}`);
  /** @type {{ name: string, sql: string | null }[]} */
  const rows = JSON.parse(match[0])[0].results;
  if (rows.length === 0) throw new Error("sqlite_master returned no tables");

  const classified = classifySqliteTables(rows);
  return {
    real: new Set(classified.real.filter((n) => !PLATFORM_TABLES.has(n))),
    virtual: new Set(classified.virtual),
    shadow: new Set(classified.shadow.filter((n) => !PLATFORM_TABLES.has(n))),
  };
}

/** @param {Set<string>} set */
function sorted(set) {
  return [...set].sort();
}

async function main() {
  const target = process.argv.includes("--remote") ? "--remote" : "--local";
  DB_ADDRESS = resolveD1Address(DB_NAME, target);
  console.log(
    `check:backup verifying the per-table export path against ${target.slice(2)} D1` +
      `${DB_ADDRESS === DB_NAME ? "" : ` (${DB_NAME} resolved to ${DB_ADDRESS})`}`,
  );

  const expected = await expectedTables();
  const { real, virtual, shadow } = await actualTables(target);

  console.log(`  migrations declare ${expected.size}: ${sorted(expected).join(", ")}`);
  console.log(`  database holds     ${real.size}: ${sorted(real).join(", ")}`);
  console.log(`  fts5 virtual       ${virtual.size}: ${sorted(virtual).join(", ")}`);
  console.log(`  fts5 shadow        ${shadow.size}: ${sorted(shadow).join(", ")}`);

  /** @type {string[]} */
  const problems = [];

  // Both directions are satisfied by the two sources shrinking together, so the structure gets floors.
  const floor = (/** @type {string} */ label, /** @type {number} */ actual, /** @type {number} */ min) => {
    if (actual < min) {
      problems.push(
        `${label}: ${actual}, expected at least ${min}. Both sources shrinking together is the ` +
          `one thing the two-direction comparison below cannot see.`,
      );
    }
  };
  floor("migrations declare too few tables", expected.size, 10);
  floor("the database holds too few tables", real.size, 10);
  floor("too few fts5 virtual tables", virtual.size, 3);
  floor("too few fts5 shadow tables", shadow.size, 11);

  // Both directions. A missing table means the backup would silently skip real
  // data; an unexpected one means something reached the database outside a
  // migration and nothing is backing it up.
  for (const name of sorted(expected)) {
    if (!real.has(name)) problems.push(`declared by a migration but absent from the database: ${name}`);
  }
  for (const name of sorted(real)) {
    if (!expected.has(name)) problems.push(`present in the database but declared by no migration: ${name}`);
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`  FAIL ${problem}`);
    throw new Error(`${problems.length} schema/backup mismatch(es)`);
  }

  const dir = path.join(os.tmpdir(), "dustinedwards-backup-check");
  await mkdir(dir, { recursive: true });

  let totalBytes = 0;
  /** @type {string[]} */
  const empty = [];

  /** @param {string} name */
  async function exportTable(name) {
    const out = path.join(dir, `${name}.sql`);
    // The directory is fixed across runs, so an export that exits 0 without writing would otherwise
    // be graded on the previous run's file.
    await rm(out, { force: true });
    // Retried once: an export is a read that overwrites its own local file. The throw is load-bearing,
    // because wrangler returns on a failed command rather than rejecting.
    await retryRead(
      () => {
        const r = wrangler(
          `d1 export ${DB_ADDRESS} ${target} --no-schema --table ${name} --output "${out}"`,
        );
        if (r.status !== 0) throw new Error(tail(r.output));
        return r;
      },
      { label: `check:backup per-table export (${name}, ${target})` },
    );
    const body = await readFile(out, "utf8");
    const bytes = (await stat(out)).size;
    // An export that wrote a file but no INSERTs is a pass that backed up
    // nothing. Count the statements, do not just check the file exists.
    const inserts = (body.match(/^INSERT INTO/gim) ?? []).length;
    return { name, bytes, inserts };
  }

  // Serial, and said so: wrangler() is spawnSync, which blocks the event loop, so the four-worker
  // pool that stood here ran one export at a time anyway.
  /** @type {Array<{ name: string, bytes: number, inserts: number }>} */
  const results = [];
  for (const name of sorted(real)) results.push(await exportTable(name));

  for (const result of results) {
    totalBytes += result.bytes;
    console.log(`  ${result.name}: ${result.bytes} bytes, ${result.inserts} INSERT statement(s)`);
    if (result.inserts === 0) empty.push(result.name);
  }

  // Scope: a table left unexported makes every count below agree with itself over a subset.
  if (results.length !== real.size) {
    throw new Error(
      `${results.length} of ${real.size} table(s) were exported. The export loop ` +
        `did not run every table, so every count below would be taken over a subset.`,
    );
  }

  // Empty tables are legitimate, so they are reported. Too few with rows is the export path broken
  // rather than the data absent. Moves with content, so it is deliberately the loosest floor in the file.
  const withRows = real.size - empty.length;
  if (withRows < 4) {
    throw new Error(
      `only ${withRows} of ${real.size} exports carried any rows, expected at least 4. The ` +
        `export path is broken, not the data.`,
    );
  }
  if (empty.length > 0) {
    console.log(`  note: ${empty.length} table(s) exported with no rows: ${empty.join(", ")}`);
  }

  // The mirror bucket covers this site's own code deleting an object, not account loss, so this is the
  // only copy outside it. Remote only: miniflare holds no objects.
  let mediaNote = "media objects NOT pulled (--local reads miniflare, which holds none)";
  if (target === "--remote") {
    const mediaDir = path.join(dir, "media");
    await mkdir(mediaDir, { recursive: true });
    const listed = await retryRead(
      () => listAllObjects({ bucket: MEDIA_BUCKET, remote: true }),
      { label: "check:backup MEDIA list" },
    );
    const pulled = await downloadAllObjects({
      bucket: MEDIA_BUCKET,
      destDir: mediaDir,
      remote: true,
    });

    if (pulled.mismatched.length > 0) {
      for (const bad of pulled.mismatched) console.error(`  FAIL media object ${bad}`);
      throw new Error(
        `${pulled.mismatched.length} media object(s) did not land on disk at the size R2 ` +
          `reported. A short read is a backup that restores to a corrupt file.`,
      );
    }
    if (pulled.downloaded !== listed.length) {
      throw new Error(
        `pulled ${pulled.downloaded} media object(s) but R2 listed ${listed.length}. A backup ` +
          `that silently omits an object it just listed is the failure this gate is for.`,
      );
    }
    mediaNote =
      `${pulled.downloaded} media object(s), ${pulled.bytes} bytes, under ${mediaDir}` +
      (listed.length === 0 ? " (the bucket is empty, so this verified nothing)" : "");
  }
  console.log(`  ${mediaNote}`);

  console.log(
    `check:backup ok. ${real.size} table(s), ${totalBytes} bytes total, written under ${dir}`,
  );
}

main().catch((/** @type {unknown} */ error) => {
  console.error(`check:backup failed. ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
