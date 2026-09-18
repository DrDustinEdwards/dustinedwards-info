/**
 * Gate over rules stated twice, in different languages or runtimes, that cannot merge.
 *
 *   npm run check:invariants
 *   npm run check:invariants -- --remote    adds the live database
 *
 * It catches divergence between the two copies, not whether the rule is right.
 * Section 2 carries hard rule 1; section 4 carries hard rule 11.
 * Every section asserts its fixture and scan are non-empty.
 */

import { existsSync, readFileSync, readdirSync, mkdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { joinConcatenatedLiterals } from "./lib/sql-literals.mjs";
import { classifySqliteTables, ftsOwnedTables } from "./lib/sqlite-tables.mjs";
import { retryRead } from "./lib/retry.mjs";
import { stripComments, stripCommentsAndStrings } from "./lib/strip-comments.mjs";
import { parseJsonc } from "./lib/wrangler-surface.mjs";
import { assertFloor } from "./lib/floor.mjs";
import { resolveD1Address } from "./lib/d1-address.mjs";

/**
 * Blanks whole-line `#` comments so an assertion cannot match YAML prose.
 * Trailing `#` is left alone: a naive pass would cut strings.
 *
 * @param {string} src
 * @returns {string}
 */
const stripHashComments = (src) => src.replace(/^[ \t]*#.*$/gm, " ");

/* Strings are blanked too: this file quotes the patterns it hunts. */

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

/* helpers */



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
      // Gitignored build output, excluded by full path so a source `dist` elsewhere is walked.
      if (full === join(root, "app", "enhance", "dist")) continue;
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
      // CommonJS, so one Proxy stub satisfies any named import at runtime.
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

/* 1. no second bucketFor */

console.log("\ncheck:invariants\n");
console.log("  1. bucket selection exists in exactly one place");

/** A conditional choosing `.OG` or `.MEDIA`. Walking both buckets is not this shape. */
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

/* 2. publiclyVisible vs visibilityClause */

console.log("\n  2. publiclyVisible() and visibilityClause() agree");

/**
 * Every post state, drafts included. `NOW` comes from `publiclyVisible()`'s own params,
 * because the two halves read the clock differently.
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
  // The drizzle half renders to SQL without a database.
  const dbModule = await bundle(
    join(root, "app", "db", "index.ts"),
    "db.mjs",
    /^~\/(lib\/context|lib\/auth|lib\/timing)/,
  );
  const { SQLiteSyncDialect } = await import("drizzle-orm/sqlite-core");
  const rendered = new SQLiteSyncDialect().sqlToQuery(dbModule.publiclyVisible());

  /* A `timestamp` binds as epoch seconds; a Date is normalised in case that changes. */
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

    // A predicate admitting everything or nothing proves nothing.
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

/* 3. the two resolveImage paths */

console.log("\n  3. the Node and Worker resolveImage paths agree");

/**
 * Only `/media/` srcs are pure functions of the key. Neither resolver may give them a
 * placeholder; the proxy env below throws on any binding read.
 */
const MEDIA_SRCS = [
  "/media/0001020304050607-1600x900.webp",
  "/media/aabbccddeeff0011-32x32.png",
  "/media/0123456789abcdef-1x1.avif",
  "/media/0001020304050607-1600x900.webp?w=640",
  // A key without dimensions must fail on both sides.
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
    // Throws if a resolver reaches a binding for a `/media/` src.
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

      // Same size with different placeholders is still two documents.
      const dims = (/** @type {{ok: boolean, value: any}} */ r) =>
        r.ok
          ? `${r.value.width}x${r.value.height} lqip=${r.value.placeholder ? "yes" : "none"}`
          : "refused";
      const same = a.ok === b.ok && dims(a) === dims(b);
      if (same) agreements += 1;
      ok(
        `both resolvers agree on ${src}`,
        same,
        `Node ${dims(a)}, Worker ${dims(b)}`,
      );
      // Agreement is not correctness: both inventing a placeholder fails.
      const lqip = (/** @type {{ok: boolean, value: any}} */ r) =>
        Boolean(r.ok && r.value.placeholder);
      ok(
        `neither resolver returns a placeholder for ${src}`,
        !lqip(a) && !lqip(b),
        `a /media/ key has no build-time derivation, so a placeholder here is a ` +
          `value one writer could produce and the other could not.`,
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
    // A count, never an unconditional verdict.
    console.log(
      `     ${compared} media src(s) compared, ${agreements} in agreement`,
    );
  }
} catch (error) {
  fail("the resolveImage comparison could not run", String(error));
}

/* 4. the column schema, three ways */

console.log("\n  4. columns agree across schema.ts, the migrations and the database");

/**
 * Hard rule 11: columns from schema.ts, the migrations on an empty database, and live D1.
 * All derived, no column list here. Virtual, shadow and `sqlite_%` tables are excluded.
 */

/** @param {{name: string, sql: string | null}[]} tables */
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
  /* source 1: schema.ts, through drizzle */
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

  /* source 2: the migrations */
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

  /* schema.ts vs migrations */
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

  /* the indexes */

  /*
   * Hard rule 11 for indexes: names and ordered columns. Partial predicates, collations and
   * directions are skipped, drizzle cannot express them. Implicit indexes go by `origin`.
   */
  {
    /** @type {Map<string, string[]>} */
    const schemaIndexes = new Map();
    for (const mod of [schemaModule, authModule]) {
      for (const value of Object.values(mod)) {
        if (!drizzleOrm.is(value, drizzleCore.SQLiteTable)) continue;
        const config = drizzleCore.getTableConfig(/** @type {any} */ (value));
        for (const idx of config.indexes) {
          const columns = idx.config.columns.map((/** @type {any} */ c) =>
            String(c.name ?? c),
          );
          schemaIndexes.set(idx.config.name, columns);
        }
      }
    }

    /** @type {Map<string, string[]>} */
    const migrationIndexes = new Map();
    for (const table of migrationTables) {
      const list = /** @type {any[]} */ (
        fresh.prepare(`PRAGMA index_list(${table})`).all()
      );
      for (const row of list) {
        // Origin 'c' is CREATE INDEX. 'u' and 'pk' are constraint-implied.
        if (String(row.origin) !== "c") continue;
        const info = /** @type {any[]} */ (
          fresh.prepare(`PRAGMA index_info(${String(row.name)})`).all()
        );
        migrationIndexes.set(
          String(row.name),
          info
            .slice()
            .sort((a, b) => Number(a.seqno) - Number(b.seqno))
            .map((c) => String(c.name)),
        );
      }
    }

    /* An empty side makes every comparison below pass vacuously. */
    ok(
      "indexes were parsed out of schema.ts",
      schemaIndexes.size > 0,
      "getTableConfig reported no indexes, so both directions below are vacuous",
    );
    ok(
      "indexes were read back out of the applied migrations",
      migrationIndexes.size > 0,
      "PRAGMA index_list reported no CREATE INDEX rows, so both directions are vacuous",
    );

    const missingInMigrations = [...schemaIndexes.keys()].filter(
      (n) => !migrationIndexes.has(n),
    );
    const missingInSchema = [...migrationIndexes.keys()].filter(
      (n) => !schemaIndexes.has(n),
    );

    ok(
      "every index schema.ts declares is created by a migration",
      missingInMigrations.length === 0,
      `no migration creates ${missingInMigrations.join(", ")}. schema.ts is ` +
        `describing an index the database will not have.`,
    );
    ok(
      "every index a migration creates is declared in schema.ts",
      missingInSchema.length === 0,
      `schema.ts does not declare ${missingInSchema.join(", ")}. Hard rule 11: a ` +
        `reader of the schema would conclude those queries run unindexed.`,
    );

    /** @type {string[]} */
    const columnMismatches = [];
    let indexesCompared = 0;
    for (const [name, columns] of schemaIndexes) {
      const other = migrationIndexes.get(name);
      if (!other) continue;
      indexesCompared += 1;
      if (columns.join(",") !== other.join(",")) {
        columnMismatches.push(
          `${name}: schema.ts (${columns.join(", ")}) vs migrations (${other.join(", ")})`,
        );
      }
    }

    ok(
      "every shared index was actually compared",
      indexesCompared === schemaIndexes.size - missingInMigrations.length,
      `${indexesCompared} of ${schemaIndexes.size - missingInMigrations.length}`,
    );
    ok(
      "every index covers the same columns, in the same order, on both sides",
      columnMismatches.length === 0,
      `${columnMismatches.join("; ")}. A composite index with its columns ` +
        `reversed is a different index wearing the same name.`,
    );

    console.log(
      `     ${schemaIndexes.size} declared index(es), ${migrationIndexes.size} created, ` +
        `${indexesCompared} compared by column`,
    );
  }

  if (unmodelled.length > 0) {
    /* Unmodelled tables have no column check; printed as an exposure. */
    console.log(
      `     not modelled in drizzle and UNCOVERED since section 5 was removed: ${unmodelled.join(", ")}`,
    );
  }

  /* source 3: live database */
  if (!wantsRemote) {
    console.log("     live database SKIPPED (pass --remote to include it)");
  } else {
    /*
     * One quoted `--command`: on Windows args arrays split, `shell: false` cannot run `.cmd`,
     * and `--file` returns one result set under `--json`.
     */
    const command = migrationTables
      .map((t) => `PRAGMA table_info(${t});`)
      .join(" ");
    /* `spawnSync` returns on failure, so the status is thrown or `retryRead` never retries. */
    const proc = await retryRead(
      () => {
        const r = spawnSync(
          `npx wrangler d1 execute ${resolveD1Address("dustinedwards", "--remote")} ` +
            `--remote --json --command "${command}"`,
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

/* 4a. search_docs is never queried through drizzle */

/*
 * Hard rule 1 for `search_docs` is section 8's raw-SQL scan; section 6 knows only `posts`.
 * So `searchDocs` in a query position is banned. To allow one, teach section 6 first.
 */

console.log("\n  4a. search_docs is modelled for the schema, never read through it");

{
  const SELF = ["app/db/schema.ts"];
  const QUERY_POSITION =
    /\.(?:from|into|update|delete|insert)\s*\(\s*searchDocs\b/;

  /** @type {string[]} */
  const offenders = [];
  let scanned = 0;

  for (const file of [
    ...sourceFiles(join(root, "app")),
    ...sourceFiles(join(root, "workers")),
  ]) {
    const rel = relative(root, file).split(sep).join("/");
    if (SELF.includes(rel)) continue;
    scanned += 1;
    const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
    if (QUERY_POSITION.test(code)) offenders.push(rel);
  }

  /* An empty walk reports the same as a clean repo. */
  ok(
    "the walk opened files to scan",
    scanned >= 132,
    `scanned ${scanned} file(s), floor 132, measured 165 on 2026-08-28. A ` +
      `zero-scope walk finds no query-builder read because it read nothing.`,
  );

  /* Prove the needle can fire. */
  ok(
    "the query-position needle can fire",
    QUERY_POSITION.test("db.select().from(searchDocs).all()"),
    "the needle no longer matches a drizzle read, so the ban cannot be enforced",
  );
  ok(
    "the query-position needle does not fire on a bare mention",
    !QUERY_POSITION.test("import { searchDocs } from '~/db/schema';"),
    "an import is being read as a query, which would ban the declaration itself",
  );

  ok(
    "nothing reads search_docs through the query builder",
    offenders.length === 0,
    `${offenders.join(", ")}. Section 6 scans \`posts\` and section 8 scans raw ` +
      `SQL, so a drizzle read of this table is covered by neither. Teach ` +
      `section 6 about it first, then delete this section.`,
  );
}

/* 5. removed */

/*
 * Removed: its literal matcher desyncs on regex literals. No gate checks raw-SQL column names.
 * Sections 7 and 8 guard hard rules 2 and 1.
 */

/* 6. every posts reader composes the predicate */

/*
 * Hard rule 1 at the caller: every `.from(posts)` is in `app/db/index.ts`, and each function
 * there composes the predicate unless exempt by function name. Writes are out of scope.
 */

console.log("\n  6. every posts reader composes the visibility predicate");

/** Allowed to read `posts` without the predicate, each with a reason. */
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
  listPostCorpusForRelated:
    "feeds relatedFor in publish.server.ts. Drafts are included because " +
    "withRelated does its own draft filtering of CANDIDATES while still " +
    "computing a related list FOR a draft; pre-filtering here would change " +
    "that half. It selects slug, title, status and publish_at, never a body, " +
    "and its output reaches only the posts row's `related` column, whose " +
    "public readers all sit behind publiclyVisible() at the route. Reached " +
    "from the save and rebuild paths, which are behind Better Auth or the " +
    "operator token.",
  listPostSourcesForCitations:
    "the media citation scan. A DRAFT citing an image must still refuse that " +
    "image's deletion, so filtering drafts out would fail OPEN, which is the " +
    "inversion of every other reader here: visibility filtering is the unsafe " +
    "direction. Reached only from resolveCitations, whose callers are the " +
    "/admin/media loader and delete action behind Better Auth; nothing it " +
    "returns is rendered outside the admin plane.",
  listPostsForOperator:
    "the operator list_posts tool, whose contract has always included drafts: " +
    "an operator stages drafts and must be able to list them. Reached only " +
    "through the operator API behind its bearer token; the tool's own " +
    "docblock states the policy.",
  getAdminPostRow:
    "the rendered half of the operator get_post response, for a post the " +
    "caller already named and whose raw markdown the same response carries " +
    "from the repository. Operator-token gated; a draft's html is exactly " +
    "what an operator editing a draft is entitled to see.",
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
 * Local names for `posts`, aliases included, so an alias cannot hide a hard rule 1 reader.
 *
 * @param {string} code comment-stripped source
 * @returns {string[]} local binding names
 */
function postsBindings(code) {
  /* The path may be empty: strings are already blanked. */
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
    // Not `joinConcatenatedLiterals`: it breaks the column-0 braces.
    const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
    const bindings = postsBindings(code);
    // An empty alternation matches every `.from()`.
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
   * Column-0 `function` to column-0 `}`. CRLF first, or no body ever closes.
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

  /** Exempt by file and function, never by file. */
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

  /* Every query must land in an extracted body; asserted below. */
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

  /* Floors catch a broken matcher, not one legitimate removal. */
  ok(
    "the posts-reader scan found a plausible number of query sites",
    totalSites >= 15,
    `${totalSites} found, floor 15, measured 18 on 2026-08-28. A broken matcher reports zero violations.`,
  );

  const composing = queriers.filter((f) => PREDICATE.test(f.body));
  ok(
    "at least some readers were seen composing the predicate",
    composing.length >= 6,
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

  // A stale exemption is unaudited permission.
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

/* 7. no DELETE FROM or COUNT(*) on an FTS index */

/*
 * Hard rule 2: `DELETE FROM` corrupts an fts5 index, and `COUNT(*)` reads the content table so
 * it cannot see drift. The rest of hard rule 2 is gated elsewhere. The index list is derived.
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

  /* A fourth index means re-measure; zero means the classifier broke. */
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
   * Scans whole source, not extracted literals, which desync on regex literals and hid a
   * hard rule 2 violation. Occurrence is all this needs.
   */
  const SQLISH = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|CREATE\s+VIRTUAL)\b/gi;

  let filesScanned = 0;
  let sqlLiterals = 0;
  let docsizeCounts = 0;
  /** @type {string[]} */
  const deleteViolations = [];
  /** @type {string[]} */
  const countViolations = [];

  /* Empty, DELETE_FTS would match every `DELETE FROM`. */
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
      // This file names what it forbids.
      if (rel === "scripts/check-invariants.mjs") continue;
      if (rel.endsWith(".d.ts")) continue;
      filesScanned += 1;

      const code = joinConcatenatedLiterals(
        stripComments(readFileSync(file, "utf8")),
      );
      /* Scope: SQL-ish matches. */
      sqlLiterals += (code.match(SQLISH) ?? []).length;

      {
        const literal = code;
        /* An empty alternation matches everything. */
        /* Show the match, not the file head. */
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
        /* Matches, not literals: concatenation merges several into one. */
        docsizeCounts += [
          ...literal.matchAll(/COUNT\s*\(\s*\*\s*\)\s*FROM\s+\w+_docsize\b/gi),
        ].length;
      }
    }
  }

  /* A broken walk reports zero violations. Hard rule 10. */
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

  /* The FTS drift checks must not disappear. */
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

/* 8. every search_docs reader composes the predicate */

/*
 * Hard rule 1 for raw-SQL `search_docs` reads, which section 6 cannot see: directly via
 * `visibilityClause(...)` or via `filters.clause`, whose builder is asserted too.
 */

console.log("\n  8. every search_docs reader composes the visibility predicate");

try {
  const DIRECT = /visibilityClause\s*\(/;
  const INDIRECT = /\bfilters\s*\.\s*clause\b/;

  /* Per literal: `DELETE FROM search_docs` contains `FROM search_docs`; `runIndex` uses `JOIN`. */
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
      /* Per query, not per function: `zeroState` runs two. */
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

        /* Resolve `prepare(sql)` to its assignment, or the main readers are missed. */
        const bareArg = statement.match(/^\(\s*([A-Za-z_$][\w$]*)\s*\)$/);
        if (bareArg) {
          const assign = fn.body.match(
            new RegExp(`\\b(?:const|let)\\s+${bareArg[1]}\\s*=\\s*\`(?:\\\\.|[^\`\\\\])*\``),
          );
          if (assign) statement = assign[0];
        }

            /*
             * `LITERALS` is blind to regex literals, so it is safe only while no `prepare()` argument
             * holds one. Asserted here.
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
  /* Tight: a small set cannot absorb slack. */
  ok(
    "the scan found search_docs readers at all",
    readers.length >= 5,
    `${readers.length} found; expected at least 4 (runIndex, runBrowse, and zeroState's ` +
      `two). The SELECT shape changed and this scan no longer sees it.`,
  );

  /**
   * Named, so a new reader cannot match by accident.
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

  /* An exemption no longer needed fails. */
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

/* 9. trash hides from the library, not from R2 */

/*
 * Runs `notTrashed()` on the real migrations. Too narrow shows trash in the library; too
 * wide makes `check:media` backfill the row.
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

  /* Two brand rows, so a broken role count reads 2, not nothing. */
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

  /* Anti-vacuity first. */
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
  /* Or `check:media` undoes the trash. */
  ok(
    "reconciliation still sees the trashed row",
    countWhere("1=1") === 3,
    `an unfiltered read returned ${countWhere("1=1")}, expected 3. listMediaRecords, ` +
      `mediaRecordsFor, existingMediaKeys and mediaRecord must NOT filter, because ` +
      `the R2 object is untouched by trashing.`,
  );

  /* Restore, as a round trip on the column. */
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

  /* The only place the migration runs. */
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

  /* The delete claim keeps its `NOT EXISTS` guard. The behavioural half runs a model of it. */
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

  /* Bulk deletes must call the guard; `check:admin-ui` stubs `.server` and cannot see it. */
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

  /* Bulk tagging must call `serialiseTags`, the one tag writer. */
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
  /* No direct `tags` write assertion: its firing could not be shown (hard rule 10). */

  console.log(
    `     3 fixture row(s), predicate ${JSON.stringify(clause)}`,
  );
} catch (error) {
  fail("the trash predicate check could not run", String(error));
}

/* report */

rmSync(join(root, "node_modules", ".cache", "check-invariants"), {
  recursive: true,
  force: true,
});

/* Section 10 is retired; its number is not reused. */

/* 11. the drift badge reads a cache */

/*
 * On a cache hit `askDriftCount` returns before any index reference; asserted on source
 * order, which an instrument cannot bypass. Every index mutator drops the cached count.
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

  /* Scope first: every assertion below passes on an empty extraction. */
  ok(
    "the askDriftCount body was extracted, and it is that function alone",
    drift.length > 200 &&
      drift.length < askSource.length / 3 &&
      !drift.includes("export async function removeAskPost"),
    `extracted ${drift.length} char(s) from a ${askSource.length} char file`,
  );

  // Order, not presence; both are asserted present before positions are compared.
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
   * The late write goes on `ctx.waitUntil`, never floating: Workers may cancel work after the
   * response. Both directions, so a floating `void listing` beside it also fails.
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
   * A failed upload's key still joins `live`: the prune deletes owned keys not in `live`, so
   * omitting it would delete the good indexed copy.
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
   * Position is not reachability: a `continue` in the catch keeps the text order and skips
   * `live.add`, so the assertion reads what lies between the two.
   */
  /* No backslash here: an escaped boundary can reach disk as a backspace byte (hard rule 12). */
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

  // The loader only: `askStatusContext` is still set by middleware and read by /admin/posts.
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

  /* A mutator that keeps the cached count leaves the badge stale until the TTL. */
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
 * `root.tsx` renders the skip link on every route, so any route rendering its own `<main>`
 * must give it `id="main"`. Source only; check:browser measures reachability.
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

  /* Scope: an empty walk or an over-eager stripper also reports no offenders. */
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
 * Public meta comes from `pageMeta` or `postSocial`, because hand-copied literals drift.
 * Admin and the named exemptions are noindex; exemptions are names, never a pattern.
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

  /* Scope: an empty walk also reports nothing hand-rolled. */
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
 * `STATIC_PATHS` mirrors `routes.ts`. Every route before `// Auth` that is `.tsx` with no
 * `:param` must be in it or in `SITEMAP_EXEMPT`, or the page is silently unlisted.
 */

console.log("\n  14. every public page route is in the sitemap or exempt");

{
  /** Public page routes deliberately absent from the sitemap, with the reason. */
  const SITEMAP_EXEMPT = {
    "/search":
      "a results page. Its content is a function of the query string, so listing " +
      "the bare path offers a crawler an empty page and listing queries is unbounded.",
  };

  const sitemapSource = readFileSync(join(root, "app", "routes", "sitemap.ts"), "utf8");

  /* Public block only. The `// Auth` marker is a comment, so it is found on the raw source. */
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

  /* Scope: an empty parse reports nothing missing; a lost `// Auth` marker is how it shrinks. */
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

  /*
   * No writer can produce a `kind = 'page'` row, which is why the sitemap has no branch for one.
   * A writer that starts inserting one fails here instead of publishing an unlisted page.
   */
  /*
   * Presence and absence, not a read of VALUES, which `sync-content.mjs` builds from fragments.
   * The CHECK constraint (section 4) admits only 'page' or 'post'.
   * Hard rule 10: the INSERT needle is anchored, or it also matches `posts_fts`.
   */
  const WRITERS = [
    "app/lib/editor/publish.server.ts",
    "scripts/sync-content.mjs",
  ];
  /** @type {string[]} */
  const badKind = [];
  let insertsSeen = 0;
  for (const rel of WRITERS) {
    const code = stripComments(readFileSync(join(root, rel), "utf8"));
    insertsSeen += (code.match(/INSERT\s+INTO\s+posts\b/gi) ?? []).length;
    if (!/'post'/.test(code)) badKind.push(`${rel}: writes no 'post' literal at all`);
    if (/'page'/.test(code)) badKind.push(`${rel}: writes a 'page' literal`);
  }

  /* Scope: a needle that stopped matching reports no offending writer. */
  /* No slack: one statement per writer, so a vanished writer must fail. */
  ok(
    "the posts INSERT scan found a statement in every writer",
    insertsSeen >= WRITERS.length,
    `found ${insertsSeen} INSERT INTO posts statement(s) across ${WRITERS.length} ` +
      `writer(s), measured 2 on 2026-08-28. A zero-scope scan finds no bad kind ` +
      `because it read none.`,
  );
  ok(
    "no writer into posts can produce a kind = 'page' row",
    badKind.length === 0,
    `${badKind.join("; ")}. The sitemap has no branch for a page row because ` +
      `none can exist; a writer that changes that has to add the branch back.`,
  );

  ok(
    "the sitemap does not filter on kind, since nothing writes another one",
    !/\bkind\b/.test(stripComments(sitemapSource)),
    "sitemap.ts filters on posts.kind again. Either a page row can now exist, in " +
      "which case this assertion is wrong, or the branch is dead again.",
  );
}

/* ------- 15. every cited hard-rule number resolves to a rule ------------- */

/*
 * Every `hard rule N` citation must resolve to a `### N.` heading in CLAUDE.md. Paraphrases
 * (of hard rule 3, hard rule 9, hard rule 10, hard rule 15) are not checked.
 */

console.log("\n  15. CLAUDE.md's rules are reachable, and every cited number resolves");

{
  const claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");

  /* Normalized for matching so CRLF cannot hide a needle; raw for the size on disk. */
  const claudeText = claudeMd.replace(/\r\n/g, "\n");

  /* The harness silently truncates CLAUDE.md, which would hide the hard rules from a session. */
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

  /* Scope: with no headings `ordinal` is -1 and the check below fails for the wrong reason. */
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

  /* Matched on "append-only": the sentence recording the unfreeze contains "frozen". */
  ok(
    "CLAUDE.md records that rule numbering is append-only",
    /append-only/i.test(claudeText),
    "without that note the next reader has no reason not to renumber.",
  );

  /** Rule numbers CLAUDE.md actually defines, from its `### N.` headings. */
  const defined = new Set(
    [...claudeMd.matchAll(/^### (\d+)\. /gm)].map((m) => Number(m[1])),
  );

  /* Scope: an empty `defined` set would report every citation as a broken comment. */
  /*
   * A floor, since numbering is append-only; one below the defined count is hard rule 10's
   * over-wide threshold, in the gate that binds hard rule 10.
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

  /* Reads lists ("Hard rules 7, 10 and 12"), bounded to digits, commas and "and". */
  const CITATION = /hard rules? ((?:\d+)(?:\s*(?:,|and)\s*\d+)*)/gi;

  /* Root documents are in scope and named, because `sourceFiles` walks only code. */
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

  /* Floors come from running this walk, never from counting files on disk. */
  ok(
    "the source walk found hard-rule citations to resolve",
    scanned >= 230 && cited >= 118,
    `scanned ${scanned} file(s) and found ${cited} citation(s). A zero-scope walk ` +
      `resolves every citation it did not find. Measured 2026-08-24: 247 and 126.`,
  );

  /*
   * The scanned floor cannot see the root documents drop out (hard rule 10's over-wide
   * threshold). CLAUDE.md defines rules and cites none, so only VERIFICATION.md must cite.
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
 * Rules 4, 6, 13 and 14 make falsifiable claims about the tree. Each is asserted both ways:
 * the claim is still written, and the code still has the property.
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

  /* Scope first: a broken extractor would read as four rule defects. */
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
    authImporters.length === 1 && (authImporters[0] ?? "").endsWith("login.tsx"),
    `imported by ${authImporters.map((f) => relative(root, f)).join(", ") || "nothing"}. ` +
      `Rule 4 keeps the Worker lean by confining the client auth bundle to /login.`,
  );


  /* -- rule 9 -------------------------------------------------------------- */
  /*
   * `/login` is public, so rule 9 applies: a posting form with a submit, and an action to
   * receive it.
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
   * Counts occurrences, not files: a second construction in the same file is the defect
   * rule 6 describes.
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
  /* This file's message contains the marker, so it is excluded by exact path, never a pattern. */
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
    marked.length === 2,
    `${marked.length} marked: ${marked.map((f) => relative(root, f)).join(", ")}. ` +
      `Rule 13 names exactly two, so a third is an unrecorded exception and fewer ` +
      `means a marker was dropped. It was THREE until 2026-08-29, when the theme ` +
      `control became one button: the header stopped passing a resolved theme down, ` +
      `so the theme fallback that substitution covered no longer exists.`,
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
 * CI runs the derived `check:ci` tier, never a hand list that forgets the next gate, and reads
 * Node from `.nvmrc`. It reads a file: it cannot see that CI ran.
 */

console.log("\n  16. the CI workflow runs the derived tier");

{
  // Comments are stripped before matching (`stripHashComments`): a step's comment names `npm ci`.

  const CI_PATH = join(root, ".github", "workflows", "ci.yml");
  const present = existsSync(CI_PATH);
  ok(
    "a CI workflow exists at .github/workflows/ci.yml",
    present,
    "there is no workflow, so nothing reviews a commit but its author",
  );

  const rawYaml = present ? readFileSync(CI_PATH, "utf8") : "";
  const yaml = stripHashComments(rawYaml);

  /* Scope: the file must be non-trivial before any match means anything. */
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

  /* The engines floor equals the `.nvmrc` pin CI runs; a floor, so patch releases install. */
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
   * The only alert that reaches a human unprompted: it must exist, poll the health route, and
   * pin its checkout by sha. It cannot see a run fire.
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
   * Both ways: no `uses:` line may end in a version tag, since a pinned action beside a floating
   * one passes the positive check.
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
 * Helper-signature drift: with two argument orders, a copied call puts a truthy string in the
 * condition slot and never fails. One signature per helper, and no string conditions.
 */

console.log("\n  17. assertion helpers agree, and no condition is a string");

{
  const gateFiles = readdirSync(join(root, "scripts"))
    .filter((n) => n.endsWith(".mjs"))
    .map((n) => ({ name: n, path: join(root, "scripts", n) }));

  /* Fails closed on a broken directory read; floored under the count, which moves. */
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

  // Scope: no definitions means the matcher stopped matching.
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
   * Scope: no calls reads like no string conditions. Floored about 13 percent under a count
   * taken by running this gate.
   */
  ok(
    "the condition-slot scan examined assertion calls",
    callsExamined >= 1117,
    `${callsExamined} call(s) examined across ${gateFiles.length} file(s). A ` +
      `zero-scope scan finds no string conditions because it read nothing.`,
  );

  /* Printed so the floor above can be re-measured without editing the gate. */
  console.log(
    `     ${callsExamined} assertion call(s) examined across ${gateFiles.length} gate file(s)`,
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
 * No step can drop out of `CUTOVER.md`, and its `SITE_ORIGIN` must match `app/lib/seo.ts`.
 * It cannot tell whether any step was performed.
 */

console.log("\n  18. the cutover checklist is complete and current");

{
  const cutover = readFileSync(join(root, "CUTOVER.md"), "utf8");
  const seo = readFileSync(join(root, "app", "lib", "seo.ts"), "utf8");

  /* Scope: a stub would read as every step missing. */
  ok(
    "CUTOVER.md is a document rather than a stub",
    cutover.length > 1500,
    `${cutover.length} characters. Below that, the item checks below are ` +
      `measuring whether the file exists, not what it says.`,
  );

  /* Named, not counted, so one item cannot be swapped for another. */
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
     * The HSTS revisit step. Needles are anchored (hard rule 10's unanchored-needle class), and
     * `preload` must sit within the HSTS step because the word has other uses here.
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

  /* The binding: the origin the code uses against the one the checklist names. */
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
 * FAILURES.md is useful because it is short. Cited paths resolve; commit shas do not, because
 * CI clones at depth 1.
 */

console.log("\n  19. FAILURES.md stays short, cited, and reachable");

{
  const failures = readFileSync(join(root, "FAILURES.md"), "utf8").replace(/\r\n/g, "\n");
  const claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");

  /* Scope: an empty file parses to zero shapes and every per-shape check passes. */
  const shapes = failures.split("\n").reduce((acc, line) => {
    if (line.startsWith("- **")) acc.push(line);
    else if (acc.length > 0 && /^ {2}\S/.test(line)) acc[acc.length - 1] += " " + line.trim();
    return acc;
  }, /** @type {string[]} */ ([]));

  ok(
    "FAILURES.md parses into shapes",
    shapes.length >= 15,
    `${shapes.length} shape(s) parsed. Below that the citation check is measuring ` +
      `the parser rather than the page.`,
  );

  /* The ceiling is the point: ordinary additions fit, a page that tells stories does not. */
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

  /* An uncited shape is a claim a reader cannot check. */
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

  /* A `capsid:` prefix is required, never inferred, so a deleted repo path cannot pass as one. */
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

  /* Asserted: a lesson nobody meets is not recorded. */
  ok(
    "CLAUDE.md points at FAILURES.md",
    claudeMd.includes("FAILURES.md"),
    "nothing in the file every session reads first mentions the failure shapes, " +
      "so the page is exactly the thing it describes: written down and unfindable.",
  );
}

/* ------- 20. every admin loader carries timing --------------------------- */

/*
 * Every admin route exporting a `loader` calls `timed(` or is in `NO_TIMING_NEEDED`.
 * It counts a call, not coverage.
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

  /* Scope: a glob that stopped matching reports every loader instrumented. */
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

  /* Exemptions are checked both ways: a vanished file, or one that calls `timed()`, is stale. */
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

/* ------- 21. savePost never writes D1 before GitHub ---------------------- */

/*
 * `savePost` commits before it writes D1: a D1 write first could describe a post on no commit,
 * while a D1 failure after is repairable. A reorder looks like a tidy, so it fails here.
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
    // Brace matching, so the body cannot spill into the functions below it.
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

  /* The other direction: no new D1 write may appear before the commit. */
  const beforeCommit = commitAt === -1 ? "" : body.slice(0, commitAt);
  ok(
    "nothing writes to D1 before the commit in savePost",
    !/\bsyncPostToD1\s*\(|\benv\.DB\b|\bdb\.batch\s*\(/.test(beforeCommit),
    "a database write appears before commitFiles. A refusal before the commit is a " +
      "CLEAN refusal with no drift, and that property holds only while nothing has " +
      "been written yet.",
  );

  /*
   * `mediaRefKey` owns the dedup key: a printable separator merges refs, and the delete guard
   * can then drop a cited blob. Both ways: helper called, no template join.
   */
  const refsAt = publishSrc.search(/function\s+mediaRefStatements\b/);
  ok(
    "mediaRefStatements exists in publish.server.ts",
    refsAt !== -1,
    "the writer was renamed or moved, so nothing below examines anything",
  );

  let refsBody = "";
  if (refsAt !== -1) {
    const open = publishSrc.indexOf("{", publishSrc.indexOf(")", refsAt));
    let depth = 0;
    for (let i = open; i < publishSrc.length; i += 1) {
      if (publishSrc[i] === "{") depth += 1;
      else if (publishSrc[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          refsBody = publishSrc.slice(open, i + 1);
          break;
        }
      }
    }
  }

  ok(
    "mediaRefStatements' body was extracted",
    refsBody.length > 200,
    `extracted ${refsBody.length} character(s). A short or empty body would make ` +
      `both assertions below pass by having nothing to find.`,
  );

  ok(
    "the live media-ref writer composes mediaRefKey",
    /\bmediaRefKey\s*\(/.test(refsBody),
    "the dedup key is built inline again. It belongs to app/lib/media-ref-key.mjs, " +
      "which is the only statement of the separator rule and the only one under test.",
  );

  ok(
    "the live media-ref writer builds no dedup key of its own",
    !/\$\{\s*ref\.\w+\s*\}[^`$]*\$\{\s*ref\.\w+\s*\}/.test(refsBody),
    "a template literal joins two or more ref fields in the writer's body. That is " +
      "the space-join defect returning: any printable separator collides, and a " +
      "collision silently drops a real citation.",
  );
}

/* ------- 22. the home page's proof tiles are READ, never written --------- */

/*
 * The home page's proof tiles report measurements and never state them (rule 17).
 * Two halves, since either alone passes a defect: each source is read, and the tile markup
 * carries no numeric literal. Comments are stripped because this file's prose is full of digits.
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
  /*
   * The verdict is read through `readHealthTile`; the loader must never run the suite, which
   * is what made the home page slow. The negative half keeps that true.
   */
  ok(
    "the health verdict is read from the stored snapshot, not written",
    /readHealthTile\(/.test(home),
    "the tile must report the snapshot /api/health wrote, through the one " +
      "reader in app/lib/health/snapshot.server.ts.",
  );
  ok(
    "the home loader does not run the health suite",
    !/runHealthChecks/.test(home),
    "home.tsx calls runHealthChecks. The front door must not compute health: " +
      "measured 2026-08-26, that call cost this page 1.07 to 3.48 s at origin " +
      "against 0.32 to 0.90 s for /blog. Read the snapshot instead.",
  );
  /*
   * The count comes from a query composing `publiclyVisible()`, never a literal or a page length.
   * Both binding names pass: the property is the source, not the variable name.
   */
  ok(
    "the post count is read from a counting query, not written",
    /\b(listing|start)\.total\b/.test(home) &&
      /listHomeStartHere|listBlogPosts/.test(home) &&
      !/\bposts:\s*\d/.test(home),
    "the tile must count through the same query, and therefore the same " +
      "publiclyVisible() predicate, that /blog counts with.",
  );

  /* Bounded by the section element, not a character window, which reads a neighbour's compliance. */
  const proof = /<section className="home-proof"[\s\S]*?<\/section>/.exec(home)?.[0] ?? "";
  ok(
    "the proof section was located to scan",
    proof.length > 200,
    `extracted ${proof.length} chars. Without it the literal scan below would ` +
      `examine nothing and report a clean result.`,
  );

  /*
   * A number as rendered text or as a whole attribute value is the defect.
   * Digits inside identifiers like `h2` or `sha256` are ignored.
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

console.log("\n  23. renderAndWrite is the one door to a rendered row, and writes all of it");

/*
 * `renderAndWrite` -> `syncPostToD1` is the only live writer of a post's derived rows, so its
 * batch composition is asserted: a dropped spread silently stops posts entering search.
 * Source scan, comments stripped: it sees a spread absent, not one present and wrong.
 */
{
  const publishSrc = stripComments(
    readFileSync(join(root, "app", "lib", "editor", "publish.server.ts"), "utf8"),
  );

  const doorAt = publishSrc.search(/export\s+async\s+function\s+renderAndWrite\b/);
  ok(
    "renderAndWrite exists in publish.server.ts",
    doorAt !== -1,
    "the door was renamed or moved, so nothing below examines anything",
  );

  let door = "";
  if (doorAt !== -1) {
    const open = publishSrc.indexOf("{", publishSrc.indexOf(")", doorAt));
    let depth = 0;
    for (let i = open; i < publishSrc.length; i += 1) {
      if (publishSrc[i] === "{") depth += 1;
      else if (publishSrc[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          door = publishSrc.slice(open, i + 1);
          break;
        }
      }
    }
  }
  ok(
    "renderAndWrite's body was extracted",
    door.length > 100,
    `extracted ${door.length} character(s); an empty body passes everything vacuously`,
  );
  ok(
    "renderAndWrite writes through syncPostToD1",
    /\bsyncPostToD1\s*\(/.test(door),
    "the door no longer reaches the batch writer, so what it writes is unexamined",
  );
  ok(
    "renderAndWrite verifies the blob sha it was handed",
    /sourceBlobSha !== blobSha/.test(door),
    "the transport-integrity check is gone: a truncated fetch would write a row " +
      "whose provenance lies",
  );

  const syncAt = publishSrc.search(/export\s+async\s+function\s+syncPostToD1\b/);
  let sync = "";
  if (syncAt !== -1) {
    const open = publishSrc.indexOf("{", publishSrc.indexOf(")", syncAt));
    let depth = 0;
    for (let i = open; i < publishSrc.length; i += 1) {
      if (publishSrc[i] === "{") depth += 1;
      else if (publishSrc[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          sync = publishSrc.slice(open, i + 1);
          break;
        }
      }
    }
  }
  ok(
    "syncPostToD1's body was extracted",
    sync.length > 200,
    `extracted ${sync.length} character(s); an empty body passes everything vacuously`,
  );
  ok(
    "syncPostToD1's batch spreads the search statements",
    /\.\.\.searchStatements\(db, record\)/.test(sync),
    "a save's post would stop entering search_docs, silently, until the next " +
      "bulk sync papered over it",
  );
  ok(
    "syncPostToD1's batch spreads the media-ref statements",
    /\.\.\.mediaRefStatements\(db, record\)/.test(sync),
    "a save would stop recording citations, and the delete guard's precise " +
      "half would go blind to new posts",
  );
  ok(
    "syncPostToD1 rebuilds the posts FTS index in the same batch",
    /posts_fts\) VALUES \('rebuild'\)/.test(sync),
    "the FTS index would drift from the row it indexes within one save",
  );
}

console.log("\n  24. no client hooks in an unhydrated tree");

/*
 * An unhydrated route renders once on the server, so a client hook in its tree is dead code.
 * Its module graph may not import state or lifecycle hooks from "react" nor client hooks from
 * "react-router"; render-time hooks are allowed.
 * Reads import clauses only (`import type` ignored); a namespace or renamed hook is invisible.
 * The unhydrated set is derived: route files minus `hydrate: true` and the admin children.
 */
{
  const routesDir = join(root, "app", "routes");
  const routeFiles = readdirSync(routesDir).filter((f) => /\.(ts|tsx)$/.test(f));
  const hydratingRoots = routeFiles.filter((f) =>
    /hydrate\s*:\s*true/.test(stripComments(readFileSync(join(routesDir, f), "utf8"))),
  );
  const unhydrated = routeFiles.filter(
    (f) => !hydratingRoots.includes(f) && !f.startsWith("admin."),
  );
  ok(
    "the unhydrated route set is non-empty and the hydrating set is not everything",
    unhydrated.length >= 20 && hydratingRoots.length >= 1,
    `${unhydrated.length} unhydrated route file(s), ${hydratingRoots.length} hydrating; ` +
      `measured 23 and 2 on 2026-08-26. A collapse here means the derivation broke, ` +
      `not that the app got smaller.`,
  );

  /**
   * Import clauses of one stripped source, value imports only.
   * @param {string} source
   * @returns {Array<{ clause: string, spec: string }>}
   */
  const importsOf = (source) => {
    /** @type {Array<{ clause: string, spec: string }>} */
    const found = [];
    for (const m of source.matchAll(
      /import\s+((?:[^;'"]|"[^"]*"|'[^']*')*?)\s*from\s*["']([^"']+)["']/g,
    )) {
      if (/^type\s/.test(m[1].trim())) continue;
      found.push({ clause: m[1], spec: m[2] });
    }
    for (const m of source.matchAll(/import\s*["']([^"']+)["']/g)) {
      found.push({ clause: "", spec: m[1] });
    }
    return found;
  };

  /**
   * A specifier resolved to a file under the repo, or null for packages,
   * assets and styles.
   * @param {string} spec @param {string} fromFile
   */
  const resolveSpec = (spec, fromFile) => {
    if (spec.includes("?")) return null;
    if (spec.endsWith(".css")) return null;
    let base = null;
    if (spec.startsWith("~/")) base = join(root, "app", spec.slice(2));
    else if (spec.startsWith("./") || spec.startsWith("../")) {
      base = join(fromFile, "..", spec);
    } else return null;
    for (const suffix of ["", ".ts", ".tsx", ".mjs", ".js"]) {
      if (existsSync(base + suffix) && !statSync(base + suffix).isDirectory()) {
        return base + suffix;
      }
    }
    // ./+types/* and other typegen virtuals resolve nowhere on disk.
    return null;
  };

  const FORBIDDEN_ROUTER = ["useFetcher", "useNavigation", "useSubmit", "useNavigate"];
  /** @type {Map<string, string>} file -> the route that first reached it */
  const reachedFrom = new Map();
  /** @type {string[]} */
  const queue = [];
  for (const f of unhydrated) {
    const full = join(routesDir, f);
    reachedFrom.set(full, f);
    queue.push(full);
  }
  /** @type {string[]} */
  const violations = [];
  let scanned = 0;
  while (queue.length > 0) {
    const file = /** @type {string} */ (queue.pop());
    const via = reachedFrom.get(file) ?? "?";
    const source = stripComments(readFileSync(file, "utf8"));
    scanned += 1;
    for (const { clause, spec } of importsOf(source)) {
      if (spec === "react") {
        const hooks = [...clause.matchAll(/\buse[A-Z]\w*/g)].map((m) => m[0]);
        if (hooks.length > 0) {
          violations.push(`${relative(root, file)} imports ${hooks.join(", ")} from "react" (reached from ${via})`);
        }
      } else if (spec === "react-router") {
        const hooks = FORBIDDEN_ROUTER.filter((h) => new RegExp(`\\b${h}\\b`).test(clause));
        if (hooks.length > 0) {
          violations.push(`${relative(root, file)} imports ${hooks.join(", ")} from "react-router" (reached from ${via})`);
        }
      } else {
        const resolved = resolveSpec(spec, file);
        if (resolved && !reachedFrom.has(resolved)) {
          reachedFrom.set(resolved, via);
          queue.push(resolved);
        }
      }
    }
  }
  ok(
    "the unhydrated import closure was actually walked",
    scanned >= 85,
    `${scanned} module(s) scanned, measured 96 on 2026-08-26 through this walk; a ` +
      `closure this small means the resolver stopped resolving, and the assertion ` +
      `below examined a stub`,
  );
  ok(
    "no unhydrated route tree imports a client hook",
    violations.length === 0,
    `a hook in an unhydrated tree is dead code that looks alive:\n` +
      `        ${violations.join("\n        ")}`,
  );
}

console.log("\n  25. the health snapshot's poll interval is the watchdog's cron");

/*
 * `HEALTH_POLL_INTERVAL_SECONDS` restates the watchdog's cron (a Worker cannot read another's
 * config), so the two are compared (rule 17). The cron is parsed: equivalent forms must agree.
 * Reads the tracked example; `check:config` binds it to the real config.
 * A mismatch makes the home tile call a live snapshot stale, or a dead one fresh.
 */
{
  const watchdogPath = join(root, "wrangler.watchdog.jsonc.example");
  const snapshotPath = join(root, "app", "lib", "health", "snapshot.mjs");
  const watchdogRaw = existsSync(watchdogPath) ? readFileSync(watchdogPath, "utf8") : "";
  const snapshot = stripComments(readFileSync(snapshotPath, "utf8"));

  ok(
    "the watchdog config and the snapshot module were both read",
    watchdogRaw.length > 500 && snapshot.length > 500,
    `watchdog config ${watchdogRaw.length} chars, snapshot ${snapshot.length} chars after ` +
      `stripping. An empty read passes every comparison below vacuously.`,
  );

  /* Parsed as JSONC: a regex would match the prose comments that discuss the cron. */
  /** @type {string[]} */
  let cronLines = [];
  let parsed = true;
  try {
    const config = parseJsonc(watchdogPath);
    const crons = config.triggers?.crons;
    cronLines = Array.isArray(crons)
      ? crons.map((/** @type {unknown} */ c) => String(c).trim())
      : [];
  } catch {
    parsed = false;
  }

  ok(
    "the watchdog config parses",
    parsed,
    `${relative(root, watchdogPath)} is not valid JSONC, so the schedule below was ` +
      `read from nothing.`,
  );

  ok(
    "the watchdog declares exactly one cron",
    cronLines.length === 1,
    `found ${cronLines.length}: ${cronLines.join(" | ") || "(none)"}. This ` +
      `assertion compares one schedule against one constant and cannot ` +
      `arbitrate between two.`,
  );

  const minuteField = (cronLines[0] ?? "").split(/\s+/)[0] ?? "";
  /**
   * The cron's period in seconds, or null when it is not a fixed period.
   * Accepts a step or an evenly spaced list; anything else fails.
   */
  const periodSeconds = (() => {
    const step = /^\*\/(\d+)$/.exec(minuteField);
    if (step) return Number(step[1]) * 60;
    if (minuteField === "*") return 60;
    const list = minuteField.split(",").map(Number);
    if (
      list.length > 1 &&
      list.every((/** @type {number} */ n) => Number.isInteger(n) && n >= 0 && n < 60)
    ) {
      const gaps = new Set(
        list.slice(1).map((/** @type {number} */ n, /** @type {number} */ i) => n - (list[i] ?? 0)),
      );
      // Evenly spaced AND wrapping evenly, or the last gap of the hour differs.
      if (gaps.size === 1 && 60 % (60 / list.length) === 0 && [...gaps][0] === 60 / list.length) {
        return [...gaps][0] * 60;
      }
    }
    return null;
  })();

  ok(
    "the cron's minute field is a fixed period this gate can read",
    periodSeconds !== null,
    `minute field ${JSON.stringify(minuteField)} is not a step or an evenly ` +
      `spaced list. Either restore one, or teach this parser the new form and ` +
      `say why; it must not fall back to a default.`,
  );

  const declared = /HEALTH_POLL_INTERVAL_SECONDS\s*=\s*([0-9*\s]+);/.exec(snapshot)?.[1] ?? "";
  // Evaluated so `15 * 60` and `900` agree; the needle admits only digits, spaces and `*`.
  const declaredSeconds = declared.trim()
    ? declared.split("*").reduce((product, part) => product * Number(part.trim()), 1)
    : NaN;

  ok(
    "the snapshot module declares a poll interval",
    Number.isFinite(declaredSeconds) && declaredSeconds > 0,
    `could not read HEALTH_POLL_INTERVAL_SECONDS out of ${relative(root, snapshotPath)}; ` +
      `got ${JSON.stringify(declared)}. Without it the comparison below is vacuous.`,
  );

  ok(
    "the declared poll interval is the schedule the watchdog actually runs",
    declaredSeconds === periodSeconds,
    `snapshot.mjs says ${declaredSeconds}s, the watchdog's cron ` +
      `${JSON.stringify(cronLines[0] ?? "")} means ${periodSeconds}s. The home ` +
      `tile decides whether a verdict is too old to show from this number, so a ` +
      `mismatch either calls a current snapshot stale or calls a dead watchdog ` +
      `fresh, on the front page, silently. Rule 17.`,
  );

  /* The snapshot module's prose must name the watchdog, so its pointer cannot outlive a move. */
  ok(
    "the snapshot module's prose points at the watchdog, not at the old workflow",
    /wrangler\.watchdog\.jsonc/.test(readFileSync(snapshotPath, "utf8")) &&
      !/health\.yml/.test(readFileSync(snapshotPath, "utf8")),
    `app/lib/health/snapshot.mjs must name wrangler.watchdog.jsonc as the owner of ` +
      `its poll interval and must NOT name health.yml, which is now the hourly ` +
      `second opinion and no longer sets the pace.`,
  );

  /*
   * health.yml must poll slower than the watchdog: the same schedule doubles load on a
   * rate-limited endpoint for no coverage. Asserts the direction, not health.yml's value.
   */
  const healthWfRaw = existsSync(join(root, ".github", "workflows", "health.yml"))
    ? stripHashComments(readFileSync(join(root, ".github", "workflows", "health.yml"), "utf8"))
    : "";
  const wfCrons = [...healthWfRaw.matchAll(/^\s*-\s*cron:\s*["']([^"']+)["']/gm)].map((m) =>
    m[1].trim(),
  );
  ok(
    "the health workflow still declares exactly one cron",
    wfCrons.length === 1,
    `found ${wfCrons.length}: ${wfCrons.join(" | ") || "(none)"}.`,
  );
  ok(
    "the health workflow is SLOWER than the watchdog, not a duplicate of it",
    wfCrons.length === 1 && wfCrons[0] !== cronLines[0] && !/^\*\/\d+ /.test(wfCrons[0] ?? ""),
    `health.yml's cron is ${JSON.stringify(wfCrons[0] ?? "(none)")} and the watchdog's is ` +
      `${JSON.stringify(cronLines[0] ?? "(none)")}. The workflow is the off-platform second ` +
      `opinion, deliberately slower: matching schedules doubles the load on a rate-limited ` +
      `endpoint for no extra coverage, and makes it ambiguous which cron the home tile's ` +
      `staleness rule is measured against.`,
  );

  /* Derived, so a literal that agrees today cannot replace the binding. */
  ok(
    "the stale threshold is derived from the interval, not restated",
    /HEALTH_SNAPSHOT_STALE_AFTER_SECONDS\s*=\s*\d+\s*\*\s*HEALTH_POLL_INTERVAL_SECONDS/.test(
      snapshot,
    ),
    "HEALTH_SNAPSHOT_STALE_AFTER_SECONDS must be a multiple of " +
      "HEALTH_POLL_INTERVAL_SECONDS written as one, so moving the schedule moves " +
      "both. A literal here is a second copy that agrees until the day it does not.",
  );

  /* One writer: nothing on the home page may start a health run. */
  const snapshotServer = stripComments(
    readFileSync(join(root, "app", "lib", "health", "snapshot.server.ts"), "utf8"),
  );
  ok(
    "the snapshot module does not import the health suite",
    !/checks\.server/.test(snapshotServer) && !/runHealthChecks/.test(snapshotServer),
    "snapshot.server.ts reaches runHealthChecks. The reader must not be able " +
      "to compute a verdict, or the home page's cache miss becomes a health run " +
      "again by a different route.",
  );
}

console.log("\n  26. CLAUDE.md's binding list is wrangler.jsonc.example's");

/*
 * CLAUDE.md's binding names are bound to `wrangler.jsonc.example` in both directions: a stale
 * name sends a session to a binding that is undefined at runtime.
 * Reads the tracked example because `wrangler.jsonc` is gitignored; `check:config` binds the two.
 */
{
  const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
  const examplePath = join(root, "wrangler.jsonc.example");
  const example = stripComments(readFileSync(examplePath, "utf8"));

  /* Names from the indented line after the `getEnv` sentence, so prose cannot widen the set. */
  const listed = new Set(
    (/Never import bindings globally\.\s*\n\s*\n {4}([A-Z_ \t]+)\n/.exec(claude)?.[1] ?? "")
      .split(/\s+/)
      .filter(Boolean),
  );

  /* An empty set makes every later assertion true. */
  ok(
    "CLAUDE.md's binding list parses",
    listed.size >= 5,
    `parsed ${listed.size} binding name(s) from CLAUDE.md. If this is 0 the ` +
      `comparison below is measuring the parser, not the file.`,
  );

  /** Derived from the config, so a new kind of binding needs no edit here. */
  const declared = new Set();
  for (const m of example.matchAll(/"binding"\s*:\s*"([A-Z0-9_]+)"/g)) declared.add(m[1]);
  for (const m of example.matchAll(/"name"\s*:\s*"([A-Z0-9_]+)"/g)) declared.add(m[1]);

  ok(
    "wrangler.jsonc.example declares bindings",
    declared.size >= 5,
    `parsed ${declared.size} binding(s) from ${relative(root, examplePath)}.`,
  );

  const advertisedButAbsent = [...listed].filter((name) => !declared.has(name));
  ok(
    "every binding CLAUDE.md lists exists in the config",
    advertisedButAbsent.length === 0,
    `${advertisedButAbsent.join(", ")} is advertised in CLAUDE.md and not declared. ` +
      `A session reaching getEnv(context) for it typechecks against a stale ` +
      `generated type and gets undefined at runtime.`,
  );

  const declaredButUnlisted = [...declared].filter((name) => !listed.has(name));
  ok(
    "every binding in the config is listed in CLAUDE.md",
    declaredButUnlisted.length === 0,
    `${declaredButUnlisted.join(", ")} is declared and not listed in CLAUDE.md. ` +
      `Adding a binding means editing both, which is the same rule check:config ` +
      `enforces between the example and the real file.`,
  );
}

/*
 * A stale floor cannot fail (hard rule 10). Re-measure by running both branches, never by
 * arithmetic: each carried token is two assertions, so the count moves both ways.
 */
console.log("\n  27. the runbook exists and names every secret");

/*
 * The runbook's rotation table names every secret in `REQUIRED_SECRETS`, both directions: a
 * missing row costs an outage, an extra row sends someone to set a value nothing reads.
 * The owner is `app/lib/secrets.mjs`; wrangler config holds no secrets.
 * The needle is a backticked cell, never a bare mention (Hard rule 10).
 */
{
  const runbookPath = join(root, "docs", "RUNBOOK.md");
  ok(
    "docs/RUNBOOK.md exists",
    existsSync(runbookPath),
    "the runbook is gone. It is the only page that carries what breaks when a " +
      "secret is rotated alone, and no other document claims that job.",
  );

  if (existsSync(runbookPath)) {
    const runbook = readFileSync(runbookPath, "utf8");
    const secretsSource = readFileSync(join(root, "app", "lib", "secrets.mjs"), "utf8");
    const listed = [...secretsSource.matchAll(/^\s*"([A-Z][A-Z0-9_]+)",\s*$/gm)].map((m) => m[1]);

    ok(
      "[scope] the ratified secret list parsed non-empty",
      listed.length > 0,
      "parsed zero names out of app/lib/secrets.mjs REQUIRED_SECRETS. Every " +
        "assertion below would then sweep an empty set and report clean.",
    );

    /* Every name the runbook puts in a backticked cell, whatever it is. */
    const named = new Set(
      [...runbook.matchAll(/`([A-Z][A-Z0-9_]{3,})`/g)].map((m) => m[1]),
    );

    for (const secret of listed) {
      ok(
        `the runbook names ${secret}`,
        named.has(secret),
        `${secret} is in REQUIRED_SECRETS and nowhere in docs/RUNBOOK.md. A ` +
          `secret with no rotation row is a secret somebody rotates alone at ` +
          `2am without being told what it takes down.`,
      );
    }

    /* The reverse reads only the rotation table; the page backticks other identifiers in prose. */
    const table = runbook.slice(
      runbook.indexOf("| Secret | Also lives in |"),
      runbook.indexOf("### `OPERATOR_TOKEN` has THREE holders"),
    );
    const rows = [...table.matchAll(/^\|\s*`([A-Z][A-Z0-9_]+)`\s*\|/gm)].map((m) => m[1]);
    ok(
      "[scope] the runbook's rotation table parsed non-empty",
      rows.length > 0,
      "found no rotation rows in docs/RUNBOOK.md. The reverse assertion below " +
        "would pass by reading nothing, which is this gate's own vacuity class.",
    );
    for (const row of rows) {
      ok(
        `the runbook's ${row} row names a secret that still exists`,
        listed.includes(row),
        `${row} has a rotation row in docs/RUNBOOK.md and is not in ` +
          `REQUIRED_SECRETS. It sends a reader to rotate something nothing reads.`,
      );
    }
  }
}

console.log("\n  28. every rendered <img> states an intrinsic size, or its class fixes the box");

/*
 * Every JSX `<img` under `app/` states its intrinsic size, or it is a layout shift.
 * `test/cover-dimensions.test.mjs` owns the function; this owns that the markup still uses it.
 * Comments are stripped so prose about `<img>` cannot satisfy the scan.
 */
{
  /** `app/enhance/` is out: it builds DOM with `createElement`, so it has no JSX `<img`. */
  const IMG_ROOTS = [join(root, "app", "routes"), join(root, "app", "components")];

  /**
   * The exemption is read from the stylesheet, not a name list (hard rule 5's mirror
   * anti-pattern): a class rule declaring both `width` and `height` reserves the box.
   * Both, never one: width alone leaves height to the intrinsic ratio.
   * @type {Map<string, string>} class name -> the declaration block
   */
  const cssRules = new Map();
  {
    const stylesDir = join(root, "app", "styles");
    const sheets = existsSync(stylesDir)
      ? readdirSync(stylesDir).filter((f) => f.endsWith(".css"))
      : [];
    for (const sheet of sheets) {
      const css = readFileSync(join(stylesDir, sheet), "utf8");
      for (const rule of css.matchAll(/\.([a-zA-Z][\w-]*)\s*\{([^}]*)\}/g)) {
        // First declaration wins; a later one may be another selector context
        // and must not satisfy the test.
        if (!cssRules.has(rule[1])) cssRules.set(rule[1], rule[2]);
      }
    }
    ok(
      "[scope] the stylesheet scan found class rules to read",
      cssRules.size > 0,
      "parsed no rules out of app/styles/*.css, so the exemption below can " +
        "never apply and this section would report failures it cannot justify.",
    );
  }

  /** @param {string} element @returns {boolean} */
  const sizedByCss = (element) => {
    const className = element.match(/className="([^"]+)"/);
    if (!className) return false;
    return className[1].split(/\s+/).some((name) => {
      const block = cssRules.get(name);
      if (block === undefined) return false;
      return /(^|[;{\s])width\s*:/.test(block) && /(^|[;{\s])height\s*:/.test(block);
    });
  };

  /** @param {string} dir @returns {string[]} */
  const walkTsx = (dir) => {
    if (!existsSync(dir)) return [];
    /** @type {string[]} */
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) found.push(...walkTsx(full));
      else if (entry.name.endsWith(".tsx")) found.push(full);
    }
    return found;
  };

  const files = IMG_ROOTS.flatMap(walkTsx);
  ok(
    "[scope] the img scan found .tsx files to read",
    files.length > 0,
    "walked app/routes and app/components and found no .tsx at all, so every " +
      "assertion below sweeps nothing and reports clean.",
  );

  /** @type {string[]} */
  const unsized = [];
  let imgElements = 0;
  let exemptByCss = 0;
  for (const file of files) {
    const source = stripComments(readFileSync(file, "utf8"));
    /* Non-greedy to the first `>`: a JSX `<img` has no children and no literal `>` in its values. */
    for (const match of source.matchAll(/<img\b[\s\S]*?\/?>/g)) {
      imgElements += 1;
      const element = match[0];
      /* The `coverDimensions` spread counts, by name only, so `{...rest}` cannot satisfy it. */
      const states =
        (/\bwidth=/.test(element) && /\bheight=/.test(element)) ||
        /\{\.\.\.coverDimensions\(/.test(element) ||
        /\{\.\.\.dimensionsFromKey\(/.test(element);
      if (states) continue;
      // Counted BEFORE the CSS exemption is applied, so a stylesheet that
      // stopped parsing shows up as failures rather than as silence.
      if (sizedByCss(element)) {
        exemptByCss += 1;
        continue;
      }
      const relative = file.slice(root.length + 1);
      unsized.push(`${relative}: ${element.replace(/\s+/g, " ").slice(0, 120)}`);
    }
  }

  /* Floored: a regex that stopped matching reports what a clean sweep reports. */
  ok(
    "[scope] the img scan matched elements",
    imgElements >= 2,
    `matched ${imgElements} <img> element(s), floor 2. Below that the pattern ` +
      `has stopped reading JSX and the result below means nothing.`,
  );
  ok(
    "every rendered <img> states an intrinsic size, or its class fixes the box",
    unsized.length === 0,
    `${unsized.length} element(s) render without width and height and without a ` +
      `class rule that declares both. An image with no intrinsic size reserves ` +
      `no space, and the one this section was written for was the post cover, ` +
      `which is the LCP element. Either state the size, or give the element a ` +
      `class whose rule fixes the box:\n      ${unsized.join("\n      ")}`,
  );
  console.log(
    `     ${imgElements} <img> element(s), ${exemptByCss} sized by a class rule, ` +
      `${cssRules.size} class rule(s) read`,
  );
}

console.log("\n  29. no tracked text file carries a raw control or invisible character");

/*
 * No raw control byte or invisible character in a tracked text file: a shell-expanded escape
 * reaches disk as one byte and still looks right (hard rule 10). An intended one is written as an escape,
 * so a raw byte is a defect anywhere and no language parsing is needed.
 * Counts below 0x20 except tab, LF and CR; 0x7F; the BOM and the zero-width family.
 * Tracked files only; binaries skipped by extension.
 */
{
  const BINARY = /\.(woff2?|ttf|otf|png|jpe?g|gif|webp|avif|ico|pdf|zip|wasm|mp4|mp3|sqlite|db)$/i;
  /** Named so a failure says what the byte IS rather than only where it is. */
  const NAMES = new Map([
    [0x00, "NUL"], [0x07, "BEL"], [0x08, "BACKSPACE"], [0x0b, "VERTICAL TAB"],
    [0x0c, "FORM FEED"], [0x1b, "ESC"], [0x7f, "DEL"],
  ]);
  /** Invisible but not control codes: BOM and the zero-width family. */
  const INVISIBLE = new Map([
    ["\uFEFF", "U+FEFF BYTE ORDER MARK"],
    ["\u200B", "U+200B ZERO WIDTH SPACE"],
    ["\u200C", "U+200C ZERO WIDTH NON-JOINER"],
    ["\u200D", "U+200D ZERO WIDTH JOINER"],
    ["\u2060", "U+2060 WORD JOINER"],
  ]);

  /*
   * No `shell: true`. On Windows that joins argv unquoted, which is the shape
   * FAILURES.md records for a seed SQL string becoming a program name.
   */
  const listed = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  ok(
    "[scope] git ls-files answered",
    listed.status === 0 && typeof listed.stdout === "string",
    `git ls-files exited ${listed.status}. A scan over no files reports what a clean tree reports.`,
  );
  const tracked = (listed.stdout ?? "").split(String.fromCharCode(10)).filter(Boolean);

  let scanned = 0;
  let skipped = 0;
  /** @type {string[]} */
  const offences = [];

  for (const rel of tracked) {
    if (BINARY.test(rel)) {
      skipped += 1;
      continue;
    }
    let buf;
    try {
      buf = readFileSync(join(root, rel));
    } catch {
      continue;
    }
    scanned += 1;

    for (let i = 0; i < buf.length; i += 1) {
      const v = buf[i];
      if ((v < 0x20 && v !== 0x09 && v !== 0x0a && v !== 0x0d) || v === 0x7f) {
        const line = buf.subarray(0, i).toString("utf8").split("\n").length;
        offences.push(`${rel}:${line} 0x${v.toString(16).padStart(2, "0")} ${NAMES.get(v) ?? "control"}`);
        break;
      }
    }

    const text = buf.toString("utf8");
    for (const [ch, name] of INVISIBLE) {
      const at = text.indexOf(ch);
      if (at === -1) continue;
      offences.push(`${rel}:${text.slice(0, at).split("\n").length} ${name}`);
      break;
    }
  }

  /* Both halves floored: an empty glob or an over-wide binary rule reports a clean sweep. */
  ok(
    "[scope] the control-character scan read the tracked tree",
    scanned >= 400 && skipped >= 50,
    `scanned ${scanned} text file(s) and skipped ${skipped} binary file(s). Below either floor the ` +
      `scan has stopped reading the repository and the result below means nothing.`,
  );
  ok(
    "no tracked text file carries a raw control or invisible character",
    offences.length === 0,
    `${offences.length} file(s) carry one. An escape written in prose can reach disk as a control ` +
      `byte, render close enough to correct to survive review, and sit there: this section exists ` +
      `because that happened three times. Write the escape so the shell cannot expand it, or use ` +
      `the literal character:\n      ${offences.join("\n      ")}`,
  );
  console.log(`     ${scanned} text file(s) scanned, ${skipped} binary skipped, ${offences.length} offence(s)`);
}

console.log("\n  30. no public control depends on script to be operable");

/*
 * Hard rule 9 on the markup: a public control must work with scripting off.
 * Admin is exempt; `/login` is not.
 * A form needs a native submission path: `onSubmit` without `method` fails; `method` without
 * `action` passes. A handler on a keyboard-reachable element is fine; on any other it fails.
 * Arrow functions contain `>`, so handlers are found first and their owning tag is located by
 * scanning back, with brace and quote depth tracked.
 */
{
  /** A keyboard reaches these unaided, so a handler on one is not a defect. */
  const INTERACTIVE = new Set([
    "a", "button", "input", "select", "textarea",
    "summary", "details", "label", "dialog", "form", "option",
  ]);

  /** Read one opening tag, honouring braces and quotes so an arrow function cannot end it early. */
  const openingTagAt = (/** @type {string} */ src, /** @type {number} */ start) => {
    let depth = 0;
    let quote = "";
    for (let i = start; i < src.length; i += 1) {
      const c = src[i];
      if (quote) {
        if (c === quote) quote = "";
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === ">" && depth === 0) return src.slice(start, i + 1);
    }
    return src.slice(start);
  };

  const publicFiles = [
    ...readdirSync(join(root, "app", "routes"), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".tsx") && !e.name.startsWith("admin."))
      .map((e) => join(root, "app", "routes", e.name)),
    ...readdirSync(join(root, "app", "components"), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
      .map((e) => join(root, "app", "components", e.name)),
  ];

  /** @type {string[]} */
  const faults = [];
  let handlersSeen = 0;
  let anchorsSeen = 0;
  let formsSeen = 0;

  for (const file of publicFiles) {
    const rel = relative(root, file).split(sep).join("/");
    const src = stripComments(readFileSync(file, "utf8"));
    /** @param {number} i */
    const lineAt = (i) => src.slice(0, i).split("\n").length;

    for (const m of src.matchAll(/\bon[A-Z][a-zA-Z]+\s*=\s*\{/g)) {
      handlersSeen += 1;
      const open = src.lastIndexOf("<", m.index);
      if (open === -1) continue;
      const tag = src.slice(open + 1).match(/^([a-zA-Z][a-zA-Z0-9]*)/)?.[1];
      if (!tag) continue;
      // A capitalised tag is a component; its own file is scanned in its turn.
      if (tag[0] === tag[0].toUpperCase()) continue;
      if (INTERACTIVE.has(tag)) continue;
      faults.push(`${rel}:${lineAt(m.index)} ${m[0].replace(/\s*=\s*\{$/, "")} on <${tag}>, which a keyboard cannot reach`);
    }

    for (const m of src.matchAll(/<a[\s>]/g)) {
      anchorsSeen += 1;
      if (!/\bhref\s*=/.test(openingTagAt(src, m.index))) {
        faults.push(`${rel}:${lineAt(m.index)} <a> with no href, so nothing activates it without script`);
      }
    }

    for (const m of src.matchAll(/<(form|Form)[\s>]/g)) {
      formsSeen += 1;
      const tag = openingTagAt(src, m.index);
      if (/\bonSubmit\s*=/.test(tag) && !/\bmethod\s*=/.test(tag)) {
        faults.push(`${rel}:${lineAt(m.index)} <${m[1]}> submits only through onSubmit, with no method for the browser to use`);
      }
    }

    for (const m of src.matchAll(/\.showModal\s*\(/g)) {
      faults.push(`${rel}:${lineAt(m.index)} showModal() is the only opener, so a scriptless reader never sees it`);
    }
  }

  /* Floored: an empty glob or a JSX scan that stopped matching reports a clean sweep. */
  ok(
    "[scope] the public-plane scan read routes and components",
    publicFiles.length >= 20 && handlersSeen + anchorsSeen + formsSeen >= 10,
    `read ${publicFiles.length} public file(s), saw ${handlersSeen} handler(s), ${anchorsSeen} anchor(s) and ` +
      `${formsSeen} form(s). Below these floors the scan has stopped reading JSX.`,
  );
  ok(
    "no public control depends on script to be operable",
    faults.length === 0,
    `${faults.length} control(s) work only with script. Hard rule 9: works without script, fast with it, and the ` +
      `admin plane is the only exemption:\n      ${faults.join("\n      ")}`,
  );
  console.log(
    `     ${publicFiles.length} public file(s), ${handlersSeen} handler(s), ${anchorsSeen} anchor(s), ` +
      `${formsSeen} form(s), ${faults.length} fault(s)`,
  );
}

console.log("\n  31. every token is defined and used, and a component sheet states no raw hex");

/*
 * Tokens: (a) every `var(--x)` resolves to a declaration, (b) every declared token is used,
 * (c) a component sheet states no raw hex. A misspelled `var()` is valid CSS and paints nothing.
 * (b) reads JavaScript too: `app/lib/content/chart.mjs` uses `--chart-*` as strings.
 * Each allowlist entry carries its reason.
 * Not gated yet: raw numeric font-weight (3d) and off-scale spacing or radius (gate 4), since
 * there is no scale to compare against. Revisit both once Part A's scales land and the sheets
 * are migrated (ruling 88).
 */
{
  /** Referenced and never declared, because something sets them at runtime. */
  const RUNTIME_INJECTED = new Map([
    ["--swatch", "set inline per swatch by app/lib/content/pipeline.mjs, read with a fallback in prose.css"],
    ["--shiki-light", "set inline on the pre element by the syntax highlighter"],
    ["--shiki-light-bg", "set inline on the pre element by the syntax highlighter"],
    ["--shiki-dark", "set inline on the pre element by the syntax highlighter"],
    ["--shiki-dark-bg", "set inline on the pre element by the syntax highlighter"],
  ]);

  /** A hex a component sheet may state, with the argument for it. */
  const HEX_ALLOWED = new Map([
    ["app/styles/motion-print.css", "the print rule colour, print-scoped and deliberately not a theme token: check:contrast requires every declared token to participate in a measured pair and a paper-only colour has no screen pair"],
  ]);

  const cssFiles = [
    join(root, "app", "app.css"),
    join(root, "app", "admin.css"),
    ...readdirSync(join(root, "app", "styles"), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".css"))
      .map((e) => join(root, "app", "styles", e.name)),
  ].filter((p) => existsSync(p));

  /** @type {Set<string>} */
  const defined = new Set();
  /**
   * Named anywhere, gates included: a gate naming an undeclared token is a typo worth failing.
   * @type {Set<string>}
   */
  const referenced = new Set();
  /**
   * Painted: the narrower set the dead-token assertion reads.
   * @type {Set<string>}
   */
  const consumed = new Set();

  for (const file of cssFiles) {
    const css = stripComments(readFileSync(file, "utf8"));
    for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
    for (const m of css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
      referenced.add(m[1]);
      consumed.add(m[1]);
    }
  }

  /** Every source file that could name a token, so (b) is not wrong about chart.mjs. */
  /** @type {string[]} */
  const sourceFiles = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (!/^(node_modules|dist|generated)$/.test(e.name)) walk(p);
      } else if (/\.(mjs|ts|tsx|js)$/.test(e.name)) {
        sourceFiles.push(p);
      }
    }
  };
  walk(join(root, "app"));
  walk(join(root, "scripts"));

  /*
   * A mention in `scripts/check-*.mjs` does not make a token consumed. check:contrast requires
   * every colour token be named there, so counting it made (b) unfailable (Hard rule 10's class).
   * `referenced` still takes gate mentions for the undefined-name check; `consumed` does not.
   */
  let sourceMentions = 0;
  let renderMentions = 0;
  let gateMentions = 0;
  for (const file of sourceFiles) {
    const rel = relative(root, file).split(sep).join("/");
    const isGate = /^scripts\/check-[a-z0-9-]+\.mjs$/.test(rel);
    // The carried map below lists token names, not uses, so its region is removed first.
    const src = readFileSync(file, "utf8").replace(
      /\/\* carried:start \*\/[\s\S]*?\/\* carried:end \*\//g,
      "",
    );
    for (const m of src.matchAll(/(--[a-z][a-z0-9-]+)/g)) {
      if (!defined.has(m[1])) continue;
      referenced.add(m[1]);
      sourceMentions += 1;
      if (isGate) {
        gateMentions += 1;
      } else {
        consumed.add(m[1]);
        renderMentions += 1;
      }
    }
  }

  const undefinedRefs = [...referenced].filter((t) => !defined.has(t) && !RUNTIME_INJECTED.has(t)).sort();
  const unusedDefs = [...defined].filter((t) => !consumed.has(t)).sort();

  /** @type {string[]} */
  const rawHex = [];
  for (const file of cssFiles) {
    const rel = relative(root, file).split(sep).join("/");
    if (rel === "app/styles/katex.generated.css") continue;
    // app.css and admin.css hold the primitive blocks; a hex there is the point.
    if (rel === "app/app.css" || rel === "app/admin.css") continue;
    if (HEX_ALLOWED.has(rel)) continue;
    const css = stripComments(readFileSync(file, "utf8"));
    for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      rawHex.push(`${rel}:${css.slice(0, m.index).split("\n").length} ${m[0]}`);
    }
  }

  /* Each result below is a length, which is zero when the scan found nothing. */
  ok(
    "[scope] the token scan read stylesheets and source",
    cssFiles.length >= 25 &&
      sourceFiles.length >= 200 &&
      defined.size >= 80 &&
      sourceMentions >= 100 &&
      renderMentions >= 60 &&
      gateMentions >= 200,
    `read ${cssFiles.length} stylesheet(s) and ${sourceFiles.length} source file(s), found ${defined.size} ` +
      `definition(s) and ${sourceMentions} token mention(s) in source, ${renderMentions} of them in a renderer ` +
      `and ${gateMentions} in a gate. MEASURED BY RUNNING 2026-09-14: 111 renderer and 407 gate mentions, ` +
      `floored at 60 and 200 in the same spirit as the floors beside them, which guard against the scan ` +
      `stopping rather than against drift. Below these floors the scan has stopped reading. THE TWO HALVES ARE ` +
      `FLOORED SEPARATELY on purpose: the renderer half alone going to zero is the failure that would make ` +
      `every token look dead, and the gate half alone going to zero would make the split look effective ` +
      `while it had stopped classifying anything.`,
  );
  ok(
    "every referenced token is defined",
    undefinedRefs.length === 0,
    `${undefinedRefs.length} token(s) are used and never declared. var() on an undeclared name falls back to nothing ` +
      `and paints the inherited value, which looks almost right:\n      ${undefinedRefs.join("\n      ")}`,
  );
  /*
   * Carried tokens: declared ahead of the owner that will paint them. Not an allowlist:
   * a row for an undeclared token fails, a row for a painted token fails, and after
   * `CARRIED_EXPIRES` the map must be empty. Moving the date is a ruling, not a repair.
   */
  const CARRIED_EXPIRES = "2026-11-30";
  /*
   * Each row names its owner: `scale:` (a member of a scale whose other members are read) or
   * `component:` (a named painter not built yet). A token with no owner is dead and is deleted.
   */
  /* carried:start */
  /**
   * @type {Map<string, string>} token -> the OWNER that would paint it.
   * Read the block above before adding a row.
   */
  const CARRIED = new Map([
  ["--control-min-dense",    "scale: the control dimensions, beside --control-min"],
  ["--ease-enter",           "scale: the easing ramps"],
  ["--ease-exit",            "scale: the easing ramps"],
  ["--ease-state",           "scale: the easing ramps"],
  ["--line-w-thick",         "scale: the line widths"],
  ["--motion-instant",       "scale: the motion durations"],
  ["--motion-page",          "scale: the motion durations"],
  ["--motion-panel",         "scale: the motion durations"],
  ["--motion-state",         "scale: the motion durations"],
  ["--radius-control",       "scale: the corner radius, the system's only one"],
  ["--s-1",                  "scale: the space scale"],
  ["--s-2",                  "scale: the space scale"],
  ["--s-4",                  "scale: the space scale"],
  ["--t-body-family",        "scale: the body type level"],
  ["--t-body-leading",       "scale: the body type level"],
  ["--t-body-size",          "scale: the body type level"],
  ["--t-body-vars",          "scale: the body type level"],
  ["--t-body-weight",        "scale: the body type level"],
  ["--t-caption-family",     "scale: the caption type level"],
  ["--t-caption-leading",    "scale: the caption type level"],
  ["--t-caption-size",       "scale: the caption type level"],
  ["--t-caption-strong",     "scale: the caption type level"],
  ["--t-caption-vars",       "scale: the caption type level"],
  ["--t-caption-weight",     "scale: the caption type level"],
  ["--t-display-family",     "scale: the display type level"],
  ["--t-display-leading",    "scale: the display type level"],
  ["--t-display-size",       "scale: the display type level"],
  ["--t-display-tracking",   "scale: the display type level"],
  ["--t-display-vars",       "scale: the display type level"],
  ["--t-display-weight",     "scale: the display type level"],
  ["--t-h1-family",          "scale: the h1 type level"],
  ["--t-h1-leading",         "scale: the h1 type level"],
  ["--t-h1-size",            "scale: the h1 type level"],
  ["--t-h1-tracking",        "scale: the h1 type level"],
  ["--t-h1-vars",            "scale: the h1 type level"],
  ["--t-h1-weight",          "scale: the h1 type level"],
  ["--t-h2-family",          "scale: the h2 type level"],
  ["--t-h2-leading",         "scale: the h2 type level"],
  ["--t-h2-size",            "scale: the h2 type level"],
  ["--t-h2-vars",            "scale: the h2 type level"],
  ["--t-h2-weight",          "scale: the h2 type level"],
  ["--t-h3-family",          "scale: the h3 type level"],
  ["--t-h3-leading",         "scale: the h3 type level"],
  ["--t-h3-size",            "scale: the h3 type level"],
  ["--t-h3-tracking",        "scale: the h3 type level"],
  ["--t-h3-vars",            "scale: the h3 type level"],
  ["--t-h3-weight",          "scale: the h3 type level"],
  ["--t-label-family",       "scale: the label type level"],
  ["--t-label-leading",      "scale: the label type level"],
  ["--t-label-size",         "scale: the label type level"],
  ["--t-label-vars",         "scale: the label type level"],
  ["--t-label-weight",       "scale: the label type level"],
  ["--lamp-origin",          "component: the lamp on the glass controls, ruling 74"],
  ["--lamp-reach",           "component: the lamp on the glass controls, ruling 74"],
  ["--surface-catch",        "component: the lamp on the glass controls, ruling 74"],
  ["--lamp-chroma-on-paper", "component: the lamp on the paper glass surface, ruling 74"],
  ["--error",                "component: the error alert, and a form field in its error state"],
  ["--error-fill",           "component: the error alert, and a form field in its error state"],
  ["--error-tint",           "component: the error alert, and a form field in its error state"],
  ["--on-error-fill",        "component: the error alert, and a form field in its error state"],
  ["--warning",              "component: the warning alert"],
  ["--warning-fill",         "component: the warning alert"],
  ["--warning-tint",         "component: the warning alert"],
  ["--on-warning-fill",      "component: the warning alert"],
  ["--success",              "component: the success alert"],
  ["--success-fill",         "component: the success alert"],
  ["--success-tint",         "component: the success alert"],
  ["--on-success-fill",      "component: the success alert"],
  ["--fig-ground",           "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-dust-100",         "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-dust-200",         "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-dust-300",         "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-leaf-100",         "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-leaf-400",         "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-leaf-500",         "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-oxide-100",        "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-oxide-200",        "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-oxide-500",        "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-s1",               "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-s2",               "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-s3",               "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-s4",               "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--fig-s5",               "component: the :::chart figure system, the --fig-* palette that replaces --chart-*"],
  ["--raised",               "component: the card and tile surface, one step off paper"],
  ["--placeholder",          "component: a form field's placeholder"],
  ["--line-strong",          "component: a control edge that identifies the control"],
  ["--brand-pressed",        "component: the primary button, pressed"],
  ["--glass-fill-paper",     "component: the /search overlay glass, ruling 71"],
  ]);
  /* carried:end */

  const stillCarried = unusedDefs.filter((t) => CARRIED.has(t));
  const unusedNotCarried = unusedDefs.filter((t) => !CARRIED.has(t));
  if (CARRIED.size) {
    console.log(
      `     ${stillCarried.length} of ${CARRIED.size} carried token(s) still unconsumed, ` +
        `map must be empty by ${CARRIED_EXPIRES}`,
    );
  }

  for (const [token, consumer] of CARRIED) {
    ok(
      `carried token ${token} is still declared`,
      defined.has(token),
      `the entry names a token no stylesheet declares. It was carried for "${consumer}"; either the ` +
        `token was renamed and the entry was not, or it is gone and the entry is a hole.`,
    );
    ok(
      `carried token ${token} is still unconsumed`,
      !consumed.has(token),
      `something now reads it, so "${consumer}" has landed. Remove the entry: the map shrinks as the ` +
        `redesign lands, and an entry kept past its consumer is an allowlist.`,
    );
  }

  ok(
    `the carried-token map is empty by ${CARRIED_EXPIRES}`,
    CARRIED.size === 0 || new Date().toISOString().slice(0, 10) <= CARRIED_EXPIRES,
    `${CARRIED.size} token(s) are still carried past ${CARRIED_EXPIRES}. This map is temporary by ` +
      `construction; finish the build that owed them or delete them. Moving the date is a ruling.`,
  );

  ok(
    "every defined token is referenced",
    unusedNotCarried.length === 0,
    `${unusedDefs.length} token(s) are declared and PAINTED BY NOTHING, ${unusedNotCarried.length} of them ` +
      `with no row on the carried map, which is what this assertion fails on. A mention in a check-*.mjs is ` +
      `not a read, so a colour with contrast pairs and no painter counts here. The full unpainted set, ` +
      `carried rows included, because the carried ones are the deadline and not the exemption:\n      ` +
      `${unusedDefs.join("\n      ")}`,
  );
  ok(
    "no component sheet states a raw hex",
    rawHex.length === 0,
    `${rawHex.length} raw hex value(s) outside the primitive blocks. A colour stated in a component sheet is a ` +
      `second owner of a palette decision and cannot be retuned with the theme:\n      ${rawHex.join("\n      ")}`,
  );
  console.log(
    `     ${defined.size} defined, ${referenced.size} named, ${consumed.size} painted, ` +
      `${sourceFiles.length} source file(s) read (${renderMentions} renderer mention(s), ` +
      `${gateMentions} gate mention(s) not counted as reads), ` +
      `${RUNTIME_INJECTED.size} runtime-injected allowed, ${rawHex.length} raw hex`,
  );
}

const MINIMUM_CHECKS = wantsRemote ? 530 : 493;
const floorBreach = assertFloor(
  "check:invariants",
  /*
   * Named per branch: --remote adds the live-database comparison, so one name would judge
   * one branch against the other's floor.
   */
  wantsRemote ? "checks-remote" : "checks-offline",
  checks,
  MINIMUM_CHECKS,
  "A SECTION was skipped rather than failing. The offline branch is the smaller one.",
);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
