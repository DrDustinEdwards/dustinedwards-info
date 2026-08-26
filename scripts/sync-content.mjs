/**
 * Pushes the generated content artifact into D1.
 *
 *   npm run sync:content -- --local
 *   npm run sync:content -- --remote
 *
 * The database is the read path; these files are the source of truth.
 *
 * **THIS SCRIPT DOES NOT RUN ANY GATE. RUN `npm run check:content` YOURSELF
 * FIRST.** This comment used to claim "runs the gate first, so a stale or
 * hand-edited artifact can never reach the database", and that was false in
 * both halves: `main()` reads the artifact directly, and the npm script is a
 * bare `node` invocation with nothing in front of it. Nothing here has ever
 * checked the artifact against its source.
 *
 * A false safety claim is worse than no claim, because it is read as a reason
 * not to check. This is the one script in the repo that writes to production
 * D1, and the failure it falsely promised to prevent, a stale or hand-edited
 * artifact reaching the database, is exactly the one that matters here: the
 * bulk path DELETES `search_docs` outright and replaces `media_refs` for
 * `source_type='post'` wholesale, so a bad artifact does not merely add wrong
 * rows, it removes right ones.
 *
 * Left as an instruction rather than wired in, deliberately. Shelling out to
 * the gate from here would make the write path depend on the gate's exit code
 * being read correctly through two layers of npm, and this repo has already
 * been burned by an exit code masked by a pipe. The gate is one command; the
 * sequence is `npm run check:content && npm run sync:content -- --remote`.
 *
 * On the bulk path this issues one upsert per post and then rebuilds the FTS
 * index outright, rather than leaning on the three per-row triggers. The
 * triggers are correct for single edits and are left in place for the admin
 * editor that comes later; a rebuild is the honest choice for a full resync.
 *
 * Note on batch(): D1's batch() is a Worker binding API and is not reachable
 * from a build script. The equivalent here is a single generated SQL file
 * applied with `wrangler d1 execute --file`, which D1 runs as one unit.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { retryRead } from "./lib/retry.mjs";
import path from "node:path";
import os from "node:os";

import { ogImageKey } from "../app/lib/content/pipeline.mjs";
import { isPubliclyVisible, statusForDraft } from "../app/lib/search/visibility.mjs";
import { ARTIFACT_PATH, lastCommitDate } from "./build-content.mjs";

const DB_NAME = "dustinedwards";

/** The tracked source of the `llms.txt` settings row. */
const LLMS_PATH = "content/llms.txt";

/**
 * Escapes a value for a SQLite string literal.
 * @param {string | null} value
 */
function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** @param {number | null} value */
function num(value) {
  return value === null || value === undefined ? "NULL" : String(value);
}

/**
 * Builds the whole resync as one script.
 * @param {any[]} posts
 */
