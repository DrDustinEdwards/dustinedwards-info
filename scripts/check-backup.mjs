/**
 * Verifies the per-table backup path against the live schema.
 *
 *   npm run check:backup -- --local
 *   npm run check:backup -- --remote
 *
 * BOUNDARY: it proves the export PATH works and that the table list matches the migrations. It
 * never restores, so it cannot tell you the dump would reconstruct the database.
 */

import { readFile, readdir, mkdir, stat } from "node:fs/promises";
import { classifySqliteTables } from "./lib/sqlite-tables.mjs";
import { retryRead } from "./lib/retry.mjs";
import { downloadAllObjects, listAllObjects } from "./lib/r2.mjs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const DB_NAME = "dustinedwards";
const MIGRATIONS_DIR = "drizzle";
/**
 * The irreplaceable bucket. The OG bucket is deliberately NOT pulled: every card is regenerable,
 * and backing up output that has a rebuild door grows a backup set without making it safer.
 */
const MEDIA_BUCKET = "dustinedwards-media";

/**
 * Tables D1 and wrangler create for their own bookkeeping. They are not ours,
 * no migration declares them, and they are not part of a content restore.
 */
const PLATFORM_TABLES = new Set([
  "_cf_KV",
  "sqlite_sequence",
  "d1_migrations",
  // Local only: miniflare creates it and remote D1 does not have it.
  "_cf_METADATA",
]);

/**
 * One already-quoted command string: an args array with `shell: true` concatenates without
 * quoting and has split an argument containing a space twice in this repo.
 *
 * @param {string} args
 * @returns {{ stdout: string, status: number }}
 */
function wrangler(args) {
  const result = spawnSync(`npx wrangler ${args}`, { encoding: "utf8", shell: true });
  return { stdout: `${result.stdout ?? ""}${result.stderr ?? ""}`, status: result.status ?? 1 };
}

/**
 * The END of wrangler's output, which is where its error is: both throws used the HEAD, which is
 * the banner.
 *
 * @param {string} text
 * @param {number} [max]
 */
function tail(text, max = 400) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && /\w/.test(l) && !/^[⛅🌀]/u.test(l));
  return lines.join(" | ").slice(-max) || "no output";
}

/**
 * How this gate ADDRESSES the database, which is not always its name: the export resolves the
 * name through the gitignored config, which a clean checkout bootstraps with a placeholder id.
 * `--local` keeps the NAME deliberately, miniflare state being keyed by the config's id.
 *
 * @param {string} target
 * @returns {string}
 */
function resolveAddress(target) {
  if (target !== "--remote") return DB_NAME;
  const listed = wrangler("d1 list --json");
  const start = listed.status === 0 ? listed.stdout.indexOf("[") : -1;
  /** @type {Array<{ uuid?: string, name?: string }>} */
  const databases = start === -1 ? [] : JSON.parse(listed.stdout.slice(start));
  const found = databases.find((d) => d.name === DB_NAME);
  // FAILS CLOSED: falling back to the name substitutes a different value and reintroduces the
  // lookup failure wearing a passing lookup.
  if (typeof found?.uuid !== "string" || found.uuid.length === 0) {
    throw new Error(
      `could not resolve ${DB_NAME} to a UUID from d1 list` +
        `${listed.status === 0 ? "" : ` (d1 list exited ${listed.status}: ${tail(listed.stdout)})`}. ` +
        `Passing the NAME lets wrangler resolve it out of wrangler.jsonc, which ` +
        `a clean checkout bootstraps from the example with a placeholder id.`,
    );
  }
  return found.uuid;
}

/** Set once in `main`, before anything reads the database. */
let DB_ADDRESS = DB_NAME;

/**
 * Virtual tables are deliberately excluded: they cannot be exported and are rebuilt from their
 * content table, so including them would make the expected set disagree by construction.
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
 * Shadow tables are found by prefix against the virtual table names rather than by a hardcoded
 * suffix list, so a future fts5 table brings its own shadows along.
 *
 * @param {string} target
 * @returns {Promise<{ real: Set<string>, virtual: Set<string>, shadow: Set<string> }>}
 */
