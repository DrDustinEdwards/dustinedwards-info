/**
 * Gate: proves the documented backup path RECONSTRUCTS the database.
 *
 *   npm run check:restore
 *
 * OBSERVATION BOUNDARY, and it is the whole reason this file exists beside
 * `check:backup` rather than inside it. That gate proves an export was WRITTEN:
 * its own header says so, "it never restores, so it cannot tell you the dump
 * would reconstruct the database". This one takes the dump the other one
 * produces, builds an empty database from the migrations, loads it, and asks
 * the restored copy the same integrity questions `/api/health` asks production.
 * A dump that exports cleanly and restores to a database that disagrees with
 * production is the failure neither gate could see before this one.
 *
 * ## WHAT IT RESTORES FROM, AND WHY NOT "THE NEWEST BACKUP"
 *
 * There is no backup store. `check:backup` exports to a temp directory per
 * invocation and leaves nothing behind, so there is no newest artifact to
 * restore and no retention to measure. Measured 2026-09-08, and it is the
 * reason this drill takes its OWN export rather than reading one: what can be
 * proven today is that the export-and-restore path round-trips. That is a
 * strictly weaker claim than "the artifact we are keeping is restorable", and
 * it is stated here rather than implied, because a drill that reads a store
 * nobody built would be asserting about nothing.
 *
 * A durable backup job, its R2 key pattern and its retention are a separate
 * decision. When one exists, the export step below is the only part that
 * changes and every assertion after it still holds.
 *
 * ## D1 TIME TRAVEL IS THE OTHER PATH AND CANNOT BE DRILLED HERE
 *
 * Time Travel is on for this database (a bookmark reads back today) and is the
 * first thing to reach for at 2am, which is why `docs/RUNBOOK.md` puts it
 * ahead of this. It restores a database IN PLACE to a bookmark; there is no
 * form of it that targets a different database. So a non-destructive drill
 * cannot exercise it, and no gate here can. The runbook says that in the same
 * words rather than leaving a reader to discover it under load.
 *
 * ## IT NEVER TOUCHES PRODUCTION, AND THAT IS ENFORCED RATHER THAN INTENDED
 *
 * Production is READ from, twice: the per-table export, and the integrity
 * queries, both of which are reads. Every WRITE in this file goes through
 * `scratch()`, which refuses any database name that is not the scratch name
 * this run generated. The guard is a function rather than a convention because
 * the failure it prevents is unrecoverable and would look like a successful
 * drill: a `d1 execute --file` aimed at the wrong name restores production
 * onto itself.
 *
 * The Claude Code hook that blocks a non-SELECT `d1 execute` cannot see inside
 * a node script, so it is NOT what protects production here. `scratch()` is.
 *
 * ## THE SCRATCH DATABASE IS ALWAYS DELETED
 *
 * In a `finally`, so a failed assertion does not leave a database behind, and
 * the deletion is REPORTED rather than assumed: a drill that leaks a database
 * per run is a slow resource leak that no assertion in it would ever notice.
 */

import { readFile, readdir, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

import { assertFloor } from "./lib/floor.mjs";
import { retryRead } from "./lib/retry.mjs";
import { listAllObjects } from "./lib/r2.mjs";
import { classifySqliteTables } from "./lib/sqlite-tables.mjs";

/** The database this drill READS and must never write to. */
const PRODUCTION_DB = "dustinedwards";
const MIGRATIONS_DIR = "drizzle";
const MEDIA_BUCKET = "dustinedwards-media";
const MEDIA_BACKUP_BUCKET = "dustinedwards-media-backup";

/**
 * The scratch database name for this run.
 *
 * Dated rather than random so a leaked database is identifiable by eye in
 * `wrangler d1 list`, and prefixed so the guard below has something to anchor
 * on that production's name can never satisfy.
 */
const SCRATCH_PREFIX = "restore-drill-";
const SCRATCH_DB = `${SCRATCH_PREFIX}${new Date().toISOString().slice(0, 10)}-${process.pid}`;

let checks = 0;
let failures = 0;

/**
 * `ok(label, condition, detail)`, the argument order every gate in this repo
 * uses. A string in the condition slot is always truthy, which is the shape
 * `check:invariants` section 17 refuses and FAILURES.md carries.
 *
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [detail]
 */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
  }
}

/**
 * Runs wrangler as one already-quoted command string.
 *
 * Passing an args array alongside `shell: true` concatenates without quoting,
 * which has split an argument containing a space twice in this repo
 * (FAILURES.md, `spawnSync` with `shell: true`).
 *
 * @param {string} args
 * @returns {{ stdout: string, status: number }}
 */