function buildSql(posts) {
  /** @type {string[]} */
  const out = [];

  // Posts no longer backed by a file are removed. Scoped to rows that came from
  // a file, so hand-authored pages are never touched by a content sync.
  const keep = posts.map((p) => sql(p.sourcePath)).join(", ");
  out.push(
    keep.length > 0
      ? `DELETE FROM posts WHERE source_path IS NOT NULL AND source_path NOT IN (${keep});`
      : `DELETE FROM posts WHERE source_path IS NOT NULL;`,
  );

  for (const post of posts) {
    const publishAt = Math.floor(Date.parse(post.publishAt) / 1000);
    const status = post.draft ? "draft" : "published";
    // Revision date: explicit frontmatter wins, otherwise the last commit that
    // touched the file. Applied here rather than in the artifact because the
    // artifact is byte-compared and a git date would make it fail on every
    // content commit. Falls back to now when there is no history to read.
    /*
     * og_image IS SET ONLY WHEN A CARD ACTUALLY EXISTS, which is the same
     * condition `build:og` renders under. Two rules, one predicate.
     *
     * A post with a cover never gets a generated card. NEITHER DOES A POST
     * THE PUBLIC CANNOT SEE, since 2026-08-23: a draft's card was live and
     * public in R2 while the post itself answered 404, and the card renders
     * the title.
     *
     * This half matters beyond tidiness because `build:og`'s prune guard asks
     * D1 which cards the live site points at, and refuses to delete any of
     * them. While a draft's row advertised a card, that card could never be
     * pruned: the guard would protect the very object the fix exists to
     * remove. Writing null here is what lets the two agree.
     */
    const hasCard =
      !post.cover &&
      isPubliclyVisible({ status: statusForDraft(post.draft), publishAt: post.publishAt });
    const ogImage = hasCard ? `/media/${ogImageKey(post)}` : null;
    const revised = post.updated ?? lastCommitDate(post.sourcePath);
    const updatedAt = revised
      ? Math.floor(Date.parse(`${revised}T00:00:00.000Z`) / 1000)
      : null;
    out.push(
      `INSERT INTO posts (slug, kind, title, body, html, description, status, publish_at, ` +
        `cover_image, cover_alt, reading_time_minutes, source_path, toc, featured, series, part, ` +
        `further_reading, og_title, og_description, related, og_image, source_blob_sha, ` +
        `render_hash, updated_at) VALUES (` +
        `${sql(post.slug)}, 'post', ${sql(post.title)}, ${sql(post.markdown)}, ${sql(post.html)}, ` +
        `${sql(post.description)}, '${status}', ${num(publishAt)}, ` +
        `${sql(post.cover ? post.cover.src : null)}, ${sql(post.cover ? post.cover.alt : null)}, ` +
        `${num(post.readingTimeMinutes)}, ${sql(post.sourcePath)}, ` +
        `${sql(JSON.stringify(post.toc))}, ${post.featured ? 1 : 0}, ${sql(post.series)}, ${num(post.part)}, ` +
        `${sql(JSON.stringify(post.furtherReading))}, ${sql(post.ogTitle)}, ${sql(post.ogDescription)}, ` +
        `${sql(JSON.stringify(post.related))}, ${sql(ogImage)}, ${sql(post.sourceBlobSha ?? null)}, ` +
        `${sql(post.renderHash ?? null)}, ${updatedAt === null ? "unixepoch()" : num(updatedAt)}) ` +
        `ON CONFLICT(slug) DO UPDATE SET ` +
        `kind = excluded.kind, title = excluded.title, body = excluded.body, ` +
        `html = excluded.html, description = excluded.description, status = excluded.status, ` +
        `publish_at = excluded.publish_at, cover_image = excluded.cover_image, ` +
        `cover_alt = excluded.cover_alt, reading_time_minutes = excluded.reading_time_minutes, ` +
        `source_path = excluded.source_path, toc = excluded.toc, featured = excluded.featured, ` +
        `series = excluded.series, part = excluded.part, further_reading = excluded.further_reading, ` +
        `og_title = excluded.og_title, og_description = excluded.og_description, ` +
        `related = excluded.related, og_image = excluded.og_image, ` +
        `source_blob_sha = excluded.source_blob_sha, render_hash = excluded.render_hash, ` +
        `updated_at = excluded.updated_at;`,
    );
  }

  // Tags are additive. A tag that loses its last post keeps its row, which costs
  // nothing and keeps tag ids stable across syncs.
  const allTags = new Set();
  for (const post of posts) for (const tag of post.tags) allTags.add(tag);
  for (const tag of [...allTags].sort()) {
    out.push(`INSERT OR IGNORE INTO tags (slug, name) VALUES (${sql(tag)}, ${sql(tag)});`);
  }

  for (const post of posts) {
    out.push(
      `DELETE FROM post_tags WHERE post_id = (SELECT id FROM posts WHERE slug = ${sql(post.slug)});`,
    );
    for (const tag of post.tags) {
      out.push(
        `INSERT INTO post_tags (post_id, tag_id) SELECT p.id, t.id FROM posts p, tags t ` +
          `WHERE p.slug = ${sql(post.slug)} AND t.slug = ${sql(tag)};`,
      );
    }
  }

  // Media citations, replaced wholesale for source_type='post'.
  //
  // Wholesale rather than per post, because this writer already holds the WHOLE
  // corpus: a per-post delete would leave refs behind for a post that has since
  // been removed from the artifact, and that stale row would be enough to refuse
  // the delete of an image nothing actually cites any more. The editor's save
  // path is the incremental writer and scopes its delete to one slug, because
  // one post is all it re-rendered.
  out.push(`DELETE FROM media_refs WHERE source_type = 'post';`);
  const seenRefs = new Set();
  for (const post of posts) {
    for (const ref of post.mediaRefs ?? []) {
      // The primary key is (media_key, source_type, source_id, form, detail), so
      // the same image cited twice on one line in one form is one row. Deduped
      // here rather than left to fail the batch.
      const id = `${ref.key} ${post.slug} ${ref.form} ${ref.detail ?? ""}`;
      if (seenRefs.has(id)) continue;
      seenRefs.add(id);
      out.push(
        `INSERT INTO media_refs (media_key, source_type, source_id, form, detail) VALUES (` +
          `${sql(ref.key)}, 'post', ${sql(post.slug)}, ${sql(ref.form)}, ${sql(ref.detail)});`,
      );
    }
  }

  // Full rebuild rather than trusting per-row triggers across a bulk write.
  out.push(`INSERT INTO posts_fts (posts_fts) VALUES ('rebuild');`);

  return `${out.join("\n")}\n`;
}

