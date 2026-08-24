/**
 * Verifies the per-table backup path against the live schema.
 *
 * OBSERVATION BOUNDARY: proves the export PATH works and that the table list
 * matches the migrations. It never restores, so it cannot tell you the dump
 * would reconstruct the database, and --local reads miniflare state rather than
 * production.
 *
 *   npm run check:backup -- --local
 *   npm run check:backup -- --remote
 *
 * `wrangler d1 export` does not work on this database. It refuses outright
 * while any fts5 virtual table exists, which is permanent: search needs them.
 * The documented backup path is therefore per table, `--no-schema --table`,
 * and this script is what keeps that claim honest.
 *
 * The table list is DERIVED, never hardcoded. `drizzle/` is the source of truth
 * for schema, so the expected set is parsed out of the migration files and
 * compared with what the database actually holds. It fails in both directions:
 * a table in the migrations but missing from the database, and a table in the
 * database that no migration created. A backup list that silently stops
 * covering a new table is the exact failure this guards, and it has happened
 * before in this portfolio (capsid `document_links`, missing for nine days
 * while backups ran green).
 *
 * Every export is then checked for real rows rather than mere existence. An
 * empty file is a passing export of nothing, which is the failure mode that
 * looks most like success.
 */

import { readFile, readdir, mkdir, stat } from "node:fs/promises";
import { classifySqliteTables } from "./lib/sqlite-tables.mjs";
import { retryRead } from "./lib/retry.mjs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const DB_NAME = "dustinedwards";
const MIGRATIONS_DIR = "drizzle";

/**
 * Tables D1 and wrangler create for their own bookkeeping. They are not ours,
 * no migration declares them, and they are not part of a content restore.
 */
const PLATFORM_TABLES = new Set([
  "_cf_KV",
  "sqlite_sequence",
  "d1_migrations",
  // Local only. Miniflare creates it; remote D1 does not have it. Found by this
  // script failing on --local after it had already passed on --remote, which is
  // the reason both targets are worth running.
  "_cf_METADATA",
]);

/**
 * Runs wrangler as one already-quoted command string. Passing an args array
 * alongside shell:true concatenates without quoting, which has split an
 * argument containing a space twice in this repo.
 *
 * @param {string} args
 * @returns {{ stdout: string, status: number }}
 */
function wrangler(args) {
  const result = spawnSync(`npx wrangler ${args}`, { encoding: "utf8", shell: true });
  return { stdout: `${result.stdout ?? ""}${result.stderr ?? ""}`, status: result.status ?? 1 };
}

/**
 * Parses table names out of the migration files.
 *
 * Virtual tables are deliberately excluded: they cannot be exported, they are
 * rebuilt from their content table, and including them would make the expected
 * set disagree with the exportable set by construction.
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
 * Reads the tables the database actually holds, minus platform bookkeeping and
 * minus every fts5 virtual table and its shadow tables.
 *
 * Shadow tables are found by prefix against the virtual table names rather than
 * by a hardcoded `_data`/`_idx` suffix list, so a future fts5 table brings its
 * own shadows along without this script needing an edit.
 *
 * @param {string} target
 * @returns {Promise<{ real: Set<string>, virtual: Set<string>, shadow: Set<string> }>}
 */