function wrangler(args) {
  const result = spawnSync(`npx wrangler ${args}`, {
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { stdout: `${result.stdout ?? ""}${result.stderr ?? ""}`, status: result.status ?? 1 };
}

/**
 * The END of wrangler's output, which is where its error is.
 *
 * `stdout.slice(0, 300)` was the first version and it reported the BANNER on
 * every failure: the version line, the resource location and the "to execute
 * locally" hint, three hundred characters of it, with the actual SQLite error
 * below the cut. A failure detail that cannot carry the failure is the same
 * class as an assertion that cannot fail.
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
 * THE GUARD. Returns the scratch name, or throws rather than returning a name
 * that could reach production.
 *
 * Every write path in this file calls this instead of naming a database, so
 * there is exactly one place where a write can learn what to aim at. It checks
 * both directions: the name must carry the scratch prefix AND must not be
 * production's. The second half is redundant today and is kept because the
 * first half's correctness depends on a constant somebody could edit.
 *
 * @param {string} name
 * @returns {string}
 */
function scratch(name) {
  if (name === PRODUCTION_DB) {
    throw new Error(
      `refusing to write to ${name}: this drill only ever reads production. ` +
        `Every write goes to the scratch database.`,
    );
  }
  if (!name.startsWith(SCRATCH_PREFIX)) {
    throw new Error(
      `refusing to write to ${JSON.stringify(name)}: it does not carry the ` +
        `${JSON.stringify(SCRATCH_PREFIX)} prefix, so it is not a database this run created.`,
    );
  }
  return name;
}

/**
 * Runs one SELECT and returns its rows.
 *
 * `--json` rather than parsing the table wrangler prints, because that table
 * is a display format and has changed shape between wrangler versions.
 *
 * @param {string} db
 * @param {string} sql must be a SELECT; nothing here writes
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function query(db, sql) {
  const result = await retryRead(
    () => {
      const r = wrangler(`d1 execute ${db} --remote --json --command "${sql}"`);
      if (r.status !== 0) throw new Error((r.stdout || "no output").slice(0, 300));
      return r;
    },
    { label: `check:restore query (${db})` },
  );
  /*
   * The JSON is preceded by wrangler's banner, so the payload is located by its
   * first `[` rather than by parsing the whole stream. A banner that changes
   * shape then costs nothing, where `JSON.parse(stdout)` would fail on it.
   */
  const start = result.stdout.indexOf("[");
  if (start === -1) throw new Error(`no JSON in wrangler output for: ${sql}`);
  const parsed = JSON.parse(result.stdout.slice(start));
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results ?? [];
}

/**
 * The migration files, in apply order.
 *
 * `wrangler d1 migrations apply` CANNOT be used against the scratch database
 * and this is not a preference. Measured 2026-09-08 in the installed wrangler:
 * that subcommand resolves `migrations_dir` out of the d1_databases entry whose
 * name or binding matches, and refuses with "Couldn't find a D1 DB with the
 * name or binding" for anything absent from the config file. A database created
 * at runtime is absent by construction, and adding it would mean writing to
 * `wrangler.jsonc`, which is gitignored and is not this gate's to edit.
 *
 * So the files are applied directly, in sorted order, which is the same order
 * and the same bytes the migrations runner would have used. The one thing that
 * is lost is the `d1_migrations` bookkeeping table, which is why the integrity
 * query does not compare it: it would be 0 against production's row per file,
 * and "fixing" that with a hand INSERT would write a second truth into a
 * derived store (hard rule 18). What replaces it is the SCHEMA comparison
 * below, which is the assertion the row count was standing in for anyway.
 *
 * @returns {Promise<string[]>}
 */
async function migrationFiles() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  if (files.length === 0) throw new Error(`no migration files in ${MIGRATIONS_DIR}/`);
  return files;
}

/**
 * The tables the migrations create, minus the fts5 virtual tables.
 *
 * DERIVED from `drizzle/`, never hardcoded, for the reason `check:backup`
 * states: a hardcoded list that silently stops covering a new table is the
 * exact failure a backup gate exists to catch, and it has happened in this
 * portfolio.
 *
 * @returns {Promise<string[]>}
 */