/**
 * Rewrites the search index from the artifact's records.
 *
 * search_docs is fully derived, so it is replaced outright rather than
 * reconciled. Both FTS tables are then rebuilt, which is the documented bulk
 * pattern for external-content fts5 and the one that does not depend on trigger
 * ordering inside a batch. There are deliberately no triggers on search_docs.
 *
 * @param {any[]} records
 */
function buildSearchSql(records) {
  /** @type {string[]} */
  const out = [`DELETE FROM search_docs;`];

  for (const record of records) {
    const publishAt = record.publishAt
      ? Math.floor(Date.parse(record.publishAt) / 1000)
      : null;
    out.push(
      `INSERT INTO search_docs (uid, url, type, title, body, tags, doc_tags, doc_uid, doc_title, ` +
        `doc_url, anchor, ordinal, status, publish_at) VALUES (` +
        `${sql(record.uid)}, ${sql(record.url)}, ${sql(record.type)}, ${sql(record.title)}, ` +
        `${sql(record.body)}, ${sql(record.tags)}, ${sql(record.docTags)}, ${sql(record.docUid)}, ` +
        `${sql(record.docTitle)}, ${sql(record.docUrl)}, ${sql(record.anchor)}, ` +
        `${num(record.ordinal)}, ${sql(record.status)}, ${num(publishAt)});`,
    );
  }

  out.push(`INSERT INTO search_identity (search_identity) VALUES ('rebuild');`);
  out.push(`INSERT INTO search_prose (search_prose) VALUES ('rebuild');`);

  return `${out.join("\n")}\n`;
}

/**
 * Runs wrangler through the shell as one command string. Passing an args array
 * alongside shell:true is deprecated, and npx needs a shell on Windows.
 *
 * @param {string} args already-quoted argument string
 * @returns {{ stdout: string, status: number }}
 */
function wrangler(args) {
  const result = spawnSync(`npx wrangler ${args}`, {
    encoding: "utf8",
    shell: true,
  });
  return { stdout: `${result.stdout ?? ""}${result.stderr ?? ""}`, status: result.status ?? 1 };
}