async function actualTables(target) {
  /*
   * RETRIED ONCE: this read has died with a transient open failure and been clean immediately
   * after. The per-table export is wrapped too; nothing that WRITES is.
   */
  const result = await retryRead(
    () => {
      const r = wrangler(
        `d1 execute ${DB_ADDRESS} ${target} --json --command ` +
          `"SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name;"`,
      );
      // A non-zero status is the failure here, not a throw, so it is raised
      // deliberately: retryRead can only see a rejection.
      if (r.status !== 0) throw new Error(tail(r.stdout));
      return r;
    },
    { label: `check:backup sqlite_master read (${target})` },
  );
  if (result.status !== 0) {
    console.error(result.stdout);
    throw new Error("could not read sqlite_master");
  }
  const match = result.stdout.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`could not parse sqlite_master output:\n${result.stdout}`);
  /** @type {{ name: string, sql: string | null }[]} */
  const rows = JSON.parse(match[0])[0].results;
  if (rows.length === 0) throw new Error("sqlite_master returned no tables");

  /*
   * Classified by the shared module, the same one `check:invariants` reads: the rules were already
   * identical and a comment said so, and one module makes that a fact. PLATFORM_TABLES stays HERE,
   * being a property of where these rows came from rather than of SQLite.
   */
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
  DB_ADDRESS = resolveAddress(target);
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

  /*
   * SCOPE FLOORS. This gate had none, and it is the one that decides whether this database can be
   * recovered at all. The two loops are both directions between two independent sources, a strong
   * shape with one blind spot: they are satisfied by the sources shrinking TOGETHER. MEASURED BOTH
   * WAYS, the two targets agreeing on every structural count and differing only in bytes, which is
   * why the floors are on STRUCTURE.
   */
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
  if (virtual.size === 0) {
    problems.push(
      "no fts5 virtual table found. This script exists because they make a full export impossible; " +
        "if they are genuinely gone, use the full export and retire this script.",
    );
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

  /**
   * Exports one table and reads back what it wrote. LIFTED OUT OF THE LOOP UNCHANGED so the loop
   * could become a pool: every assertion is the one the serial loop made.
   *
   * @param {string} name
   */
  async function exportTable(name) {
    const out = path.join(dir, `${name}.sql`);
    /*
     * RETRIED ONCE. An export is a READ: it pulls rows and writes a LOCAL temp file, so a second
     * attempt overwrites its own output. The throw is load-bearing, wrangler RETURNING on a failed
     * command rather than rejecting.
     */
    /*
     * NO STATUS CHECK AFTER THIS. There was one and it could not fire: `retryRead` hands back what
     * the callback returned and the callback throws on non-zero. The vacuity rule's first class, and it
     * printed what read as the diagnostic for a failed export.
     */
    await retryRead(
      () => {
        const r = wrangler(
          `d1 export ${DB_ADDRESS} ${target} --no-schema --table ${name} --output "${out}"`,
        );
        if (r.status !== 0) throw new Error(tail(r.stdout));
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

  /**
   * THE EXPORTS RUN CONCURRENTLY, and NOTHING ELSE ABOUT THEM CHANGED: the same commands against
   * the same target, each writing its own file, each a READ, and the output re-sorted. THE COST WAS
   * SCHEDULING RATHER THAN WORK, process startup being the cost. THE BOUND IS ARGUED RATHER THAN
   * TUNED: enough processes to saturate the machine puts the cost back as scheduler contention.
   */
  const EXPORT_CONCURRENCY = 4;
  const names = sorted(real);
  /** @type {Array<{ name: string, bytes: number, inserts: number }>} */
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(EXPORT_CONCURRENCY, names.length) }, async () => {
      for (;;) {
        const index = next;
        next += 1;
        const name = names[index];
        if (name === undefined) return;
        results.push(await exportTable(name));
      }
    }),
  );

  /*
   * RE-SORTED BEFORE REPORTING: a pool completes out of order, and output order that depends on
   * which export finished first is a gate whose diffs are noise.
   */
  results.sort((a, b) => a.name.localeCompare(b.name));
  for (const result of results) {
    totalBytes += result.bytes;
    console.log(`  ${result.name}: ${result.bytes} bytes, ${result.inserts} INSERT statement(s)`);
    if (result.inserts === 0) empty.push(result.name);
  }

  /*
   * SCOPE, ASSERTED, and new with the pool: a worker that returned early leaves exports unrun, and
   * every count below is then computed over a smaller set that agrees with itself.
   */
  if (results.length !== names.length) {
    throw new Error(
      `${results.length} of ${names.length} table(s) were exported. The export pool ` +
        `did not run every table, so every count below would be taken over a subset.`,
    );
  }

  // Empty tables are legitimate, so this reports. EVERY table being empty is not: that is the
  // export path broken rather than the data absent.
  if (empty.length === real.size) {
    throw new Error(
      `every one of the ${real.size} exports contained zero rows. The export path is broken, ` +
        `not the data.`,
    );
  }
  /*
   * AND A FLOOR ON HOW MANY CARRIED ROWS, the check above failing only when every export is empty.
   * This moves with CONTENT, so it is deliberately the loosest floor in the file.
   */
  const withRows = real.size - empty.length;
  if (withRows < 4) {
    throw new Error(
      `only ${withRows} of ${real.size} exports carried any rows, expected at least 4. The ` +
        `all-empty check above passes whenever a single table still exports.`,
    );
  }
  if (empty.length > 0) {
    console.log(`  note: ${empty.length} table(s) exported with no rows: ${empty.join(", ")}`);
  }

  /*
   * THE MEDIA OBJECTS, to the SAME backup root: the mirror bucket answers this site's own code
   * deleting an object and NOTHING about account loss, so this is the only copy outside it. REMOTE
   * ONLY, AND SAID RATHER THAN SKIPPED SILENTLY, `--local` reading a miniflare that holds no
   * objects. THE FLOOR IS THE LIST, NOT A CONSTANT: downloaded against what R2 listed in the call.
   */
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