/**
 * The tables in DEPENDENCY ORDER, parents before children.
 *
 * ## WHY ORDER, WHEN THE EXPORT ALREADY DEFERS FOREIGN KEYS
 *
 * Every file `wrangler d1 export` writes opens with its own
 * `PRAGMA defer_foreign_keys=TRUE`, so the obvious reading is that order does
 * not matter. It does, and this cost two full drill runs to see.
 *
 * MEASURED 2026-09-08. Alphabetical order failed on `account` and `post_tags`,
 * which are exactly the two tables whose parents (`user`, `posts` and `tags`)
 * sort after them. Concatenating everything into one file with the PRAGMA at
 * the top then failed differently: D1 reported "the application left the
 * database in a state where constraints were violated" and rolled the whole
 * thing back, with production carrying ZERO orphans in all three relations,
 * confirmed by a LEFT JOIN count per relation.
 *
 * `defer_foreign_keys` is reset at every COMMIT, and `d1 execute --file`
 * batches a file across more than one transaction. So the deferral only ever
 * covers one batch, and a child that lands in an earlier batch than its parent
 * fails whatever the PRAGMA says. Order is the thing that actually works, and
 * it is the instruction `docs/RUNBOOK.md` gives a human for the same reason.
 *
 * ## DERIVED, NOT LISTED
 *
 * The edges are parsed out of the `REFERENCES` clauses in `drizzle/`. A
 * hardcoded order would be correct today and silently wrong the first time a
 * migration adds a relation, which is the same failure mode `check:backup`
 * refuses for its table list.
 *
 * @returns {Promise<string[]>}
 */
async function orderedTables() {
  const files = await migrationFiles();
  const tables = await migrationTables();
  /** @type {Map<string, Set<string>>} */
  const parents = new Map(tables.map((t) => [t, new Set()]));

  for (const file of files) {
    const sql = (await readFile(path.join(MIGRATIONS_DIR, file), "utf8")).replace(
      /^\s*--.*$/gm,
      "",
    );
    for (const block of sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\n\s*\)\s*;/gi,
    )) {
      const child = block[1];
      if (!parents.has(child)) continue;
      for (const ref of block[2].matchAll(/REFERENCES\s+["`]?(\w+)["`]?/gi)) {
        if (ref[1] !== child && parents.has(ref[1])) parents.get(child)?.add(ref[1]);
      }
    }
  }

  /*
   * A NON-EMPTY EDGE SET IS ASSERTED BY THE CALLER, not here, because this
   * function's failure mode is a silent zero: a regex that stops matching the
   * CREATE TABLE shape returns every table with no parents, which sorts
   * alphabetically and reproduces the exact defect this exists to fix.
   */
  /** @type {string[]} */
  const order = [];
  const placed = new Set();
  /** @param {string} table @param {Set<string>} seen */
  const visit = (table, seen) => {
    if (placed.has(table) || seen.has(table)) return;
    seen.add(table);
    for (const parent of [...(parents.get(table) ?? [])].sort()) visit(parent, seen);
    placed.add(table);
    order.push(table);
  };
  for (const table of tables) visit(table, new Set());
  return order;
}

/** How many parent edges `orderedTables` found, for the caller's scope check. */
async function referenceCount() {
  const files = await migrationFiles();
  let edges = 0;
  for (const file of files) {
    const sql = (await readFile(path.join(MIGRATIONS_DIR, file), "utf8")).replace(
      /^\s*--.*$/gm,
      "",
    );
    edges += [...sql.matchAll(/REFERENCES\s+["`]?\w+["`]?/gi)].length;
  }
  return edges;
}

async function migrationTables() {
  const files = await migrationFiles();
  /** @type {Set<string>} */
  const tables = new Set();
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const live = sql.replace(/^\s*--.*$/gm, "");
    for (const m of live.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/gi)) {
      tables.add(m[1]);
    }
    for (const m of live.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/gi)) {
      tables.delete(m[1]);
    }
  }
  if (tables.size === 0) throw new Error("parsed zero tables out of the migrations");
  return [...tables].sort();
}

/**
 * The integrity questions, IN THE SPELLING `/api/health` USES.
 *
 * The three index counts are taken on the `_docsize` shadow tables, because
 * `COUNT(*)` on an external-content fts5 table reads through to its content
 * table and can never disagree with it. That is `check:invariants` section 7's
 * rule and the reason `app/lib/health/checks.server.ts` is written this way; a
 * drill that counted the virtual tables directly would compare two numbers that
 * are the same number by construction and pass on a broken index.
 */