async function actualTables(target) {
  /*
   * RETRIED ONCE. This exact read died with SQLITE_CANTOPEN on 2026-08-05 and
   * again on 2026-08-11, both times clean on an immediate retry. The per-table
   * export below is wrapped too, since 2026-08-11; nothing that WRITES is.
   */
  const result = await retryRead(
    () => {
      const r = wrangler(
        `d1 execute ${DB_NAME} ${target} --json --command ` +
          `"SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name;"`,
      );
      // A non-zero status is the failure here, not a throw, so it is raised
      // deliberately: retryRead can only see a rejection.
      if (r.status !== 0) throw new Error((r.stdout || "no output").slice(0, 200));
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
   * Classified by scripts/lib/sqlite-tables.mjs since 2026-08-10, the same
   * module check:invariants sections 4, 5 and 7 read. The rules here and there
   * were already identical, and the comment above this function said so; one
   * module makes that a fact rather than a coincidence that held twice.
   *
   * PLATFORM_TABLES stays HERE. It is a property of where these rows came from,
   * a live D1 carrying Cloudflare bookkeeping, not a property of SQLite, so the
   * shared classifier does not know about it and should not.
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
  console.log(`check:backup verifying the per-table export path against ${target.slice(2)} D1`);

  const expected = await expectedTables();
  const { real, virtual, shadow } = await actualTables(target);

  console.log(`  migrations declare ${expected.size}: ${sorted(expected).join(", ")}`);
  console.log(`  database holds     ${real.size}: ${sorted(real).join(", ")}`);
  console.log(`  fts5 virtual       ${virtual.size}: ${sorted(virtual).join(", ")}`);
  console.log(`  fts5 shadow        ${shadow.size}: ${sorted(shadow).join(", ")}`);

  /** @type {string[]} */
  const problems = [];

  /*
   * SCOPE FLOORS, added by the 2026-08-24 floor sweep. This gate had NO floor
   * of any kind, and it is the one that decides whether this database can be
   * recovered at all.
   *
   * The two comparison loops below are BOTH DIRECTIONS between two independent
   * sources, which is a strong shape and has one blind spot: it is satisfied by
   * the two sources shrinking TOGETHER. If the migration parser stops matching
   * `CREATE TABLE` and the sqlite_master filter over-excludes in the same edit,
   * both sets go small, every loop agrees, the export writes the handful that
   * survived, and the run reports "ok" with a table count nobody floors.
   *
   * MEASURED THROUGH THIS GATE 2026-08-24 by running it BOTH WAYS, because the
   * offline tier runs --local and check:all runs --remote: local and remote
   * agree on every structural count (11 declared, 11 held, 3 virtual, 12
   * shadow) and differ only in bytes, which is why the floors are on structure
   * and not on size. A byte floor would be a floor on how much has been
   * written, which is content, and it would read differently on the two targets.
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
  for (const name of sorted(real)) {
    const out = path.join(dir, `${name}.sql`);
    /*
     * RETRIED ONCE, since 2026-08-11. This file's header used to say the export
     * was deliberately unwrapped, and the pre-audit sweep's `check:all` failed
     * right here: "per-table export failed for post_tags", clean on an
     * immediate re-run. That is the SIXTH instance of the transient Cloudflare
     * read class and the first to land outside retryRead's coverage.
     *
     * An export is a READ. It pulls rows and writes a LOCAL temp file, so a
     * second attempt overwrites its own output and lands nowhere else. Nothing
     * that writes to D1 or R2 is wrapped, and that stays true.
     *
     * The throw is load-bearing: wrangler RETURNS on a failed command rather
     * than rejecting, so without it retryRead has nothing to catch.
     */
    const exported = await retryRead(
      () => {
        const r = wrangler(
          `d1 export ${DB_NAME} ${target} --no-schema --table ${name} --output "${out}"`,
        );
        if (r.status !== 0) throw new Error((r.stdout || "no output").slice(0, 200));
        return r;
      },
      { label: `check:backup per-table export (${name}, ${target})` },
    );
    if (exported.status !== 0) {
      console.error(exported.stdout);
      throw new Error(`per-table export failed for ${name}`);
    }
    const body = await readFile(out, "utf8");
    const bytes = (await stat(out)).size;
    totalBytes += bytes;
    // An export that wrote a file but no INSERTs is a pass that backed up
    // nothing. Count the statements, do not just check the file exists.
    const inserts = (body.match(/^INSERT INTO/gim) ?? []).length;
    console.log(`  ${name}: ${bytes} bytes, ${inserts} INSERT statement(s)`);
    if (inserts === 0) empty.push(name);
  }

  // Empty tables are legitimate (nothing has been written yet), so this reports
  // rather than fails. What would NOT be legitimate is every table being empty,
  // which means the export path is broken rather than the data being absent.
  if (empty.length === real.size) {
    throw new Error(
      `every one of the ${real.size} exports contained zero rows. The export path is broken, ` +
        `not the data.`,
    );
  }
  /*
   * AND A FLOOR ON HOW MANY CARRIED ROWS, because the check above is the
   * weakest form of this test: it fails only when EVERY export is empty, so an
   * export path that broke for all but one table reads as a pass.
   *
   * MEASURED BOTH WAYS 2026-08-24: 5 tables carry rows (post_tags, posts,
   * search_docs, settings, tags), local and remote alike. The other six are
   * legitimately empty. Floored one under, and this one moves with CONTENT
   * rather than schema, so it is deliberately the loosest floor in the file.
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

  console.log(
    `check:backup ok. ${real.size} table(s), ${totalBytes} bytes total, written under ${dir}`,
  );
}

main().catch((/** @type {unknown} */ error) => {
  console.error(`check:backup failed. ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
