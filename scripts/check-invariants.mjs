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
 */
const MINIMUM_CHECKS = 97;
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
