/**
 * Gate over rules this repo states TWICE and cannot merge into one.
 *
 *   npm run check:invariants
 *   npm run check:invariants -- --remote    adds the live database
 *
 * OBSERVATION BOUNDARY: it compares the two implementations of a rule against
 * each other over a fixture. It does not know whether the rule itself is right,
 * so two implementations that agree on the WRONG answer pass here. What it
 * catches is divergence, which is the failure this repo has actually suffered.
 *
 * Offline by default: no network, no bindings. It bundles TypeScript with
 * esbuild to reach modules the Worker imports, the same technique
 * `check:admin-ui` uses, and runs the SQL halves against an in-memory SQLite
 * from `node:sqlite`. `--remote` adds one read of the deployed D1, which is the
 * only place an unapplied migration or a hand-altered column can be seen.
 *
 * ## What belongs here, and what emphatically does not
 *
 * A pair belongs here when the same rule is expressed twice IN DIFFERENT
 * LANGUAGES OR RUNTIMES, so it cannot be collapsed into one function. Two copies
 * of the same expression in the same language are not an invariant to gate, they
 * are duplication to delete: `bucketFor` was three copies and is now one in
 * `classify.mjs`, and `LANGUAGES` is derived from `GRAMMARS` rather than kept
 * beside it. Asserting a single function agrees with itself proves nothing and
 * would be a gate that can never fail.
 *
 * So this file holds eight sections, and the first is not a comparison:
 *
 *   1. NO SECOND BUCKET SELECTION. Structural. The dedupe is only true while it
 *      stays true, and the failure mode now is a fourth copy appearing in a
 *      file nobody thought to check.
 *   2. publiclyVisible() vs visibilityClause(). Drizzle conditions against a
 *      hand-written SQL string, over the same rule. Hard rule 1 lives in both.
 *   3. The two resolveImage paths. Node and Worker. Since finding B002 both are
 *      pure functions of the key string, which is what makes them comparable at
 *      all; before it, one read the filesystem and the other read R2.
 *   4. THE COLUMN SCHEMA, three ways: schema.ts, the migrations applied to an
 *      empty database, and the live database. Both directions on every pair.
 *   5. EVERY COLUMN NAMED IN RAW SQL EXISTS. Section 4 proves the schema
 *      sources agree with each other; this proves the SQL strings agree with
 *      them, which is the half that actually failed.
 *   6. EVERY POSTS READER COMPOSES THE VISIBILITY PREDICATE. Section 2 proves
 *      the two predicates agree; this proves a reader actually uses one, which
 *      is the half that leaks. Structural, like section 1.
 *
 * Section 4 exists because of hard rule 11 and cost a real defect:
 * `claimMediaKeyForDelete` named `media.r2_key`, which `0007` creates and
 * `0009` renames to `key`, so the statement was guaranteed to throw on the one
 * path it exists to protect. No typecheck reads inside a SQL string, no gate
 * exercised a media delete, and the schema verification in RECOVERY.md compares
 * `sqlite_master` objects by NAME AND TYPE, so columns were outside everything
 * anyone looked at.
 *
 * FAILS CLOSED. Every section asserts its fixture is non-empty and its scan
 * examined files, so "0 problems" can never quietly mean "0 things examined".
 */

import { existsSync, readFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { joinConcatenatedLiterals } from "./lib/sql-literals.mjs";
import { classifySqliteTables, ftsOwnedTables } from "./lib/sqlite-tables.mjs";
import { retryRead } from "./lib/retry.mjs";
import { stripComments, stripCommentsAndStrings } from "./lib/strip-comments.mjs";

/*
 * WHY THE STRING-BLANKING FORM, here specifically: THIS FILE QUOTES THE VERY
 * PATTERNS IT HUNTS, so a scan that kept string literals would flag itself and
 * report its own needles as violations. The general reason comments must go
 * first, and what happens when they do not, is in the helper.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let checks = 0;
let failures = 0;

/**
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
 * @param {string} label
 * @param {string} [detail]
 */
function fail(label, detail = "") {
  checks += 1;
  failures += 1;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
}

/* ------------------------------------------------------------------ helpers */



/**
 * Every source file in the tree, derived by walking rather than listed.
 *
 * @param {string} [dir]
 * @param {string[]} [out]
 * @returns {string[]}
 */
function sourceFiles(dir = root, out = []) {
  const SKIP = new Set([
    "node_modules",
    ".git",
    "build",
    ".wrangler",
    "content",
    "public",
    ".react-router",
  ]);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".claude") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      sourceFiles(full, out);
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} entry
 * @param {string} outfile
 * @param {RegExp} stubs
 * @returns {Promise<any>}
 */
async function bundle(entry, outfile, stubs) {
  const { build } = await import("esbuild");
  const cacheRoot = join(root, "node_modules", ".cache", "check-invariants");
  mkdirSync(cacheRoot, { recursive: true });

  /** @type {import("esbuild").Plugin} */
  const stubPlugin = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: stubs }, (args) => {
        // The entry itself must never be stubbed, or the gate would compare
        // two empty objects and pass having examined nothing.
        if (args.kind === "entry-point") return null;
        return { path: args.path, namespace: "stub" };
      });
      // CommonJS, deliberately. An ESM stub can only offer the names it
      // declares, so every named import from a stubbed module is a build
      // error; esbuild resolves named imports from CJS at runtime, which lets
      // one stub stand in for any module's surface.
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents:
          "module.exports = new Proxy({}, { get: () => () => {}, has: () => true });",
        loader: "js",
      }));
    },
  };

  const out = join(cacheRoot, outfile);
  await build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    logLevel: "silent",
    plugins: [stubPlugin],
    alias: { "~": join(root, "app") },
  });
  return import(pathToFileURL(out).href);
}

/* ------------------------------------------------ 1. no second bucketFor */

console.log("\ncheck:invariants\n");
console.log("  1. bucket selection exists in exactly one place");

/**
 * A bucket selection is a conditional whose two arms are `<x>.OG` and
 * `<x>.MEDIA` in either order.
 *
 * Shape rather than file, because the rule is "there is one of these", and a
 * scan keyed on an allowed-files list would go stale the moment someone adds a
 * file. `rebuild.server.ts` iterating `[env.MEDIA, env.OG]` to walk BOTH buckets
 * is deliberately not this shape and must not be flagged: walking both is not
 * choosing between them.
 */
const SELECTION = [
  /\?[^;]{0,80}?\.OG\b[^;]{0,80}?:[^;]{0,80}?\.MEDIA\b/,
  /\?[^;]{0,80}?\.MEDIA\b[^;]{0,80}?:[^;]{0,80}?\.OG\b/,
];

const DEFINITION = join(root, "app", "lib", "media", "classify.mjs");
const files = sourceFiles();
const selectionSites = [];

for (const file of files) {
  const text = stripCommentsAndStrings(readFileSync(file, "utf8"));
  if (SELECTION.some((re) => re.test(text))) selectionSites.push(file);
}

ok(
  "the scan examined a plausible number of source files",
  files.length >= 235,
  `only ${files.length} file(s) walked, so a green result would mean nothing`,
);

ok(
  "classify.mjs still defines the bucket selection",
  selectionSites.includes(DEFINITION),
  "the one implementation is gone; either it moved or this gate is looking for the wrong shape",
);

const extras = selectionSites.filter((f) => f !== DEFINITION);
ok(
  "no other file selects a bucket",
  extras.length === 0,
  extras.length > 0
    ? `${extras.length} second implementation(s): ${extras
        .map((f) => relative(root, f).split(sep).join("/"))
        .join(", ")}. Import bucketFor from classify.mjs instead.`
    : "",
);

console.log(
  `     ${files.length} source file(s) scanned, ${selectionSites.length} selection site(s)`,
);

/* --------------------------- 2. publiclyVisible vs visibilityClause */

console.log("\n  2. publiclyVisible() and visibilityClause() agree");

/**
 * Post states the two predicates must judge identically.
 *
 * Enumerated rather than sampled: status has two values and publish_at has four
 * interesting cases (null, past, future, exactly now), so eight rows cover the
 * whole space the rule can see. The draft rows matter as much as the published
 * ones, because a predicate that forgot `status` entirely would still pass a
 * fixture made only of published posts.
 *
 * **`NOW` IS TAKEN FROM `publiclyVisible()` ITSELF, not chosen here**, and the
 * first version of this gate was wrong for exactly that reason. The two
 * implementations do not agree on where the current time comes from: the
 * drizzle one calls `new Date()` internally, while the SQL one takes the
 * instant as a bound parameter. Picking a constant here compared them at two
 * different moments and reported a divergence that did not exist. So the
 * reference instant is read out of the rendered drizzle parameters below, and
 * the fixture is built relative to it, which is the only way the comparison is
 * about the RULE rather than about the clock.
 */
/** @param {number} NOW @returns {{slug: string, status: string, publish_at: number | null}[]} */
const POST_STATES_AT = (NOW) => [
  { slug: "published-no-date", status: "published", publish_at: null },
  { slug: "published-past", status: "published", publish_at: NOW - 86_400 },
  { slug: "published-future", status: "published", publish_at: NOW + 86_400 },
  { slug: "published-exactly-now", status: "published", publish_at: NOW },
  { slug: "draft-no-date", status: "draft", publish_at: null },
  { slug: "draft-past", status: "draft", publish_at: NOW - 86_400 },
  { slug: "draft-future", status: "draft", publish_at: NOW + 86_400 },
  { slug: "draft-exactly-now", status: "draft", publish_at: NOW },
];

try {
  // The drizzle half. `publiclyVisible()` builds a condition from the schema and
  // needs no database to do it, so the dialect can render it to SQL directly.
  const dbModule = await bundle(
    join(root, "app", "db", "index.ts"),
    "db.mjs",
    /^~\/(lib\/context|lib\/auth|lib\/timing)/,
  );
  const { SQLiteSyncDialect } = await import("drizzle-orm/sqlite-core");
  const rendered = new SQLiteSyncDialect().sqlToQuery(dbModule.publiclyVisible());

  /*
   * The reference instant, read out of the rendered parameters.
   *
   * A `timestamp` column is bound as EPOCH SECONDS, not as a Date: drizzle has
   * already applied the column's mapper by the time the dialect renders. So the
   * instant is the one numeric parameter, alongside the string 'published'.
   * Normalising a Date first anyway costs nothing and means a future drizzle
   * that binds the object instead does not silently break the gate.
   */
  const drizzleParams = rendered.params.map((p) =>
    p instanceof Date ? Math.floor(p.getTime() / 1000) : p,
  );
  const instants = drizzleParams.filter((p) => typeof p === "number");
  ok(
    "publiclyVisible() bound exactly one instant, which the fixture is built around",
    instants.length === 1,
    `bound ${instants.length} numeric parameter(s); this gate cannot pick a reference instant`,
  );
  const NOW = instants[0] ?? Math.floor(Date.now() / 1000);
  const POST_STATES = POST_STATES_AT(NOW);

  ok("the post-state fixture is not empty", POST_STATES.length > 0);
  ok(
    "the fixture covers both statuses and a null, past and future publish_at",
    new Set(POST_STATES.map((p) => p.status)).size === 2 &&
      POST_STATES.some((p) => p.publish_at === null) &&
      POST_STATES.some((p) => p.publish_at !== null && p.publish_at < NOW) &&
      POST_STATES.some((p) => p.publish_at !== null && p.publish_at > NOW),
  );

  const db = new DatabaseSync(":memory:");
  db.exec(
    `CREATE TABLE posts (slug TEXT PRIMARY KEY, status TEXT NOT NULL, publish_at INTEGER)`,
  );
  const insert = db.prepare(
    `INSERT INTO posts (slug, status, publish_at) VALUES (?, ?, ?)`,
  );
  for (const p of POST_STATES) {
    insert.run(p.slug, p.status, /** @type {number | null} */ (p.publish_at));
  }

  // The search half, a hand-written string with one positional parameter.
  const searchModule = await bundle(
    join(root, "app", "lib", "search", "search.server.ts"),
    "search.mjs",
    /^~\/(db|lib\/context|lib\/auth)/,
  );

  ok(
    "publiclyVisible() rendered to SQL",
    typeof rendered.sql === "string" && rendered.sql.length > 0,
  );
  ok(
    "visibilityClause() is exported and returns SQL",
    typeof searchModule.visibilityClause === "function" &&
      typeof searchModule.visibilityClause() === "string",
    "export it from search.server.ts so this gate can reach the real one",
  );

  if (typeof searchModule.visibilityClause === "function") {
    const viaDrizzle = db
      .prepare(`SELECT slug FROM posts WHERE ${rendered.sql} ORDER BY slug`)
      .all(.../** @type {any[]} */ (drizzleParams))
      .map((r) => String(r.slug));

    const viaSearch = db
      .prepare(
        `SELECT slug FROM posts d WHERE ${searchModule.visibilityClause()} ORDER BY slug`,
      )
      .all(NOW)
      .map((r) => String(r.slug));

    ok(
      "both predicates admit the same posts",
      JSON.stringify(viaDrizzle) === JSON.stringify(viaSearch),
      `publiclyVisible admits [${viaDrizzle}], visibilityClause admits [${viaSearch}]`,
    );

    // A predicate that admitted everything, or nothing, would agree with a copy
    // of itself and tell us nothing. The rule has to actually discriminate.
    ok(
      "the predicates admit some posts and reject others",
      viaDrizzle.length > 0 && viaDrizzle.length < POST_STATES.length,
      `admitted ${viaDrizzle.length} of ${POST_STATES.length}`,
    );
    ok(
      "no draft is admitted by either predicate",
      !viaDrizzle.some((s) => s.startsWith("draft")) &&
        !viaSearch.some((s) => s.startsWith("draft")),
    );
    ok(
      "no future-dated post is admitted by either predicate",
      !viaDrizzle.includes("published-future") &&
        !viaSearch.includes("published-future"),
    );

    console.log(
      `     ${POST_STATES.length} post state(s), both predicates admit [${viaDrizzle.join(", ")}]`,
    );
  }
} catch (error) {
  fail("the visibility comparison could not run", String(error));
}

/* ------------------------------------ 3. the two resolveImage paths */

console.log("\n  3. the Node and Worker resolveImage paths agree");

/**
 * Media srcs both resolvers must answer identically.
 *
 * Only `/media/` is comparable, and that is the finding rather than a gap: for
 * `public/` the Node side reads the working tree and the Worker reads the
 * repository over the GitHub API, so neither is a pure function and there is
 * nothing an offline gate can compare. Before B002 that was true of `/media/`
 * too, which is precisely why the dimensions moved into the key.
 */
const MEDIA_SRCS = [
  "/media/0001020304050607-1600x900.webp",
  "/media/aabbccddeeff0011-32x32.png",
  "/media/0123456789abcdef-1x1.avif",
  "/media/0001020304050607-1600x900.webp?w=640",
  // Refusals. A key with no dimensions cannot be measured by either side, and
  // both must fail rather than one inventing an answer.
  "/media/0001020304050607.webp",
  "/media/notahash-800x600.webp",
];

ok("the media src fixture is not empty", MEDIA_SRCS.length > 0);
ok(
  "the fixture contains both resolvable and unresolvable keys",
  MEDIA_SRCS.some((s) => /-\d+x\d+\./.test(s)) &&
    MEDIA_SRCS.some((s) => !/-\d+x\d+\./.test(s)),
);

try {
  const nodeModule = await import(
    pathToFileURL(join(root, "scripts", "lib", "content.mjs")).href
  );
  const workerModule = await bundle(
    join(root, "app", "lib", "editor", "publish.server.ts"),
    "publish.mjs",
    /^(~\/(db|lib\/context|lib\/auth)|.*\.server(\.[tj]s)?$|\.\/github\.server)/,
  );

  ok(
    "the Node resolver is exported",
    typeof nodeModule.makeResolveImage === "function",
    "export makeResolveImage from scripts/lib/content.mjs so this gate can reach it",
  );
  ok(
    "the Worker resolver is exported",
    typeof workerModule.makeResolveImage === "function",
  );

  if (
    typeof nodeModule.makeResolveImage === "function" &&
    typeof workerModule.makeResolveImage === "function"
  ) {
    const nodeResolve = nodeModule.makeResolveImage("content/posts/fixture.md");
    // Never reached for a /media/ src, and that is the property being asserted:
    // if either resolver starts fetching for these, this env throws and the
    // gate goes red rather than passing on an accidental network read.
    const workerResolve = workerModule.makeResolveImage(
      new Proxy(
        {},
        {
          get() {
            throw new Error("a /media/ resolve must not touch any binding");
          },
        },
      ),
    );

    let compared = 0;
    let agreements = 0;
    for (const src of MEDIA_SRCS) {
      /** @param {(s: string) => Promise<{width: number, height: number}>} fn */
      const settle = async (fn) => {
        try {
          return { ok: true, value: await fn(src) };
        } catch (error) {
          return { ok: false, value: String(error) };
        }
      };
      const a = await settle(nodeResolve);
      const b = await settle(workerResolve);
      compared += 1;

      const dims = (/** @type {{ok: boolean, value: any}} */ r) =>
        r.ok ? `${r.value.width}x${r.value.height}` : "refused";
      const same = a.ok === b.ok && dims(a) === dims(b);
      if (same) agreements += 1;
      ok(
        `both resolvers agree on ${src}`,
        same,
        `Node ${dims(a)}, Worker ${dims(b)}`,
      );
    }

    ok(
      "every fixture src was actually compared",
      compared === MEDIA_SRCS.length,
      `${compared} of ${MEDIA_SRCS.length}`,
    );
    ok(
      "the fixture produced both resolutions and refusals",
      agreements === MEDIA_SRCS.length,
    );
    // Reports the AGREEMENT COUNT, not a verdict. An earlier version said "both
    // paths in agreement" unconditionally and printed it under six failures,
    // which is the same class of lie as a gate reporting "0 problems" having
    // examined nothing.
    console.log(
      `     ${compared} media src(s) compared, ${agreements} in agreement`,
    );
  }
} catch (error) {
  fail("the resolveImage comparison could not run", String(error));
}

/* ------------------------------------------- 4. the column schema, three ways */

console.log("\n  4. columns agree across schema.ts, the migrations and the database");

/**
 * The COLUMN schema, from every source that has an opinion about it.
 *
 * Hard rule 11 exists because nothing checked this. `claimMediaKeyForDelete`
 * named `media.r2_key`, which `0007_media.sql` creates and `0009_media_index.sql`
 * renames to `key`, so the statement was guaranteed to throw on the one path it
 * exists to protect. Nothing caught it: no typecheck reads inside a SQL string,
 * no gate exercises a media delete, and the schema verification in RECOVERY.md
 * compares `sqlite_master` objects by NAME AND TYPE, so columns were outside
 * everything anyone looked at.
 *
 * Three sources, and every one of them is DERIVED:
 *
 *   schema.ts    what the query builder believes, read through `getTableConfig`
 *                rather than by parsing the file
 *   migrations   what `drizzle/*.sql` actually creates, applied to an empty
 *                in-memory database and read back with `PRAGMA table_info`
 *   database     the live D1, same PRAGMA, behind `--remote`
 *
 * There is no column list in this file, which is the entire point: a gate that
 * mirrors the thing it checks fails in exactly the case the mirror is stale.
 *
 * Exclusions are derived too, never named. Virtual tables are the ones whose
 * DDL says `CREATE VIRTUAL TABLE`; shadow tables are the ones prefixed with a
 * virtual table's name and an underscore, which is the same rule `check:backup`
 * uses; and `sqlite_%` is reserved by SQLite for its own bookkeeping.
 */

/**
 * Lifted to scripts/lib/sqlite-tables.mjs 2026-08-10, so this file, section 7
 * below and check-backup.mjs all classify by the same rules. The rules were
 * already identical in all three; identical-by-coincidence is what this repo
 * keeps converting into one module with several readers.
 *
 * @param {{name: string, sql: string | null}[]} tables
 */
function classifyTables(tables) {
  return classifySqliteTables(tables);
}

/**
 * @param {Map<string, Map<string, string>>} a
 * @param {Map<string, Map<string, string>>} b
 * @param {string} aName
 * @param {string} bName
 * @param {string[]} tables
 */
function compareColumns(a, b, aName, bName, tables) {
  let comparisons = 0;
  for (const table of tables) {
    const left = a.get(table);
    const right = b.get(table);
    if (!left || !right) continue;
    comparisons += 1;

    const missingFromB = [...left.keys()].filter((c) => !right.has(c));
    const missingFromA = [...right.keys()].filter((c) => !left.has(c));
    ok(
      `${table}: every ${aName} column exists in ${bName}`,
      missingFromB.length === 0,
      `${bName} lacks ${missingFromB.join(", ")}`,
    );
    ok(
      `${table}: every ${bName} column exists in ${aName}`,
      missingFromA.length === 0,
      `${aName} lacks ${missingFromA.join(", ")}`,
    );

    const typeMismatches = [...left.entries()]
      .filter(([c, t]) => right.has(c) && right.get(c) !== t)
      .map(([c, t]) => `${c} is ${t} in ${aName} and ${right.get(c)} in ${bName}`);
    ok(
      `${table}: shared columns declare the same type`,
      typeMismatches.length === 0,
      typeMismatches.join("; "),
    );
  }
  return comparisons;
}

/** SQLite spells one type several ways; only the affinity is comparable. */
function normalizeType(/** @type {string} */ type) {
  const t = String(type).toUpperCase().replace(/\(.*\)/, "").trim();
  if (t.includes("INT")) return "INTEGER";
  if (["TEXT", "CHAR", "CLOB", "VARCHAR"].some((k) => t.includes(k))) return "TEXT";
  if (t.includes("BLOB") || t === "") return "BLOB";
  if (["REAL", "FLOA", "DOUB"].some((k) => t.includes(k))) return "REAL";
  return "NUMERIC";
}

const wantsRemote = process.argv.includes("--remote");

