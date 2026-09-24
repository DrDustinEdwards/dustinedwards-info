/**
 * Drafts never appear publicly. The visibility predicate is stated twice, as a query-builder
 * condition and as hand-written SQL, and the two are run against a fixture of post states; every
 * reader of `posts` and of `search_docs` composes one of them or is a named exemption; and the
 * home page's counts are read through them rather than written.
 */

import test from "node:test";
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { stripComments, stripCommentsAndStrings } from "../scripts/lib/strip-comments.mjs";
import { bundler, collector, root, sourceFiles } from "./lib/invariants-harness.mjs";

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

test("drafts never public: every posts reader composes the visibility predicate", async (t) => {
  const { ok, fail, done } = collector();

  /*
   * The visibility rule at the caller: every `.from(posts)` is in `app/db/index.ts`, and each function
   * there composes the predicate unless exempt by function name. Writes are out of scope.
   */
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
      "scan COULD NOT SEE IT, because the scan matches `.from(posts)` and that " +
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
    listPostLinkCorpus:
      "feeds backlinksFor in publish.server.ts, and stands on listPostCorpusForRelated " +
      "above for the same reason: withBacklinks does its own visibility filtering of " +
      "the LINKING post while still computing a backlink list FOR a draft, so " +
      "pre-filtering here would change that half. It is the WIDER exemption of the two, " +
      "because it selects the rendered html, so state what that buys and what it costs: " +
      "a backlink is read out of a rendered body and there is nowhere else to read one, " +
      "and a draft's html therefore passes through this function. Nothing of it is " +
      "returned: withBacklinks keeps only the linking post's slug and title, and only " +
      "when that post is publicly visible. Its output reaches the posts row's " +
      "`backlinks` column, whose public reader re-checks every slug against " +
      "publiclyVisible() at the route. Reached from the save path behind Better Auth or " +
      "the operator token.",
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
   * Local names for `posts`, aliases included, so an alias cannot hide a visibility rule reader.
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
        "\n        A reader outside the one reviewable file is how the visibility rule gets bypassed " +
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
        "\n        The visibility rule: every public read goes through publiclyVisible(). If this " +
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

    t.diagnostic(
      `     ${totalSites} query site(s) in ${CHOKEPOINT}, ${queriers.length} function(s), ` +
        `${composing.length} composing, ${Object.keys(VISIBILITY_EXEMPT).length} exempt`,
    );
  } catch (error) {
    fail("the posts-reader coverage check could not run", String(error));
  }

  done();
});

test("drafts never public: every search_docs reader composes the visibility predicate", async (t) => {
  const { ok, fail, done } = collector();

  /*
   * The visibility rule for raw-SQL `search_docs` reads, which the posts reader scan cannot see: directly via
   * `visibilityClause(...)` or via `filters.clause`, whose builder is asserted too.
   */
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
              "desync quote pairing and this scan would classify a phantom. " +
              "Measured 0 across 25 prepare() arguments on 2026-08-21; that is the " +
              "premise this scan rests on and it has just stopped holding.",
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
        "scan reads; the query is unchanged and was simply out of scope before.",
    };

    const bare = readers.filter((r) => !r.direct && !r.indirect);
    const unexplainedBare = bare.filter((r) => !(r.key in SEARCH_DOCS_EXEMPT));
    ok(
      "every search_docs reader composes visibilityClause, or is a named exemption",
      unexplainedBare.length === 0,
      unexplainedBare
        .map((r) => `${r.key} selects from search_docs with no visibility predicate`)
        .join("\n        ") +
        "\n        The visibility rule reaches the search index too. Compose visibilityClause(), " +
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

    t.diagnostic(
      `     ${readers.length} reader(s): ${readers.filter((r) => r.direct).length} direct, ` +
        `${readers.filter((r) => !r.direct && r.indirect).length} via filters.clause, ` +
        `${writeSites} write statement(s) excluded`,
    );
  } catch (error) {
    fail("the search_docs reader check could not run", String(error));
  }

  done();
});

test("drafts never public: the home page's proof tiles are read, never written", async () => {
  const { ok, done } = collector();

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
        "build:stack derives from package.json.",
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

    /*
     * Bounded by the element, not a character window, which reads a neighbor's compliance.
     *
     * THE ANCHOR MOVED WITH THE FIGURES (ruling 117): the three proof tiles were flattened into the
     * evidence row, so `section.home-proof` no longer exists and this bounded on nothing. The
     * zero-scope guard below is what caught that, which is the whole reason it is here.
     */
    const proof = /<EvidenceRow[\s\S]*?\/>/.exec(home)?.[0] ?? "";
    ok(
      "the evidence row was located to scan",
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
      "no evidence fact states a number of its own",
      literals.length === 0,
      `the home page's evidence row contains ${literals.length} numeric literal(s): ` +
        `${literals.join(", ")}. Every number on that section is a claim about a ` +
        `measurement and must come from the instrument that took it. Rule 17.`,
    );
  }

  done();
});

