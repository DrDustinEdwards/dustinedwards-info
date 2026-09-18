/**
 * Gate: proves the documented backup path RECONSTRUCTS the database.
 *
 *   npm run check:restore
 *
 * BOUNDARY: it takes its OWN export, so the claim is that the path round-trips rather than that a
 * kept artifact is restorable, and it never touches production, enforced by one guarded writer.
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

/**
 * Production's UUID at runtime, because THE NAME IS NOT ADDRESSABLE FROM CI: the export resolves
 * through the gitignored config, which CI bootstraps with a placeholder id. The asymmetry is the
 * trap: it poisons exactly this database while the scratch one, in no config, works.
 *
 * @type {string | null}
 */
let PRODUCTION_ID = null;
const MIGRATIONS_DIR = "drizzle";
const MEDIA_BUCKET = "dustinedwards-media";
const MEDIA_BACKUP_BUCKET = "dustinedwards-media-backup";

/** Dated rather than random so a leaked database is identifiable, and prefixed for the guard. */
const SCRATCH_PREFIX = "restore-drill-";
const SCRATCH_DB = `${SCRATCH_PREFIX}${new Date().toISOString().slice(0, 10)}-${process.pid}`;

let checks = 0;
let failures = 0;

/**
 * The argument order every gate here uses: a string in the condition slot is always truthy.
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
 * One already-quoted command string: with `shell: true` an array concatenates without quoting.
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
 * The END of wrangler's output, which is where its error is: a head slice reported the banner.
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
 * THE GUARD: one place a write can learn what to aim at. Both directions, the scratch prefix AND
 * not production's, the second kept because the first depends on an editable constant.
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
  /* PRODUCTION NOW HAS TWO SPELLINGS: a write handed `PRODUCTION_ID` carries no name. */
  if (PRODUCTION_ID !== null && name === PRODUCTION_ID) {
    throw new Error(
      `refusing to write to ${name}: that is ${PRODUCTION_DB}'s UUID. This ` +
        `drill only ever reads production. Every write goes to the scratch database.`,
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
 * `--json` rather than the table wrangler prints, a display format that has changed shape.
 *
 * @param {string} db
 * @param {string} sql must be a SELECT; nothing here writes
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function query(db, sql) {
  const result = await retryRead(
    () => {
      const r = wrangler(`d1 execute ${db} --remote --json --command "${sql}"`);
      if (r.status !== 0) throw new Error(tail(r.stdout));
      return r;
    },
    { label: `check:restore query (${db})` },
  );
  /* The payload is located by its first `[`, so a banner that changes shape costs nothing. */
  const start = result.stdout.indexOf("[");
  if (start === -1) throw new Error(`no JSON in wrangler output for: ${sql}`);
  const parsed = JSON.parse(result.stdout.slice(start));
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return first?.results ?? [];
}

/**
 * `wrangler d1 migrations apply` CANNOT run against the scratch database: it resolves
 * `migrations_dir` from a d1_databases entry and refuses one absent from the config. So the files
 * are applied directly in sorted order. What is lost is `d1_migrations`, which is why the
 * integrity query skips it: hard rule 18 makes a hand INSERT a second truth in a derived store,
 * and the schema comparison below is what the row count stood in for.
 *
 * @returns {Promise<string[]>}
 */
async function migrationFiles() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  if (files.length === 0) throw new Error(`no migration files in ${MIGRATIONS_DIR}/`);
  return files;
}

/**
 * DERIVED from `drizzle/`: a hardcoded list that stops covering a new table is the failure.
 *
 * @returns {Promise<string[]>}
 */
/**
 * Tables in DEPENDENCY ORDER despite the export's PRAGMA: `defer_foreign_keys` resets at every
 * COMMIT and `--file` batches across transactions. DERIVED from the `REFERENCES` clauses, since
 * a hardcoded order is correct today and silently wrong at the next relation.
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
   * A NON-EMPTY EDGE SET IS ASSERTED BY THE CALLER: a regex that stops matching returns every
   * table with no parents, which sorts alphabetically and reproduces the defect this fixes.
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
 * IN THE SPELLING `/api/health` USES. Counts come off the `_docsize` shadow tables, because
 * `COUNT(*)` on an external-content fts5 table reads through and can never disagree.
 */
const INTEGRITY_SQL =
  "SELECT (SELECT COUNT(*) FROM posts) AS posts, " +
  "(SELECT COUNT(*) FROM posts_fts_docsize) AS postsFts, " +
  "(SELECT COUNT(*) FROM search_docs) AS docs, " +
  "(SELECT COUNT(*) FROM search_identity_docsize) AS identity, " +
  "(SELECT COUNT(*) FROM search_prose_docsize) AS prose";

/** `sqlite_master` with its DDL, so shadows are separated by the rule rather than by a suffix list. */
const SCHEMA_SQL = "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name";

/** D1 and wrangler's bookkeeping, the same set `check:backup` excludes. */
const PLATFORM_TABLES = new Set(["_cf_KV", "sqlite_sequence", "d1_migrations", "_cf_METADATA"]);

async function main() {
  console.log(`check:restore against ${PRODUCTION_DB}, scratch ${SCRATCH_DB}\n`);

  const dir = path.join(os.tmpdir(), `dustinedwards-restore-drill-${process.pid}`);
  await mkdir(dir, { recursive: true });

  /*
   * SWEEP FIRST, because the `finally` does not run on a hard kill. Only the prefix and only older
   * than the window, so a concurrent run is safe, and the count is REPORTED: a weekly sweep of
   * something is a leak nobody is fixing.
   */
  const SWEEP_AFTER_MS = 2 * 60 * 60 * 1000;
  const listed = wrangler("d1 list --json");
  /*
   * PARSED ONCE, OUTSIDE THE SWEEP'S `if`: the sweep is best-effort and the UUID resolution fails
   * closed, so it cannot sit inside a branch a failed list skips.
   */
  const listedStart = listed.status === 0 ? listed.stdout.indexOf("[") : -1;
  /** @type {Array<{ uuid?: string, name?: string, created_at?: string }>} */
  const databases = listedStart === -1 ? [] : JSON.parse(listed.stdout.slice(listedStart));

  /*
   * FAILS CLOSED, and loudly: falling back to the name substitutes a different value and
   * reintroduces the lookup failure this removes, wearing a passing lookup.
   */
  const production = databases.find((d) => d.name === PRODUCTION_DB);
  if (typeof production?.uuid !== "string" || production.uuid.length === 0) {
    throw new Error(
      `could not resolve ${PRODUCTION_DB} to a UUID from d1 list` +
        `${listed.status === 0 ? "" : ` (d1 list exited ${listed.status}: ${tail(listed.stdout)})`}. ` +
        `Passing the NAME to d1 export lets wrangler resolve it out of ` +
        `wrangler.jsonc, which CI bootstraps from the example with a ` +
        `placeholder database_id, so the read would fail as 7404.`,
    );
  }
  PRODUCTION_ID = production.uuid;
  console.log(`  ${PRODUCTION_DB} resolved to ${PRODUCTION_ID}`);

  if (listed.status === 0) {
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
    /* 1. the export, from production, READ ONLY */

    const tables = await orderedTables();
    ok(
      "[scope] the migrations name at least one table to restore",
      tables.length > 0,
      "a zero-table export would restore an empty database and every count " +
        "comparison below would compare 0 against 0 and pass.",
    );

    /* THE EDGE PARSE IS PROVEN NON-EMPTY: its failure is a silent alphabetical fallback. */
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
      /*
       * NO STATUS CHECK AFTER THIS: `retryRead` returns what the inner function returned and that
       * throws on non-zero, so a check would be hard rule 10's unfailable condition. The throw INSIDE
       * the callback is load-bearing, wrangler returning rather than rejecting on a failed command.
       */
      await retryRead(
        () => {
          const r = wrangler(
            `d1 export ${PRODUCTION_ID} --remote --no-schema --table ${table} --output "${out}"`,
          );
          if (r.status !== 0) throw new Error(tail(r.stdout));
          return r;
        },
        { label: `check:restore export (${table})` },
      );
      const body = await readFile(out, "utf8");
      dumps.push({ name: table, inserts: (body.match(/^INSERT INTO/gim) ?? []).length });
    }
    timings.export = Date.now() - exportStart;
    /* PROGRESS: this gate is minutes of round trips and a long silence looks like a hang. */
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

    /* 2. production's own answers, READ ONLY */

    const [live] = await query(String(PRODUCTION_ID), INTEGRITY_SQL);
    ok(
      "production answers the integrity query",
      live !== undefined && typeof live.posts === "number",
      `read ${JSON.stringify(live)}. Every comparison below is against these ` +
        `numbers, so an unreadable production row makes the drill vacuous ` +
        `rather than failing.`,
    );
    if (live === undefined) throw new Error("production integrity query returned no row");

    /* 3. build the scratch database */

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

    /* 3a. a migrated database is NOT an empty one */

    /*
     * MIGRATIONS SEED, AND A SEED COLLIDES WITH A RESTORE: applying them leaves a schema-correct
     * database already carrying a `settings` row, and the dump then trips a UNIQUE constraint,
     * presenting as "the backup is corrupt". REVERSE dependency order, and ONLY REAL TABLES, since
     * hard rule 2 forbids `DELETE FROM` on an index.
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

    /* 4. load the dump */

    /*
     * ONE FILE, WITH FOREIGN KEYS DEFERRED: a per-table restore is order-dependent in a way
     * alphabetical order gets wrong. The PRAGMA holds enforcement to the end of the transaction, so
     * a broken reference still fails at commit.
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
     * THE INDEXES ARE REBUILT, NOT RESTORED, hard rule 2: an fts5 virtual table cannot be exported.
     * That is also what makes the equalities below meaningful.
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

    /* 5. the restored database answers the same questions */

    const [restored] = await query(scratch(SCRATCH_DB), INTEGRITY_SQL);
    ok(
      "the restored database answers the integrity query",
      restored !== undefined && typeof restored.posts === "number",
      `read ${JSON.stringify(restored)}. A restore that cannot be queried is ` +
        `not a restore, and the comparisons below need both sides.`,
    );

    if (restored !== undefined) {
      /* ONE NAMED ASSERTION PER COLUMN: a single "the rows match" leaves the reader diffing at 2am. */
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

      /* ASSERTED WITHIN THE RESTORED DATABASE, not against production, which is `/api/health`'s job. */
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

    /* 5a. the SCHEMA, both sides */

    /*
     * THE ASSERTION `d1_migrations` WAS STANDING IN FOR, made directly and re-runnably, which is
     * what hard rule 17 asks of a number somebody wants to keep believing. One classifier on both
     * sides, so the platform's bookkeeping is excluded identically.
     */
    const classify = (/** @type {Array<Record<string, unknown>>} */ rows) => {
      const typed = rows.map((r) => ({ name: String(r.name), sql: r.sql ? String(r.sql) : null }));
      const { real, virtual } = classifySqliteTables(typed);
      return {
        real: real.filter((n) => !PLATFORM_TABLES.has(n)),
        virtual: virtual.filter((n) => !PLATFORM_TABLES.has(n)),
      };
    };
    const liveSchema = classify(await query(String(PRODUCTION_ID), SCHEMA_SQL));
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

    /* 6. the media mirror, EVERY key */

    /*
     * EVERY KEY, NOT A SAMPLE: a sample from a population this small is hard rule 10's zero-scope
     * vacuity. What this adds over the health poll is that it reads the buckets from OUTSIDE the
     * Worker, so the mirror is asserted by something that is not maintaining it.
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
       * ETAG, corroborated by SIZE, degrading to size for a multipart etag. `backup.server.ts` holds
       * the reason; this runs outside the Worker and cannot import it.
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
    /* 7. the scratch database always goes away */

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
   * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it. It moves with the number of MIGRATION
   * FILES and not with the table list, the load being one assertion over one combined file.
   */
  const MINIMUM_CHECKS = 32;
  const breach = assertFloor("check:restore", "checks", checks, MINIMUM_CHECKS);
  if (breach) ok("[scope] this gate executed its assertions", false, breach);

  console.log(
    `\n  timings: export ${timings.export ?? 0}ms, restore ${timings.restore ?? 0}ms, ` +
      `total ${timings.total}ms`,
  );
  console.log(`${checks} checks, ${failures} failures\n`);

  /* `exitCode` rather than `process.exit()`, which tears the process down mid stdout write. */
  process.exitCode = failures > 0 ? 1 : 0;
}

await main().catch((/** @type {unknown} */ error) => {
  console.error(`check:restore failed. ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