/**
 * A `d1 execute --file` import, RETRIED ONCE.
 *
 * ## THE NAMED EXEMPTION TO WRITES-ARE-NEVER-WRAPPED (ruled 2026-08-12)
 *
 * `scripts/lib/retry.mjs` wraps READS only, and its header says so, because a
 * retried write is a write that may have landed twice. The rule now reads:
 * writes are never wrapped, EXCEPT writes idempotent BY CONSTRUCTION, with the
 * argument stated where the wrapper is applied. This is that statement.
 *
 * Every file this runs is idempotent, measured rather than asserted:
 *
 *   posts    DELETE ... NOT IN (kept slugs), INSERT ... ON CONFLICT(slug) DO
 *            UPDATE, post_tags and media_refs deleted and rebuilt, then the
 *            fts index rebuilt with ('rebuild')
 *   llms     INSERT ... ON CONFLICT(key) DO UPDATE SET value = excluded.value
 *   search   DELETE FROM search_docs, re-INSERT every record, both fts indexes
 *            rebuilt
 *
 * None appends. A doubled run lands the same corpus, which is not a theory: ship
 * re-runs this whole sync over the existing corpus on EVERY deploy, and asserts
 * three-way docsize equality afterwards, so the doubled case is the normal case
 * and is already gated.
 *
 * ## WHY ALL THREE, not just the one that failed
 *
 * The seventh transient hit the llms import specifically. All three go through
 * the same `/d1/database/{id}/import` endpoint with the same exposure and the
 * same idempotency argument, and wrapping only the one that happened to fail is
 * the fix that lands in all but one affected site. Nothing else in this script
 * is wrapped: the verification read at the end is a read, and no other write in
 * the repo is touched.
 *
 * The FINAL result is returned rather than thrown, so each call site keeps its
 * own error message; those strings are quoted in the canon.
 *
 * @param {string} args @param {string} label @returns {Promise<{stdout: string, status: number}>}
 */
async function wranglerImport(args, label) {
  /** @type {{stdout: string, status: number}} */
  let last = { stdout: "", status: 1 };
  try {
    return await retryRead(
      () => {
        last = wrangler(args);
        // retryRead can only see a rejection; wrangler RETURNS on failure.
        if (last.status !== 0) throw new Error((last.stdout || "no output").slice(0, 200));
        return last;
      },
      { label },
    );
  } catch {
    // Exactly two attempts, and this is the second one's real result.
    return last;
  }
}

