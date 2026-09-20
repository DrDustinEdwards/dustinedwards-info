/**
 * Pushes the local content build product into D1, drift report first.
 *
 *   npm run sync:content -- --local
 *   npm run sync:content -- --remote
 *
 * The database is the read path; these files are the source of truth.
 *
 * **THIS SCRIPT DOES NOT RUN ANY GATE. RUN `npm run check:content` YOURSELF FIRST.** It is the
 * one script that writes to production D1, and the bulk path DELETES the search index and
 * replaces the media citations wholesale.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { retryRead } from "./lib/retry.mjs";
import path from "node:path";
import os from "node:os";

import { ogImageKey } from "../app/lib/content/pipeline.mjs";
import { isPubliclyVisible, statusForDraft } from "../app/lib/search/visibility.mjs";
import { ARTIFACT_PATH, revisedDate } from "./build-content.mjs";

import { resolveD1Address } from "./lib/d1-address.mjs";

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
    // Revision date: explicit frontmatter wins, otherwise the last commit that touched the file.
    // Applied here because a render must depend on the sources alone, and the Worker has no git.
    /*
     * og_image IS SET ONLY WHEN A CARD ACTUALLY EXISTS, the same condition the generator renders
     * under: two rules, one predicate. NEITHER A COVERED POST NOR ONE THE PUBLIC CANNOT SEE gets one,
     * after a draft's card was live while the post answered 404. That half matters beyond tidiness:
     * the prune guard asks D1 which cards the live site points at and refuses to delete them.
     */
    const hasCard =
      !post.cover &&
      isPubliclyVisible({ status: statusForDraft(post.draft), publishAt: post.publishAt });
    const ogImage = hasCard ? `/media/${ogImageKey(post)}` : null;
    /*
     * `revisedDate` OWNS THE RULE, which is what lets `check:microformats` feed a component the same
     * value without restating it. The epoch conversion stays here, being this file's column format.
     */
    const revised = revisedDate(post);
    const updatedAt = revised ? Math.floor(revised.getTime() / 1000) : null;
    out.push(
      `INSERT INTO posts (slug, kind, title, body, html, description, status, publish_at, ` +
        `cover_image, cover_alt, reading_time_minutes, source_path, toc, featured, series, part, ` +
        `further_reading, og_title, og_description, related, og_image, source_blob_sha, ` +
        `render_hash, writing_status, assumed_audience, key_takeaways, changelog, backlinks, ` +
        `updated_at) VALUES (` +
        `${sql(post.slug)}, 'post', ${sql(post.title)}, ${sql(post.markdown)}, ${sql(post.html)}, ` +
        `${sql(post.description)}, '${status}', ${num(publishAt)}, ` +
        `${sql(post.cover ? post.cover.src : null)}, ${sql(post.cover ? post.cover.alt : null)}, ` +
        `${num(post.readingTimeMinutes)}, ${sql(post.sourcePath)}, ` +
        `${sql(JSON.stringify(post.toc))}, ${post.featured ? 1 : 0}, ${sql(post.series)}, ${num(post.part)}, ` +
        `${sql(JSON.stringify(post.furtherReading))}, ${sql(post.ogTitle)}, ${sql(post.ogDescription)}, ` +
        `${sql(JSON.stringify(post.related))}, ${sql(ogImage)}, ${sql(post.sourceBlobSha ?? null)}, ` +
        `${sql(post.renderHash ?? null)}, ` +
        // The three optional head blocks. NULL when absent, which is most posts.
        `${sql(post.writingStatus ?? null)}, ${sql(post.assumedAudience ?? null)}, ` +
        `${sql(post.keyTakeaways ? JSON.stringify(post.keyTakeaways) : null)}, ` +
        // The author-written post history, NULL on the posts nobody has revised.
        `${sql(post.changelog ? JSON.stringify(post.changelog) : null)}, ` +
        // The posts that link here, NULL when nothing does.
        `${sql(post.backlinks && post.backlinks.length > 0 ? JSON.stringify(post.backlinks) : null)}, ` +
        `${updatedAt === null ? "unixepoch()" : num(updatedAt)}) ` +
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
        `writing_status = excluded.writing_status, ` +
        `assumed_audience = excluded.assumed_audience, ` +
        `key_takeaways = excluded.key_takeaways, changelog = excluded.changelog, ` +
        `backlinks = excluded.backlinks, ` +
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

  // Media citations, replaced wholesale for posts, because this writer holds the WHOLE corpus: a
  // per-post delete leaves refs for a post since removed, and that row refuses the delete of an
  // image nothing cites. The editor's save path scopes to one slug, one post being all it rendered.
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
 * Rewrites the search index from the artifact's records. Fully derived, so replaced outright
 * rather than reconciled, and both FTS tables are rebuilt, the documented bulk pattern for
 * external-content fts5, which does not depend on trigger ordering inside a batch.
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
 * THE NAMED EXEMPTION TO WRITES-ARE-NEVER-WRAPPED. The rule now reads: writes are never wrapped,
 * EXCEPT writes idempotent BY CONSTRUCTION, with the argument stated where the wrapper is
 * applied. Every file this runs deletes-and-replaces or upserts and none appends, and ship
 * re-runs this sync over the existing corpus on EVERY deploy, so the doubled case is the normal
 * case. WHY ALL THREE: same endpoint, same exposure, same argument, and wrapping only the one
 * that failed is the fix that lands in all but one affected site.
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
   * THE SHIP-TIME DRIFT REPORT, taken the instant before this write overwrites the evidence. Five
   * classes per slug:
   *
   *   unchanged       same source, same render.
   *   source-changed  the repository moved and D1 had not caught up; the write is the catch-up.
   *   RENDER DRIFT    the SAME source with a DIFFERENT render hash, the Worker-versus-Node class.
   *                   NOT a defect on its own, the commonest cause being the deployed Worker
   *                   rendering new markdown with the old renderer. The verdict is a SECOND run's.
   *   missing-in-d1   a file with no row: a new post, or a lost row.
   *   extra-in-d1     a row with no file: a deleted post; the write cleans it.
   *
   * THE WRITE STILL RUNS, whatever this finds, because converging D1 to the build IS the repair,
   * and the exit goes nonzero at the very END so ship can let the deploy stand. A failed read
   * THROWS rather than skipping the report, since nothing is what a clean run reports.
   */
  /** @type {string[]} */
  const renderDrift = [];
  {
    const read = wrangler(
      `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
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
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --file "${sqlPath}" --yes`,
    `sync:content posts import (${target})`,
  );
  if (applied.status !== 0) {
    console.error(applied.stdout);
    throw new Error("wrangler d1 execute failed");
  }

  // The llms.txt settings row, from its tracked source file: the FILE is the source of truth. The
  // only thing that ever wrote this row was the initial migration, seeding copy later retired. Read
  // as a Buffer and decoded explicitly, this file being compared byte for byte and the platform
  // text layer not UTF-8 here.
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
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --file "${settingsPath}" --yes`,
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
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --file "${searchPath}" --yes`,
    `sync:content search index import (${target})`,
  );
  if (indexed.status !== 0) {
    console.error(indexed.stdout);
    throw new Error("wrangler d1 execute failed for the search index");
  }

  // The index is only useful if it mirrors the table, so assert it. Counts the FTS SHADOW table: on
  // an external-content fts5 table a count of the index reads through to the content table. The
  // docsize shadow holds one row per indexed document and goes to zero.
  const verify = wrangler(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
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
  // Same trap as the post index: a count on either search index reads through to its content table.
  // These count the docsize shadows, which go to zero on a failed rebuild.
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
   * NONZERO LAST, after every write stood: render drift means the shared pipeline is not shared in
   * practice, and a run that exits green on it is the green light meaning nothing.
   */
  if (renderDrift.length > 0) {
    console.error(
      `sync:content: RENDER DRIFT on ${renderDrift.length} slug(s): ` +
        `${renderDrift.join(", ")}. The Worker and the Node build rendered the same ` +
        `source bytes differently; D1 has been converged to the build. Whether that ` +
        `is a defect or the benign ordering artifact of ruling 30 is decided by a ` +
        `SECOND run of this sync, which ship performs: drift that clears was a row ` +
        `written by the previously deployed Worker, and drift that survives the ` +
        `converge is the defect.`,
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