try {
  /* ---- source 1: schema.ts, through drizzle rather than by parsing ---- */
  const [schemaModule, authModule, drizzleCore, drizzleOrm] = await Promise.all([
    bundle(join(root, "app", "db", "schema.ts"), "schema.mjs", /^~\/(lib)/),
    bundle(join(root, "app", "db", "auth-schema.ts"), "auth.mjs", /^~\/(lib)/),
    import("drizzle-orm/sqlite-core"),
    import("drizzle-orm"),
  ]);

  /** @type {Map<string, Map<string, string>>} */
  const fromSchema = new Map();
  for (const mod of [schemaModule, authModule]) {
    for (const value of Object.values(mod)) {
      if (!drizzleOrm.is(value, drizzleCore.SQLiteTable)) continue;
      const config = drizzleCore.getTableConfig(
        /** @type {any} */ (value),
      );
      fromSchema.set(
        config.name,
        new Map(
          config.columns.map((c) => [c.name, normalizeType(c.getSQLType())]),
        ),
      );
    }
  }

  /* ---- source 2: the migrations, applied to an empty database ---- */
  const fresh = new DatabaseSync(":memory:");
  const migrations = readdirSync(join(root, "drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    fresh.exec(readFileSync(join(root, "drizzle", file), "utf8"));
  }
  const freshTables = /** @type {{name: string, sql: string | null}[]} */ (
    /** @type {unknown} */ (
      fresh
        .prepare("SELECT name, sql FROM sqlite_master WHERE type='table'")
        .all()
    )
  );
  const { real: migrationTables, virtual } = classifyTables(freshTables);

  /** @type {Map<string, Map<string, string>>} */
  const fromMigrations = new Map();
  for (const table of migrationTables) {
    const info = /** @type {any[]} */ (
      fresh.prepare(`PRAGMA table_info(${table})`).all()
    );
    fromMigrations.set(
      table,
      new Map(info.map((c) => [String(c.name), normalizeType(String(c.type))])),
    );
  }

  ok(
    "the migration enumeration is not empty",
    migrations.length > 0 && migrationTables.length > 0,
    `${migrations.length} migration(s) produced ${migrationTables.length} table(s)`,
  );
  ok(
    "the schema.ts enumeration is not empty",
    fromSchema.size > 0,
    "no drizzle tables were found, so every comparison below would be vacuous",
  );
  ok(
    "virtual tables were identified and excluded by DDL rather than by name",
    virtual.length > 0,
    "no CREATE VIRTUAL TABLE found; the fts5 exclusion is not being exercised",
  );

  /* ---- schema.ts vs migrations, both directions, offline ---- */
  const modelled = [...fromSchema.keys()].sort();
  const unmodelled = migrationTables.filter((t) => !fromSchema.has(t));
  const phantom = modelled.filter((t) => !fromMigrations.has(t));

  ok(
    "every table drizzle models is actually created by a migration",
    phantom.length === 0,
    `no migration creates ${phantom.join(", ")}`,
  );

  const compared = compareColumns(
    fromSchema,
    fromMigrations,
    "schema.ts",
    "migrations",
    modelled,
  );
  ok(
    "every modelled table was actually compared",
    compared === modelled.length - phantom.length,
    `${compared} of ${modelled.length - phantom.length}`,
  );

  console.log(
    `     schema.ts ${fromSchema.size} table(s), migrations ${migrationTables.length}, ` +
      `${virtual.length} virtual excluded`,
  );
  if (unmodelled.length > 0) {
    /*
     * Not a failure, and NO LONGER COVERED. This used to read "covered by
     * section 5", which was true until section 5 was deleted on 2026-08-16 for
     * being unable to check anything reliably. A table drizzle does not model
     * is reachable only through raw SQL, and nothing asserts its column names
     * now. Printed as an EXPOSURE rather than as reassurance, because the line
     * that named a cover which no longer exists is worse than no line at all.
     */
    console.log(
      `     not modelled in drizzle and UNCOVERED since section 5 was removed: ${unmodelled.join(", ")}`,
    );
  }

  /* ---- source 3: the live database, behind --remote ---- */
  if (!wantsRemote) {
    console.log("     live database SKIPPED (pass --remote to include it)");
  } else {
    /*
     * ONE batched `--command`, passed as a single already-quoted shell string.
     *
     * Every other shape was tried and each fails on Windows for its own reason.
     * An args array with `shell: true` lets the shell split the statement list
     * on its spaces and semicolons, and wrangler reports
     * "Unknown arguments: table_info(account);". `shell: false` cannot run a
     * `.cmd` shim at all and fails EINVAL. And `--file`, which looks like the
     * clean answer, returns only ONE result set under `--json` no matter how
     * many statements the file holds, which silently reduces this check to a
     * single table.
     *
     * Batched rather than a call per table because this runs inside `check:all`
     * and eleven round trips to the edge is most of a minute. The SQL contains
     * no double quote, so wrapping it in one is safe here and asserted below by
     * the count of result sets coming back.
     */
    const command = migrationTables
      .map((t) => `PRAGMA table_info(${t});`)
      .join(" ");
    /*
     * RETRIED ONCE. Remote D1 reads have failed with Cloudflare error 10000
     * twice, both clean immediately after. Read only; nothing here writes.
     *
     * THE THROW IS LOAD-BEARING. `spawnSync` RETURNS on a failed command, it
     * does not reject, so wrapping it directly gives retryRead nothing to
     * catch and the retry can never fire: an inert wrapper that reads as
     * protection. Caught in review of this very commit, and it is the same
     * class check:assertions exists to find. The non-zero status is raised
     * deliberately so there is a rejection to retry on.
     */
    const proc = await retryRead(
      () => {
        const r = spawnSync(
          `npx wrangler d1 execute dustinedwards --remote --json --command "${command}"`,
          { cwd: root, encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024 },
        );
        if (r.status !== 0) throw new Error((r.stderr || r.stdout || "no output").slice(0, 200));
        return r;
      },
      { label: "check:invariants live column schema read (--remote)" },
    );
    const match = (proc.stdout ?? "").match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!match) {
      fail(
        "the live column schema could not be read",
        (proc.stderr || proc.stdout || "no output").slice(0, 200),
      );
    } else {
      const sets = JSON.parse(match[0]);
      ok(
        "the live database answered for every table asked about",
        sets.length === migrationTables.length,
        `asked ${migrationTables.length}, got ${sets.length}`,
      );

      /** @type {Map<string, Map<string, string>>} */
      const fromLive = new Map();
      migrationTables.forEach((table, i) => {
        const rows = sets[i]?.results ?? [];
        if (rows.length === 0) return;
        fromLive.set(
          table,
          new Map(
            rows.map((/** @type {any} */ c) => [
              String(c.name),
              normalizeType(String(c.type)),
            ]),
          ),
        );
      });

      const absent = migrationTables.filter((t) => !fromLive.has(t));
      ok(
        "every table the migrations create exists in the live database",
        absent.length === 0,
        `live database has no ${absent.join(", ")}. An unapplied migration?`,
      );

      const liveCompared = compareColumns(
        fromMigrations,
        fromLive,
        "migrations",
        "database",
        migrationTables,
      );
      ok(
        "every live table was actually compared",
        liveCompared === migrationTables.length - absent.length,
        `${liveCompared} of ${migrationTables.length - absent.length}`,
      );
      console.log(`     live database: ${liveCompared} table(s) compared`);
    }
  }
} catch (error) {
  fail("the column comparison could not run", String(error));
}

/* ------------------- 5. REMOVED: the raw-SQL column scanner ------------- */

/*
 * SECTION 5 WAS DELETED 2026-08-16, and the number is kept so 6 through 9 do
 * not renumber. It matched SQL out of string literals with a regex and then
 * checked every qualified name against `schema.ts`.
 *
 * IT COULD CHECK NOTHING AND PRINT ZERO PROBLEMS. The literal matcher
 * understood quotes but not REGEX LITERALS, so a `/"/` or `/'/` anywhere in a
 * scanned file opened a string that never closed and every quote after it was
 * paired against the wrong partner. MEASURED on 2026-08-16 against the same
 * matcher, read out of this file rather than retyped: 692 desynced matches
 * swallowing 47,495 characters in `check-admin-ui.mjs`, and 19 swallowing 6,739
 * in `search.server.ts`, whose worst single phantom ran 1,523 characters and
 * took the real FTS queries with it. A run that examined nothing looked exactly
 * like a clean one, because the count it printed was of phantoms.
 *
 * RULED: delete rather than patch. Reading SQL out of a host language correctly
 * needs a tokenizer that knows where a regex literal may begin, which in
 * JavaScript is decided by the preceding token, so it needs a parser, not a
 * longer regex. A second regex would be the same instrument with more surface.
 *
 * WHAT IS LOST, stated rather than absorbed: `search_docs` is not modelled in
 * drizzle, and section 4 used to name section 5 as its cover. That cover is
 * gone. Section 4 still reconciles every drizzle-modelled table across
 * `schema.ts`, the migrations and the live database, and section 7 still guards
 * the FTS indexes, but no gate now checks a column name written in raw SQL.
 *
 * THE SAME MATCHER IS STILL LIVE IN TWO PLACES, and it was one instance of a
 * three-instance class rather than a lone defect: section 7 declares it as
 * `LITERAL` and section 8 as `LITERALS`, byte-identical both times. Those guard
 * hard rules 2 and 1, so they were NOT deleted with this one: removing them
 * would drop the guards entirely. They are recorded here as open, because
 * closing a class on one instance is what left three delete paths unguarded
 * this same week.
 */

/* ------------------------- 6. every posts READER composes the predicate */

/*
 * HARD RULE 1, at the CALLER rather than at the predicate.
 *
 * Section 2 proves `publiclyVisible()` and `visibilityClause()` admit the same
 * rows. It says nothing about whether a reader USES either one, and that is the
 * half that actually leaks: a new loader selecting from `posts` directly is
 * invisible to section 2 and would serve drafts and future-dated rows.
 * Backlog item 3.
 *
 * ## TWO ASSERTIONS, and the first is the one section 1's technique gives us
 *
 * **The chokepoint.** Every `.from(posts)` in `app/` lives in `app/db/index.ts`.
 * Measured 2026-08-10: 13 of 13. That single fact is most of the guarantee,
 * because it means the visibility question is decided in one reviewable file
 * rather than wherever someone happened to need a query.
 *
 * **Per function, inside that file.** Every top-level function that queries
 * `posts` must compose `publiclyVisible()`, `visibilityClause()` or
 * `isBlogPost()` (which composes the first), unless it is named below.
 *
 * ## THE EXCLUSION IS A FUNCTION, NOT A FILE, and that distinction is the point
 *
 * The obvious shape is to exclude the module holding the admin reader. It is
 * also useless: `app/db/index.ts` holds the admin reader AND all nine public
 * readers, so a file-level exclusion excludes the entire public read surface
 * and the section passes while asserting nothing. Measured before writing this.
 *
 * ## WRITES ARE OUT OF SCOPE, deliberately
 *
 * `publish.server.ts` carries six raw `FROM posts` occurrences and every one is
 * a DELETE or a subquery resolving an id for a write. A visibility predicate on
 * a write would be wrong: unpublishing a post must still be able to delete its
 * rows. Section 5 already binds those statements' column names to the schema.
 */

console.log("\n  6. every posts reader composes the visibility predicate");

/**
 * Named functions permitted to query `posts` without the predicate.
 * Each needs a reason, and the reason needs to survive a reader asking "why is
 * it safe for THIS one to see drafts?".
 */
const VISIBILITY_EXEMPT = {
  listAllPostsForAdmin:
    "the admin post list exists to show drafts and future-dated rows; that IS its " +
    "job. Reached only from /admin routes, which are behind Better Auth.",
  adminNavCounts:
    "the sidebar's Posts badge counts what the admin can EDIT, so a draft is one " +
    "of the things being counted and filtering drafts out would make the badge " +
    "disagree with the list it links to. Same standing as listAllPostsForAdmin " +
    "above, reached only from the /admin layout loader behind Better Auth, and " +
    "weaker in consequence than either exemption here: it selects COUNT(*) and " +
    "no columns, so no title, slug, body or date of an unpublished post can " +
    "leave through it. What escapes in the worst case is one integer. It was " +
    "written first as a single statement with two scalar subqueries and this " +
    "section COULD NOT SEE IT, because the scan matches `.from(posts)` and that " +
    "form reached the table from inside a sql template. Rewritten through the " +
    "query builder so the chokepoint applies; the extra round trip is the price " +
    "of being observable.",
  getDraftPostForPreview:
    "draft preview links (feature G). The ONLY exempt reader reachable without a " +
    "session, so the reason has to be stronger than the one above. It does not " +
    "DROP the predicate, it inverts and narrows it: `status = 'draft'`, which is " +
    "the strict complement of publiclyVisible()'s status half, so a published, " +
    "scheduled or archived row returns null. The slug it is asked about comes out " +
    "of a KV record named by a 32-byte token, never off the URL, so a caller " +
    "cannot ask about a post they were not given a link to. /preview/:token " +
    "declares private, no-store with no public branch and returns the post " +
    "route's byte-identical 404 on every failure.",
};

/**
 * What `posts` is CALLED in this file, aliases included.
 *
 * THE SCAN USED TO HARDCODE THE NAME, and an import alias walked straight past
 * it. Measured by the pre-audit sweep of 2026-08-11: a file containing
 *
 *     import { posts as postsTable } from "~/db/schema";
 *     return db.select().from(postsTable);        // no predicate
 *
 * left this section reporting 77 checks and 0 failures. The identical file
 * written `import { posts }` and `.from(posts)` reported 77 and 1, naming it.
 * The ONLY difference was the alias, and this is hard rule 1's instrument.
 *
 * It was not hypothetical. `app/lib/operator/api.server.ts` has imported posts
 * under an alias since the operator API shipped, with two live query sites this
 * section had never once looked at.
 *
 * Any named import of `posts` counts, from any module path. There is no other
 * `posts` export in this repo, and scanning a same-named import from somewhere
 * else would cost a false positive, which is the safe direction.
 *
 * @param {string} code comment-stripped source
 * @returns {string[]} local binding names, always including the plain one
 */
function postsBindings(code) {
  /*
   * THE MODULE PATH IS ALLOWED TO BE EMPTY, and that is not sloppiness.
   *
   * This file's `stripCommentsAndStrings()` blanks every string literal to `""` so that a
   * later pass can find SQL literals without tripping over an apostrophe in
   * prose. By the time this function sees the source,
   *
   *     import { posts as postsTable } from "~/db/schema";
   *
   * reads `import { posts as postsTable } from "";`. A needle written
   * `["'][^"']+["']` against the RAW form matched nothing here, and the first
   * draft of this resolver scored zero aliased imports in a repo that has one.
   * Measure the needle through the pipeline that feeds it.
   */
  const names = new Set(["posts"]);
  for (const m of code.matchAll(/import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']*["']/g)) {
    for (const raw of m[1].split(",")) {
      const spec = raw.trim();
      const aliased = spec.match(/^posts\s+as\s+(\w+)$/);
      if (aliased) names.add(aliased[1]);
    }
  }
  // `import * as schema from "./schema"` then `.from(schema.posts)`.
  for (const m of code.matchAll(/import\s*\*\s*as\s+(\w+)\s*from\s*["'][^"']*["']/g)) {
    names.add(`${m[1]}.posts`);
  }
  return [...names];
}

try {
  const PREDICATE = /\b(publiclyVisible|visibilityClause|isBlogPost)\s*\(/;

  /** `.from(<binding>)` for this file's bindings. Guarded non-empty below. */
  const queryFor = (/** @type {string[]} */ bindings) =>
    new RegExp(
      `\\.from\\(\\s*(?:${bindings
        .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")})\\s*\\)`,
      "g",
    );

  // Chokepoint: which files under app/ query the posts table at all?
  const queryingFiles = [];
  let appFilesScanned = 0;
  let aliasedFiles = 0;
  for (const file of sourceFiles(join(root, "app"))) {
    const rel = relative(root, file).split(sep).join("/");
    if (rel.endsWith(".d.ts")) continue;
    appFilesScanned += 1;
    // stripCommentsAndStrings() ONLY. joinConcatenatedLiterals merges concatenated string
    // literals across lines, which destroys the column-0 brace structure the
    // function extractor below depends on. It exists for the SQL-literal passes
    // and buys nothing here: `.from(posts)` is not a string literal. Using it
    // scored 18 query sites in a file that has 2, and reported isToolName as a
    // posts reader.
    const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
    const bindings = postsBindings(code);
    // NON-EMPTY BY CONSTRUCTION, asserted anyway: an empty alternation
    // collapses to `()` and would match every `.from()` in the repo.
    if (bindings.length === 0) {
      fail(`no posts binding resolved for ${rel}`, "the alternation would match everything");
      continue;
    }
    if (bindings.length > 1) aliasedFiles += 1;
    const hits = (code.match(queryFor(bindings)) ?? []).length;
    if (hits > 0) queryingFiles.push({ rel, hits, bindings });
  }

  ok(
    "the binding resolver is exercised by at least one aliased import",
    aliasedFiles > 0,
    `no file under app/ imports posts under an alias or a namespace. The resolver ` +
      `would then be untested by the repo itself, and a plain-name scan would score ` +
      `identically. Verify with a plant before trusting a green result here.`,
  );

  ok(
    "the caller scan examined a plausible number of files under app/",
    appFilesScanned >= 140,
    `${appFilesScanned} scanned; a green result below would mean nothing`,
  );

  const CHOKEPOINT = "app/db/index.ts";

  /**
   * Top-level functions, extracted by the file's own brace style: a `function`
   * at column 0, closing at a `}` at column 0.
   *
   * CRLF IS COLLAPSED FIRST, and that is load-bearing rather than tidy. The
   * close test is an exact compare against `"}"`, so on a CRLF file every line
   * reads `"}\r"`, no function ever finds its end, and every body runs to EOF.
   * Measured 2026-08-11 on app/lib/operator/api.server.ts, which is CRLF on
   * disk: NINE functions each swallowed the file's TWO query sites and the
   * accounting read 18 of 2. app/db/index.ts hid this for months by happening
   * to be LF. The accounting assertion is what surfaced it.
   *
   * @param {string} source comment-stripped source
   */
  function topLevelFunctions(source) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (!m) continue;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j] === "}") { end = j; break; }
      }
      out.push({ name: m[1], body: lines.slice(i, end + 1).join("\n") });
    }
    return out;
  }

  /**
   * Posts readers permitted OUTSIDE the chokepoint file, by FILE AND FUNCTION.
   *
   * FUNCTION-SCOPED, never file-scoped, for the reason section 6 was built with
   * in the first place: a module-scoped exemption would excuse every future
   * reader anyone adds to that file, which is the vacuous form.
   *
   * `syncStatus` was found on 2026-08-11 by fixing the alias blindness above.
   * It had been outside this section's view since the operator API shipped.
   */
  const CHOKEPOINT_EXEMPT = {
    "app/lib/operator/api.server.ts::syncStatus":
      "the operator's diagnostic. It reports d1Posts (every row) ALONGSIDE " +
      "d1PubliclyVisible (the predicate applied), and the whole point is that the " +
      "two can disagree: comparing them is how store drift is detected. An " +
      "unpredicated count is the measurement, not a leak. Behind OPERATOR_TOKEN, " +
      "not a public route, and it returns counts rather than rows.",
  };

  /** Querying functions outside the chokepoint, file-qualified. */
  const outsideQueriers = [];
  for (const f of queryingFiles.filter((q) => q.rel !== CHOKEPOINT)) {
    const code = stripCommentsAndStrings(readFileSync(join(root, f.rel), "utf8"));
    const q = queryFor(f.bindings);
    for (const fn of topLevelFunctions(code)) {
      if ((fn.body.match(q) ?? []).length > 0) {
        outsideQueriers.push({ key: `${f.rel}::${fn.name}`, rel: f.rel, ...fn });
      }
    }
    const accountedHere = topLevelFunctions(code).reduce(
      (sum, fn) => sum + ((fn.body.match(q) ?? []).length),
      0,
    );
    ok(
      `every posts query in ${f.rel} landed inside an extracted function`,
      accountedHere === f.hits,
      `${accountedHere} of ${f.hits} accounted for. The extraction missed some, so the ` +
        `exemption assertions below do not cover this file.`,
    );
  }

  const unexplainedOutside = outsideQueriers.filter((f) => !(f.key in CHOKEPOINT_EXEMPT));
  ok(
    `every .from(posts) outside ${CHOKEPOINT} is a named exemption`,
    unexplainedOutside.length === 0,
    unexplainedOutside
      .map((f) => `${f.key} queries posts outside the DB layer`)
      .join("\n        ") +
      "\n        A reader outside the one reviewable file is how hard rule 1 gets bypassed " +
      "without anyone deciding to bypass it. If it is deliberate, add it to " +
      "CHOKEPOINT_EXEMPT with the reason.",
  );

  // The other direction: an exemption naming a reader that no longer exists is
  // permission nobody audits.
  for (const key of Object.keys(CHOKEPOINT_EXEMPT)) {
    ok(
      `chokepoint exemption ${key} still names a live posts reader`,
      outsideQueriers.some((f) => f.key === key),
      `${key} no longer queries posts, or was renamed or moved. Remove the exemption.`,
    );
  }

  const dbSource = readFileSync(join(root, CHOKEPOINT), "utf8");
  const dbCode = stripCommentsAndStrings(dbSource);
  const dbBindings = postsBindings(dbCode);
  const QUERY = queryFor(dbBindings);

  /*
   * Verified by accounting: every posts query in the file must land inside one
   * of the extracted bodies, and that count is asserted below rather than
   * assumed. If the file's style ever changes, the accounting assertion fails
   * rather than the scan silently missing a function.
   */
  const functions = topLevelFunctions(dbCode);

  const queriers = functions.filter((f) => (f.body.match(QUERY) ?? []).length > 0);
  const totalSites = (dbCode.match(QUERY) ?? []).length;
  const accounted = queriers.reduce(
    (sum, f) => sum + ((f.body.match(QUERY) ?? []).length),
    0,
  );

  ok(
    "every .from(posts) site was accounted for inside an extracted function",
    totalSites > 0 && accounted === totalSites,
    `${accounted} of ${totalSites} landed inside a function body. The function extraction ` +
      `missed some, so the per-function assertions below do not cover the file.`,
  );

  // Anti-vacuity floors, RE-MEASURED THROUGH THIS SCAN 2026-08-24 by running
  // the gate: 14 sites, 8 composing. They were set against the 2026-08-10
  // counts and had not moved since.
  ok(
    "the posts-reader scan found a plausible number of query sites",
    totalSites >= 13,
    `${totalSites} found, floor 13, measured 14. A broken matcher reports zero violations.`,
  );

  const composing = queriers.filter((f) => PREDICATE.test(f.body));
  ok(
    "at least some readers were seen composing the predicate",
    composing.length >= 7,
    `${composing.length} of ${queriers.length} compose it. If this collapses, the ` +
      `PREDICATE matcher has broken and every reader would read as a violation or none would.`,
  );

  const bypassing = queriers.filter((f) => !PREDICATE.test(f.body));
  const unexplained = bypassing.filter((f) => !(f.name in VISIBILITY_EXEMPT));
  ok(
    "every posts reader composes the predicate, or is a named exemption",
    unexplained.length === 0,
    unexplained
      .map((f) => `${CHOKEPOINT}::${f.name} queries posts with no visibility predicate`)
      .join("\n        ") +
      "\n        Hard rule 1: every public read goes through publiclyVisible(). If this " +
      "reader is deliberately exempt, add it to VISIBILITY_EXEMPT with the reason.",
  );

  // The other direction: an exemption naming a function that no longer exists,
  // or that now composes the predicate, is permission nobody audits.
  for (const name of Object.keys(VISIBILITY_EXEMPT)) {
    const fn = queriers.find((f) => f.name === name);
    ok(
      `exemption ${name} still names a posts reader that bypasses the predicate`,
      fn !== undefined && !PREDICATE.test(fn.body),
      !fn
        ? `${name} no longer queries posts. Remove the exemption.`
        : `${name} now composes the predicate, so the exemption is stale. Remove it.`,
    );
  }

  console.log(
    `     ${totalSites} query site(s) in ${CHOKEPOINT}, ${queriers.length} function(s), ` +
      `${composing.length} composing, ${Object.keys(VISIBILITY_EXEMPT).length} exempt`,
  );
} catch (error) {
  fail("the posts-reader coverage check could not run", String(error));
}