async function main() {
  const target = process.argv.includes("--remote") ? "--remote" : "--local";

  const artifact = await readFile(ARTIFACT_PATH, "utf8");
  const { posts, records } = JSON.parse(artifact);
  if (!Array.isArray(records)) {
    throw new Error(
      `${ARTIFACT_PATH} carries no records array. Run npm run build:content first.`,
    );
  }

  /*
   * THE SHIP-TIME DRIFT REPORT. What the committed artifact's byte gate used
   * to prove at commit time, taken at the last moment it is still provable:
   * the instant before this write overwrites the evidence.
   *
   * (slug, source_blob_sha, render_hash) is read for every file-backed row
   * and compared against the fresh build product. Five classes per slug:
   *
   *   unchanged       same source, same render.
   *   source-changed  a different source_blob_sha: the repository moved and
   *                   D1 had not caught up yet. Expected on every content
   *                   ship; the write below is the catch-up.
   *   RENDER DRIFT    the SAME source with a DIFFERENT render_hash: the
   *                   Worker and the Node build rendered identical bytes
   *                   differently. This is the Worker-versus-Node class the
   *                   byte gate existed for, and the one class that is a
   *                   pipeline defect rather than ordinary staleness.
   *   missing-in-d1   a file with no row: a new post, or a lost row.
   *   extra-in-d1     a row with no file: a deleted post; the write cleans it.
   *
   * THE WRITE STILL RUNS, whatever this finds. Converging D1 to the build IS
   * the repair (rule 18), and refusing to write would preserve wrong rows to
   * protect a report. The exit goes nonzero at the very END, after every
   * write and verification, so ship can let the deploy stand, finish both
   * index convergences, and still fail the run: the same shape as an index
   * miss.
   *
   * A failed read THROWS rather than skipping the report. A drift report
   * that could not read one side reports nothing, and nothing is exactly
   * what a clean run reports.
   */
  /** @type {string[]} */
  const renderDrift = [];
  {
    const read = wrangler(
      `d1 execute ${DB_NAME} ${target} --json --command ` +
        '"SELECT slug, source_blob_sha, render_hash FROM posts WHERE source_path IS NOT NULL;"',
    );
    if (read.status !== 0) {
      console.error(read.stdout);
      throw new Error("the pre-write drift read failed, so drift cannot be reported");
    }
    const rowsMatch = read.stdout.match(/\[[\s\S]*\]/);
    if (!rowsMatch) throw new Error(`could not parse the drift read:\n${read.stdout}`);
    /** @type {Array<{slug: string, source_blob_sha: string | null, render_hash: string | null}>} */
    const rows = JSON.parse(rowsMatch[0])[0].results;

    const rowBySlug = new Map(rows.map((r) => [r.slug, r]));
    const buildSlugs = new Set(posts.map((/** @type {any} */ p) => p.slug));
    let unchanged = 0;
    let sourceChanged = 0;
    let missing = 0;
    for (const post of posts) {
      const row = rowBySlug.get(post.slug);
      if (!row) {
        missing += 1;
        console.log(`  missing-in-d1: ${post.slug}`);
      } else if (row.source_blob_sha !== post.sourceBlobSha) {
        sourceChanged += 1;
        console.log(`  source-changed: ${post.slug} (expected: the repo moved)`);
      } else if (row.render_hash !== post.renderHash) {
        renderDrift.push(post.slug);
        console.log(
          `  RENDER DRIFT: ${post.slug} renders differently in the Worker and ` +
            `the Node build from the same source ${post.sourceBlobSha}: ` +
            `d1=${row.render_hash} build=${post.renderHash}`,
        );
      } else {
        unchanged += 1;
      }
    }
    const extra = rows.filter((r) => !buildSlugs.has(r.slug));
    for (const row of extra) console.log(`  extra-in-d1: ${row.slug} (the write removes it)`);

    // The counts print EVERY run, greppable, and ship reads this line.
    console.log(
      `sync:content drift: unchanged=${unchanged} source-changed=${sourceChanged} ` +
        `render-drift=${renderDrift.length} missing-in-d1=${missing} extra-in-d1=${extra.length}`,
    );
  }

  // mkdir returns undefined when the directory already exists, so the path is
  // computed here rather than taken from its return value.
  const dir = path.join(os.tmpdir(), "dustinedwards-sync");
  await mkdir(dir, { recursive: true });
  const sqlPath = path.join(dir, "sync-content.sql");
  await writeFile(sqlPath, buildSql(posts), "utf8");

  console.log(`sync:content applying ${posts.length} posts to ${target.slice(2)} D1`);
  const applied = await wranglerImport(
    `d1 execute ${DB_NAME} ${target} --file "${sqlPath}" --yes`,
    `sync:content posts import (${target})`,
  );
  if (applied.status !== 0) {
    console.error(applied.stdout);
    throw new Error("wrangler d1 execute failed");
  }

  // The llms.txt settings row, from its tracked source file.
  //
  // Same shape as everything else here: the FILE is the source of truth and the
  // row is derived, so a rebuild reproduces it. Before 2026-08-02 the only thing
  // that ever wrote this row was 0001_init.sql, which seeds the virology copy
  // retired on 2026-07-27, so a rebuilt site would have served a stale llms.txt
  // with nothing to flag it. check:llms compares the two now.
  //
  // Read as a Buffer and decoded explicitly rather than with an encoding hint,
  // because this file is compared byte for byte and the platform text layer is
  // cp1252 on this host.
  const llms = (await readFile(LLMS_PATH)).toString("utf8");
  if (llms.includes("\r")) {
    throw new Error(
      `${LLMS_PATH} contains CR. It is pinned to LF in .gitattributes; a CRLF ` +
        `checkout would sync CRLF into D1 and change what /llms.txt serves.`,
    );
  }
  const settingsPath = path.join(dir, "sync-settings.sql");
  await writeFile(
    settingsPath,
    `INSERT INTO settings (key, value) VALUES ('llms.txt', ${sql(llms)})\n` +
      `  ON CONFLICT(key) DO UPDATE SET value = excluded.value;\n`,
    "utf8",
  );
  console.log(`sync:content applying llms.txt (${Buffer.byteLength(llms)} bytes)`);
  const settingsApplied = await wranglerImport(
    `d1 execute ${DB_NAME} ${target} --file "${settingsPath}" --yes`,
    `sync:content llms.txt import (${target})`,
  );
  if (settingsApplied.status !== 0) {
    console.error(settingsApplied.stdout);
    throw new Error("wrangler d1 execute failed for the llms.txt settings row");
  }

  // Search index second, as its own statement file. Kept separate from the post
  // sync so a failure here names the search index rather than looking like a
  // content failure, and so the posts path is unchanged by search work.
  const searchPath = path.join(dir, "sync-search.sql");
  await writeFile(searchPath, buildSearchSql(records), "utf8");

  console.log(`sync:content applying ${records.length} search records`);
  const indexed = await wranglerImport(
    `d1 execute ${DB_NAME} ${target} --file "${searchPath}" --yes`,
    `sync:content search index import (${target})`,
  );
  if (indexed.status !== 0) {
    console.error(indexed.stdout);
    throw new Error("wrangler d1 execute failed for the search index");
  }

  // The index is only useful if it actually mirrors the table. Assert it rather
  // than assume the rebuild worked.
  // Counts the FTS shadow table, not posts_fts itself. On an external-content
  // FTS5 table `COUNT(*) FROM posts_fts` reads through to the content table, so
  // it equals COUNT(*) FROM posts no matter how broken the index is. Measured:
  // after DELETE FROM posts_fts the count still read 1 of 1 while MATCH returned
  // nothing. posts_fts_docsize holds one row per indexed document and went to 0,
  // so it is the only one of the three that can actually fail.
  const verify = wrangler(
    `d1 execute ${DB_NAME} ${target} --json --command ` +
      '"SELECT (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM posts_fts_docsize) AS fts, ' +
      '(SELECT COUNT(*) FROM post_tags) AS post_tags, (SELECT COUNT(*) FROM tags) AS tags, ' +
      '(SELECT COUNT(*) FROM search_docs) AS docs, ' +
      '(SELECT COUNT(*) FROM search_identity_docsize) AS identity, ' +
      '(SELECT COUNT(*) FROM search_prose_docsize) AS prose;"',
  );
  if (verify.status !== 0) {
    console.error(verify.stdout);
    throw new Error("post-sync verification query failed");
  }

  const match = verify.stdout.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`could not parse verification output:\n${verify.stdout}`);
  const row = JSON.parse(match[0])[0].results[0];

  console.log(
    `sync:content posts=${row.posts} posts_fts=${row.fts} tags=${row.tags} post_tags=${row.post_tags}`,
  );
  console.log(
    `sync:content search_docs=${row.docs} identity=${row.identity} prose=${row.prose}`,
  );

  if (row.posts !== row.fts) {
    throw new Error(
      `FTS drift: posts=${row.posts} but posts_fts=${row.fts}. The rebuild did not take.`,
    );
  }
  if (row.posts < posts.length) {
    throw new Error(`expected at least ${posts.length} posts in D1, found ${row.posts}`);
  }
  // Same trap as posts_fts: COUNT(*) on either search index reads through to
  // search_docs and can never disagree with it. These count the docsize shadow
  // tables, which hold one row per INDEXED document and go to zero on a failed
  // rebuild, so they are the only counts here that can actually fail.
  if (row.docs !== records.length) {
    throw new Error(
      `search_docs=${row.docs} but the artifact carries ${records.length} records.`,
    );
  }
  if (row.identity !== row.docs || row.prose !== row.docs) {
    throw new Error(
      `search index drift: search_docs=${row.docs} but identity=${row.identity} and ` +
        `prose=${row.prose}. A rebuild did not take.`,
    );
  }
  console.log("sync:content ok. FTS and search index row counts match.");

  /*
   * NONZERO LAST, after every write stood. Render drift means the shared
   * pipeline is not shared in practice, and a run that exits green on it is
   * the green-light-meaning-nothing this report replaces the byte gate to
   * avoid. The writes above already converged D1 to the build, so the state
   * is repaired; the exit is the alarm, not the refusal.
   */
  if (renderDrift.length > 0) {
    console.error(
      `sync:content: RENDER DRIFT on ${renderDrift.length} slug(s): ` +
        `${renderDrift.join(", ")}. The Worker and the Node build rendered the same ` +
        `source bytes differently; D1 has been converged to the build, and the drift ` +
        `is a pipeline defect to find, not a state to repair.`,
    );
    process.exit(1);
  }
}

main().catch((/** @type {unknown} */ error) => {
  console.error(
    `sync:content failed. ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
