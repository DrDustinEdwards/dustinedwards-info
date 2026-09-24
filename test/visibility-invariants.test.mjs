/**
 * Drafts never appear publicly. The visibility predicate is stated twice, as a query-builder
 * condition and as hand-written SQL, and the two are run against a fixture of post states.
 */

import test from "node:test";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { bundler, collector, root } from "./lib/invariants-harness.mjs";

const bundle = bundler("visibility");

test("drafts never public: publiclyVisible() and visibilityClause() agree", { timeout: 180_000 }, async (t) => {
  const { ok, fail, done } = collector();

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

    /* A `timestamp` binds as epoch seconds; a Date is normalized in case that changes. */
    const drizzleParams = rendered.params.map((p) =>
      p instanceof Date ? Math.floor(p.getTime() / 1000) : p,
    );
    const instants = drizzleParams.filter((p) => typeof p === "number");
    ok(
      "publiclyVisible() bound exactly one instant, which the fixture is built around",
      instants.length === 1,
      `bound ${instants.length} numeric parameter(s); this test cannot pick a reference instant`,
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
      "export it from search.server.ts so this test can reach the real one",
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

      t.diagnostic(
        `     ${POST_STATES.length} post state(s), both predicates admit [${viaDrizzle.join(", ")}]`,
      );
    }
  } catch (error) {
    fail("the visibility comparison could not run", String(error));
  }

  done();
});