/* ------------------- 7. nothing DELETEs from an FTS index or counts one */

/*
 * HARD RULE 2's UNGATED HALF. Backlog item 6.
 *
 * `check:backup` derives the table list and excludes fts5 tables from the
 * export. Nothing stopped code from writing to one. Two ways to corrupt or
 * misread an fts5 index, both recorded in hard rule 2 and both enforced by
 * nobody until now:
 *
 *   DELETE FROM <index>   corrupts it. The repair is
 *                         INSERT INTO <index>(<index>) VALUES('rebuild').
 *   COUNT(*) on <index>   reads THROUGH to the content table on an
 *                         external-content index, so it can NEVER detect drift.
 *                         Measured: with the index emptied, COUNT(*) still read
 *                         7 while the docsize shadow read 0.
 *
 * Section 5 explicitly SKIPS virtual tables in its raw-SQL column scan
 * (`${virtualTables.length} fts5 table(s) skipped`), so an added
 * `DELETE FROM posts_fts` passes every other gate in this repo.
 *
 * ## THE SCAN INVERTS SECTION 5's MACHINERY
 *
 * Section 5 STRIPS literals to find code. This scans INSIDE them, because SQL
 * in this codebase only ever exists as a string. Comments are stripped FIRST so
 * prose explaining the rule cannot be read as a statement, which is the trap
 * check:logo, check:contrast, check:features, check:headers, check:urls and
 * check:secrets have each hit.
 *
 * ## THE TABLE LIST IS DERIVED, NEVER NAMED
 *
 * From `drizzle/*.sql` replayed into memory, then classified by the shared
 * `scripts/lib/sqlite-tables.mjs`. It was one index, then two, then three; a
 * hardcoded list is how the fourth gets missed. Shadows come by prefix, so a
 * new index brings its own along.
 */

console.log("\n  7. no DELETE FROM an FTS index, and no COUNT(*) on one");

try {
  const ftsDb = new DatabaseSync(":memory:");
  for (const file of readdirSync(join(root, "drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    ftsDb.exec(readFileSync(join(root, "drizzle", file), "utf8"));
  }
  const ftsRows = /** @type {any[]} */ (
    ftsDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all()
  );
  const classified = classifySqliteTables(ftsRows);
  const owned = ftsOwnedTables(classified);

  /*
   * EXACTLY THREE, and this is a tripwire rather than a preference. A fourth
   * index means the corpus grew and the floors below want re-measuring; zero
   * means the classifier or the migration replay broke, and a broken classifier
   * reports zero violations exactly like a clean repo.
   */
  ok(
    "the derived fts5 index list is the three known indexes",
    classified.virtual.length === 3,
    `derived ${classified.virtual.length}: ${classified.virtual.join(", ") || "(none)"}. ` +
      `Zero means the classifier broke. More means a new index landed: re-measure the ` +
      `floors in this section and confirm its shadows are covered.`,
  );
  ok(
    "each index brought its shadow tables",
    classified.shadow.length >= classified.virtual.length * 3,
    `${classified.shadow.length} shadow(s) for ${classified.virtual.length} index(es): ` +
      `${classified.shadow.join(", ")}`,
  );

  /*
   * NO LITERAL EXTRACTION HERE ANY MORE, replaced 2026-08-21, and this is the
   * third instance of the class that killed section 5.
   *
   * ## WHAT WAS PROVEN, rather than reasoned
   *
   * The old matcher understood quotes but not REGEX LITERALS, so a `/"/`
   * anywhere in a file opened a string that never closed. MEASURED across the
   * 189 files this walk scans: 137 regex literals containing a quote, in 28
   * files, producing 22 phantom "literals" over 800 characters, the longest
   * 21,551. The 1,523-character phantom in `search.server.ts` that the
   * 2026-08-16 audit named is still there.
   *
   * **AND THE GUARD WAS BYPASSED, DEMONSTRATED WITH A PLANT IN BOTH
   * DIRECTIONS.** The identical string, `"DELETE FROM posts_fts WHERE rowid =
   * 1"`, was added to two files. In `app/lib/once.mjs`, which carries no regex
   * literals, this section FIRED and named it. In `app/lib/search/search.server.ts`,
   * which carries three phantoms, it was INVISIBLE and the gate reported 167
   * checks and zero failures. Hard rule 2's guard could be walked past in the
   * one file most likely to contain FTS SQL.
   *
   * ## WHY SCANNING THE SOURCE DIRECTLY IS THE RIGHT REPLACEMENT
   *
   * Section 5 needed literal BOUNDARIES because it extracted column names from
   * inside a statement and compared them to a schema. **This section only asks
   * whether a forbidden pattern OCCURS.** Boundaries buy it nothing and cost it
   * a bypass, so they go. Nothing is skipped, so a false negative of that shape
   * is no longer possible.
   *
   * The trade is a false-positive surface, and it is small and self-announcing:
   * `DELETE FROM posts_fts` is not valid JavaScript outside a string, comments
   * are already stripped, and if it ever fires on something harmless the failure
   * prints the file and the surrounding text.
   */
  const SQLISH = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|CREATE\s+VIRTUAL)\b/gi;

  let filesScanned = 0;
  let sqlLiterals = 0;
  let docsizeCounts = 0;
  /** @type {string[]} */
  const deleteViolations = [];
  /** @type {string[]} */
  const countViolations = [];

  /*
   * `owned` is what DELETE_FTS is built from, so it gets its OWN guard rather
   * than inheriting one. The two assertions above cover `classified.virtual`
   * and `classified.shadow`, which IMPLY this list is non-empty; an implication
   * is not a guard, and it is the first thing that would break if
   * ftsOwnedTables changed what it returns. An empty alternation makes
   * DELETE_FTS match every `DELETE FROM`, so this section would report zero
   * violations by matching everything. Found by check:assertions rule (d).
   */
  ok(
    "the fts-owned table list is non-empty before it becomes a RegExp",
    owned.length > 0,
    `ftsOwnedTables returned nothing from ${classified.virtual.length} index(es); ` +
      `an empty alternation would make DELETE_FTS match every DELETE FROM`,
  );

  const owningAlternation = owned.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const DELETE_FTS = new RegExp(`\\bDELETE\\s+FROM\\s+(${owningAlternation})\\b`, "i");
  const COUNT_INDEX = new RegExp(
    `COUNT\\s*\\(\\s*\\*\\s*\\)\\s*FROM\\s+(${classified.virtual.join("|")})\\b`,
    "i",
  );

  for (const dir of ["app", "workers", "scripts"]) {
    for (const file of sourceFiles(join(root, dir))) {
      const rel = relative(root, file).split(sep).join("/");
      // Self-exclusion, same reason as section 1 and section 5: this file's own
      // failure messages and regexes name the very statements it forbids.
      if (rel === "scripts/check-invariants.mjs") continue;
      if (rel.endsWith(".d.ts")) continue;
      filesScanned += 1;

      const code = joinConcatenatedLiterals(
        stripComments(readFileSync(file, "utf8")),
      );
      /*
       * SCOPE, COUNTED ON THE SOURCE. `sqlLiterals` used to count extracted
       * literals; it now counts SQL-ish MATCHES, which is the honest measure of
       * what this scan has to look at. The floor below moves with it.
       */
      sqlLiterals += (code.match(SQLISH) ?? []).length;

      {
        const literal = code;
        /*
         * Both guarded on a NON-EMPTY derived list. With zero indexes the
         * alternation collapses to `()`, which matches the empty string and so
         * matches EVERY literal: the tripwire above has already failed by then,
         * and without this the same run also reports every DELETE in the repo
         * as an FTS violation. Found by the vacuity plant, which produced two
         * misleading extra failures beside the one it was written to fire.
         */
        /*
         * A WINDOW AROUND THE MATCH, not the head of the file. `literal` is now
         * the whole source, so slicing from its start printed the import block
         * on the defect-replay run: it named the file and never showed the
         * offence, which is half a failure message.
         */
        const window = (/** @type {RegExp} */ re) => {
          const m = literal.match(re);
          if (!m || m.index === undefined) return "(matched, but not located)";
          const from = Math.max(0, m.index - 30);
          return literal
            .slice(from, m.index + m[0].length + 40)
            .replace(/\s+/g, " ")
            .trim();
        };
        if (owned.length > 0 && DELETE_FTS.test(literal)) {
          deleteViolations.push(`${rel}: ...${window(DELETE_FTS)}...`);
        }
        if (classified.virtual.length > 0 && COUNT_INDEX.test(literal)) {
          countViolations.push(`${rel}: ...${window(COUNT_INDEX)}...`);
        }
        /*
         * MATCHES, not literals. `sync-content.mjs` builds its health check by
         * concatenating three fragments, and `joinConcatenatedLiterals` merges
         * them into ONE literal carrying all three counts, so counting literals
         * reported 1 where the repo has 3. Found by this assertion failing on
         * its own first run.
         */
        docsizeCounts += [
          ...literal.matchAll(/COUNT\s*\(\s*\*\s*\)\s*FROM\s+\w+_docsize\b/gi),
        ].length;
      }
    }
  }

  /*
   * ANTI-VACUITY, RE-MEASURED 2026-08-21 because the counter changed what it
   * counts. It was extracted LITERALS, floored at 45 against a measured 61. It
   * is now SQL-ish MATCHES in the comment-stripped source, which is the honest
   * measure of what this scan looks at now that it no longer extracts anything.
   *
   * MEASURED THROUGH THIS EXACT PIPELINE: 189 files, 175 matches. Floored a
   * quarter under at 131, so ordinary refactoring does not trip it. Carrying
   * the old 45 forward would have been a floor set against a different
   * instrument, satisfied by roughly a quarter of the corpus going dark.
   *
   * A zero means the walk broke, and "0 violations" from a broken walk is
   * indistinguishable from a clean repo. Hard rule 10.
   */
  ok(
    "the source scan examined a plausible number of files",
    filesScanned >= 193,
    `${filesScanned} scanned; expected the whole of app, workers and scripts`,
  );
  ok(
    "the source scan found SQL to examine",
    sqlLiterals >= 169,
    `${sqlLiterals} SQL-ish match(es) found, floor 169, measured 184 on ` +
      `2026-08-24. The walk is broken, so a green result below would mean nothing.`,
  );

  ok(
    "no source literal DELETEs from an fts5 index or its shadows",
    deleteViolations.length === 0,
    deleteViolations.join("\n        ") +
      "\n        DELETE FROM an fts5 table corrupts the index. The repair is " +
      "INSERT INTO <index>(<index>) VALUES('rebuild').",
  );

  ok(
    "no source literal counts rows in an fts5 index directly",
    countViolations.length === 0,
    countViolations.join("\n        ") +
      "\n        COUNT(*) on an external-content index reads THROUGH to the content " +
      "table and can never detect drift. Count the *_docsize shadow instead.",
  );

  /*
   * The companion, and it is the positive half. Enumerated before asserting,
   * and RE-ENUMERATED 2026-08-24 because the old sentence here had gone false:
   * `sync-content.mjs` is no longer the only FTS health check in the repo. The
   * three shadow counts moved into `app/lib/health/checks.server.ts` when the
   * health endpoint landed, `app/lib/operator/api.server.ts` counts one, and
   * sync-content keeps one. If these disappear, the drift check has gone and
   * nothing else would say so.
   */
  ok(
    "at least one FTS health check counts a *_docsize shadow",
    docsizeCounts >= 5,
    `${docsizeCounts} found, floor 5, measured 6 on 2026-08-24. If this dropped, the ` +
      `checks that can detect FTS drift have been removed or rewritten to count the index.`,
  );

  console.log(
    `     ${classified.virtual.length} index(es), ${classified.shadow.length} shadow(s), ` +
      `${filesScanned} file(s), ${sqlLiterals} SQL literal(s), ${docsizeCounts} docsize count(s)`,
  );
} catch (error) {
  fail("the FTS write and count check could not run", String(error));
}

/* --------------- 8. every search_docs READER composes the predicate ------ */

/*
 * THE OTHER HALF OF HARD RULE 1, and it was uncovered until 2026-08-11.
 *
 * Section 6 asserts that every `posts` reader composes the predicate. But the
 * public search surface does not read `posts`: it reads `search_docs`, in raw
 * SQL, and section 6's scan is for `.from(<posts binding>)`. So the two
 * `zeroState` queries restated the visibility rule inline and nothing looked at
 * them.
 *
 * MEASURED BEFORE FIXING: deleting the entire predicate from the zeroState tag
 * query left check:invariants, check:search, check:content, check:urls and
 * check:policy ALL GREEN. That is the exact shape of a draft leak on /search's
 * zero state, invisible to every offline instrument.
 *
 * The external audit reported this and gave the wrong reason (it said section 6
 * should have covered the file, and that the `d.` alias was the obstacle).
 * Section 6 DOES cover the file: a Drizzle-shaped no-predicate `posts` read
 * planted there fires by name. The alias was only why the queries could not
 * CALL the shared function. The real gap is the one this section closes: a
 * whole TABLE nobody was watching.
 *
 * TWO LEVELS, because two of the four readers compose it indirectly:
 *
 *   direct    `visibilityClause(...)` in the same function
 *   indirect  `filters.clause`, the FilterSql that buildFilters assembles
 *
 * The indirection is only trustworthy if buildFilters itself composes the
 * predicate, so that is asserted separately rather than assumed.
 */

console.log("\n  8. every search_docs reader composes the visibility predicate");

try {
  const DIRECT = /visibilityClause\s*\(/;
  const INDIRECT = /\bfilters\s*\.\s*clause\b/;

  /*
   * CLASSIFIED PER SQL LITERAL, not per function body, and both halves of that
   * were learned by getting it wrong first.
   *
   * `DELETE FROM search_docs` CONTAINS the substring `FROM search_docs`, so a
   * body-level `FROM` test reported both of publish.server.ts's write helpers
   * as unpredicated readers. And `runIndex` reaches the table through
   * `JOIN search_docs d`, never `FROM`, so a `FROM`-only test missed the very
   * reader most worth checking.
   *
   * A literal is a READ when it is a SELECT that names the table in either
   * position; it is a WRITE when it names it after a write verb. Writes carry
   * no predicate and must not.
   */
  const READS = /\bSELECT\b[\s\S]*?\b(?:FROM|JOIN)\s+search_docs\b/i;
  const WRITES = /\b(?:INSERT\s+INTO|DELETE\s+FROM|UPDATE)\s+search_docs\b/i;
  /** Backtick, single- and double-quoted literals, which is where the SQL is. */
  const LITERALS = /`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g;

  /** @param {string} source */
  function topLevelFns(source) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (!m) continue;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j] === "}") { end = j; break; }
      }
      out.push({ name: m[1], body: lines.slice(i, end + 1).join("\n") });
    }
    return out;
  }

  const readers = [];
  let writeSites = 0;
  let scanned = 0;
  for (const file of sourceFiles(join(root, "app"))) {
    const rel = relative(root, file).split(sep).join("/");
    if (rel.endsWith(".d.ts")) continue;
    scanned += 1;
    const code = stripComments(readFileSync(file, "utf8"));
    if (!/search_docs/.test(code)) continue;
    for (const fn of topLevelFns(code)) {
      /*
       * ONE QUERY, not one function, and the difference is the whole assertion.
       *
       * The first version asked whether the FUNCTION composed the predicate.
       * `zeroState` runs TWO queries, so deleting the predicate from one of
       * them left the other satisfying the test and the audit's own repro
       * passed. Per-function granularity is exactly the hole this section
       * exists to close.
       *
       * A `prepare(` argument is one statement. Extracted by counting
       * parentheses from the call, so an interpolation containing parens does
       * not truncate it.
       */
      for (const call of fn.body.matchAll(/\bprepare\s*\(/g)) {
        const open = (call.index ?? 0) + call[0].length - 1;
        let depth = 0;
        let end = open;
        for (let i = open; i < fn.body.length; i += 1) {
          if (fn.body[i] === "(") depth += 1;
          else if (fn.body[i] === ")") {
            depth -= 1;
            if (depth === 0) { end = i; break; }
          }
        }
        let statement = fn.body.slice(open, end + 1);

        /*
         * `prepare(sql)` where `sql` was assembled above is the dominant shape:
         * runIndex and runBrowse both build the string first. Resolving the
         * bare identifier back to its assignment is what makes those two
         * visible; without it this scan saw 2 readers where there are 3, and
         * the two it missed were the ones serving actual search results.
         */
        const bareArg = statement.match(/^\(\s*([A-Za-z_$][\w$]*)\s*\)$/);
        if (bareArg) {
          const assign = fn.body.match(
            new RegExp(`\\b(?:const|let)\\s+${bareArg[1]}\\s*=\\s*\`(?:\\\\.|[^\`\\\\])*\``),
          );
          if (assign) statement = assign[0];
        }

            /*
         * ============================================================
         * THE SAME DEFECTIVE MATCHER, KEPT HERE ON PURPOSE, WITH A TRIPWIRE.
         * ============================================================
         *
         * `LITERALS` is byte-identical to the matcher deleted from section 5
         * and replaced in section 7 on 2026-08-21, and it does not understand
         * REGEX LITERALS. Section 7's copy was proven bypassable with a plant.
         * This one is kept, and the difference is measured rather than assumed.
         *
         * **Section 7 scanned whole files. This scans one `prepare()` argument**,
         * already bounded by paren counting before the matcher ever runs.
         * MEASURED 2026-08-21 across every `app/` file carrying `search_docs`:
         * 25 prepare() arguments, longest 1,163 characters, and ZERO of them
         * contain a regex literal. The desync has nothing to desync on.
         *
         * It is not replaced the way section 7 was, because section 7 only
         * asked whether a pattern OCCURS while this one must CLASSIFY each
         * literal as a read or a write. Granularity is the assertion here:
         * `DELETE FROM search_docs` contains `FROM search_docs`, so a
         * whole-statement test reported both write helpers as unpredicated
         * readers, and that is recorded above as already having been got wrong.
         *
         * SO THE RISK IS BOUNDED AND MADE TO ANNOUNCE ITSELF. The moment a
         * regex literal appears inside a scanned prepare() argument, the
         * measurement above stops being true and this fails, rather than
         * quietly classifying a desynced region.
         */
        ok(
          `no regex literal inside the prepare() argument in ${rel}::${fn.name}`,
          !/(^|[=(,:!&|?{;[]\s*)\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\\n])+\/[gimsuy]*/.test(
            statement,
          ),
          "LITERALS below does not understand regex literals, so one here would " +
            "desync quote pairing and this section would classify a phantom. " +
            "Measured 0 across 25 prepare() arguments on 2026-08-21; that is the " +
            "premise this section rests on and it has just stopped holding.",
        );

        const literals = statement.match(LITERALS) ?? [];
        if (literals.some((l) => WRITES.test(l) && !READS.test(l))) {
          writeSites += 1;
          continue;
        }
        if (!literals.some((l) => READS.test(l))) continue;
        readers.push({
          key: `${rel}::${fn.name}`,
          direct: DIRECT.test(statement),
          indirect: INDIRECT.test(statement),
        });
      }
    }
  }

  ok(
    "the search_docs reader scan examined a plausible number of files",
    scanned >= 140,
    `${scanned} scanned; a green result below would mean nothing`,
  );
  /*
   * NON-EMPTY SCOPE. Zero readers found means the SQL was reworded and this
   * whole section would report perfect compliance by examining nothing.
   *
   * MEASURED THROUGH THIS SCAN: 4 reader QUERIES. runIndex and runBrowse
   * contribute one each and zeroState contributes two, because the unit here is
   * a `prepare()` call rather than a function. Tight rather than slack, for the
   * same reason as check:secrets' three-file workers floor: a set this small
   * cannot absorb slack without losing the ability to notice one disappearing.
   */
  ok(
    "the scan found search_docs readers at all",
    readers.length >= 5,
    `${readers.length} found; expected at least 4 (runIndex, runBrowse, and zeroState's ` +
      `two). The SELECT shape changed and this scan no longer sees it.`,
  );

  /**
   * Readers deliberately without the predicate, each with the reason.
   *
   * A NAMED LIST, on the same rule as every other exemption map here: a pattern
   * would let a new reader match by accident, and a name cannot. Both directions
   * are policed below, so an entry that stops being needed fails rather than
   * standing as a permanent excuse.
   *
   * @type {Record<string, string>}
   */
  const SEARCH_DOCS_EXEMPT = {
    "app/lib/health/checks.server.ts::runHealthChecks":
      "COUNTS ROWS, SERVES NONE. The fts-equality health check compares " +
      "COUNT(*) FROM search_docs against search_identity_docsize and " +
      "search_prose_docsize. The FTS indexes are built from ALL of search_docs, " +
      "drafts included, so composing visibilityClause on one side of that " +
      "comparison and not the other would MANUFACTURE drift on every run: the " +
      "check would fail permanently and for a reason no reader could act on. " +
      "It returns one integer, never a row, and /api/health publishes only a " +
      "boolean derived from it. This became visible on 2026-08-23 when the " +
      "checks moved from workers/ into app/, which is the only tree this " +
      "section scans; the query is unchanged and was simply out of scope before.",
  };

  const bare = readers.filter((r) => !r.direct && !r.indirect);
  const unexplainedBare = bare.filter((r) => !(r.key in SEARCH_DOCS_EXEMPT));
  ok(
    "every search_docs reader composes visibilityClause, or is a named exemption",
    unexplainedBare.length === 0,
    unexplainedBare
      .map((r) => `${r.key} selects from search_docs with no visibility predicate`)
      .join("\n        ") +
      "\n        Hard rule 1 reaches the search index too. Compose visibilityClause(), " +
      "passing NO_ALIAS for an unaliased query, or add the reader to " +
      "SEARCH_DOCS_EXEMPT with the reason.",
  );

  /*
   * THE OTHER DIRECTION. An exemption naming a reader that has since gained the
   * predicate, or that no longer reads search_docs at all, is a stale excuse
   * rather than a standing decision, and a stale excuse is how the next real
   * bypass gets waved through under an old name.
   */
  for (const key of Object.keys(SEARCH_DOCS_EXEMPT)) {
    ok(
      `search_docs exemption ${key} still names a bare reader`,
      bare.some((r) => r.key === key),
      readers.some((r) => r.key === key)
        ? `${key} now composes the predicate, so the exemption is stale. Remove it.`
        : `${key} no longer reads search_docs, or was renamed or moved. Remove the exemption.`,
    );
  }

  // The indirection is only worth trusting if its source composes the rule.
  const searchSrc = stripComments(
    readFileSync(join(root, "app", "lib", "search", "search.server.ts"), "utf8"),
  );
  const buildFilters = topLevelFns(searchSrc).find((f) => f.name === "buildFilters");
  ok(
    "buildFilters, which every indirect reader relies on, composes the predicate",
    Boolean(buildFilters) && DIRECT.test(buildFilters?.body ?? ""),
    !buildFilters
      ? "buildFilters no longer exists, so filters.clause is an unverified indirection"
      : "buildFilters no longer calls visibilityClause, so every reader trusting " +
        "filters.clause is composing something else",
  );

  console.log(
    `     ${readers.length} reader(s): ${readers.filter((r) => r.direct).length} direct, ` +
      `${readers.filter((r) => !r.direct && r.indirect).length} via filters.clause, ` +
      `${writeSites} write statement(s) excluded`,
  );
} catch (error) {
  fail("the search_docs reader check could not run", String(error));
}