const INTEGRITY_SQL =
  "SELECT (SELECT COUNT(*) FROM posts) AS posts, " +
  "(SELECT COUNT(*) FROM posts_fts_docsize) AS postsFts, " +
  "(SELECT COUNT(*) FROM search_docs) AS docs, " +
  "(SELECT COUNT(*) FROM search_identity_docsize) AS identity, " +
  "(SELECT COUNT(*) FROM search_prose_docsize) AS prose";

/**
 * Every table SQLite itself knows about, for the schema comparison.
 *
 * `sqlite_master` rather than a name list, and the DDL comes with it so
 * `classifySqliteTables` can separate virtual tables from their shadows by the
 * rule rather than by a suffix list that differs across fts5 versions.
 */
const SCHEMA_SQL = "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name";

/**
 * Tables D1 and wrangler create for their own bookkeeping. Not ours, no
 * migration declares them, and they are not part of a content restore. The
 * same set `check:backup` excludes, and `d1_migrations` is in it here for the
 * additional reason given on `migrationFiles`.
 */
const PLATFORM_TABLES = new Set(["_cf_KV", "sqlite_sequence", "d1_migrations", "_cf_METADATA"]);

async function main() {
  console.log(`check:restore against ${PRODUCTION_DB}, scratch ${SCRATCH_DB}\n`);

  const dir = path.join(os.tmpdir(), `dustinedwards-restore-drill-${process.pid}`);
  await mkdir(dir, { recursive: true });

  /*
   * SWEEP FIRST. The `finally` below deletes this run's database, and a
   * `finally` does not run on a hard kill.
   *
   * MEASURED, twice, while building this gate: killing the drill mid-run left
   * `restore-drill-2026-09-08-16944` and `restore-drill-2026-09-08-788` behind,
   * and nothing in the drill would ever have noticed. That is the same shape as
   * the queued `check:browser` child-cleanup item: cleanup that only exists on
   * the happy path is cleanup that accumulates.
   *
   * Only databases carrying the prefix, and only ones older than the window, so
   * a concurrent run cannot delete the database another run is using. The count
   * is REPORTED rather than silent: a sweep that is quietly removing something
   * every week is a leak nobody is fixing.
   */
  const SWEEP_AFTER_MS = 2 * 60 * 60 * 1000;
  const listed = wrangler("d1 list --json");
  if (listed.status === 0) {
    const start = listed.stdout.indexOf("[");
    /** @type {Array<{ name?: string, created_at?: string }>} */
    const databases = start === -1 ? [] : JSON.parse(listed.stdout.slice(start));
    const stale = databases.filter(
      (d) =>
        typeof d.name === "string" &&
        d.name.startsWith(SCRATCH_PREFIX) &&
        d.name !== SCRATCH_DB &&
        Date.now() - Date.parse(d.created_at ?? "") > SWEEP_AFTER_MS,
    );
    for (const old of stale) {
      wrangler(`d1 delete ${scratch(String(old.name))} --skip-confirmation`);
    }
    if (stale.length > 0) {
      console.log(
        `  swept ${stale.length} leaked scratch database(s): ` +
          `${stale.map((d) => d.name).join(", ")}`,
      );
    }
  }

  let created = false;
  const started = Date.now();
  /** @type {Record<string, number>} */
  const timings = {};

  try {
    /* ---- 1. the export, from production, READ ONLY ---------------------- */

    const tables = await orderedTables();
    ok(
      "[scope] the migrations name at least one table to restore",
      tables.length > 0,
      "a zero-table export would restore an empty database and every count " +
        "comparison below would compare 0 against 0 and pass.",
    );

    /*
     * THE EDGE PARSE IS PROVEN NON-EMPTY, because its failure is a silent
     * alphabetical fallback. A `REFERENCES` regex that stops matching returns
     * every table with no parents, `orderedTables` then emits them in the
     * order `migrationTables` found them, and the load fails exactly the way
     * it failed before the ordering existed. This repo has shipped that shape:
     * a zero from a search proves nothing until the scope is proven non-empty.
     */
    const edges = await referenceCount();
    ok(
      "[scope] the migrations parse to at least one foreign key",
      edges > 0,
      "found no REFERENCES clauses in drizzle/. Either the schema genuinely " +
        "has no relations, in which case delete this assertion, or the parse " +
        "broke and the load order below is alphabetical again.",
    );
    console.log(`  load order (${edges} reference(s)): ${tables.join(", ")}`);

    const exportStart = Date.now();
    /** @type {Array<{ name: string, inserts: number }>} */
    const dumps = [];
    for (const table of tables) {
      const out = path.join(dir, `${table}.sql`);
      const exported = await retryRead(
        () => {
          const r = wrangler(
            `d1 export ${PRODUCTION_DB} --remote --no-schema --table ${table} --output "${out}"`,
          );
          if (r.status !== 0) throw new Error((r.stdout || "no output").slice(0, 300));
          return r;
        },
        { label: `check:restore export (${table})` },
      );
      if (exported.status !== 0) throw new Error(`per-table export failed for ${table}`);
      const body = await readFile(out, "utf8");
      dumps.push({ name: table, inserts: (body.match(/^INSERT INTO/gim) ?? []).length });
    }
    timings.export = Date.now() - exportStart;
    /*
     * PROGRESS, because this gate is minutes of network round trips and the
     * first version printed nothing between its banner and its first failure.
     * A long silence is indistinguishable from a hang, and the reader's only
     * recourse was to go and look in `wrangler d1 list`.
     */
    console.log(
      `  exported ${dumps.length} table(s) from ${PRODUCTION_DB} in ${timings.export}ms`,
    );

    ok(
      "[scope] the export produced a file for every table the migrations declare",
      dumps.length === tables.length,
      `exported ${dumps.length} of ${tables.length}. A restore from a partial ` +
        `export reconstructs a partial database, and the count comparisons ` +
        `below would then be measuring the wrong thing.`,
    );

    /* ---- 2. production's own answers, READ ONLY -------------------------- */

    const [live] = await query(PRODUCTION_DB, INTEGRITY_SQL);
    ok(
      "production answers the integrity query",
      live !== undefined && typeof live.posts === "number",
      `read ${JSON.stringify(live)}. Every comparison below is against these ` +
        `numbers, so an unreadable production row makes the drill vacuous ` +
        `rather than failing.`,
    );
    if (live === undefined) throw new Error("production integrity query returned no row");

    /* ---- 3. build the scratch database ---------------------------------- */

    const restoreStart = Date.now();
    const create = wrangler(`d1 create ${scratch(SCRATCH_DB)}`);
    ok(
      "the scratch database is created",
      create.status === 0,
      `wrangler d1 create exited ${create.status}: ${tail(create.stdout)}`,
    );
    if (create.status !== 0) throw new Error("could not create the scratch database");
    created = true;

    const files = await migrationFiles();
    let applied = 0;
    for (const file of files) {
      const full = path.join(MIGRATIONS_DIR, file);
      const run = wrangler(`d1 execute ${scratch(SCRATCH_DB)} --remote --yes --file "${full}"`);
      ok(
        `migration ${file} applies to an empty database`,
        run.status === 0,
        `wrangler d1 execute exited ${run.status}: ${tail(run.stdout)}. The ` +
          `schema half of a restore is the migrations; if one does not apply ` +
          `cleanly there is nothing to load into.`,
      );
      if (run.status === 0) applied += 1;
    }
    ok(
      "[scope] every migration file was applied",
      applied === files.length,
      `applied ${applied} of ${files.length}. A partial schema makes every ` +
        `comparison below a statement about a database that was never built.`,
    );

    /* ---- 3a. a migrated database is NOT an empty one --------------------- */

    /*
     * MIGRATIONS SEED, AND A SEED COLLIDES WITH A RESTORE.
     *
     * MEASURED 2026-09-08, on the run after the load order was fixed:
     * "UNIQUE constraint failed: settings.key". `drizzle/0001_init.sql` inserts
     * a `settings` row, so applying the migrations leaves a database that is
     * schema-correct and already carries data. The dump then tries to insert
     * the same primary key and the whole transaction rolls back.
     *
     * This is not an artefact of the drill. It is what happens to a human
     * following the restore steps, and it presents as "the backup is corrupt"
     * rather than as "the schema step seeded a row". `docs/RUNBOOK.md` carries
     * the same clearing step for the same reason.
     *
     * REVERSE dependency order, so a child is emptied before its parent and no
     * delete trips a foreign key.
     *
     * ONLY REAL TABLES. `orderedTables` is built from `CREATE TABLE`, which
     * does not match `CREATE VIRTUAL TABLE`, so no fts5 index can reach this
     * list. That matters: hard rule 2 forbids `DELETE FROM` against an index,
     * and the repair there is `('rebuild')`, which step 4 does.
     */
    const clear = wrangler(
      `d1 execute ${scratch(SCRATCH_DB)} --remote --yes --command ` +
        `"${[...tables].reverse().map((t) => `DELETE FROM \\"${t}\\";`).join(" ")}"`,
    );
    ok(
      "the migrated database is emptied before the restore",
      clear.status === 0,
      `wrangler d1 execute exited ${clear.status}: ${tail(clear.stdout)}. A ` +
        `migration seeds settings, so a restore into a freshly migrated database ` +
        `collides on that row unless the seed is cleared first.`,
    );

    /* ---- 4. load the dump ------------------------------------------------ */

    /*
     * ONE FILE, WITH FOREIGN KEYS DEFERRED, and both halves were measured
     * rather than chosen.
     *
     * The first version of this drill loaded one file per table in the sorted
     * order the export produced. `account` and `post_tags` both failed, and
     * they are exactly the two tables with a parent: `account` references
     * `user` and `post_tags` references `posts`, and both parents sort AFTER
     * their child. A per-table restore is therefore order-dependent in a way
     * that alphabetical order gets wrong, which is a defect in the RUNBOOK's
     * instructions as much as in this gate.
     *
     * `PRAGMA defer_foreign_keys = true` holds enforcement until the end of
     * the transaction, so the whole set lands and the constraints are checked
     * once everything is present. That is what makes the order irrelevant, and
     * it is a real restore rather than a restore with the checks turned off:
     * a genuinely broken reference still fails at commit.
     *
     * `docs/RUNBOOK.md` documents THIS path, not the per-table one, because
     * this is the path that has been rehearsed.
     */
    const combined = path.join(dir, "_restore.sql");
    /** @type {string[]} */
    const bodies = [];
    let loaded = 0;
    /* `dumps` is in `orderedTables` order, so parents are already written first. */
    for (const dump of dumps) {
      if (dump.inserts === 0) continue;
      bodies.push(await readFile(path.join(dir, `${dump.name}.sql`), "utf8"));
      loaded += 1;
    }
    await writeFile(combined, `${bodies.join("\n")}\n`, "utf8");

    const load = wrangler(`d1 execute ${scratch(SCRATCH_DB)} --remote --yes --file "${combined}"`);
    ok(
      "THE WHOLE DUMP LOADS INTO THE RESTORED DATABASE",
      load.status === 0,
      `wrangler d1 execute exited ${load.status}: ${tail(load.stdout)}. The ${loaded} ` +
        `table(s) with rows are written parents first, so a foreign key failure ` +
        `here is a genuinely broken reference rather than a load order.`,
    );

    /*
     * THE INDEXES ARE REBUILT, NOT RESTORED. Hard rule 2: an fts5 virtual table
     * cannot be exported, and the repair is `('rebuild')` rather than a
     * `DELETE FROM`. So the restore's index half is a derivation from the
     * content tables, which is also what makes the equality assertions below
     * meaningful: they compare a rebuilt index against restored content.
     */
    const rebuild = wrangler(
      `d1 execute ${scratch(SCRATCH_DB)} --remote --yes --command ` +
        `"INSERT INTO posts_fts (posts_fts) VALUES ('rebuild'); ` +
        `INSERT INTO search_identity (search_identity) VALUES ('rebuild'); ` +
        `INSERT INTO search_prose (search_prose) VALUES ('rebuild');"`,
    );
    ok(
      "the three FTS indexes rebuild on the restored database",
      rebuild.status === 0,
      `wrangler d1 execute exited ${rebuild.status}: ${tail(rebuild.stdout)}. ` +
        `Hard rule 2: the repair is ('rebuild'), never DELETE FROM.`,
    );
    timings.restore = Date.now() - restoreStart;

    ok(
      "[scope] the restore loaded at least one table",
      loaded > 0,
      `loaded ${loaded} table(s). Every comparison below would otherwise be ` +
        `against an empty database, and an empty database that happens to match ` +
        `an empty production would report a clean restore of nothing.`,
    );

    /* ---- 5. the restored database answers the same questions ------------- */

    const [restored] = await query(scratch(SCRATCH_DB), INTEGRITY_SQL);
    ok(
      "the restored database answers the integrity query",
      restored !== undefined && typeof restored.posts === "number",
      `read ${JSON.stringify(restored)}. A restore that cannot be queried is ` +
        `not a restore, and the comparisons below need both sides.`,
    );

    if (restored !== undefined) {
      /*
       * ONE NAMED ASSERTION PER COLUMN, rather than one deep-equal over the
       * row. A single "the rows match" assertion fails with both objects
       * printed and leaves the reader to diff them at 2am; these fail by the
       * name of the thing that disagreed, which is what the prompt for this
       * gate asked for and what makes a red run actionable.
       */
      const COLUMNS = /** @type {const} */ ([
        ["posts", "the post count"],
        ["docs", "the search_docs count"],
      ]);
      for (const [column, human] of COLUMNS) {
        ok(
          `RESTORED ${human} MATCHES PRODUCTION`,
          restored[column] === live[column],
          `restored ${JSON.stringify(restored[column])}, production ` +
            `${JSON.stringify(live[column])}. The dump did not reconstruct this ` +
            `table, so the documented backup path does not restore the database.`,
        );
      }

      /*
       * THE INDEX EQUALITIES ARE ASSERTED WITHIN THE RESTORED DATABASE, not
       * against production. Production's own equality is `/api/health`'s job
       * and is checked every fifteen minutes; what this drill can say that
       * nothing else can is whether a REBUILD over RESTORED content produces
       * an index that agrees with it.
       */
      ok(
        "RESTORED posts_fts EQUALS RESTORED posts",
        restored.postsFts === restored.posts,
        `posts_fts_docsize ${JSON.stringify(restored.postsFts)} against posts ` +
          `${JSON.stringify(restored.posts)}. The rebuild did not take on the ` +
          `restored content, so a restored site would search a partial corpus.`,
      );
      for (const index of /** @type {const} */ (["identity", "prose"])) {
        ok(
          `RESTORED search_${index} EQUALS RESTORED search_docs`,
          restored[index] === restored.docs,
          `search_${index}_docsize ${JSON.stringify(restored[index])} against ` +
            `search_docs ${JSON.stringify(restored.docs)}. The rebuild did not ` +
            `take, so search would answer from a partial index after a restore.`,
        );
      }
    }

    /* ---- 5a. the SCHEMA, both sides ------------------------------------- */

    /*
     * THE ASSERTION `d1_migrations` WAS STANDING IN FOR, made directly.
     *
     * RECOVERY.md records this comparison as a DATED observation: "measured
     * 2026-08-04 by applying every migration then present to an empty database
     * and diffing object by object against the live schema. 57 of 57 matched."
     * Its own next sentence says two migrations have landed since, so it is a
     * record and not a current claim. This makes it re-runnable, which is what
     * hard rule 17 asks of any number somebody wants to keep believing.
     *
     * Both sides are classified by the same function, so a virtual table and
     * its shadows are separated by the DDL rather than by a suffix list, and
     * the platform's own bookkeeping is excluded from both sides identically.
     */
    const classify = (/** @type {Array<Record<string, unknown>>} */ rows) => {
      const typed = rows.map((r) => ({ name: String(r.name), sql: r.sql ? String(r.sql) : null }));
      const { real, virtual } = classifySqliteTables(typed);
      return {
        real: real.filter((n) => !PLATFORM_TABLES.has(n)),
        virtual: virtual.filter((n) => !PLATFORM_TABLES.has(n)),
      };
    };
    const liveSchema = classify(await query(PRODUCTION_DB, SCHEMA_SQL));
    const restoredSchema = classify(await query(scratch(SCRATCH_DB), SCHEMA_SQL));

    ok(
      "[scope] production reports a non-empty schema",
      liveSchema.real.length > 0,
      `sqlite_master returned no real tables for ${PRODUCTION_DB}. Comparing two ` +
        `empty lists reports what a matching schema reports.`,
    );
    ok(
      "THE RESTORED SCHEMA MATCHES PRODUCTION, table for table",
      liveSchema.real.join(",") === restoredSchema.real.join(","),
      `restored [${restoredSchema.real.join(", ")}] against production ` +
        `[${liveSchema.real.join(", ")}]. A migration that no longer reproduces ` +
        `the live schema means the rebuild path in RECOVERY.md does not land ` +
        `where production is.`,
    );
    ok(
      "THE RESTORED FTS TABLES MATCH PRODUCTION",
      liveSchema.virtual.join(",") === restoredSchema.virtual.join(","),
      `restored [${restoredSchema.virtual.join(", ")}] against production ` +
        `[${liveSchema.virtual.join(", ")}]. Search is rebuilt from these, so a ` +
        `missing index is a restored site whose search answers nothing.`,
    );

    console.log(
      `  restored ${restored?.posts ?? "?"} post(s), ${restored?.docs ?? "?"} search doc(s), ` +
        `${restoredSchema.real.length} table(s), ${restoredSchema.virtual.length} FTS index(es)`,
    );

    /* ---- 6. the media mirror, EVERY key -------------------------------- */

    /*
     * EVERY KEY, NOT A SAMPLE.
     *
     * The prompt for this gate asked for a random sample of 20 keys with
     * matching etags. Measured 2026-09-08: `dustinedwards-media` holds ONE
     * object. A sample of 20 drawn from a population of 1 is the zero-scope
     * vacuity hard rule 10 forbids, and it would report a plausible number
     * having verified one object. It is also strictly weaker than what already
     * runs: `media-backup-drift` compares both key sets and every etag in full
     * on every health poll, and `app/lib/media/backup.server.ts` owns that
     * comparison rule. This reads the same two buckets from outside the Worker,
     * so the mirror is asserted by something that is not the thing maintaining
     * it, and it counts what it examined so a zero cannot read as a sweep.
     */
    const [sources, twins] = await Promise.all([
      retryRead(() => listAllObjects({ bucket: MEDIA_BUCKET, remote: true }), {
        label: "check:restore MEDIA list",
      }),
      retryRead(() => listAllObjects({ bucket: MEDIA_BACKUP_BUCKET, remote: true }), {
        label: "check:restore MEDIA_BACKUP list",
      }),
    ]);
    const twinByKey = new Map(twins.map((o) => [o.key, o]));
    /** @type {string[]} */
    const unbacked = [];
    for (const source of sources) {
      const twin = twinByKey.get(source.key);
      if (!twin) {
        unbacked.push(`${source.key} (no twin)`);
        continue;
      }
      /*
       * ETAG, corroborated by SIZE, and degrading to size for a multipart
       * etag. The same rule `backup.server.ts` states, restated here only
       * because this runs outside the Worker and cannot import it; the reason
       * lives there and is not duplicated.
       */
      const multipart = source.etag.includes("-") || twin.etag.includes("-");
      const identical = multipart
        ? source.size === twin.size
        : source.etag === twin.etag && source.size === twin.size;
      if (!identical) {
        unbacked.push(
          `${source.key} (${multipart ? "size" : "etag"} differs: ` +
            `${source.size}/${source.etag} against ${twin.size}/${twin.etag})`,
        );
      }
    }
    ok(
      "EVERY MEDIA OBJECT HAS AN IDENTICAL TWIN IN MEDIA_BACKUP",
      unbacked.length === 0,
      `${unbacked.length} of ${sources.length}: ${unbacked.slice(0, 5).join("; ")}. ` +
        `The mirror is the only thing standing between this site's own delete ` +
        `paths and an unrecoverable object.`,
    );
    console.log(
      `  media: ${sources.length} object(s) in ${MEDIA_BUCKET}, ${twins.length} in ` +
        `${MEDIA_BACKUP_BUCKET}, ${sources.length - unbacked.length} identical` +
        (sources.length === 0 ? " (the bucket is empty, so this verified nothing)" : ""),
    );
  } finally {
    /* ---- 7. the scratch database always goes away ---------------------- */

    if (created) {
      const dropped = wrangler(`d1 delete ${scratch(SCRATCH_DB)} --skip-confirmation`);
      ok(
        "THE SCRATCH DATABASE IS DELETED",
        dropped.status === 0,
        `wrangler d1 delete exited ${dropped.status}: ${tail(dropped.stdout)}. ` +
          `A drill that leaks a database per run is a resource leak no other ` +
          `assertion here would ever notice. Delete ${SCRATCH_DB} by hand.`,
      );
    }
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  timings.total = Date.now() - started;

  /*
   * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed: 35
   * on the first fully green run, 2026-09-08. Floor 32, which is the count
   * minus the `check:floors` tolerance at that count.
   *
   * The count moves with the number of MIGRATION FILES, since each one is its
   * own assertion, and that only ever goes up. It does NOT move with the table
   * list any more: the load is one assertion over one combined file rather
   * than one per table, which is why the first two runs read 42 and 33.
   */
  const MINIMUM_CHECKS = 32;
  const breach = assertFloor("check:restore", "checks", checks, MINIMUM_CHECKS);
  if (breach) ok("[scope] this gate executed its assertions", false, breach);

  console.log(
    `\n  timings: export ${timings.export ?? 0}ms, restore ${timings.restore ?? 0}ms, ` +
      `total ${timings.total}ms`,
  );
  console.log(`${checks} checks, ${failures} failures\n`);

  /*
   * `exitCode` rather than `process.exit()`, on check:uptime's measurement:
   * `process.exit()` tears the process down while libuv still holds queued
   * stdout writes on Windows and the gate exits 127 with its output lost.
   */
  process.exitCode = failures > 0 ? 1 : 0;
}

await main().catch((/** @type {unknown} */ error) => {
  console.error(`check:restore failed. ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
