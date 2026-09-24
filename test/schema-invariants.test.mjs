import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { resolveD1Address } from "../scripts/lib/d1-address.mjs";
import { retryRead } from "../scripts/lib/retry.mjs";
import { classifySqliteTables } from "../scripts/lib/sqlite-tables.mjs";
import { bundler, collector, root } from "./lib/invariants-harness.mjs";

const bundle = bundler("schema");

test("schema: columns agree across schema.ts, the migrations and the database", { timeout: 180_000 }, async (t) => {
  const { ok, fail, done } = collector();

  /* All derived, no column list here. Virtual, shadow and `sqlite_%` tables are excluded. */

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

  try {
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
      "every modeled table was actually compared",
      compared === modelled.length - phantom.length,
      `${compared} of ${modelled.length - phantom.length}`,
    );

    t.diagnostic(
      `     schema.ts ${fromSchema.size} table(s), migrations ${migrationTables.length}, ` +
        `${virtual.length} virtual excluded`,
    );

    /*
     * Names and ordered columns only: drizzle cannot express partial predicates, collations or
     * directions. Implicit indexes go by `origin`.
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
        `schema.ts does not declare ${missingInSchema.join(", ")}. The schema-source rule: a ` +
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

      t.diagnostic(
        `     ${schemaIndexes.size} declared index(es), ${migrationIndexes.size} created, ` +
          `${indexesCompared} compared by column`,
      );
    }

    if (unmodelled.length > 0) {
      /* Unmodelled tables have no column check; printed as an exposure. */
      t.diagnostic(
        `     not modeled in drizzle, so no column check covers: ${unmodelled.join(", ")}`,
      );
    }

    /*
     * The live database is opt-in because CI holds no Cloudflare credentials, and it is the only
     * place an unapplied migration or a hand-altered column shows up.
     */
    const live = process.env.SCHEMA_LIVE === "1";
    await t.test(
      "the live database matches the migrations",
      { skip: live ? false : "set SCHEMA_LIVE=1 to compare against the deployed database" },
      async () => {
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
        { label: "schema test live column schema read (SCHEMA_LIVE=1)" },
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
        t.diagnostic(`     live database: ${liveCompared} table(s) compared`);
      }
      },
    );
  } catch (error) {
    fail("the column comparison could not run", String(error));
  }

  done();
});