/* ------------------- 9. trash hides an asset from the library, not from R2 -- */

/*
 * **BEHAVIOURAL, not structural, and that is what makes it worth having.**
 *
 * Sections 6 and 8 assert that a reader COMPOSES a predicate. This one asserts
 * what the predicate DOES, by applying the real migrations to an empty SQLite
 * database, inserting a media fixture, and running the predicate `notTrashed()`
 * renders to. The second opinion is not another function, which would be a
 * mirror; it is the DATABASE.
 *
 * It exists because trash on this table is counter-intuitive by design and the
 * two halves fail in opposite directions:
 *
 *   TOO NARROW   a library view that forgets the predicate offers a trashed
 *                asset back to the author, and the role chip that led them
 *                there counted it.
 *   TOO WIDE     a RECONCILIATION reader that applies it sees an object in R2
 *                with no row, and `check:media` backfills the row, which is
 *                trash undone by a gate on the next reconcile. The object is
 *                untouched by trashing, so this direction is not hypothetical.
 *
 * Both directions are asserted, and the anti-vacuity control runs the same
 * queries WITHOUT the predicate first, so a fixture that accidentally contained
 * no trashed row could not report compliance.
 */

console.log("\n  9. trash hides an asset from the library and not from reconciliation");

try {
  const dbModule = await bundle(
    join(root, "app", "db", "index.ts"),
    "db-trash.mjs",
    /^~\/(lib\/context|lib\/auth|lib\/timing)/,
  );
  const { SQLiteSyncDialect } = await import("drizzle-orm/sqlite-core");
  const clause = new SQLiteSyncDialect().sqlToQuery(dbModule.notTrashed()).sql;

  ok(
    "notTrashed() renders to SQL naming the trashed_at column",
    /trashed_at/.test(clause),
    `rendered ${JSON.stringify(clause)}. If the column were renamed and the ` +
      `predicate not, every assertion below would still pass against a fixture ` +
      `built by this gate, so the NAME is checked before the behaviour.`,
  );

  const dbSourceForTrash = stripComments(
    readFileSync(join(root, "app", "db", "index.ts"), "utf8"),
  );

  const trashDb = new DatabaseSync(":memory:");
  for (const file of readdirSync(join(root, "drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    trashDb.exec(readFileSync(join(root, "drizzle", file), "utf8"));
  }

  /*
   * THREE ROWS, and the two brand rows are the point.
   *
   * One live content row, one live brand row and one TRASHED brand row. A
   * fixture with a trashed row of a role nothing else carries would let a
   * broken role count pass, because the role would simply vanish rather than
   * report the wrong number. Two rows sharing a role is what makes the count
   * assertion able to read 2 when it should read 1.
   */
  const insert = trashDb.prepare(
    `INSERT INTO media (key, storage, kind, role, alt, caption, tags, trashed_at)
     VALUES (?, 'r2', 'image', ?, '', '', ?, ?)`,
  );
  insert.run("live-content.png", "content", ",alpha,", null);
  insert.run("live-brand.svg", "brand", "", null);
  insert.run("trashed-brand.svg", "brand", "", "2026-08-15 12:00:00");

  /** @param {string} where @returns {number} */
  const countWhere = (where) =>
    Number(
      /** @type {any} */ (
        trashDb.prepare(`SELECT count(*) AS n FROM media WHERE ${where}`).get()
      ).n,
    );
  /** @param {string} where @returns {number} */
  const brandWhere = (where) =>
    Number(
      /** @type {any} */ (
        trashDb
          .prepare(`SELECT count(*) AS n FROM media WHERE role = 'brand' AND ${where}`)
          .get()
      ).n,
    );

  /* ANTI-VACUITY FIRST. Without the predicate the fixture must show all three
   * and both brand rows, or the assertions below prove nothing about it. */
  ok(
    "the fixture actually contains a trashed row",
    countWhere("1=1") === 3 && brandWhere("1=1") === 2,
    `unfiltered listing ${countWhere("1=1")} of 3, unfiltered brand ${brandWhere("1=1")} of 2. ` +
      `The fixture is wrong and every assertion below would be vacuous.`,
  );

  ok(
    "a trashed row is absent from the default listing",
    countWhere(clause) === 2,
    `the listing predicate returned ${countWhere(clause)} row(s), expected 2. A trashed ` +
      `asset is being offered back to the author.`,
  );
  ok(
    "a trashed row is absent from its role count",
    brandWhere(clause) === 1,
    `the brand role count returned ${brandWhere(clause)}, expected 1. The chip would lead ` +
      `to a grid with fewer rows than the number promised.`,
  );
  ok(
    "the Trash view sees exactly the trashed rows",
    countWhere("trashed_at IS NOT NULL") === 1,
    `the trash predicate returned ${countWhere("trashed_at IS NOT NULL")}, expected 1`,
  );
  /* THE OTHER DIRECTION. Reconciliation must still see it, or check:media
   * backfills the row and undoes the trash on the next reconcile. */
  ok(
    "reconciliation still sees the trashed row",
    countWhere("1=1") === 3,
    `an unfiltered read returned ${countWhere("1=1")}, expected 3. listMediaRecords, ` +
      `mediaRecordsFor, existingMediaKeys and mediaRecord must NOT filter, because ` +
      `the R2 object is untouched by trashing.`,
  );

  /*
   * RESTORE PUTS THE ROW BACK IN ITS ROLE COUNT, asserted as a round trip
   * rather than as a second predicate.
   *
   * Trash and restore are one mechanism read in two directions, and the failure
   * worth catching is the asymmetric one: a restore that clears the flag but
   * leaves the row out of the count, which would look to the author like the
   * asset came back and the chip did not. Done by mutating the fixture and
   * re-reading, so it exercises the column rather than a predicate about it.
   */
  trashDb.exec(`UPDATE media SET trashed_at = NULL WHERE key = 'trashed-brand.svg'`);
  ok(
    "a restored row returns to the default listing",
    countWhere(clause) === 3,
    `after restore the listing predicate returned ${countWhere(clause)}, expected 3`,
  );
  ok(
    "a restored row returns to its role count",
    brandWhere(clause) === 2,
    `after restore the brand role count returned ${brandWhere(clause)}, expected 2. ` +
      `Restore cleared the flag without the count following it back.`,
  );
  ok(
    "the Trash view is empty once the last trashed row is restored",
    countWhere("trashed_at IS NOT NULL") === 0,
    `the trash predicate returned ${countWhere("trashed_at IS NOT NULL")}, expected 0`,
  );
  // Put it back, so the tag assertions below read the fixture as built.
  trashDb.exec(
    `UPDATE media SET trashed_at = '2026-08-15 12:00:00' WHERE key = 'trashed-brand.svg'`,
  );

  /* The tags column, asserted here because the migration is what creates it and
   * this is the only place the migration is actually executed. */
  ok(
    "the tags column exists and stores the delimiter-wrapped form",
    /** @type {any} */ (
      trashDb.prepare(`SELECT tags FROM media WHERE key = 'live-content.png'`).get()
    ).tags === ",alpha,",
    "the wrapping is what makes an exact tag match possible with LIKE",
  );
  ok(
    "an exact tag needle separates a tag from a longer tag containing it",
    Number(
      /** @type {any} */ (
        trashDb
          .prepare(`SELECT count(*) AS n FROM media WHERE tags LIKE '%,alpha,%'`)
          .get()
      ).n,
    ) === 1 &&
      Number(
        /** @type {any} */ (
          trashDb
            .prepare(`SELECT count(*) AS n FROM media WHERE tags LIKE '%,alph,%'`)
            .get()
        ).n,
      ) === 0,
    "this is the property the storage form was chosen for, asserted in SQLite " +
      "rather than only in the unit test's LIKE emulation",
  );

  /*
   * THE PERMANENT DELETE STILL REFUSES A CITED OBJECT.
   *
   * Trash does not go near this path and must not: Delete permanently runs the
   * EXISTING refcount-guarded claim, and the whole safety argument of the media
   * library rests on that one statement staying atomic and staying guarded. The
   * risk this section is written against is a later trash-shaped refactor
   * folding `trashed_at` into `claimMediaKeyForDelete` and dropping the
   * `NOT EXISTS` while rewriting the WHERE.
   *
   * TWO ASSERTIONS, and their boundaries differ, which is why they are not one:
   *
   *   STRUCTURAL, over the shipped source. The guard is still composed inside
   *   the claim. This is the one that would catch the refactor.
   *
   *   BEHAVIOURAL, over the fixture. The SQL below is written HERE and is
   *   therefore a MODEL of the guard rather than the guard itself, which is a
   *   weaker claim than the trash assertions above and is stated as such: it
   *   proves the refcount semantics do what the library relies on, not that
   *   this exact statement ships.
   */
  const claim = dbSourceForTrash.match(
    /export async function claimMediaKeyForDelete[\s\S]*?\n\}/,
  );
  ok(
    "claimMediaKeyForDelete still composes the NOT EXISTS refcount guard",
    Boolean(claim) && /NOT EXISTS[\s\S]*?mediaRefs/.test(claim?.[0] ?? ""),
    "the permanent delete's refusal is one statement, and it is the only thing " +
      "standing between Delete permanently and a published page rendering a " +
      "broken image. Trash must not be folded into it.",
  );

  trashDb.exec(
    `CREATE TABLE IF NOT EXISTS fixture_refs (media_key TEXT NOT NULL)`,
  );
  trashDb.exec(`INSERT INTO fixture_refs (media_key) VALUES ('live-content.png')`);
  /** @param {string} key @returns {number} */
  const claimable = (key) =>
    Number(
      /** @type {any} */ (
        trashDb
          .prepare(
            `SELECT count(*) AS n FROM media WHERE key = ?
               AND NOT EXISTS (SELECT 1 FROM fixture_refs WHERE media_key = ?)`,
          )
          .get(key, key)
      ).n,
    );
  ok(
    "a CITED asset cannot be claimed for permanent deletion",
    claimable("live-content.png") === 0,
    "the refcount guard would let a delete through while a post cites the asset",
  );
  ok(
    "an UNCITED asset can be claimed, so the guard is not refusing everything",
    claimable("trashed-brand.svg") === 1,
    "a guard that refuses every key would satisfy the assertion above vacuously",
  );

  /*
   * **EVERY BULK DELETE PATH ACTUALLY CALLS THE GUARD.**
   *
   * FOUND BY A PLANT, and the plant is the only reason this exists. Replacing
   * the call inside Empty trash with `const claimed = true` left this entire
   * gate GREEN: the assertions above prove the guard is still written
   * correctly, and nothing proved anybody still uses it. A guarded function
   * nobody calls is a guard with no subject, and Empty trash is precisely the
   * path where skipping it removes many objects at once.
   *
   * Source level, over the media route, because `check:admin-ui` cannot see
   * this: it stubs every `.server` import, so the action never runs there.
   */
  const mediaRoute = stripComments(
    readFileSync(join(root, "app", "routes", "admin.media._index.tsx"), "utf8"),
  );
  const emptyBranch = mediaRoute.match(/intent\s*===\s*"empty-trash"[\s\S]*?\n  \}/);
  ok(
    "the media route has an empty-trash branch to examine",
    Boolean(emptyBranch),
    "not found after stripping comments, so the two assertions below would be vacuous",
  );
  ok(
    "Empty trash claims each key through the refcount guard",
    /claimMediaKeyForDelete\s*\(/.test(emptyBranch?.[0] ?? ""),
    "the bulk delete must iterate the EXISTING guarded delete. A loop that " +
      "removed objects directly would delete files a published post cites, and " +
      "iterating the guarded delete IS the ruling this feature was built under.",
  );
  ok(
    "Empty trash deletes the object only AFTER the claim succeeds",
    /claimMediaKeyForDelete[\s\S]{0,400}?deleteMediaObject/.test(emptyBranch?.[0] ?? ""),
    "the claim comes first: deleting the row is what reserves the key, and " +
      "removing the object before claiming it reopens the TOCTOU the single " +
      "statement was written to close",
  );

  /*
   * **TAGS HAVE EXACTLY ONE WRITER, AND EVERY BULK PATH GOES THROUGH IT.**
   *
   * FOUND BY A PLANT, the second time this session's technique has paid:
   * replacing the call inside bulk tagging with a direct
   * `upsertMediaRecord({ tags: ... })` left every gate green. The unit tests
   * prove `serialiseTags` is correct and nothing proved anybody still calls it,
   * so a bulk path could write `,alpha,` by hand, get the wrapping subtly wrong
   * on the empty case, and silently produce rows no tag needle matches.
   *
   * This table has ALREADY been bitten by exactly this shape: `media_refs` is
   * deduplicated with space-joined keys by two shipped writers and NUL by the
   * tested helper, unreachable today only because `form` is a spaceless enum.
   * One writer, gated, is the repair for the class rather than for the instance.
   */
  const bulkTagBranch = mediaRoute.match(
    /intent\s*===\s*"bulk-add-tag"[\s\S]*?\n  \}/,
  );
  ok(
    "the media route has a bulk-tag branch to examine",
    Boolean(bulkTagBranch),
    "not found after stripping comments, so the assertions below would be vacuous",
  );
  ok(
    "bulk tagging writes through setMediaTags, the single tag writer",
    /setMediaTags\s*\(/.test(bulkTagBranch?.[0] ?? ""),
    "a bulk path that writes the column directly is a SECOND author of the " +
      "delimiter rule. The wrapping is what makes an exact tag match possible " +
      "with LIKE, and a hand-built value that gets the empty case wrong produces " +
      "rows no needle matches.",
  );
  /*
   * A THIRD ASSERTION WAS WRITTEN HERE AND REMOVED, deliberately, and the
   * removal is itself the finding.
   *
   * It read: no writer in this route sets the `tags` column directly. With the
   * plant in place that expression is demonstrably TRUE when evaluated against
   * the same file with the same comment strip, so the assertion should have
   * failed. In the gate it passed, and I could not account for the difference
   * within the session.
   *
   * Hard rule 10 settles what to do about that. An assertion whose firing
   * cannot be demonstrated is worse than no assertion: it reports coverage it
   * does not have and increments the executed count while doing it. So it is
   * removed rather than shipped unproven.
   *
   * The assertion above IS proven, by a plant whose firing line is in the
   * session report, and it catches the same defect from the other direction:
   * bulk tagging must CALL the single writer.
   *
   * OWED: find why the two evaluations disagree, then restore it with a plant
   * that fires.
   */

  console.log(
    `     3 fixture row(s), predicate ${JSON.stringify(clause)}`,
  );
} catch (error) {
  fail("the trash predicate check could not run", String(error));
}

/* ------------------------------------------------------------------ report */

rmSync(join(root, "node_modules", ".cache", "check-invariants"), {
  recursive: true,
  force: true,
});

/* ------- 10. every route-level artifact read goes through the shared reader */

/*
 * ONE 600KB READ PER REQUEST, ENFORCED AT THE CALLER.
 *
 * `loadArtifact` is not a database read. It is an HTTPS round trip off
 * Cloudflare's network to the GitHub Contents API for
 * `content/generated/posts.json`, 601,683 bytes, base64 encoded to roughly
 * 802,000 over the wire, then decoded and parsed inside the Worker. Measured on
 * production at 283 to 632ms per call.
 *
 * `artifactReader` memoizes it per request and the admin middleware installs
 * one on `artifactContext`, so callers that thread it share a single read.
 * `resolveCitations` takes that reader as an OPTIONAL third argument and falls
 * back to its own `loadArtifact` when it is absent, which keeps the resolver
 * usable from the operator path. That fallback is also exactly what makes a
 * missing argument silent: it works, it returns the right answer, and it costs
 * another full round trip.
 *
 * ## THIS IS NOT A TRIPWIRE. IT HAD A LIVE INSTANCE.
 *
 * Written 2026-08-20 after the gap had been NAMED as unasserted twice without
 * anyone looking for instances. There was one: the media loader's detail branch
 * called `resolveCitations(env, [row.key])` with no reader, inside the same
 * loader that had already resolved citations for the grid. So
 * `/admin/media?key=...` fetched the artifact TWICE per request, once for the
 * grid and once for the drawer. Found by grepping the call sites while writing
 * this section, not by measurement, because the detail view was never sampled.
 *
 * ## SCOPE, AND WHAT IT DELIBERATELY DOES NOT COVER
 *
 * ROUTE FILES ONLY. A route runs inside a request that has a context, so it can
 * always thread the reader. `app/lib/` is out of scope: `publish.server.ts`,
 * `operator/api.server.ts` and `posts.server.ts` call `loadArtifact` directly
 * and are reached from paths that hold only an `env`, so requiring a reader
 * there would be requiring something the caller cannot supply.
 *
 * It asserts the ARGUMENT IS PASSED, not that it is the right reader. Passing a
 * freshly constructed `artifactReader(env)` would satisfy this and still read
 * twice. No cheap source check separates those, and stating the limit is worth
 * more than a regex pretending otherwise.
 *
 * Comments are stripped first, because a `resolveCitations(env, keys)` written
 * in a comment would otherwise fail a section whose subject is code. That is the
 * inverse of the defect check:policy carried until 2026-08-19, where a comment
 * SATISFIED an assertion; both directions cost a real reading.
 */

console.log("\n  10. every route-level artifact read goes through the shared reader");

{
  const ROUTES_DIR = join(root, "app", "routes");
  let routeFiles = 0;
  let resolveCalls = 0;
  let threaded = 0;
  const unthreaded = [];
  const directLoads = [];

  for (const file of sourceFiles(ROUTES_DIR)) {
    const rel = relative(root, file).split(sep).join("/");
    if (rel.endsWith(".d.ts")) continue;
    routeFiles += 1;
    const code = stripComments(readFileSync(file, "utf8"));

    // Every resolveCitations call in a route must carry a third argument.
    // Matched to the closing paren of the call rather than to end of line,
    // because the threaded form wraps and an anchored line match would read a
    // wrapped call as two-argument.
    for (const m of code.matchAll(/resolveCitations\(([\s\S]{0,200}?)\)\s*[,;)]/g)) {
      resolveCalls += 1;
      const args = m[1];
      if (/artifactContext/.test(args)) threaded += 1;
      else unthreaded.push(`${rel}: resolveCitations(${args.replace(/\s+/g, " ").trim()})`);
    }

    // And no route may reach loadArtifact directly, which bypasses the memo
    // entirely. admin.tsx is the one permitted site: it is where the reader is
    // BUILT, and the call there is the memo's own body.
    if (rel !== "app/routes/admin.tsx") {
      for (const _m of code.matchAll(/\bloadArtifact\(/g)) directLoads.push(rel);
    }
  }

  /*
   * SCOPE, ASSERTED FIRST. Every assertion below reports "nothing unthreaded"
   * when the walk found no files, when the stripper emptied them, and when the
   * code is genuinely clean. Only the third is a pass.
   */
  ok(
    "the route walk found files and at least one resolveCitations call",
    routeFiles >= 34 && resolveCalls >= 3,
    `${routeFiles} route file(s), ${resolveCalls} call(s). A zero-scope walk agrees with anything.`,
  );

  ok(
    "every route-level resolveCitations threads the shared reader",
    unthreaded.length === 0,
    `${unthreaded.length} call(s) fall back to their own loadArtifact, each a separate ` +
      `600KB GitHub round trip:\n        ${unthreaded.join("\n        ")}`,
  );

  ok(
    "no route outside admin.tsx calls loadArtifact directly",
    directLoads.length === 0,
    `direct call(s) in: ${[...new Set(directLoads)].join(", ")}. Thread the reader from ` +
      `artifactContext instead, or state why this route cannot.`,
  );
}

/* ---------- 11. the drift badge reads a cache, not the AI Search index ---- */

/*
 * THE LAYOUT MUST NOT LIST THE INDEX ON A CACHE HIT.
 *
 * `listAllAskItems` pages AI Search and was measured on production 2026-08-19
 * across 12 direct samples of `/admin.data` at a median of 208ms and a maximum
 * of 2332ms. The admin layout runs on every admin page load, so that tail was
 * reachable from any click in the admin plane. `askDriftCount` serves the badge
 * from KV and only lists on a miss.
 *
 * ## ASSERTED ON STRUCTURE, NOT ON AN INSTRUMENT, AND THAT IS THE POINT
 *
 * The tempting version counts `ask_list_page` marks and asserts none appear on
 * a cached request. This repo already has the counter-example: on 2026-08-19 a
 * mark count reported ONE `artifact_load` while TWO reads were happening,
 * because the second call bypassed the memo the mark sat inside. An instrument
 * can only see what it was threaded through, so an assertion built on one
 * inherits every hole in the threading. Source ORDER cannot be bypassed: if the
 * early return precedes every mention of the index, a hit cannot reach it.
 *
 * ## THREE PROPERTIES
 *
 * 1. `askDriftCount` returns the cached value BEFORE any reference to the
 *    index appears in its body.
 * 2. The admin layout's loader reads the count through `askDriftCount` and does
 *    not call the full status reader. The reader stays on the CONTEXT for
 *    `/admin/posts`, which owns the repair and must be authoritative, so this
 *    is scoped to the loader rather than to the file.
 * 3. CALLER COVERAGE on invalidation: every function that mutates the index
 *    must drop the cached number. Written after the first sweep of this change
 *    missed two of four sites, one because the regex matched a bare `await` and
 *    the site used an assignment, and one because it invalidated nothing at all.
 */

console.log("\n  11. the drift badge reads a cache, not the AI Search index");

{
  const askSource = stripComments(
    readFileSync(join(root, "app", "lib", "search", "ask.server.ts"), "utf8"),
  );
  const layoutSource = stripComments(
    readFileSync(join(root, "app", "routes", "admin.tsx"), "utf8"),
  );

  const bodyOf = (/** @type {string} */ src, /** @type {string} */ name) => {
    const start = src.indexOf(`export async function ${name}(`);
    if (start === -1) return "";
    const end = src.indexOf("\n}", start);
    return end === -1 ? src.slice(start) : src.slice(start, end + 2);
  };

  const drift = bodyOf(askSource, "askDriftCount");

  /*
   * SCOPE, ASSERTED FIRST. Every assertion below reports success when the
   * extractor returns "", because "no index reference before the return" is
   * trivially true of an empty string. That is the shape of a gate that
   * examined nothing and said so cheerfully.
   */
  ok(
    "the askDriftCount body was extracted, and it is that function alone",
    drift.length > 200 &&
      drift.length < askSource.length / 3 &&
      !drift.includes("export async function removeAskPost"),
    `extracted ${drift.length} char(s) from a ${askSource.length} char file`,
  );

  // ORDER, not presence. Both must exist for the comparison to mean anything,
  // which is why their presence is asserted before their positions are compared.
  const cachedReturn = drift.indexOf("return cached;");
  const firstIndexUse = Math.min(
    ...["askIndexStatus(", "listAllAskItems(", "AI_SEARCH"]
      .map((needle) => drift.indexOf(needle))
      .filter((at) => at !== -1)
      .concat([Number.MAX_SAFE_INTEGER]),
  );

  ok(
    "askDriftCount both returns a cached value and can reach the index",
    cachedReturn !== -1 && firstIndexUse !== Number.MAX_SAFE_INTEGER,
    `cached return at ${cachedReturn}, first index use at ${firstIndexUse}. ` +
      `If either is absent the ordering assertion below compares nothing.`,
  );
  ok(
    "the cached value returns BEFORE any AI Search reference",
    cachedReturn !== -1 && cachedReturn < firstIndexUse,
    `cached return at ${cachedReturn}, first index reference at ${firstIndexUse}. ` +
      `A hit can reach the listing, which is the cost this cache exists to remove.`,
  );

  /*
   * THE LATE WRITE IS REGISTERED ON waitUntil, NOT LEFT FLOATING.
   *
   * The defect this replaces: on a listing slower than DRIFT_BUDGET_MS the
   * write was `void listing.then(...)`, which lands only if the isolate
   * outlives the response. Workers may cancel pending work once a response is
   * returned, so a slow listing never populated the cache, the next request
   * missed for the same reason, and the TTL never got a value to expire.
   * Measured before the fix: 4 misses in 12 samples, and the only two that
   * populated the cache were the two that finished UNDER the budget.
   *
   * Asserted on SOURCE rather than on a mark, for section 11's standing
   * reason: a floating write and a registered one are indistinguishable to any
   * instrument on the request, because the difference is entirely in what
   * happens after the response has gone.
   *
   * BOTH DIRECTIONS. Presence of `ctx.waitUntil(` alone would still pass if a
   * second, floating `void listing` were added beside it, which is exactly the
   * shape the fix removed.
   */
  ok(
    "the drift cache's late write is registered on waitUntil",
    /ctx\.waitUntil\(/.test(drift) && /writeCachedDrift\(/.test(drift),
    "askDriftCount does not hand its late write to waitUntil, so on a listing slower " +
      "than the budget the write lands only if the isolate outlives the response. That is " +
      "the self-perpetuating miss this cache was fixed for.",
  );
  ok(
    "no floating promise survives beside it in askDriftCount",
    !/\bvoid\s+listing\b/.test(drift),
    "a `void listing` floating write is back in askDriftCount. It cannot be relied on to " +
      "land, and its presence beside the waitUntil call makes the cache fill by luck again.",
  );

  /*
   * THE PER-POST UPLOAD ISOLATES EACH RECORD, AND A FAILED KEY STILL COUNTS AS
   * LIVE. The second half is the one that bites.
   *
   * `syncAskPost` used to `await` each upload with no catch, so the first
   * rejection threw out of the function. MEASURED: one post published with nine
   * records, the first upload failed, and all nine were missing for three
   * weeks. The caller catches by design, so a save must not fail because an
   * index write did, and the failure had nowhere to go but the drift badge.
   *
   * Isolating the loop introduces a worse bug if done carelessly. The prune
   * below the loop deletes every key this post owns that is NOT in `live`, so a
   * failed upload whose key never joined `live` would cause the good copy
   * ALREADY in the index to be deleted. The old throw prevented that by never
   * reaching the prune. `live` means "this key should exist", not "this key was
   * just written", so a failed key belongs in it.
   *
   * Asserted on ORDER, which is what the property actually is: the push happens
   * inside the catch and the `live.add` happens after it, unconditionally.
   */
  const uploadBody = bodyOf(askSource, "syncAskPost");
  ok(
    "the syncAskPost body was extracted",
    uploadBody.length > 200 && uploadBody.includes("items.upload("),
    `extracted ${uploadBody.length} char(s)`,
  );
  ok(
    "a failed Ask upload is recorded rather than thrown out of the loop",
    /failed\.push\(/.test(uploadBody) && /catch/.test(uploadBody),
    "syncAskPost does not isolate a failing record, so one rejection abandons every " +
      "remaining record for that post. That cost nine records three weeks.",
  );
  /*
   * **POSITION IS NOT REACHABILITY, and the first version of this assertion got
   * that wrong.** It compared `indexOf("live.add(key)")` against
   * `indexOf("failed.push(")` and asserted the first came later. A `continue`
   * added to the catch block satisfies that comparison perfectly: the text
   * still sits after the push, and the line is now unreachable on the failure
   * path. Planted exactly that, and the gate stayed green.
   *
   * So the assertion reads what is BETWEEN them. Any control-flow escape
   * between the failure being recorded and the key joining `live` skips the
   * `live.add`, whatever order the characters are in.
   */
  /*
   * **THE NEEDLE CARRIES NO BACKSLASH, AND THAT IS NOT STYLE.**
   *
   * This was written as a word-boundary regex and the boundary did not survive
   * being written to disk: a shell heredoc ate one backslash, Python read the
   * remaining `\b` as an escape, and the file received a literal BACKSPACE
   * (0x08) on both sides of the alternation. The pattern then asked for
   * "backspace, continue, backspace", which no source file contains, so the
   * test returned false, the negation returned true, and the assertion passed
   * on a planted defect.
   *
   * It was caught only because the plant was run. A green gate over a violation
   * confirmed to have applied is the exact shape hard rule 12 exists for.
   *
   * Built from a character class instead. It says the same thing as a word
   * boundary for this input and contains nothing an escaping layer can eat.
   */
  const ESCAPE_BEFORE_LIVE = /(^|[^A-Za-z])(continue|return|break|throw)([^A-Za-z]|$)/;
  const betweenFailAndLive = uploadBody.slice(
    uploadBody.indexOf("failed.push("),
    uploadBody.indexOf("live.add(key)"),
  );
  ok(
    "a failed key still joins the live set, so the prune cannot delete a good record",
    uploadBody.indexOf("failed.push(") !== -1 &&
      uploadBody.indexOf("live.add(key)") > uploadBody.indexOf("failed.push(") &&
      uploadBody.split("live.add(").length - 1 === 1 &&
      !ESCAPE_BEFORE_LIVE.test(betweenFailAndLive),
    "the failure branch escapes before `live.add(key)`, or the call moved. The prune " +
      "deletes every key this post owns that is not in `live`, so a transient upload " +
      "failure would DELETE the copy already in the index. Found between them: " +
      JSON.stringify(betweenFailAndLive.trim().slice(0, 120)),
  );
  ok(
    "the uploaded count subtracts what failed",
    /records\.length - failed\.length/.test(uploadBody),
    "syncAskPost reports records.length as uploaded, which was only ever accurate " +
      "because a failure threw before reaching the return.",
  );

  // The layout's LOADER specifically. askStatusContext is still set by the
  // middleware and read by /admin/posts, so a file-level assertion would be
  // wrong in both directions.
  const layoutLoader = (() => {
    const start = layoutSource.indexOf("export async function loader(");
    if (start === -1) return "";
    const end = layoutSource.indexOf("\n}", start);
    return end === -1 ? layoutSource.slice(start) : layoutSource.slice(start, end + 2);
  })();

  ok(
    "the admin layout loader was extracted",
    layoutLoader.length > 200 && layoutLoader.includes("adminNavCounts"),
    `extracted ${layoutLoader.length} char(s)`,
  );
  ok(
    "the admin layout loader takes the badge from askDriftCount",
    /askDriftCount\(/.test(layoutLoader),
    "the layout computes drift some other way, so the cache is bypassed",
  );
  ok(
    "the admin layout loader does not call the full status reader",
    !/askStatusContext\)\s*\(\)/.test(layoutLoader),
    "the loader calls the uncached reader, which lists the index on every admin page load",
  );

  /*
   * CALLER COVERAGE. A function that changes what the index holds and leaves
   * the cached number in place makes the badge disagree with an action the
   * operator just took, for up to the TTL.
   */
  const mutators = [];
  const uncovered = [];
  for (const m of askSource.matchAll(/export async function (\w+)\(/g)) {
    const body = bodyOf(askSource, m[1]);
    if (!/items\.(upload|delete)\(/.test(body)) continue;
    mutators.push(m[1]);
    if (!/dropCachedDrift\(/.test(body)) uncovered.push(m[1]);
  }

  ok(
    "index-mutating functions were found to check",
    mutators.length >= 3,
    `found ${mutators.length}. A zero-scope scan reports full coverage.`,
  );
  ok(
    "every index-mutating function drops the cached drift count",
    uncovered.length === 0,
    `${uncovered.join(", ")} mutate the index and leave the badge's cached number ` +
      `in place, so it disagrees with the action for up to the TTL.`,
  );
}

/* -------- 12. every rendered <main> is the skip link's target ------------ */

/*
 * THE SKIP LINK IS UNCONDITIONAL, SO ITS TARGET MUST BE TOO.
 *
 * `root.tsx` renders `<a class="skip-link" href="#main">` on EVERY route. A
 * route that renders a `<main>` without `id="main"` therefore ships a skip
 * link that moves focus nowhere, and it is the first thing a keyboard reader
 * reaches.
 *
 * It regressed twice and neither was noticed: `/login`, the site's only door,
 * and the error boundary, which is the most likely page a stranger reaches by a
 * broken link. Both fixed 2026-08-20.
 *
 * **THIS EXISTS BECAUSE check:browser IS NOT IN THE OFFLINE TIER.** That gate
 * measures the real thing in a real browser and is the better instrument, but
 * it needs a build, a server and a browser, so it is tiered network and `ship`
 * never runs it. This is the cheap source-shaped half that runs before every
 * ship. The two are not redundant: this one cannot see whether the target is
 * REACHABLE, only whether it exists in the source.
 *
 * SCOPED TO ROUTES THAT RENDER A `<main>`. A route rendering into a parent
 * layout's main has no `<main>` of its own and must not be required to invent
 * one; the admin subtree is exactly that shape.
 */

console.log("\n  12. every rendered <main> is the skip link's target");

{
  const ROUTES = join(root, "app", "routes");
  /** @type {string[]} */
  const offenders = [];
  let withMain = 0;
  let scanned = 0;

  for (const file of sourceFiles(ROUTES)) {
    const rel = relative(root, file).split(sep).join("/");
    if (!rel.endsWith(".tsx")) continue;
    scanned += 1;
    const code = stripComments(readFileSync(file, "utf8"));
    if (!/<main[\s>]/.test(code)) continue;
    withMain += 1;
    if (!/<main[^>]*\sid="main"/.test(code)) offenders.push(rel);
  }

  /*
   * SCOPE, ASSERTED. "No offenders" is also what an empty walk and a stripper
   * that emptied every file both report, and this gate has been bitten by that
   * shape twice in a week.
   */
  ok(
    "the route walk found files, and some of them render a <main>",
    scanned >= 19 && withMain >= 9,
    `scanned ${scanned} route file(s), ${withMain} render a <main>. A zero-scope walk ` +
      `agrees with anything.`,
  );

  ok(
    "every route rendering a <main> gives it id=\"main\"",
    offenders.length === 0,
    `${offenders.join(", ")} render a <main> with no id="main", so root's ` +
      `unconditional skip link moves focus nowhere on those routes.`,
  );
}

/* ------- 13. every public page's meta comes from a builder --------------- */

/*
 * NO PAGE HAND-ASSEMBLES ITS OWN SOCIAL SET.
 *
 * Five public pages each built part of the same meta list by hand and each
 * stopped somewhere different. Measured 2026-08-20: the HOME PAGE, the URL
 * people paste, had `og:image` and `twitter:card` and no canonical, no
 * `og:title`, no `og:description`, no `og:url` and no `og:type`. The colophon
 * and roster had a title and description and nothing else. Projects and
 * playground had canonical and OG text and no image and no card.
 *
 * Nothing was wrong with any single line. The defect is the SHAPE: a copied
 * literal drifts one property at a time and no reviewer diffs five files
 * against each other. So the assertion is structural rather than a checklist of
 * tag names, because a checklist would need updating every time the set grows
 * and would itself become the sixth copy.
 *
 * TWO BUILDERS ARE LEGITIMATE. `pageMeta` for hand-authored pages and
 * `postSocial` for posts, which resolves per-post overrides and the generated
 * card. A route using either is compliant; a route returning a bare array is
 * not.
 *
 * SCOPED TO app/routes AND TO PUBLIC PAGES. `admin.*` is exempt: the admin
 * plane is noindex by ruling, so a canonical and a social card would be
 * describing pages that must never be shared. `login` is exempt for the same
 * reason. The exemption is a NAMED LIST with a reason, not a pattern, so a new
 * public page cannot join it by accident.
 */

console.log("\n  13. every public page's meta comes from a builder");

{
  /** Routes allowed to hand-write meta, each with the reason. */
  const META_EXEMPT = {
    "app/routes/login.tsx": "noindex by ruling: a canonical would describe a page nobody may share",
    "app/routes/search.tsx": "results pages are noindex; the meta is a title only",
    "app/routes/preview.$token.tsx":
      "a capability-token draft view. It emits noindex in the markup AND on the wire, " +
      "so a canonical and a social card would describe a page that must never be shared, " +
      "and the token is in the URL.",
  };

  /** @type {string[]} */
  const handRolled = [];
  let withMeta = 0;
  let scanned = 0;

  for (const file of sourceFiles(join(root, "app", "routes"))) {
    const rel = relative(root, file).split(sep).join("/");
    if (!rel.endsWith(".tsx")) continue;
    if (rel.includes("/admin")) continue;
    scanned += 1;
    const code = stripComments(readFileSync(file, "utf8"));
    if (!/export function meta\(/.test(code)) continue;
    withMeta += 1;
    if (rel in META_EXEMPT) continue;
    if (/pageMeta\(|postSocial\(/.test(code)) continue;
    handRolled.push(rel);
  }

  /*
   * SCOPE, ASSERTED. "Nothing hand-rolled" is also what an empty walk reports,
   * and this gate has been bitten by that shape three times in a fortnight.
   */
  ok(
    "the public route walk found files that export meta()",
    scanned >= 9 && withMeta >= 9,
    `scanned ${scanned} public route file(s), ${withMeta} export meta(). A zero-scope ` +
      `walk agrees with anything.`,
  );

  ok(
    "every public page's meta comes from pageMeta or postSocial",
    handRolled.length === 0,
    `${handRolled.join(", ")} assemble a meta array by hand. That is how five pages ` +
      `ended up with five different partial social sets.`,
  );

  ok(
    "the meta exemptions all name a route that exists",
    Object.keys(META_EXEMPT).every((p) => existsSync(join(root, p))),
    `META_EXEMPT names a file that is not there, so it exempts nothing and hides ` +
      `whatever replaced it`,
  );
}

/* ------- 14. every public page route is in the sitemap or exempt ---------- */

/*
 * A PAGE ADDED AND FORGOTTEN IS SILENTLY UNLISTED.
 *
 * `sitemap.ts` carries `STATIC_PATHS`, a literal mirroring `routes.ts`. Its own
 * comment said so and left it: "a public page added there and forgotten here is
 * simply absent from the sitemap, silently, and nothing fails". That is not a
 * hypothetical. MEASURED 2026-08-20: `/projects` and `/playground` had been
 * missing since they shipped, both public, both indexable, both in the header
 * nav.
 *
 * ## THE RULE, so the set is decidable rather than a matter of opinion
 *
 * A route is an INDEXABLE PAGE when all three hold:
 *   1. it is declared before the `// Auth` marker, so it is in the public block
 *   2. its module is `.tsx`, which is a page rather than a resource route
 *      returning XML, JSON or a stream
 *   3. its path carries no `:param`, because dynamic pages are emitted from D1
 *      further down the sitemap rather than from this list
 *
 * Anything satisfying all three must be in `STATIC_PATHS` or in
 * `SITEMAP_EXEMPT` below, which is a NAMED LIST WITH A REASON, on the same rule
 * as every other exemption map in this repo. A pattern would let a new page
 * match by accident; a name cannot.
 *
 * ## WHY NOT DERIVE THE ARRAY AT RUNTIME
 *
 * `routes.ts` is a build-time module of nested config objects. Reading it inside
 * the Worker means parsing TypeScript there or shipping a second generated
 * artifact for four strings. This gets the same guarantee at no runtime cost,
 * and it can say WHY a route is absent, which a derivation cannot.
 */

console.log("\n  14. every public page route is in the sitemap or exempt");

{
  /** Public page routes deliberately absent from the sitemap, with the reason. */
  const SITEMAP_EXEMPT = {
    "/search":
      "a results page. Its content is a function of the query string, so listing " +
      "the bare path offers a crawler an empty page and listing queries is unbounded.",
  };

  const routesSource = stripComments(readFileSync(join(root, "app", "routes.ts"), "utf8"));
  const sitemapSource = readFileSync(join(root, "app", "routes", "sitemap.ts"), "utf8");

  /*
   * The public block only. Everything from the `// Auth` marker down is login
   * and the admin subtree, which are noindex by ruling. Comments are stripped
   * above, so the marker is found on the RAW source rather than the stripped
   * copy.
   */
  const raw = readFileSync(join(root, "app", "routes.ts"), "utf8");
  const authAt = raw.indexOf("// Auth");
  const publicRaw = authAt === -1 ? raw : raw.slice(0, authAt);
  const publicBlock = stripComments(publicRaw);

  /** @type {string[]} */
  const pages = [];
  if (/index\("routes\/home\.tsx"\)/.test(publicBlock)) pages.push("/");
  for (const m of publicBlock.matchAll(/route\(\s*"([^"]+)"\s*,\s*"routes\/([^"]+)"/g)) {
    const [, path, module] = m;
    if (!module.endsWith(".tsx")) continue;
    if (path.includes(":")) continue;
    pages.push(`/${path}`);
  }

  /*
   * SCOPE, ASSERTED. An empty parse reports "nothing missing", which is the
   * same output as a correct sitemap. The `// Auth` slice is the specific way
   * this can silently shrink to nothing.
   */
  ok(
    "the public route block parsed into page routes",
    pages.length >= 6 && authAt !== -1,
    `parsed ${pages.length} public page route(s) and the // Auth marker was ` +
      `${authAt === -1 ? "NOT found" : "found"}. A zero-scope parse agrees with anything.`,
  );

  const missing = pages.filter(
    (p) => !new RegExp(`"${p}"`).test(sitemapSource) && !(p in SITEMAP_EXEMPT),
  );
  ok(
    "every public page route is in STATIC_PATHS or exempt by name",
    missing.length === 0,
    `${missing.join(", ")} are public .tsx pages with no dynamic segment, and they ` +
      `appear in neither STATIC_PATHS nor SITEMAP_EXEMPT. A page nobody lists is a ` +
      `page search engines never see.`,
  );

  ok(
    "every sitemap exemption names a route that still exists",
    Object.keys(SITEMAP_EXEMPT).every((p) => pages.includes(p)),
    `SITEMAP_EXEMPT names a path the route table no longer declares, so it exempts ` +
      `nothing and hides whatever replaced it`,
  );
}

/* ------- 15. every cited hard-rule number resolves to a rule ------------- */

/*
 * THE CODE CITES THE RULES BY NUMBER, AND NOTHING CHECKED THE NUMBERS.
 *
 * Fourteen source files say things like "hard rule 10's class" or "hard rule 15
 * makes that file off limits". Until 2026-08-21 the rules lived in Capsid, and
 * **Capsid cannot be gated, because every gate verifies disk.** So the one
 * document the code depends on by number was the one document no assertion
 * could reach, which is the mechanism Grok's audit identified behind a month of
 * stale numbers: `MINIMUM_GATES` was 28 and true while Capsid said 24, 26 and
 * 27 and was false.
 *
 * The rules moved into CLAUDE.md for exactly that reason. This binds them.
 *
 * ## WHAT THIS ASSERTS, and it is the weaker of the two things asked for
 *
 * Every `hard rule N` cited anywhere in the repo resolves to a heading
 * `### N.` in CLAUDE.md. A citation of a number that does not exist fails, and
 * so does renumbering a rule out from under a citation.
 *
 * ## WHAT IT DOES NOT ASSERT, stated because the gap is the interesting half
 *
 * **It does not check that the TEXT a comment attributes to a rule matches the
 * rule.** `check-secrets.mjs` says "hard rule 3 says ..." and paraphrases it;
 * `check-features.mjs` says "hard rule 9's second half". Verifying a paraphrase
 * against a source sentence needs to decide when two English sentences say the
 * same thing, which no regex does and which a wrong answer makes worse than no
 * answer: a gate that green-lights a false paraphrase is more dangerous than
 * one that never looked.
 *
 * So the failure this cannot see is a comment that cites rule 8 correctly and
 * then describes rule 9. That class was real: the August drift audit found
 * three rules FALSE AS WRITTEN across two files. What kills it now is having
 * ONE home rather than two, which removes the copy that drifts, plus this
 * binding on the numbers. The residue is stated rather than closed.
 */

console.log("\n  15. CLAUDE.md's rules are reachable, and every cited number resolves");

{
  const claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");

  /*
   * NORMALIZED for every structural match, RAW for the size. A needle written
   * with `\n` must not silently miss on a CRLF checkout, and the character
   * count has to be what the machine actually holds.
   */
  const claudeText = claudeMd.replace(/\r\n/g, "\n");

  /*
   * ## THE SHAPE ASSERTIONS, ABSORBED FROM check:claude-md ON 2026-08-21
   *
   * Audit tier 4.1 ruled that gate out as prompt hygiene rather than a release
   * gate, and that was right about the GATE and wrong about two of its
   * assertions, for a reason the audit could not have seen: it read the repo on
   * 2026-08-16, when CLAUDE.md POINTED at Capsid for the rules and was 8.5 KB.
   * Since 2026-08-21 the rules ARE this file, so silent truncation now deletes
   * the fifteen hard rules themselves rather than a pointer to them. The stake
   * went UP as the gate was being retired.
   *
   * MEASURED 2026-08-07, which is why the limit is not theoretical: the file
   * was 65,489 characters, 39 percent of it past the boundary, and what sat in
   * that 39 percent was the ENTIRE hard-rules section. Nothing in the harness
   * reports truncation, so a rule that scrolled past the boundary does not
   * exist for that session while reading as present to anyone opening the file.
   *
   * ## WHAT WAS DROPPED RATHER THAN MOVED, and why each one earned it
   *
   * - "CLAUDE.md is not a stub", "has a Hard rules section" and "the section is
   *   not empty" are all subsumed by the rule-count assertion below: a stub, a
   *   missing section and an empty one all parse to zero `### N.` headings.
   * - The CHARACTER-OFFSET check on where the section starts. That gate's own
   *   header recorded it as slack on today's file, and the ordinal check below
   *   is the falsifiable form of the same claim.
   * - The LF-endings pin. `.gitattributes` pins the whole tree, this file is
   *   line-ending agnostic by construction above, and 0 of 256 tracked text
   *   files carried a carriage return when measured on 2026-08-20.
   */
  const TRUNCATION_LIMIT = 40000;

  ok(
    `CLAUDE.md fits in the context window (under ${TRUNCATION_LIMIT} characters)`,
    claudeMd.length < TRUNCATION_LIMIT,
    `${claudeMd.length} characters, ${claudeMd.length - TRUNCATION_LIMIT} over. ` +
      `Everything past the limit is silently truncated, so the rules are not ` +
      `merely long, they are ABSENT for that session while still reading as ` +
      `present in the file.`,
  );

  const headings = [...claudeText.matchAll(/\n## (.+)/g)].map((m) => m[1].trim());
  const ordinal = headings.findIndex((h) => h === "Hard rules");

  /*
   * SCOPE, ASSERTED. With no headings parsed, `ordinal` is -1 and the check
   * below would fail for the wrong reason, sending a reader to the document
   * instead of to this parser.
   */
  ok(
    "the document has sections to order",
    headings.length >= 5,
    `${headings.length} \`## \` heading(s) parsed; with fewer than three the ` +
      `ordinal check means nothing.`,
  );

  ok(
    "hard rules is one of the FIRST TWO sections",
    ordinal !== -1 && ordinal <= 1,
    `it is section ${ordinal + 1} of ${headings.length}` +
      (ordinal > 1 ? `, after: ${headings.slice(0, ordinal).join(", ")}` : "") +
      `. Fitting inside the limit is not enough: a session reads top to bottom ` +
      `and acts before it reaches the end. This section was LAST until ` +
      `2026-08-07, and therefore past the boundary entirely.`,
  );

  /*
   * APPEND-ONLY survives; FROZEN does not. Moved with the rest, and it is the
   * one thing stopping a renumber silently retargeting fourteen files'
   * citations. Matched on "append-only" rather than on "frozen", because the
   * sentence recording the 2026-08-21 unfreeze CONTAINS the word frozen and a
   * `/frozen/i` needle would have passed on the commit that falsified it.
   */
  ok(
    "CLAUDE.md records that rule numbering is append-only",
    /append-only/i.test(claudeText),
    "without that note the next reader has no reason not to renumber.",
  );

  /** Rule numbers CLAUDE.md actually defines, from its `### N.` headings. */
  const defined = new Set(
    [...claudeMd.matchAll(/^### (\d+)\. /gm)].map((m) => Number(m[1])),
  );

  /*
   * SCOPE, ASSERTED. An empty `defined` set makes every citation below
   * "unresolved" and the failure would read as fourteen broken comments rather
   * than as one broken parse, which sends the next reader to the wrong file.
   */
  /*
   * FLOOR RAISED 15 to 19 ON 2026-08-24, when rules 16 to 19 landed.
   *
   * It is a floor rather than an equality because numbering is APPEND-ONLY: a
   * rule is never removed and never renumbered, so the count only ever rises,
   * and an equality here would fail on the commit that adds a rule rather than
   * on the commit that loses one. A floor left at 15 against 19 defined is four
   * rules that could vanish unnoticed, which is hard rule 10's own
   * over-wide-threshold class sitting in the gate that binds hard rule 10.
   */
  ok(
    "CLAUDE.md defines numbered hard rules",
    defined.size >= 19,
    `parsed ${defined.size} rule heading(s) of the form "### N.". If this is 0 the ` +
      `citation check below is measuring the parser, not the comments.`,
  );

  /** @type {string[]} */
  const unresolved = [];
  let cited = 0;
  let scanned = 0;

  /*
   * PROSE CITES IN LISTS, so the needle reads a list.
   *
   * `VERIFICATION.md` opens with "Hard rules 7, 10 and 12 in CLAUDE.md are the
   * principles". A `(\d+)` needle sees the 7 and NOTHING ELSE, so two of the
   * three citations in the most-cited sentence in the repo would have gone
   * unchecked while the gate reported a clean pass. Found by widening the walk
   * to the root documents and reading what it actually matched.
   *
   * The list form is bounded deliberately: digits joined by commas and the word
   * "and", nothing else. A greedy run would swallow the sentence after it.
   */
  const CITATION = /hard rules? ((?:\d+)(?:\s*(?:,|and)\s*\d+)*)/gi;

  /*
   * THE ROOT DOCUMENTS ARE IN SCOPE, not just source. CLAUDE.md and
   * VERIFICATION.md cite these numbers more than any source file does, and a
   * document that sends a reader to a rule that does not exist fails them in
   * exactly the way a comment does. `sourceFiles` walks code, so the root
   * markdown is named rather than walked.
   */
  const rootDocs = ["CLAUDE.md", "VERIFICATION.md", "README.md", "RECOVERY.md"];

  const targets = [
    ...rootDocs.map((name) => join(root, name)),
    ...["app", "scripts", "workers", "test"].flatMap((dir) => [
      ...sourceFiles(join(root, dir)),
    ]),
  ];

  /** Citations found per root document, so the scope check can be specific. */
  const perDoc = new Map(rootDocs.map((name) => [name, 0]));

  for (const file of targets) {
    const rel = relative(root, file).split(sep).join("/");
    if (rel.endsWith(".d.ts")) continue;
    scanned += 1;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(CITATION)) {
      for (const part of m[1].split(/[^\d]+/).filter(Boolean)) {
        cited += 1;
        if (perDoc.has(rel)) perDoc.set(rel, (perDoc.get(rel) ?? 0) + 1);
        const n = Number(part);
        if (!defined.has(n)) unresolved.push(`${rel}: "hard rule ${n}"`);
      }
    }
  }

  /*
   * BOTH FLOORS RE-MEASURED 2026-08-24 THROUGH THIS WALK: 247 files scanned,
   * 126 citations found, against floors of 40 and 10.
   *
   * The citation floor was the slack one, by 116. Ten citations is cleared by
   * two files, so the walk could have stopped opening `test/` entirely and this
   * assertion would still have passed while reporting a clean resolve for every
   * citation it never read. That is not hypothetical: PLANTED on 2026-08-24 by
   * dropping `workers` and `test` from the directory list, this walk fell to
   * 203 files and 97 citations, which the old floors passed and the new ones
   * fail. Raised to 230 and 118, margins of 17 and 8, stated as counts because
   * the property that matters is how many can vanish before this notices.
   *
   * MEASURED THROUGH THE WALK, never by counting files on disk. A separate
   * count taken with an ad-hoc directory walk said 129 citations across 65
   * files, and it was answering a different question: this walk skips `.d.ts`
   * and carries `sourceFiles`'s own extension filter, so only what it actually
   * OPENS is in scope. The number that lives in the gate is the number the gate
   * produced.
   */
  ok(
    "the source walk found hard-rule citations to resolve",
    scanned >= 230 && cited >= 118,
    `scanned ${scanned} file(s) and found ${cited} citation(s). A zero-scope walk ` +
      `resolves every citation it did not find. Measured 2026-08-24: 247 and 126.`,
  );

  /*
   * THE SCOPE CHECK ABOVE CANNOT SEE THE ROOT DOCUMENTS DROP OUT, which is the
   * whole reason they were added. Four files out of two hundred and forty-seven
   * is noise against the scanned floor at any value it could sensibly take, so
   * deleting `rootDocs` would leave VERIFICATION.md unchecked while the gate
   * went on reporting a clean pass: hard rule 10's over-wide-threshold class,
   * one line below a threshold written to catch it.
   *
   * ## WHY ONLY VERIFICATION.md IS REQUIRED TO CITE
   *
   * The first draft required CLAUDE.md to contribute citations too, and it
   * FAILED on clean disk with "CLAUDE.md contributed 0". That was the assertion
   * doing its job against its own author. **CLAUDE.md DEFINES the rules and
   * never cites one**: it carries `### N.` headings, and the phrase "hard rule
   * N" appears in it zero times. It is already covered, by the `defined.size`
   * assertion above, which reads it directly.
   *
   * README.md and RECOVERY.md are scanned and required to cite nothing, because
   * there is no reason they should have to.
   */
  const REQUIRED_CITERS = ["VERIFICATION.md"];
  ok(
    "the documents that cite hard rules were actually read, not just listed",
    REQUIRED_CITERS.every((name) => (perDoc.get(name) ?? 0) > 0),
    REQUIRED_CITERS.map((name) => `${name}: ${perDoc.get(name) ?? 0}`).join(", ") +
      ` citation(s). Zero means the walk is not opening the document that cites ` +
      `these rules most, and every citation in it resolves by not being looked at.`,
  );

  ok(
    "every cited hard-rule number is defined in CLAUDE.md",
    unresolved.length === 0,
    `${unresolved.join(", ")}. The code cites a rule number CLAUDE.md does not ` +
      `define, so a reader following the citation lands nowhere.`,
  );
}

/* ------- 15b. four rules are bound to the behaviour they describe -------- */

/*
 * **BINDING A RULE'S TEXT TO WHAT THE CODE DOES, for the subset where that is
 * possible at all.**
 *
 * Section 15 binds every cited NUMBER to a heading that exists. That catches a
 * dangling citation and nothing else, and it says so. It cannot see a rule
 * whose text is simply false, which is what rule 6 was until 2026-08-22: it
 * claimed `content/posts/<slug>.md` was stated once and there were three
 * construction sites. Two separate recovery sessions diffed the rules against
 * their old Capsid text, pronounced them restored, and neither noticed, because
 * a rule can be transcribed perfectly and still be wrong about the code.
 *
 * ## WHY ONLY FOUR
 *
 * Most of the fifteen cannot be bound and pretending otherwise would be worse
 * than leaving them. Rule 5 says so in its own text: it would need a
 * hand-maintained selector list, which is the mirror this repo keeps deleting.
 * Rules 7, 10, 12 and 15 are METHOD, claims about how to work rather than about
 * what the code contains. Rules 1, 2, 3, 9 and 11 cite gates, and asserting a
 * gate exists is close to spelling.
 *
 * Four rules make a crisp, falsifiable claim about the tree:
 *
 *   4   CodeMirror is lazy-split, and client auth is imported by /login alone
 *   6   the post path is stated ONCE, by the exported postPath()
 *   13  two justified substitutions, each marked at its call site
 *   14  drizzle-kit is deliberately absent
 *
 * ## BOTH DIRECTIONS, WHICH IS THE WHOLE POINT
 *
 * Each rule gets a pair: the CLAIM is still in the rule's text, and the CODE
 * still has the property. Asserting only the code lets someone rewrite the rule
 * to say the opposite and stay green. Asserting only the text is spelling. Both
 * together can pass only while the two agree, which is the property section 15
 * was missing.
 *
 * The residue, stated rather than closed: this cannot see a rule rewritten to
 * describe a DIFFERENT true property. It can only see the claim leaving, or the
 * property leaving.
 */

console.log("\n  15b. four rules are bound to the behaviour they describe");

{
  const claudeText = readFileSync(join(root, "CLAUDE.md"), "utf8").replace(/\r\n/g, "\n");

  /** The body of one rule, from its heading to the next one. */
  const ruleBody = (/** @type {number} */ n) => {
    const start = claudeText.indexOf(`### ${n}. `);
    if (start === -1) return "";
    const next = claudeText.indexOf("\n### ", start + 1);
    return next === -1 ? claudeText.slice(start) : claudeText.slice(start, next);
  };

  /*
   * SCOPE FIRST. If the extractor stops matching, every claim assertion below
   * reports a missing claim and every code assertion still passes, which reads
   * like four rule defects rather than one broken parser.
   */
  const bodies = [4, 6, 13, 14].map(ruleBody);
  ok(
    "the four bound rules were extracted from CLAUDE.md",
    bodies.every((b) => b.length > 80),
    `lengths ${bodies.map((b) => b.length).join(", ")}. A short body means the heading ` +
      `shape moved and the claim assertions below are checking nothing.`,
  );

  const files = (/** @type {string} */ dir) => {
    /** @type {string[]} */
    const out = [];
    const walk = (/** @type {string} */ d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(full);
      }
    };
    walk(join(root, dir));
    return out;
  };
  const appFiles = files("app");
  const scriptFiles = files("scripts");
  ok(
    "the tree walk found files to search",
    appFiles.length > 40 && scriptFiles.length > 20,
    `app ${appFiles.length}, scripts ${scriptFiles.length}`,
  );

  /* -- rule 4 -------------------------------------------------------------- */
  ok(
    "rule 4 still claims client auth is imported by /login alone",
    /login/.test(bodies[0]) && /auth/i.test(bodies[0]),
    "rule 4 no longer makes the claim the assertion below checks",
  );
  const authImporters = appFiles.filter((f) =>
    /from\s+["'][^"']*auth-client/.test(readFileSync(f, "utf8")),
  );
  ok(
    "rule 4 holds: exactly one module imports the client auth helper",
    authImporters.length === 1 && /login\.tsx$/.test(authImporters[0] ?? ""),
    `imported by ${authImporters.map((f) => relative(root, f)).join(", ") || "nothing"}. ` +
      `Rule 4 keeps the Worker lean by confining the client auth bundle to /login.`,
  );


  /* -- rule 9 -------------------------------------------------------------- */
  /*
   * THE DOOR IS ON THE PUBLIC PLANE, and it was the counter-example to its own
   * rule for as long as it existed.
   *
   * `/login` offered exactly one way in: a `type="button"` whose `onClick`
   * called the Better Auth browser client. With script off it rendered, it was
   * ENABLED, and it did nothing. Meanwhile README declared that every public
   * page works with scripting disabled. Rule 9 is the law, the admin plane
   * behind the door is exempt, and the door itself is not.
   *
   * Asserted on SHAPE rather than on the word "form" appearing somewhere: the
   * old file contained a `<form>`-free button and the new one must contain a
   * submit inside a posting form AND a server action to receive it. A page with
   * the form and no action is a door that 405s.
   */
  const loginPath = join(root, "app", "routes", "login.tsx");
  ok(
    "rule 9's door: login.tsx exists",
    existsSync(loginPath),
    "the assertions below would examine nothing",
  );
  const loginCode = existsSync(loginPath)
    ? stripComments(readFileSync(loginPath, "utf8"))
    : "";
  ok(
    "rule 9's door: the source was read and comments stripped",
    loginCode.length > 400,
    `${loginCode.length} chars. This file explains the defect in prose, so an ` +
      `unstripped scan would find "form method post" in the explanation.`,
  );
  ok(
    "rule 9 HOLDS: the only door posts a real form, so it works with script off",
    /<form\s+method="post"/.test(loginCode),
    "the sign-in control is script-only again: with scripting disabled the site " +
      "has no way in at all, which is what README promised was impossible",
  );
  ok(
    "rule 9's door: something server-side receives that post",
    /export\s+async\s+function\s+action\b/.test(loginCode),
    "a form with no action is a door that answers 405",
  );
  ok(
    "rule 9's door: the control SUBMITS rather than only listening",
    /type="submit"/.test(loginCode) && !/type="button"/.test(loginCode),
    "a type=button inside the form is the original defect wearing a form around it",
  );
  /* -- rule 6 -------------------------------------------------------------- */
  ok(
    "rule 6 still claims the post path is stated ONCE by postPath()",
    /postPath/.test(bodies[1]) && /ONCE/.test(bodies[1]),
    "rule 6 no longer makes the claim the assertion below checks",
  );
  /*
   * OCCURRENCES, NOT FILES, and the plant is why. The first version filtered
   * files containing the pattern and asserted the count was 1. Reintroducing
   * the exact defect rule 6 describes, a second construction in the SAME file,
   * left it green: one file, one match, assertion satisfied. That is rule 10's
   * own "count matches, not containers" discipline broken inside the gate
   * written to bind rule 6.
   */
  const pathSites = [];
  for (const f of [...appFiles, ...scriptFiles]) {
    const hits = (readFileSync(f, "utf8").match(/`content\/posts\/\$\{/g) ?? []).length;
    for (let i = 0; i < hits; i += 1) pathSites.push(relative(root, f));
  }
  ok(
    "rule 6 holds: the post path is constructed in exactly one place",
    pathSites.length === 1,
    `constructed ${pathSites.length} time(s): ${pathSites.join(", ")}. ` +
      `Rule 6 says this string is stated ONCE, by the exported postPath().`,
  );

  /* -- rule 13 ------------------------------------------------------------- */
  ok(
    "rule 13 still names its two justified substitutions",
    /JUSTIFIED SUBSTITUTION|justified/i.test(bodies[2]) && /REMOTE_ARGS/.test(bodies[2]),
    "rule 13 no longer names the substitutions the assertion below counts",
  );
  /*
   * THIS FILE IS EXCLUDED, and it is the only exclusion. The failure message
   * above contains the marker phrase, so the scan counted the gate itself and
   * reported three where there are two. A gate matching its own prose is the
   * comment-satisfies-an-assertion class pointing the other way, and it fired
   * on the first run.
   *
   * Excluded by exact path, never by pattern: an exclusion that names a
   * directory would hide a real marker added under it later.
   */
  const SELF = join(root, "scripts", "check-invariants.mjs");
  const scanned = [...appFiles, ...scriptFiles].filter((f) => f !== SELF);
  ok(
    "the marker scan excludes exactly this gate and nothing else",
    scanned.length === appFiles.length + scriptFiles.length - 1,
    `excluded ${appFiles.length + scriptFiles.length - scanned.length} file(s), expected 1`,
  );
  const marked = scanned.filter((f) =>
    readFileSync(f, "utf8").includes("JUSTIFIED SUBSTITUTION"),
  );
  ok(
    "rule 13 holds: every justified substitution is marked at its call site",
    marked.length === 3,
    `${marked.length} marked: ${marked.map((f) => relative(root, f)).join(", ")}. ` +
      `Rule 13 names exactly three, so a fourth is an unrecorded exception and fewer ` +
      `means a marker was dropped.`,
  );

  /* -- rule 14 ------------------------------------------------------------- */
  ok(
    "rule 14 still claims drizzle-kit is deliberately absent",
    /drizzle-kit/.test(bodies[3]),
    "rule 14 no longer makes the claim the assertion below checks",
  );
  const pkg = readFileSync(join(root, "package.json"), "utf8");
  ok(
    "rule 14 holds: drizzle-kit is absent from package.json",
    !/drizzle-kit/.test(pkg),
    "drizzle-kit is declared. Rule 14 says migrations are hand-written and the tool " +
      "is deliberately absent, so either the tool goes or the rule does.",
  );
}

/* ------- 16. the CI workflow runs the DERIVED tier ----------------------- */

/*
 * MOVED HERE 2026-08-21 FROM check:hooks, WHICH WAS DELETED.
 *
 * Audit tier 4.1 ruled that gate out: it reads `.claude/settings.json`, cannot
 * see whether a hook RAN, and knows one editor. Accepted for the hooks half.
 * These six assertions arrived in it on 2026-08-20 and were never about hooks;
 * they were put there to avoid adding a twenty-eighth gate for one file, which
 * the gate's own header says out loud. They are the half worth keeping and they
 * belong with the other structural claims about this repo.
 *
 * ## WHAT IS WORTH ASSERTING, and it is narrow on purpose
 *
 * Not the yaml's shape: GitHub validates that, and restating its schema would be
 * a mirror of someone else's parser. What can rot silently and LOCALLY is the
 * DERIVATION. The workflow's value is that it runs `npm run check:ci`, which
 * computes the tier from package.json, so a gate added tomorrow is in CI by
 * default and has to be argued OUT rather than remembered IN. Someone
 * "helpfully" replacing that with a list of gate names would keep CI green, keep
 * it looking thorough, and quietly reintroduce the exact failure check-all.mjs
 * exists about: the next gate is forgotten.
 *
 * Same for the Node version. `.nvmrc` says it and `node-version-file` reads it;
 * a literal `node-version: 24` in the yaml would be a second statement of one
 * fact, which is the mirror class this repo has paid for twice this month.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT READS A FILE.** It cannot see whether GitHub Actions is enabled on the
 * repository, whether a run was triggered, whether it passed, whether a branch
 * protection rule requires it, or whether someone merged past a red one. A green
 * result here is compatible with CI having never executed once. Only the run
 * itself proves that, and the run is not an artifact this repo contains.
 */

console.log("\n  16. the CI workflow runs the derived tier");

{
  /*
   * COMMENTS STRIPPED BEFORE MATCHING, and this was caught by its own plant.
   *
   * The first draft matched the RAW yaml. Replacing `npm ci` with `npm install`
   * in the run step PASSED, because that step's own comment says "`npm ci` and
   * not `npm install`" and the needle found it there. The assertion was reading
   * prose as though it were configuration.
   *
   * LIMIT, stated: whole-line `#` comments only. A trailing `#` is not
   * attempted, because a naive pass would cut a string containing one, and this
   * is not a yaml parser. A fragment hidden after code on the same line still
   * fires.
   */
  const stripHashComments = (/** @type {string} */ src) =>
    src.replace(/^[ \t]*#.*$/gm, " ");

  const CI_PATH = join(root, ".github", "workflows", "ci.yml");
  const present = existsSync(CI_PATH);
  ok(
    "a CI workflow exists at .github/workflows/ci.yml",
    present,
    "there is no workflow, so nothing reviews a commit but its author",
  );

  const rawYaml = present ? readFileSync(CI_PATH, "utf8") : "";
  const yaml = stripHashComments(rawYaml);

  /*
   * SCOPE, ASSERTED. Every match below succeeds trivially against an empty
   * string in the negative direction and fails confusingly in the positive one,
   * so the file being non-trivial is established before anything is read.
   */
  ok(
    "the workflow file is not empty",
    rawYaml.length > 200 && yaml.length > 100,
    present
      ? `${rawYaml.length} byte(s) raw, ${yaml.length} after stripping comments. A ` +
        `file that is all comment declares no job, and a stripper that emptied it ` +
        `would make every assertion below fail for the wrong reason.`
      : "(absent, see above)",
  );

  ok(
    "the workflow runs the DERIVED CI tier, not a hardcoded gate list",
    /npm run check:ci\b/.test(yaml),
    "it does not run `npm run check:ci`. A list of gate names there is the mirror " +
      "that lets the next gate be forgotten, which is what check-all.mjs exists about.",
  );

  ok(
    "the workflow installs from the lockfile with npm ci",
    /\bnpm ci\b/.test(yaml),
    "`npm install` re-resolves and can pass where the lockfile disagrees with " +
      "package.json, which makes the run a re-resolution rather than a review",
  );

  ok(
    "the Node version comes from .nvmrc rather than a second literal",
    /node-version-file:\s*\.nvmrc/.test(yaml) && !/node-version:\s*["']?\d/.test(yaml),
    "the workflow states a Node version of its own. .nvmrc is the one place that " +
      "says it; a copy there is a mirror and mirrors drift.",
  );

  /*
   * THE ENGINES FLOOR IS BOUND TO `.nvmrc`, because it had already drifted.
   *
   * Measured 2026-08-23: `.nvmrc` said 24.14.1 and `package.json` engines said
   * `>=22.22.0`. CI installs the `.nvmrc` version, so a contributor on Node 22
   * satisfied `engines`, installed happily, and ran a DIFFERENT runtime from the
   * one every gate result in CI was produced on. Nothing said so.
   *
   * The 2026-08-22 audit reported this and got both halves wrong: it said
   * ".nvmrc says 22.22.0" (it says 24.14.1) and "local development on 24 would
   * silently differ" (24 is what CI runs; 22 and 23 are what differ). The
   * direction was inverted, which is worth recording because acting on the
   * audit's version would have LOWERED the floor.
   *
   * `package.json` is static JSON and cannot read `.nvmrc`, so the two values
   * are unavoidably a mirror. This assertion is what stops a mirror drifting:
   * it does not care what the version IS, only that the floor equals the pin.
   *
   * A FLOOR rather than an exact pin, deliberately. `"node": "24.14.1"` would
   * refuse to install on 24.14.2, which breaks every contributor on the next
   * Node patch release to buy nothing: the defect was a floor two majors low,
   * not a floor one patch loose.
   */
  const nvmrcPath = join(root, ".nvmrc");
  const nvmrcVersion = existsSync(nvmrcPath)
    ? readFileSync(nvmrcPath, "utf8").trim()
    : "";
  ok(
    ".nvmrc names a Node version",
    /^\d+\.\d+\.\d+$/.test(nvmrcVersion),
    `read ${JSON.stringify(nvmrcVersion)}. Without it the comparison below has ` +
      `nothing to compare against and would pass on any package.json.`,
  );

  const pkgEngines = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).engines?.node ?? "";
  ok(
    "package.json engines.node floors at exactly the .nvmrc version",
    pkgEngines === `>=${nvmrcVersion}`,
    `engines.node is ${JSON.stringify(pkgEngines)} and .nvmrc is ` +
      `${JSON.stringify(nvmrcVersion)}, so the two disagree about which runtime this ` +
      `repo supports. CI installs the .nvmrc one, so a looser floor lets a ` +
      `contributor run a Node that no gate result was ever produced on.`,
  );

  ok(
    "the workflow triggers on push to main and on pull requests",
    /on:/.test(yaml) && /push:/.test(yaml) && /pull_request:/.test(yaml),
    "a workflow that runs on neither is a file, not a review",
  );

  /* ----- the health workflow: the dead man's switch ---------------------- */

  /*
   * **THE ONLY THING ON THIS SITE THAT REACHES A HUMAN WITHOUT A HUMAN
   * LOOKING.** A failing scheduled run is the alert; GitHub emails the owner.
   *
   * Three properties are asserted and each has a specific way of rotting:
   *
   *   - it EXISTS. Deleting it removes all alerting and nothing else notices,
   *     because the absence of an alert is what health looks like.
   *   - it TARGETS the health route. A workflow polling `/` would pass every
   *     run while the Ask index rotted, which is the 31 July failure exactly.
   *   - its checkout is PINNED BY SHA. A tag is a moving pointer, and this
   *     workflow runs on a schedule with the repository's token.
   *
   * OBSERVATION BOUNDARY: this reads a file. It cannot see whether Actions is
   * enabled, whether a run fired, whether GitHub disabled the schedule after
   * 60 days of inactivity, or whether the owner's notification settings deliver
   * the mail. Every one of those is a silent failure this cannot reach, and the
   * workflow's own header says so at length.
   */
  const HEALTH_WF = join(root, ".github", "workflows", "health.yml");
  const healthPresent = existsSync(HEALTH_WF);
  ok(
    "the health workflow exists at .github/workflows/health.yml",
    healthPresent,
    "the dead man's switch is gone, so nothing polls the site and the silence " +
      "that follows is indistinguishable from health",
  );

  const healthRaw = healthPresent ? readFileSync(HEALTH_WF, "utf8") : "";
  const healthYaml = stripHashComments(healthRaw);

  ok(
    "the health workflow is not all comment",
    healthRaw.length > 400 && healthYaml.length > 200,
    `${healthRaw.length} byte(s) raw, ${healthYaml.length} stripped. This file is ` +
      `mostly prose by design, so the stripped length is what proves there is a job ` +
      `left underneath it and that every assertion below has something to read.`,
  );

  ok(
    "the health workflow runs on a schedule",
    /schedule:/.test(healthYaml) && /cron:/.test(healthYaml),
    "without a schedule it only runs when someone asks, which is the state this " +
      "whole mechanism exists to replace",
  );

  ok(
    "the health workflow polls the health route",
    /\/api\/health\b/.test(healthYaml),
    "it does not name /api/health. A workflow polling some other path passes every " +
      "run while the checks it was built for go unmeasured.",
  );

  /*
   * SHA-PINNED, asserted POSITIVELY and NEGATIVELY.
   *
   * The positive form alone is satisfiable by adding a pinned action beside a
   * floating one, so the negative half is what actually closes it: no `uses:`
   * line in EITHER workflow may end in a version tag. Scoped to `uses:` lines
   * rather than the whole file, because the prose above them names `@v4` while
   * explaining why it is wrong, and a whole-file match would read that comment
   * as the violation it warns about. Comments are stripped first as well.
   */
  const usesLines = [
    ...healthYaml.matchAll(/^\s*-?\s*uses:\s*(\S+)\s*$/gm),
    ...yaml.matchAll(/^\s*-?\s*uses:\s*(\S+)\s*$/gm),
  ].map((m) => m[1]);

  ok(
    "the workflows declare actions to check",
    usesLines.length >= 3,
    `${usesLines.length} uses: line(s) parsed across both workflows. A zero-scope ` +
      `parse agrees that everything is pinned by examining nothing.`,
  );

  const floating = usesLines.filter((u) => /@v?\d+(\.\d+)*$/.test(u));
  ok(
    "every action in every workflow is pinned by commit SHA, not by tag",
    floating.length === 0,
    `${floating.join(", ")} pin to a tag. A tag is a moving pointer the upstream ` +
      `owner can repoint at any commit, so it means "whatever that account publishes ` +
      `next" running with this repository's token. Audit section 8.`,
  );

  const healthCheckout = usesLines.find((u) => u.startsWith("actions/checkout@"));
  ok(
    "the health workflow's checkout is pinned to a full 40-character SHA",
    Boolean(healthCheckout) && /@[0-9a-f]{40}$/.test(healthCheckout ?? ""),
    `checkout is ${JSON.stringify(healthCheckout ?? "(absent)")}. A short SHA is ` +
      `ambiguous and a tag is mutable; only the full commit id is a fixed target.`,
  );
}

/* ------- 17. one helper name, one argument order, no string conditions ---- */

/*
 * THE TENTH VACUITY CLASS, AND THE ONLY TWO RULES OF check:assertions THAT
 * SURVIVED IT. Moved here 2026-08-21; that gate was deleted in audit tier 4.1
 * as a lint of lints.
 *
 * `assert()` was defined SEVEN times across the gates with FOUR argument orders:
 * three took the condition first, four took the label first. An assertion copied
 * between two of them lands a non-empty STRING in the condition slot. A string is
 * truthy, so it can never fail, and the checks counter still increments, so the
 * gate reports MORE coverage than before it went blind. Both directions were
 * demonstrated on 2026-08-11:
 *
 *   assert(1 === 2, "must fail")  in a label-first gate     -> 98 checks, 0 failures
 *   assert("must fail", 1 === 2)  in a condition-first gate ->  7 checks, 0 failures
 *
 * The class lives in the API surface BETWEEN instruments, where a per-file lint
 * cannot look, which is why nine prior classes and a dedicated lint all missed
 * it. It was found by an external audit and by nothing in this repo.
 *
 * ## WHY BOTH RULES, WHEN THE AUDIT ASKED TO KEEP ONE
 *
 * Tier 4.1 says keep the helper-argument-order check. **That is half the
 * repair, and the deleted gate's own comment recorded which half was missing.**
 * Giving the two shapes two names removes the CAUSE, one name meaning two
 * things. It does not stop someone hand-writing
 *
 *     assert(1 === 2, "AUDIT: a false condition that must fail");
 *
 * in a label-first gate. MEASURED AFTER THE RENAME: still 98 checks, 0 failures.
 * So the condition-position argument is examined directly, and which position
 * that is comes from the helper's own definition rather than being assumed.
 *
 * Dropping the other four rules is the accepted half. (a) literal conditions and
 * (d) unguarded derived RegExps were each written after ONE instance and have
 * caught none since; (b) unscoped whole-document matches was enforced by
 * requiring a `SCOPED-BY` comment, which makes a comment satisfy an assertion
 * about code, a defect class this repo has now paid for three times; and (c) was
 * already skipped as unimplementable by its own author.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT READS SOURCE TEXT.** It cannot execute a condition to see whether it can
 * vary, and it proves an assertion is not a STRING, never that the expression in
 * that slot is meaningful. `ok("x", page.includes(">Roster<"))` passes here and
 * would still be worthless if `>Roster<` appeared on every page. That judgement
 * stays with whoever writes the assertion.
 */

console.log("\n  17. assertion helpers agree, and no condition is a string");

{
  const gateFiles = readdirSync(join(root, "scripts"))
    .filter((n) => n.endsWith(".mjs"))
    .map((n) => ({ name: n, path: join(root, "scripts", n) }));

  /*
   * FAILS CLOSED. Zero files is a broken directory read reporting the same
   * clean sweep as a clean repo. Floored well under the real count, because
   * this moves by one whenever a gate is added or deleted and both happen.
   */
  ok(
    "the helper scan read the gate scripts",
    gateFiles.length >= 36,
    `${gateFiles.length} .mjs file(s) under scripts/; the directory read has broken.`,
  );

  /** @type {Map<string, {file: string, params: string}[]>} */
  const signatures = new Map();
  for (const { name, path } of gateFiles) {
    const src = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    for (const m of src.matchAll(
      /^(?:export\s+)?(?:function|const)\s+(ok|check|assert|assertThat|eq|fail)\b[^\n]*?\(([^)]*)\)/gm,
    )) {
      const first = m[2].split(",")[0].trim().replace(/\s*=.*$/, "");
      const list = signatures.get(m[1]) ?? [];
      list.push({ file: name, params: first });
      signatures.set(m[1], list);
    }
  }

  // NON-EMPTY SCOPE: no definitions found means the matcher stopped matching
  // and every consistency claim below would be about nothing.
  ok(
    "the signature scan found assertion helpers to compare",
    signatures.size >= 5,
    `${signatures.size} helper name(s) across ${gateFiles.length} file(s); the ` +
      `definition matcher has stopped reading this repo's style.`,
  );

  for (const [helper, defs] of [...signatures].sort()) {
    const orders = new Set(defs.map((d) => d.params));
    ok(
      `${helper}() takes the same first argument everywhere it is defined`,
      orders.size === 1,
      defs.map((d) => `${d.file}: ${helper}(${d.params}, ...)`).join("\n        ") +
        `\n        ${orders.size} different first arguments for one name. An assertion ` +
        `copied between these files puts a truthy STRING in the condition slot, can ` +
        `never fail, and still increments the check count. Give the shapes different ` +
        `names, or make them agree.`,
    );
  }

  /** Splits a call's arguments at top level, ignoring commas inside nesting. */
  function topLevelArgs(/** @type {string} */ inner) {
    const args = [];
    let depth = 0;
    let quote = "";
    let current = "";
    for (let i = 0; i < inner.length; i += 1) {
      const c = inner[i];
      if (quote) {
        current += c;
        if (c === quote && inner[i - 1] !== "\\") quote = "";
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { quote = c; current += c; continue; }
      if ("([{".includes(c)) depth += 1;
      if (")]}".includes(c)) depth -= 1;
      if (c === "," && depth === 0) { args.push(current.trim()); current = ""; continue; }
      current += c;
    }
    if (current.trim()) args.push(current.trim());
    return args;
  }

  /** helper name -> index of the argument that carries the CONDITION. */
  const conditionIndex = new Map();
  for (const [helper, defs] of signatures) {
    const first = defs[0]?.params ?? "";
    if (helper === "fail") continue; // reports, takes no condition
    conditionIndex.set(helper, /^(ok|condition)$/.test(first) ? 0 : 1);
  }

  /** @type {string[]} */
  const stringConditions = [];
  let callsExamined = 0;

  for (const { name, path } of gateFiles) {
    const code = stripCommentsAndStrings(readFileSync(path, "utf8").replace(/\r\n/g, "\n"));
    for (const m of code.matchAll(/\b(check|ok|assert|assertThat|eq)\s*\(/g)) {
      const idx = conditionIndex.get(m[1]);
      if (idx === undefined) continue;
      const open = (m.index ?? 0) + m[0].length - 1;
      let depth = 0;
      let end = open;
      for (let i = open; i < code.length; i += 1) {
        if (code[i] === "(") depth += 1;
        else if (code[i] === ")") { depth -= 1; if (depth === 0) { end = i; break; } }
      }
      const arg = topLevelArgs(code.slice(open + 1, end))[idx];
      if (!arg) continue;
      callsExamined += 1;
      if (!/^["'`]/.test(arg)) continue;
      const line = (code.slice(0, m.index ?? 0).match(/\n/g) ?? []).length + 1;
      stringConditions.push(`${name}:${line} ${m[1]}(...) argument ${idx + 1}`);
    }
  }

  /*
   * SCOPE, ASSERTED, and this one is not decoration: the absence check below
   * reports the same clean result whether there are no string conditions or no
   * calls at all. Comments are stripped first, so a stripper that emptied every
   * file would look exactly like a clean repo.
   *
   * MEASURED 2026-08-21 BY RUNNING IT: 347 calls across 39 files. Floored at
   * 300, about 13 percent under. The first draft GUESSED 400 and failed on its
   * own first run, which is this assertion working on its author: a floor set by
   * guess is a floor set above what the scan can actually see, and the failure
   * mode it is written to catch is a scan that shrinks rather than one that
   * stops.
   */
  ok(
    "the condition-slot scan examined assertion calls",
    callsExamined >= 510,
    `${callsExamined} call(s) examined across ${gateFiles.length} file(s). A ` +
      `zero-scope scan finds no string conditions because it read nothing.`,
  );

  ok(
    "no assertion carries a string literal in its condition slot",
    stringConditions.length === 0,
    stringConditions.join("\n        ") +
      "\n        A string literal is always truthy, so that assertion can never " +
      "fail while still incrementing the check count. Check the argument order.",
  );
}

/* ------- 18. the cutover checklist is complete and current ---------------- */

/*
 * A CHECKLIST THAT LOST ITEMS ONCE ALREADY.
 *
 * The DNS cutover steps lived inside current-state paragraphs in Capsid's
 * core.md, and the 2026-08-21 consolidation that cut that file by 87 percent
 * deleted most of them. They survived only in version history. The audit that
 * found it named the mechanism exactly: **the cut asked "is this a number the
 * repo also knows?" and bindings had been filed inside status prose**, so a
 * question that was right for status was wrong for rules.
 *
 * They are in `CUTOVER.md` now, and this is what stops the same thing happening
 * again: an item cannot be dropped from that file without failing here.
 *
 * ## THE ORIGIN IS BOUND, NOT JUST NAMED, and that is the half with teeth
 *
 * Keyword presence proves an item is still WRITTEN. It cannot prove the document
 * is still TRUE. `SITE_ORIGIN` is the one item whose truth is checkable from the
 * repo: the document names the current value, and it is read out of
 * `app/lib/seo.ts` rather than restated. **On the day the origin changes, this
 * goes red until the checklist follows**, which is the same shape as
 * `check:llms` binding the llms.txt contact URL, and it fires on exactly the
 * event the checklist exists for.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **It reads two files.** It cannot tell whether any step was PERFORMED, whether
 * the zone is still gray-clouded, whether the Web Analytics auto-install is
 * still armed, or whether a Google redirect URI exists. Every one of those lives
 * in a Cloudflare or Google console, not in this repo. A green result here means
 * the checklist is complete and its one machine-checkable fact agrees with the
 * code; it means nothing at all about the state of the world.
 */

console.log("\n  18. the cutover checklist is complete and current");

{
  const cutover = readFileSync(join(root, "CUTOVER.md"), "utf8");
  const seo = readFileSync(join(root, "app", "lib", "seo.ts"), "utf8");

  /*
   * SCOPE, ASSERTED. Against an empty or truncated file every keyword check
   * below fails at once and the report would read as nine missing steps rather
   * than as one missing document.
   */
  ok(
    "CUTOVER.md is a document rather than a stub",
    cutover.length > 1500,
    `${cutover.length} characters. Below that, the item checks below are ` +
      `measuring whether the file exists, not what it says.`,
  );

  /*
   * EVERY ITEM THE CONSOLIDATION DELETED, one assertion each, named rather than
   * counted. A count would let one item be swapped for another; a name cannot.
   * The needle is the distinctive token, not the sentence, so the prose stays
   * the writer's.
   */
  /** @type {Array<[string, RegExp]>} */
  const ITEMS = [
    ["the Web Analytics auto-install landmine", /auto_install/],
    ["SITE_ORIGIN", /SITE_ORIGIN/],
    ["BETTER_AUTH_URL", /BETTER_AUTH_URL/],
    ["the Google redirect URI", /redirect URI/i],
    ["AI Search authorized hosts", /Authorized hosts/i],
    ["operator allowedHostnames", /allowedHostnames/],
    ["103 Early Hints", /103 Early Hints/],
    ["HTML caching as a decision", /HTML caching is a DECISION/i],
    ["the workflow-mainline sunset", /workflow-mainline\.md` SUNSETS|workflow-mainline/i],
    ["the gray-cloud facts", /gray-clouded/i],
    ["the 2017 delegation date", /2017-03-20/],
    ["the legacy origin address", /50\.116\.84\.36/],
    /*
     * The HSTS revisit. `workers/app.ts` has said "revisit for the apex at DNS
     * cutover" since 2026-08-06 and this checklist did not carry the step, so
     * the instruction pointed at a document that had never heard of it.
     *
     * ## ALL THREE NEEDLES ARE ANCHORED, and the first draft of this was not
     *
     * Written as bare `/includeSubDomains/` and `/preload/i`, and the plant that
     * was supposed to prove it worked went GREEN: renaming the token to
     * `includeSubDomainsXX` still matched, because an unanchored needle matches
     * any string that merely CONTAINS it. That is hard rule 10's unanchored-
     * needle class, caught by planting rather than by reading, which is the
     * whole argument for planting.
     *
     * `\b` on both sides fixes that case. The preload needle gets a different
     * repair, because `preload` is a word this repo will plausibly use again:
     * `<link rel="preload">` on an LCP image is an open suggestion in the
     * 2026-08-22 audit, section 11. A bare match would then be satisfied by an
     * unrelated sentence while the HSTS decision had been deleted. So it is
     * required to appear WITHIN the HSTS step rather than anywhere in the file.
     */
    ["the HSTS cutover step", /Strict-Transport-Security/],
    ["the HSTS includeSubDomains decision", /\bincludeSubDomains\b/],
    ["the HSTS preload refusal, inside that step", /Strict-Transport-Security[\s\S]{0,2500}?\bpreload\b/i],
  ];

  for (const [name, needle] of ITEMS) {
    ok(
      `CUTOVER.md still names ${name}`,
      needle.test(cutover),
      `the checklist no longer mentions it. This document exists because a ` +
        `consolidation deleted these once; dropping one silently is the failure ` +
        `this section is here to prevent.`,
    );
  }

  /*
   * THE BINDING. Two independent sources: the value the code uses, and the value
   * the checklist tells an operator to change.
   */
  const origin = (seo.match(/export const SITE_ORIGIN = "([^"]+)"/) ?? [])[1] ?? "";

  ok(
    "SITE_ORIGIN was read out of seo.ts",
    origin.length > 0,
    "the declaration did not parse, so the comparison below would compare " +
      "the checklist against an empty string and pass on any document.",
  );

  ok(
    "CUTOVER.md names the SITE_ORIGIN the code actually uses",
    origin.length > 0 && cutover.includes(origin),
    `seo.ts says ${origin} and CUTOVER.md does not contain it. Either the origin ` +
      `changed and the checklist was not updated, which is the exact moment this ` +
      `document matters, or the checklist is describing a site that no longer ` +
      `exists.`,
  );
}

/* ------- 19. FAILURES.md stays short, cited, and reachable ---------------- */

/*
 * THE PAGE'S VALUE IS THAT IT IS SHORT, so its length is asserted.
 *
 * Every shape on it was already written down, at length, when it happened
 * again. The problem was never that the incidents went unrecorded; it was that
 * seventeen stories are not findable and a list is. A page that grows back into
 * stories has become the thing it was written to replace, and nothing else in
 * this repo would notice.
 *
 * ## WHAT IS ASSERTED
 *
 * A ceiling on bytes and on the number of shapes, so growth is a deliberate
 * diff rather than drift. Every shape carries a CITATION. And CLAUDE.md points
 * at the page, because a page nobody reads is precisely the failure it exists
 * to prevent.
 *
 * ## PATHS ARE RESOLVED; COMMIT SHAS ARE NOT, and the reason is CI
 *
 * A path citation is checked against disk, so a shape pointing at a file that
 * has been moved or deleted fails here. A commit sha is NOT resolved, because
 * `actions/checkout@v4` clones at depth 1 and the shas cited are older than
 * that, so `git cat-file` would fail in CI for a reason that has nothing to do
 * with the citation being right. Asserting it locally and not in CI would mean
 * a gate that passes in the place it is reviewed and fails on one machine.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT CANNOT READ THE SHAPES.** It cannot tell whether a line states a real
 * failure mode, whether the citation supports the claim, or whether two shapes
 * are the same shape written twice. It counts, measures and resolves paths.
 * Whether the page is any GOOD is a human judgement and always will be.
 */

console.log("\n  19. FAILURES.md stays short, cited, and reachable");

{
  const failures = readFileSync(join(root, "FAILURES.md"), "utf8").replace(/\r\n/g, "\n");
  const claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");

  /*
   * SCOPE, ASSERTED. An empty or truncated file parses to zero shapes, and
   * every per-shape assertion below would then pass by iterating nothing.
   */
  const shapes = failures.split("\n").reduce((acc, line) => {
    if (/^- \*\*/.test(line)) acc.push(line);
    else if (acc.length > 0 && /^ {2}\S/.test(line)) acc[acc.length - 1] += " " + line.trim();
    return acc;
  }, /** @type {string[]} */ ([]));

  ok(
    "FAILURES.md parses into shapes",
    shapes.length >= 15,
    `${shapes.length} shape(s) parsed. Below that the citation check is measuring ` +
      `the parser rather than the page.`,
  );

  /*
   * THE CEILING, and it is the whole point rather than tidiness. Measured
   * 2026-08-21 at 3,567 bytes and 16 shapes. The limits are roughly 60 percent
   * headroom, so ordinary additions land and a page that has started telling
   * stories does not.
   */
  ok(
    "FAILURES.md still fits on one screen",
    failures.length <= 6000,
    `${failures.length} bytes against a 6000 ceiling. The page's entire value is ` +
      `that it is short enough to read before starting work. If these shapes now ` +
      `need more room, the fix is to CUT, or to move detail into VERIFICATION.md ` +
      `where the evidence lives, not to raise this number.`,
  );

  ok(
    "FAILURES.md is a list rather than a collection of stories",
    shapes.length <= 22,
    `${shapes.length} shapes against a ceiling of 22. Merge shapes that are the ` +
      `same shape, or drop the ones nothing has repeated.`,
  );

  /*
   * EVERY SHAPE CITES SOMETHING. A shape with no citation is an assertion about
   * this repo that a reader cannot check, which is the genre of claim this whole
   * page exists to distrust.
   */
  const CITATION = /`([^`]+)`/g;
  const uncited = [];
  /** @type {Set<string>} */
  const citedPaths = new Set();

  for (const shape of shapes) {
    const tokens = [...shape.matchAll(CITATION)].map((m) => m[1]);
    const cites = tokens.filter(
      (t) => /^[0-9a-f]{7,40}$/.test(t) || /\.(md|mjs|ts|tsx|json|sh)$/.test(t),
    );
    if (cites.length === 0) uncited.push(shape.slice(0, 70));
    for (const c of cites) if (!/^[0-9a-f]{7,40}$/.test(c)) citedPaths.add(c);
  }

  ok(
    "every shape carries a citation",
    uncited.length === 0,
    uncited.join("\n        ") +
      "\n        A shape with no citation is a claim about this repo that a reader " +
      "cannot check, which is the genre this page exists to distrust.",
  );

  /*
   * PATHS RESOLVE. Not shas: see the header. A cited path that has moved makes
   * the shape unfollowable, and this repo moves files.
   *
   * A `capsid:` prefix marks a citation that lives in the MCP store and is NOT
   * on disk. Those are skipped here, and the prefix is required rather than
   * inferred: this section FAILED on its own first run over a bare
   * `dustinedwards/decisions-vol-7.md`, and inferring "looks like a namespace,
   * skip it" would have silently exempted any repo path that had been deleted.
   * Making the author mark it also tells the READER the citation needs the MCP.
   */
  ok(
    "the citation scan found paths to resolve",
    citedPaths.size >= 4,
    `${citedPaths.size} distinct path(s) cited. If this is 0 the resolution below ` +
      `passes by having nothing to resolve.`,
  );

  const dead = [...citedPaths]
    .filter((p) => !p.startsWith("capsid:"))
    .filter((p) => p.includes("/") || p.endsWith(".md"))
    .filter((p) => !p.includes(" ") && !existsSync(join(root, p)));

  ok(
    "every cited path still exists",
    dead.length === 0,
    `${dead.join(", ")} cited in FAILURES.md and not on disk. A shape pointing at ` +
      `a file that moved is a shape nobody can follow back to its incident.`,
  );

  /*
   * REACHABILITY. The page's own thesis is that a recorded lesson nobody meets
   * is not recorded, so the pointer is asserted rather than assumed.
   */
  ok(
    "CLAUDE.md points at FAILURES.md",
    claudeMd.includes("FAILURES.md"),
    "nothing in the file every session reads first mentions the failure shapes, " +
      "so the page is exactly the thing it describes: written down and unfindable.",
  );
}

/* ------- 20. every admin loader carries timing --------------------------- */

/*
 * THE ONE LOADER NOBODY MARKED WAS THE EXPENSIVE ONE.
 *
 * MEASURED 2026-08-21: `/admin/posts.data` cost 1,420ms median with NOT ONE
 * `timed()` call, while its two D1 queries measure 0.33 to 0.47ms IN D1. About
 * 1,400ms was unattributed. Three separate fixes had landed on the admin
 * LAYOUT, which was the only thing instrumented, and each moved roughly 90ms
 * while the real cost sat one file away with no name.
 *
 * Of fifteen admin route files, TWO carried marks: the layout and the media
 * index. This section is what stops the next one hiding for a month.
 *
 * ## WHAT IS ASSERTED
 *
 * Every `app/routes/admin*` file that exports a `loader` contains at least one
 * `timed(` call, or is named below with a reason.
 *
 * ## WHAT IT CANNOT SEE, and it is the honest half
 *
 * **It counts a CALL, not COVERAGE.** A loader with six awaits and one
 * `timed()` passes here while five of them stay invisible, which is exactly the
 * state `admin.posts.$slug.edit.tsx` was in before this session. Proving every
 * await is wrapped needs to decide which expressions are I/O, which is a
 * parser's job and not a regex's. The floor this sets is "somebody thought
 * about it", and the breakdown SUMMING is what proves coverage; that check is a
 * measurement, not a gate, because it needs a live request.
 */

console.log("\n  20. every admin loader carries timing");

{
  /** @type {Map<string, string>} route file -> why it needs no mark */
  const NO_TIMING_NEEDED = new Map([
    [
      "admin.logout.tsx",
      "its loader is `throw redirect(\"/admin\")` and nothing else. There is no " +
        "I/O to time and a mark would measure the cost of throwing.",
    ],
    [
      "admin.tools.tsx",
      "since 2026-08-25 its loader calls `auditSecrets` and nothing else, which " +
        "reads bindings already in memory and performs no I/O. It DID carry a " +
        "mark, around `toolsSource.fetch`, and that source was a stubSource " +
        "returning a literal: the mark measured the cost of returning an object " +
        "and was kept deliberately, so the day it stopped reading ~0 would be " +
        "visible. The stub is gone with the fleet typing, so there is no longer " +
        "a call to wrap. Add a mark the moment this loader reads anything.",
    ],
  ]);

  const routes = readdirSync(join(root, "app", "routes")).filter(
    (n) => /^admin.*\.tsx?$/.test(n),
  );

  /*
   * SCOPE, ASSERTED. A glob that stopped matching would report every admin
   * loader instrumented by finding none, which is this repo's most repeated
   * defect class.
   */
  ok(
    "the admin route walk found routes",
    routes.length >= 12,
    `${routes.length} admin route file(s) found under app/routes. A zero-scope ` +
      `walk reports perfect coverage by examining nothing.`,
  );

  /** @type {string[]} */
  const unmarked = [];
  let withLoader = 0;

  for (const name of routes) {
    const src = readFileSync(join(root, "app", "routes", name), "utf8");
    const code = stripComments(src);
    if (!/export\s+(?:async\s+)?function\s+loader\b/.test(code)) continue;
    withLoader += 1;
    if (NO_TIMING_NEEDED.has(name)) continue;
    if (!/\btimed\s*\(/.test(code)) unmarked.push(name);
  }

  ok(
    "the walk found admin loaders to check",
    withLoader >= 10,
    `${withLoader} admin route(s) export a loader. If this collapses, the check ` +
      `below passes by having nothing to examine.`,
  );

  ok(
    "every admin loader carries at least one timed() call",
    unmarked.length === 0,
    unmarked.join(", ") +
      " export a loader and contain no timed() call. An unmarked admin loader is " +
      "how /admin/posts hid 1,400ms for a month while three fixes landed on the " +
      "90ms layout. Add a mark, or name the file in NO_TIMING_NEEDED with the " +
      "reason it has no I/O.",
  );

  /*
   * THE EXEMPTIONS POLICE THEMSELVES, both directions: an entry naming a file
   * that no longer exists exempts nothing, and one naming a file that HAS since
   * gained a timed() call is a stale excuse rather than a standing decision.
   */
  for (const [name, why] of NO_TIMING_NEEDED) {
    ok(
      `timing exemption ${name} names a route that still exists`,
      routes.includes(name),
      `app/routes/${name} is gone, so this exemption covers nothing (${why})`,
    );
    const src = routes.includes(name)
      ? stripComments(readFileSync(join(root, "app", "routes", name), "utf8"))
      : "";
    ok(
      `timing exemption ${name} is still untimed`,
      !/\btimed\s*\(/.test(src),
      `${name} now calls timed(), so the exemption is stale and should be deleted ` +
        `rather than left standing.`,
    );
  }
}

/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate is EIGHT sections numbered 1 to 9 with 5 REMOVED, several of which
 * are wrapped in try blocks that
 * report a failure and continue, and two of which change shape with --remote.
 * A section that stops running is therefore the most available failure here,
 * and it is invisible: the remaining sections still pass and the total is the
 * only witness.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-16 by RUNNING it: 102
 * offline, AFTER section 5 was removed. Never summed. It was 84 against a floor
 * of 80, then 85 when the draft preview reader took a second visibility
 * exemption, then 105 when section 9 landed with the media trash predicate, its
 * restore round trip and the permanent-delete guard.
 *
 * DELETING SECTION 5 COST THREE ASSERTIONS, 105 to 102, and that ratio is the
 * argument for the deletion rather than against it: 499 lines and a scan
 * reporting 246 column references produced three checks, and the scan could
 * desync on a regex literal and examine nothing while printing the same three.
 *
 * Floored at 97, slack of five, UNCHANGED. The drop is absorbed by the existing
 * slack deliberately: lowering the floor to match would hide the next section
 * that stops running, which is the failure this floor exists for.
 *
 * RE-MEASURED 2026-08-20 by RUNNING it: 105 offline, after section 10 added its
 * three assertions. Floor 97 to 100, slack of five held. Section 10 is three
 * assertions over a walk of every route file, so a walk that stopped finding
 * files would drop the count by three and the floor is what notices.
 *
 * RE-MEASURED AGAIN 2026-08-20 by RUNNING it: 113, after section 11's eight.
 * Floor 100 to 108, slack of five held. Section 11 extracts two function bodies
 * and walks the mutators of one module, so an extractor that returned "" would
 * drop several at once; three of its eight assertions exist to catch exactly
 * that and the floor catches the section vanishing whole.
 */
/* ------- 21. savePost never writes D1 before GitHub ---------------------- */

/*
 * **THE ORDER IS THE SAFETY PROPERTY, and it is invisible at a glance.**
 *
 * The repo is the source of truth and D1 is a derived index, so `savePost`
 * commits first and converges the index second. That order is what makes a
 * failure survivable in the direction that matters: a D1 failure AFTER the
 * commit leaves writing safe in git and an index that a rebuild repairs, while
 * a D1 write BEFORE the commit would leave the database describing a post that
 * exists on no commit, with nothing to rebuild from.
 *
 * The 2026-08-22 audit read this as the defect. It is not; "with no record" was
 * the defect and is fixed in `converge.mjs`. This section exists so that a
 * later edit reordering the two, which would look like a harmless tidy, fails
 * instead.
 *
 * SCOPED TO THE FUNCTION BODY, extracted by brace matching rather than a
 * character window, because a window reaches into the next function and this
 * file has several that touch both stores. Comments are stripped first: the
 * prose above `syncPostToD1` in the route names both calls while explaining
 * their order, and a whole-file scan would read that as code.
 */

console.log("\n  21. savePost commits before it touches D1");

{
  const publishSrc = stripComments(
    readFileSync(join(root, "app", "lib", "editor", "publish.server.ts"), "utf8"),
  );

  const at = publishSrc.search(/export\s+async\s+function\s+savePost\b/);
  ok(
    "savePost exists in publish.server.ts",
    at !== -1,
    "the function was renamed or moved, so nothing below examines anything",
  );

  let body = "";
  if (at !== -1) {
    // Brace matching from the first { after the signature, so the body cannot
    // spill into commitMessage() or syncAskForPost() below it.
    const open = publishSrc.indexOf("{", publishSrc.indexOf(")", at));
    let depth = 0;
    for (let i = open; i < publishSrc.length; i += 1) {
      if (publishSrc[i] === "{") depth += 1;
      else if (publishSrc[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          body = publishSrc.slice(open, i + 1);
          break;
        }
      }
    }
  }

  ok(
    "savePost's body was extracted",
    body.length > 200,
    `extracted ${body.length} character(s). A short or empty body would make every ` +
      `assertion below pass by having nothing to find.`,
  );

  const commitAt = body.indexOf("commitFiles(");
  const convergeAt = body.indexOf("convergeWithRetry(");

  ok(
    "savePost calls commitFiles",
    commitAt !== -1,
    "the GitHub write is gone from savePost, so the ordering claim is meaningless",
  );
  ok(
    "savePost converges D1 through convergeWithRetry",
    convergeAt !== -1,
    "the D1 write no longer goes through the retry-and-record path, so a failed " +
      "index write is silent again, which is the defect this replaced",
  );
  ok(
    "the D1 convergence happens AFTER the GitHub commit",
    commitAt !== -1 && convergeAt !== -1 && commitAt < convergeAt,
    `commitFiles is at ${commitAt} and convergeWithRetry at ${convergeAt}. Writing the ` +
      `index first would leave D1 describing a post that exists on no commit, with ` +
      `nothing to rebuild it from. The repo is the source of truth.`,
  );

  /*
   * THE OTHER DIRECTION: no bare D1 write in front of the commit. The ordering
   * assertion above only compares the two calls it knows about; this catches a
   * NEW write being added earlier, which is how the property would actually be
   * lost.
   */
  const beforeCommit = commitAt === -1 ? "" : body.slice(0, commitAt);
  ok(
    "nothing writes to D1 before the commit in savePost",
    !/\bsyncPostToD1\s*\(|\benv\.DB\b|\bdb\.batch\s*\(/.test(beforeCommit),
    "a database write appears before commitFiles. A refusal before the commit is a " +
      "CLEAN refusal with no drift, and that property holds only while nothing has " +
      "been written yet.",
  );
}

/* ------- 22. the home page's proof tiles are READ, never written --------- */

/*
 * THE FRONT PAGE MAKES THREE NUMERIC CLAIMS, and rule 17 says each belongs to
 * the instrument that measures it. Nothing owned that until this section: the
 * home route could have carried `<span>25</span>` and every other gate in this
 * repository would have stayed green, because no instrument reads the home
 * page's source and no fixture renders it.
 *
 * That matters more here than almost anywhere else on the site. These tiles are
 * the site's argument that it measures itself, so a hand-typed digit in one is
 * not a stale number, it is a false claim made in the exact place the claim is
 * being advertised.
 *
 * TWO HALVES, because either alone is satisfiable by a defect:
 *
 *   1. Each source is READ. The gate count comes from the stack artifact, the
 *      health verdict from `runHealthChecks`, the post count from the listing.
 *   2. The rendered tile block carries NO NUMERIC LITERAL. A loader that reads
 *      all three correctly and then renders a typed digit passes (1) completely.
 *
 * COMMENT-STRIPPED, because this file's own prose is full of digits and the
 * docblock above the loader legitimately discusses `s-maxage=600`.
 */
{
  const homePath = join(root, "app", "routes", "home.tsx");
  const home = stripComments(readFileSync(homePath, "utf8"));

  ok(
    "the home route was read and is not empty",
    home.length > 500,
    `${home.length} chars after comment stripping. A scan of an empty string ` +
      `reports exactly what a compliant file reports.`,
  );

  ok(
    "the gate count is read from the stack artifact, not written",
    /stack\.gates\.length/.test(home),
    "the tile must derive its number from content/generated/stack.json, which " +
      "build:stack derives from package.json and check:stack reconciles.",
  );
  ok(
    "the health verdict is read from the health module, not written",
    /runHealthChecks\(/.test(home),
    "the tile must report the same run /api/health serves.",
  );
  ok(
    "the post count is read from the listing, not written",
    /listing\.total/.test(home),
    "the tile must count through the same query, and therefore the same " +
      "publiclyVisible() predicate, that /blog counts with.",
  );

  /*
   * THE TILE BLOCK, extracted by its own element rather than by a character
   * window. A window around an anchor reads its neighbour's compliance, which
   * this repo has been bitten by; the section element bounds the scan to the
   * markup that makes the claims.
   */
  const proof = /<section className="home-proof"[\s\S]*?<\/section>/.exec(home)?.[0] ?? "";
  ok(
    "the proof section was located to scan",
    proof.length > 200,
    `extracted ${proof.length} chars. Without it the literal scan below would ` +
      `examine nothing and report a clean result.`,
  );

  /*
   * A DIGIT IN THE MARKUP IS THE DEFECT. `String(gates)` is fine, `>25<` is
   * not. The needle looks for a number sitting as rendered text or as a
   * complete attribute value, which is the shape a hand-written tile takes,
   * and deliberately ignores digits inside identifiers like `h2` or `sha256`.
   */
  const literals = [...proof.matchAll(/>\s*\d[\d,.]*\s*<|="\s*\d[\d,.]*\s*"/g)].map(
    (m) => m[0].trim(),
  );
  ok(
    "no proof tile states a number of its own",
    literals.length === 0,
    `the home page's proof section contains ${literals.length} numeric literal(s): ` +
      `${literals.join(", ")}. Every number on that section is a claim about a ` +
      `measurement and must come from the instrument that took it. Rule 17.`,
  );
}

/*
 * RE-MEASURED 2026-08-23 BY RUNNING IT: 226 offline.
 *
 * **THIS FLOOR HAD GONE STALE BY 66 AND ITS MESSAGE BY 142.** The constant read
 * 160 while the gate ran 226, and the failure text it would have printed said
 * "Measured: 84 offline", a number from several sections ago. A floor 66 under
 * the truth cannot fail on anything short of a catastrophe: three whole
 * sections could stop running and the count would still clear it, which is the
 * unfailable-condition class in hard rule 10, in the gate that enforces hard
 * rule 10.
 *
 * The same drift was found in `check:headers` on the same day, where the floor
 * read 99 against a measured 143. Two independent instances of one shape, and
 * the shape is this: a floor is raised when a section lands and then never
 * again, so it decays every time an existing section grows an assertion. Both
 * are now re-measured by RUNNING the gate, which is the only method that would
 * have caught either.
 *
 * Floor 160 to 214. RE-MEASURED AGAIN 2026-08-23 after the engines binding
 * landed: 228, so the margin is 14, about six percent. Stated as a margin
 * rather than a percentage because the property that matters is how many
 * assertions can vanish before this notices, and that is a count.
 *
 * RE-MEASURED 2026-08-25 by RUNNING the gate after section 22 and the tools
 * timing exemption landed: 247. Floor 214 to 233, margin held at 14, which is
 * the same count of vanishing assertions this gate could previously absorb.
 * Section 22 is 6 assertions, so losing it whole still fails.
 */
const MINIMUM_CHECKS = 233;
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A section was SKIPPED ` +
      `rather than failing. Measured 2026-08-25: 247 offline.`,
  );
}

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
