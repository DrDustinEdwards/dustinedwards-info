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
 * So this file holds six sections, and the first is not a comparison:
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
 * Sections 4 and 5 exist because of hard rule 11 and cost a real defect:
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

import { readFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { joinConcatenatedLiterals } from "./lib/sql-literals.mjs";
import { classifySqliteTables, ftsOwnedTables } from "./lib/sqlite-tables.mjs";
import { retryRead } from "./lib/retry.mjs";

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
 * Source with comments and string literals removed.
 *
 * Both matter. A comment naming the expression would be found by the scan and
 * reported as a second implementation, which is exactly the trap `check:logo`
 * and `check:contrast` both hit by parsing their own prose. String literals
 * matter because THIS FILE quotes the pattern it looks for, and would otherwise
 * flag itself.
 *
 * @param {string} source
 */
function stripped(source) {
  return stripComments(source)
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/**
 * Comments removed, strings kept.
 *
 * **This must run before any attempt to find string literals, and that is not a
 * tidiness preference.** An apostrophe in ordinary prose ("does not" written as
 * "doesn't", or a possessive in a doc comment) opens a single-quoted string as
 * far as a regex is concerned, and it runs to the next apostrophe anywhere in
 * the file, swallowing whatever code lies between. Section 5 reported
 * `process.argv`, `window.innerHeight` and `Math.floor` as unknown database
 * columns for exactly this reason before comments were stripped first.
 *
 * @param {string} source
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

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
  const text = stripped(readFileSync(file, "utf8"));
  if (SELECTION.some((re) => re.test(text))) selectionSites.push(file);
}

ok(
  "the scan examined a plausible number of source files",
  files.length >= 50,
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
    // Not a failure. A table drizzle does not model is reachable only through
    // raw SQL, which is precisely what section 5 asserts against. Printed so the
    // set is visible rather than implied.
    console.log(
      `     not modelled in drizzle, so covered by section 5: ${unmodelled.join(", ")}`,
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

/* --------------------------------- 5. raw SQL names columns that exist */

console.log("\n  5. every column named in raw SQL exists in the schema");

/**
 * The columns raw SQL refers to, checked against the real schema.
 *
 * Section 4 proves the three schema sources agree. This proves the SQL STRINGS
 * agree with them, which is the half that actually failed: `r2_key` was not a
 * disagreement between schema sources, it was a string nobody compared to any
 * of them.
 *
 * **It does not parse SQL and does not need to.** Five extractions, all regex,
 * and every one of them was added because a probe proved the previous set let a
 * real column rename through:
 *
 *   (a) INSERT INTO <table> (a, b, c)  table-scoped, so a column that exists on
 *                                      some OTHER table is still caught
 *   (b) <qualifier>.<column>           resolved through FROM/JOIN aliases, and
 *                                      through `excluded` to the INSERT target
 *   (c) unqualified names after
 *       WHERE / AND / OR / SET / BY     table-scoped when one table is in play,
 *                                      otherwise a schema-wide existence check
 *   (d) EVERY assignment in a SET      not just the first after the keyword
 *   (e) bare SELECT lists              plain identifiers only
 *
 * Statements are read from string literals JOINED ACROSS `+` first. Without
 * that, `sync-content.mjs` was the last hole in this gate: it builds its SQL as
 * literal text, so every column name is statically present, but it concatenates
 * fragments for line length and no single fragment holds a whole statement.
 *
 * **It asserts only that a named column EXISTS, never that a statement names
 * every column.** That distinction is load-bearing: the editor's `posts` upsert
 * deliberately omits `og_image`, because a post created in the editor has no
 * social card until `build:og` runs, and the editor stores nothing rather than a
 * URL that would 404. A completeness check would call that a defect and be
 * wrong.
 *
 * Virtual tables are skipped: `INSERT INTO posts_fts (posts_fts) VALUES
 * ('rebuild')` names the TABLE in the column position, which is fts5 command
 * syntax rather than a column reference, and `MATCH`, `snippet()` and `bm25()`
 * have no equivalent the query builder can express.
 */
/**
 * SQL is extracted from STRING LITERALS, never from a byte window in the file.
 *
 * The first version of this matched anything after a SELECT/INSERT keyword for
 * 1200 characters, which swallowed the surrounding JavaScript and duly reported
 * `view.state`, `rows.map` and `window.innerHeight` as unknown columns. A
 * qualified name only means a column if it is inside SQL, so the literal is the
 * unit and everything outside one is not SQL by construction.
 */
const STRING_LITERAL = /`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g;
const LOOKS_LIKE_SQL = /\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i;

/**
 * Adjacent string literals joined across `+`, so a statement split for line
 * length is one statement again.
 *
 * **This is what `sync-content.mjs` needed, and without it that file was the
 * last hole in this gate.** It builds its SQL as literal text, so the column
 * names are all statically present, but it concatenates fragments:
 *
 *     `INSERT INTO posts (slug, kind, title, body, ` +
 *       `html, description, ...) VALUES (` +
 *       ...
 *
 * Every extraction below needs a WHOLE statement. The INSERT column list is
 * matched up to its closing paren, and that paren is three fragments away, so
 * the largest write path in the repo was invisible while the file still
 * appeared in the scan because its single-fragment statements matched.
 *
 * Joining is safe for the same reason it is necessary: it can only make a
 * literal longer, and a longer literal that is not SQL still fails
 * `LOOKS_LIKE_SQL`, while a name that resolves to no table is caught either way.
 *
 * @param {string} source
 */
// joinConcatenatedLiterals moved to scripts/lib/sql-literals.mjs 2026-08-09, so it
// can be covered by test/sql-literals.test.mjs without importing this gate,
// which runs its whole suite at module load. Grounds are in that module.

try {
  const columnUniverse = new Map();
  const fresh2 = new DatabaseSync(":memory:");
  for (const file of readdirSync(join(root, "drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    fresh2.exec(readFileSync(join(root, "drizzle", file), "utf8"));
  }
  const tables2 = /** @type {{name: string, sql: string | null}[]} */ (
    /** @type {unknown} */ (
      fresh2
        .prepare("SELECT name, sql FROM sqlite_master WHERE type='table'")
        .all()
    )
  );
  const { real: realTables, virtual: virtualTables } = classifyTables(tables2);
  for (const table of realTables) {
    const info = /** @type {any[]} */ (
      fresh2.prepare(`PRAGMA table_info(${table})`).all()
    );
    columnUniverse.set(table, new Set(info.map((c) => String(c.name))));
  }
  /** Every column name anywhere, for the cases an alias cannot be resolved. */
  const anyColumn = new Set(
    [...columnUniverse.values()].flatMap((s) => [...s]),
  );
  // SQLite exposes these on every table without declaring them.
  for (const implicit of ["rowid", "oid", "_rowid_"]) anyColumn.add(implicit);

  ok(
    "the column universe is not empty",
    anyColumn.size > 0 && columnUniverse.size > 0,
    "nothing to check names against, so every assertion below would be vacuous",
  );

  const SQL_KEYWORDS = new Set([
    "select", "from", "where", "and", "or", "not", "null", "is", "in", "as",
    "on", "join", "left", "inner", "outer", "order", "by", "group", "having",
    "limit", "offset", "insert", "into", "values", "update", "set", "delete",
    "conflict", "do", "nothing", "ignore", "desc", "asc", "distinct", "count",
    "case", "when", "then", "else", "end", "excluded", "unixepoch", "datetime",
    "strftime", "substr", "instr", "snippet", "bm25", "char", "coalesce", "cast",
    "exists", "union", "all", "replace", "rebuild", "abs", "length", "max", "min",
  ]);

  let statementsScanned = 0;
  let namesChecked = 0;
  /*
   * Counted and PRINTED, so "0 unknown columns" can never quietly mean "every
   * statement was skipped". The same discipline the diagram gate uses for
   * unreachable rules: an exclusion that reports nothing is indistinguishable
   * from an exclusion that swallowed everything.
   */
  let analyticsStatementsSkipped = 0;
  /**
   * Analytics Engine dataset names, from the TRACKED example config.
   *
   * The real wrangler.jsonc is gitignored and absent from check:head's
   * extracted worktree, and `check:config` asserts the dataset name matches in
   * both files, so reading the example is the portable half of one gated pair
   * rather than a weaker source.
   *
   * @type {string[]}
   */
  const ANALYTICS_DATASETS = (() => {
    try {
      const raw = readFileSync(join(root, "wrangler.jsonc.example"), "utf8");
      const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const names = (JSON.parse(stripped).analytics_engine_datasets ?? [])
        .map((/** @type {any} */ ae) => ae.dataset)
        .filter(Boolean);
      return names;
    } catch {
      // FAIL CLOSED. An unreadable config means no exclusion, so an Analytics
      // Engine statement is reported rather than silently skipped.
      return [];
    }
  })();
  let unresolved = 0;
  /** @type {string[]} */
  const unknown = [];

  for (const file of sourceFiles()) {
    const relativePath = relative(root, file).split(sep).join("/");
    // This gate quotes SQL in its own prose and fixtures; scanning itself would
    // report its own examples. Same self-reference trap as section 1.
    if (relativePath === "scripts/check-invariants.mjs") continue;
    // Generated ambient types. No SQL, and its doc comments carry URLs that
    // read as qualified names.
    if (relativePath.endsWith(".d.ts")) continue;
    /*
     * `test/` holds SQL FIXTURES, which is the same self-reference trap as this
     * gate's own file one line above and is excluded for the same reason, not
     * as a convenience.
     *
     * Found the moment `test/` was added, 2026-08-09: `test/sql-literals.test.mjs`
     * replays the `og_titl` defect, so it deliberately contains statements
     * naming columns that exist nowhere, and this section correctly reported
     * four of them. A fixture asserting that a MISSPELLED column is rejoined
     * cannot also be required to name real columns.
     *
     * The scope is narrow on purpose. Only `test/` is excluded, not any file
     * with "test" in its name, and the coverage floor below still applies to
     * everything else, so this cannot quietly become a way to hide real SQL.
     */
    if (relativePath === "test" || relativePath.startsWith("test/")) continue;
    const text = joinConcatenatedLiterals(
      stripComments(readFileSync(file, "utf8")),
    );
    if (!LOOKS_LIKE_SQL.test(text)) continue;

    /*
     * A FILE MAY DEFINE ITS OWN SCHEMA, and one does.
     * `workers/ask-budget.ts` runs against the Durable Object's private SQLite,
     * not D1, and creates its `budget` table in the same file. Its `day` and
     * `count` columns are perfectly real and appear nowhere in `drizzle/`.
     *
     * Derived rather than excluded by name: any CREATE TABLE found in this
     * file is executed into a throwaway database and read back with the same
     * PRAGMA as everything else, so the local tables are checked against their
     * own definition instead of being skipped. A typo in the Durable Object's
     * own SQL is still caught.
     */
    const localSchema = new Map();
    for (const create of text.match(/CREATE\s+TABLE[\s\S]*?\([\s\S]*?\)/gi) ?? []) {
      const ddl = create.replace(/\$\{[^}]*\}/g, "x");
      try {
        const scratch = new DatabaseSync(":memory:");
        scratch.exec(ddl);
        const made = /** @type {any[]} */ (
          scratch
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .all()
        );
        for (const t of made) {
          const info = /** @type {any[]} */ (
            scratch.prepare(`PRAGMA table_info(${t.name})`).all()
          );
          localSchema.set(
            String(t.name),
            new Set(info.map((c) => String(c.name))),
          );
        }
      } catch {
        // Not valid standalone DDL (an interpolated fragment, a partial match).
        // Nothing to learn from it, and guessing would be worse than skipping.
      }
    }

    for (const literal of text.match(STRING_LITERAL) ?? []) {
      // An interpolation is a value or an identifier this scan cannot resolve,
      // so it becomes a placeholder rather than text to read column names out
      // of. `${posts.publishAt}` is a drizzle column reference, already checked
      // by the typechecker, and is not a raw name.
      const statement = literal
        .slice(1, -1)
        .replace(/\$\{[^}]*\}/g, " ? ");
      if (!LOOKS_LIKE_SQL.test(statement)) continue;
      if (!/\b(FROM|INTO|UPDATE|SET)\b/i.test(statement)) continue;

      /*
       * ANALYTICS ENGINE IS NOT D1, so its statements are out of scope here.
       *
       * This section asserts that every column named in raw SQL exists in
       * `app/db/schema.ts`. Analytics Engine is a different system with a fixed
       * schema we do not own: `blob1`, `double1`, `timestamp` and
       * `_sample_interval` are its columns and will never appear in ours.
       * Checking them against the D1 universe asks a question with no true
       * answer, which is what it did on first contact with the traffic panel.
       *
       * TWO DISCRIMINATORS, because one of them does not survive this scanner.
       * The dataset name is the obvious signal, but the callers build the FROM
       * by interpolation and the loop above rewrites every `${...}` to `?`, so
       * the name is gone by the time the text arrives here. Measured, after the
       * name-only version skipped zero statements and reported the failure
       * unchanged.
       *
       * So `_sample_interval` carries it. That column is Analytics Engine's
       * sampling weight, it is not a name this schema has or could have, and
       * every query against the dataset must reference it: counting without it
       * undercounts the moment sampling engages, which is the panel's whole
       * correctness argument. The dataset name is kept as the second signal for
       * statements that spell it out, and it is resolved from the config rather
       * than typed here so renaming the dataset moves this with it.
       *
       * An Analytics Engine statement that references neither would be checked
       * against the D1 schema and reported. That is the safe direction: loud
       * and wrong, rather than quiet and unchecked.
       *
       * SCOPED TO THE STATEMENT, never to the file. A D1 statement sitting in
       * the same module is still checked, which is why this is not an exemption
       * list of paths.
       */
      const namesDataset = ANALYTICS_DATASETS.some((d) =>
        new RegExp(`\\bFROM\\s+${d}\\b`, "i").test(statement),
      );
      if (namesDataset || /\b_sample_interval\b/.test(statement)) {
        analyticsStatementsSkipped += 1;
        continue;
      }

      statementsScanned += 1;

      // (a) INSERT INTO <table> ( ... ), scoped to that table.
      const insert = statement.match(
        /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/i,
      );
      if (insert && !virtualTables.includes(insert[1])) {
        const table = insert[1];
        const known = columnUniverse.get(table);
        if (known) {
          for (const piece of insert[2].split(",")) {
            const name = piece.trim().replace(/^["'`\[]|["'`\]]$/g, "");
            if (!name || !/^[A-Za-z_][\w]*$/.test(name)) continue;
            if (SQL_KEYWORDS.has(name.toLowerCase())) continue;
            namesChecked += 1;
            if (!known.has(name)) {
              unknown.push(`${relativePath}: ${table}.${name} (INSERT column list)`);
            }
          }
        }
      }

      /*
       * (b) qualified references, resolved to a table wherever possible.
       *
       * The QUALIFIER must be a real table or an alias this statement binds.
       * That is what separates `d.publish_at` from `console.log`, and without
       * it a multi-line template literal that happens to contain SQL reports
       * every property access near it as an unknown column. Resolving the alias
       * also makes the check table-scoped rather than schema-wide, so a column
       * that exists on some OTHER table is still caught.
       *
       * Quoted values are removed first: `WHERE key = 'llms.txt'` is a string,
       * not a reference to a `txt` column on an `llms` table.
       */
      const body = statement.replace(/'(?:[^']|'')*'/g, " ? ");

      /** @type {Map<string, string>} */
      const aliases = new Map();
      for (const table of realTables) aliases.set(table, table);
      for (const table of localSchema.keys()) aliases.set(table, table);
      for (const [, table, alias] of body.matchAll(
        /\b(?:FROM|JOIN|INTO|UPDATE)\s+([A-Za-z_]\w*)(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/gi,
      )) {
        if (!realTables.includes(table)) continue;
        if (alias && !SQL_KEYWORDS.has(alias.toLowerCase())) {
          aliases.set(alias, table);
        }
      }
      // `FROM posts p, tags t` binds the second pair after a comma.
      for (const [, table, alias] of body.matchAll(
        /,\s*([A-Za-z_]\w*)\s+(?:AS\s+)?([A-Za-z_]\w*)/gi,
      )) {
        if (realTables.includes(table)) aliases.set(alias, table);
      }
      /*
       * `excluded` is the row the INSERT tried to write, so it carries exactly
       * the target table's columns. Binding it makes `excluded.og_title` a
       * checkable reference instead of an unresolvable qualifier, and an upsert
       * is where most of this repo's column names appear twice.
       */
      const insertTarget = body.match(
        /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+([A-Za-z_]\w*)/i,
      );
      if (insertTarget && realTables.includes(insertTarget[1])) {
        aliases.set("excluded", insertTarget[1]);
      }

      /*
       * (c) UNQUALIFIED references.
       *
       * **This is the case the original bug was in.** `claimMediaKeyForDelete`
       * read `DELETE FROM media WHERE r2_key = ?1`, with no qualifier and no
       * INSERT column list, so neither of the extractions above would have seen
       * it and this gate would have shipped unable to catch the defect it was
       * written for.
       */

      /** Columns of a table, from the file's own DDL if it declares any. */
      const columnsOf = (/** @type {string} */ t) =>
        localSchema.get(t) ?? columnUniverse.get(t);

      /** Every column name in scope for THIS file, D1 plus any local table. */
      const inScope = new Set(anyColumn);
      for (const cols of localSchema.values()) {
        for (const c of cols) inScope.add(c);
      }

      const tablesTouched = new Set(
        [...body.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+([A-Za-z_]\w*)/gi)]
          .map((m) => m[1])
          .filter((t) => realTables.includes(t) || localSchema.has(t)),
      );
      const soleTable = tablesTouched.size === 1 ? [...tablesTouched][0] : null;

      const bare = [
        ...body.matchAll(
          /\b(?:WHERE|AND|OR|SET|BY)\s+([A-Za-z_]\w*)\s*(?:=|<|>|!=|\bIS\b|\bIN\b|\bLIKE\b|\bNOT\b|\bDESC\b|\bASC\b|,|$)/gi,
        ),
      ].map((m) => m[1]);

      /*
       * (e) BARE SELECT lists.
       *
       * `SELECT uid, url, title, publish_at FROM search_docs` names four
       * columns and none of them followed a keyword this scan anchored on, so
       * all four were unchecked. Measured before this existed: `titl` in that
       * list was accepted with 0 failures.
       *
       * Only plain identifiers are taken. `COUNT(*)`, `snippet(...)`,
       * `substr(d.body, 1, 240) AS snippet` and anything qualified are left to
       * the other extractions, which already handle them or correctly ignore
       * them.
       */
      const selectList = body.match(/\bSELECT\b\s+(?:DISTINCT\s+)?([\s\S]*?)\bFROM\b/i);
      if (selectList) {
        for (const item of selectList[1].split(",")) {
          const name = item.trim();
          if (!/^[A-Za-z_]\w*$/.test(name)) continue;
          bare.push(name);
        }
      }

      /*
       * (d) EVERY assignment target in a SET clause, not just the first.
       *
       * The pattern above anchors on the SET keyword, so in
       * `SET kind = excluded.kind, title = excluded.title, ...` it saw `kind`
       * and stopped. An upsert in this repo assigns twenty-two columns, so
       * twenty-one of them were unchecked, and a typo in any of them passed.
       * Measured before this existed: `og_titl = excluded.og_title` in
       * sync-content.mjs was accepted with 0 failures.
       */
      const setClause = body.match(/\bSET\b([\s\S]*?)(?:\bWHERE\b|$)/i);
      if (setClause) {
        for (const [, name] of setClause[1].matchAll(
          /(?:^|,)\s*([A-Za-z_]\w*)\s*=/g,
        )) {
          bare.push(name);
        }
      }

      for (const name of bare) {
        if (SQL_KEYWORDS.has(name.toLowerCase())) continue;
        namesChecked += 1;
        if (soleTable) {
          // One table, so the name is attributable and the check is exact.
          const known = columnsOf(soleTable);
          if (known && !known.has(name)) {
            unknown.push(
              `${relativePath}: ${name} is not a column of ${soleTable}`,
            );
          }
        } else if (!inScope.has(name)) {
          /*
           * More than one table in play, so which one owns an unqualified name
           * needs a parser. The weaker question is still worth asking and is
           * still decisive for the bug this gate exists for: `r2_key` is a
           * column of NO table, and the statement that named it touched both
           * `media` and `media_refs` through a subquery, which is exactly why
           * a single-table restriction here missed it on the first attempt.
           */
          unknown.push(
            `${relativePath}: ${name} is not a column of any table (statement touches ${[...tablesTouched].join(", ") || "no known table"})`,
          );
        }
      }

      for (const [, qualifier, name] of body.matchAll(
        /\b([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)\b/g,
      )) {
        if (SQL_KEYWORDS.has(name.toLowerCase())) continue;
        if (virtualTables.includes(qualifier)) continue;
        const table = aliases.get(qualifier);
        // An unresolvable qualifier is not a column reference this scan can
        // judge, so it is skipped rather than guessed at. Reported in the
        // count below so the skipping is visible.
        if (!table) {
          unresolved += 1;
          continue;
        }
        namesChecked += 1;
        const known = columnsOf(table);
        if (known && !known.has(name) && !inScope.has(name)) {
          unknown.push(`${relativePath}: ${table}.${name}`);
        } else if (known && !known.has(name)) {
          unknown.push(
            `${relativePath}: ${name} is not a column of ${table} (qualified as ${qualifier})`,
          );
        }
      }
    }
  }

  ok(
    "the scan found raw SQL to examine",
    statementsScanned > 0 && namesChecked > 0,
    `${statementsScanned} statement(s), ${namesChecked} name(s); a green result would mean nothing`,
  );
  ok(
    "every column named in raw SQL exists",
    unknown.length === 0,
    unknown.join(" | "),
  );

  console.log(
    `     ${statementsScanned} raw statement(s), ${namesChecked} column reference(s) ` +
      `checked, ${unresolved} qualifier(s) unresolved, ` +
      `${virtualTables.length} fts5 table(s) skipped, ` +
      `${analyticsStatementsSkipped} analytics engine statement(s) out of scope ` +
      `(${ANALYTICS_DATASETS.join(", ") || "no dataset resolved"})`,
  );
} catch (error) {
  fail("the raw SQL column check could not run", String(error));
}

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
   * This file's `stripped()` blanks every string literal to `""` so that a
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
    // stripped() ONLY. joinConcatenatedLiterals merges concatenated string
    // literals across lines, which destroys the column-0 brace structure the
    // function extractor below depends on. It exists for the SQL-literal passes
    // and buys nothing here: `.from(posts)` is not a string literal. Using it
    // scored 18 query sites in a file that has 2, and reported isToolName as a
    // posts reader.
    const code = stripped(readFileSync(file, "utf8"));
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
    appFilesScanned >= 80,
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
    const code = stripped(readFileSync(join(root, f.rel), "utf8"));
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
  const dbCode = stripped(dbSource);
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

  // Anti-vacuity floors, set just under the measured 2026-08-10 counts:
  // 13 sites, 10 querying functions, 9 composing.
  ok(
    "the posts-reader scan found a plausible number of query sites",
    totalSites >= 10,
    `${totalSites} found; expected at least 10. A broken matcher reports zero violations.`,
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

  /** Strip comments, then EXTRACT literals: the inverse of section 5. */
  const LITERAL = /`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g;
  const SQLISH = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|CREATE\s+VIRTUAL)\b/i;

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
        readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/(^|[^:])\/\/[^\n]*/g, "$1 "),
      );
      for (const literal of code.match(LITERAL) ?? []) {
        if (!SQLISH.test(literal)) continue;
        sqlLiterals += 1;
        /*
         * Both guarded on a NON-EMPTY derived list. With zero indexes the
         * alternation collapses to `()`, which matches the empty string and so
         * matches EVERY literal: the tripwire above has already failed by then,
         * and without this the same run also reports every DELETE in the repo
         * as an FTS violation. Found by the vacuity plant, which produced two
         * misleading extra failures beside the one it was written to fire.
         */
        if (owned.length > 0 && DELETE_FTS.test(literal)) {
          deleteViolations.push(`${rel}: ${literal.trim().slice(0, 90)}`);
        }
        if (classified.virtual.length > 0 && COUNT_INDEX.test(literal)) {
          countViolations.push(`${rel}: ${literal.trim().slice(0, 90)}`);
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
   * ANTI-VACUITY. Measured 2026-08-10 THROUGH THIS EXACT PIPELINE: 143 files
   * and 61 SQL-bearing literals. A raw count before comment-stripping and
   * literal-joining reads 150 and 80, and taking those as the floor would sit
   * it ABOVE what the gate can actually see. Measure what the gate measures.
   *
   * Floors set roughly a quarter under, so ordinary refactoring does not trip
   * them. A zero means the literal extractor broke, and "0 violations" from a
   * broken extractor is indistinguishable from a clean repo. Hard rule 10.
   */
  ok(
    "the literal scan examined a plausible number of files",
    filesScanned >= 110,
    `${filesScanned} scanned; expected the whole of app, workers and scripts`,
  );
  ok(
    "the literal scan found SQL to examine",
    sqlLiterals >= 45,
    `${sqlLiterals} SQL-bearing literal(s) found; expected at least 45. The extractor ` +
      `is broken, so a green result below would mean nothing.`,
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
   * The companion, and it is the positive half. Enumerated before asserting:
   * `sync-content.mjs` is the only FTS health check in the repo, and it counts
   * posts_fts_docsize, search_identity_docsize and search_prose_docsize. If
   * that disappears, the drift check has gone and nothing else would say so.
   */
  ok(
    "at least one FTS health check counts a *_docsize shadow",
    docsizeCounts >= 3,
    `${docsizeCounts} found; sync-content.mjs counts three. If this dropped, the only ` +
      `check that can detect FTS drift has been removed or rewritten to count the index.`,
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
    scanned >= 80,
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
    readers.length >= 4,
    `${readers.length} found; expected at least 4 (runIndex, runBrowse, and zeroState's ` +
      `two). The SELECT shape changed and this scan no longer sees it.`,
  );

  const bare = readers.filter((r) => !r.direct && !r.indirect);
  ok(
    "every search_docs reader composes visibilityClause, directly or via filters.clause",
    bare.length === 0,
    bare.map((r) => `${r.key} selects from search_docs with no visibility predicate`).join("\n        ") +
      "\n        Hard rule 1 reaches the search index too. Compose visibilityClause(), " +
      "passing NO_ALIAS for an unaliased query.",
  );

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

/* ------------------------------------------------------------------ report */

rmSync(join(root, "node_modules", ".cache", "check-invariants"), {
  recursive: true,
  force: true,
});

/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate is EIGHT sections, several of which are wrapped in try blocks that
 * report a failure and continue, and two of which change shape with --remote.
 * A section that stops running is therefore the most available failure here,
 * and it is invisible: the remaining sections still pass and the total is the
 * only witness.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 84
 * offline. Never summed. Floored at 80, slack of four: the offline count is
 * stable across runs, and --remote only ADDS, so a floor set on the offline
 * figure holds for both tiers.
 */
const MINIMUM_CHECKS = 80;
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A section was SKIPPED ` +
      `rather than failing. Measured: 84 offline.`,
  );
}

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
