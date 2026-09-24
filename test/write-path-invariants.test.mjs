/**
 * The write paths: the Node and Worker image resolvers agree, nothing deletes from or counts an
 * FTS index directly, savePost commits to the repository before it touches D1, and renderAndWrite
 * is the one door to a rendered row and writes all of it.
 */

import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

import { joinConcatenatedLiterals } from "../scripts/lib/sql-literals.mjs";
import { classifySqliteTables, ftsOwnedTables } from "../scripts/lib/sqlite-tables.mjs";
import { stripComments } from "../scripts/lib/strip-comments.mjs";
import { bundler, collector, root, sourceFiles } from "./lib/invariants-harness.mjs";

const bundle = bundler("write-paths");

/* Bundling cold took 62s once on a loaded host, past the suite's 60s default. */
test("write paths: the Node and Worker resolveImage paths agree", { timeout: 180_000 }, async (t) => {
  const { ok, fail, done } = collector();

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
      "export makeResolveImage from scripts/lib/content.mjs so this test can reach it",
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
      t.diagnostic(
        `     ${compared} media src(s) compared, ${agreements} in agreement`,
      );
    }
  } catch (error) {
    fail("the resolveImage comparison could not run", String(error));
  }

  done();
});

test("write paths: no DELETE FROM an FTS index, and no COUNT(*) on one", async (t) => {
  const { ok, fail, done } = collector();

  /*
   * The per-table backup rule: `DELETE FROM` corrupts an fts5 index, and `COUNT(*)` reads the content table so
   * it cannot see drift. The rest of the per-table backup rule is gated elsewhere. The index list is derived.
   */
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
        `floors in this test and confirm its shadows are covered.`,
    );
    ok(
      "each index brought its shadow tables",
      classified.shadow.length >= classified.virtual.length * 3,
      `${classified.shadow.length} shadow(s) for ${classified.virtual.length} index(es): ` +
        `${classified.shadow.join(", ")}`,
    );

    /*
     * Scans whole source, not extracted literals, which desync on regex literals and hid a
     * the per-table backup rule violation. Occurrence is all this needs.
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

    /* A broken walk reports zero violations. The vacuity rule. */
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

    t.diagnostic(
      `     ${classified.virtual.length} index(es), ${classified.shadow.length} shadow(s), ` +
        `${filesScanned} file(s), ${sqlLiterals} SQL literal(s), ${docsizeCounts} docsize count(s)`,
    );
  } catch (error) {
    fail("the FTS write and count check could not run", String(error));
  }

  done();
});

test("write paths: savePost commits before it touches D1", async () => {
  const { ok, done } = collector();

  /*
   * `savePost` commits before it writes D1: a D1 write first could describe a post on no commit,
   * while a D1 failure after is repairable. A reorder looks like a tidy, so it fails here.
   */
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

  done();
});

test("write paths: renderAndWrite is the one door to a rendered row, and writes all of it", async () => {
  const { ok, done } = collector();

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

  done();
});

