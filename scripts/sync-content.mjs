// This script runs no gate: run `npm run check:content` first. It writes production D1, and the
// bulk path deletes the search index and replaces the media citations wholesale.

import { readFile, writeFile, mkdir } from "node:fs/promises";

import { retryRead } from "./lib/retry.mjs";
import path from "node:path";
import os from "node:os";

import { ogImageKey } from "../app/lib/content/pipeline.mjs";
import { isPubliclyVisible, statusForDraft } from "../app/lib/search/visibility.mjs";
import { ARTIFACT_PATH, revisedDate } from "./build-content.mjs";

import { resolveD1Address } from "./lib/d1-address.mjs";
import { runWrangler } from "./lib/wrangler-run.mjs";
import { deleteFloor, requirePosts, syncablePostProblems } from "./lib/delete-floor.mjs";

const DB_NAME = "dustinedwards";

const LLMS_PATH = "content/llms.txt";

/** @param {string | null} value */
function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** @param {number | null} value */
function num(value) {
  return value === null || value === undefined ? "NULL" : String(value);
}

/** @param {any[]} posts */
function buildSql(posts) {
  /** @type {string[]} */
  const out = [];

  // Scoped to rows that came from a file, so hand-authored pages are never touched by a content sync.
  // Never an unscoped delete: an empty keep list is a collapsed artifact, refused upstream and here.
  if (posts.length === 0) throw new Error("buildSql refuses to delete every file-sourced post");
  const keep = posts.map((p) => sql(p.sourcePath)).join(", ");
  out.push(`DELETE FROM posts WHERE source_path IS NOT NULL AND source_path NOT IN (${keep});`);

  for (const post of posts) {
    const publishAt = Math.floor(Date.parse(post.publishAt) / 1000);
    const status = post.draft ? "draft" : "published";
    // og_image is set only when a card exists, the generator's own condition: the prune guard asks D1
    // which cards the live site points at and refuses to delete them.
    const hasCard =
      !post.cover &&
      isPubliclyVisible({ status: statusForDraft(post.draft), publishAt: post.publishAt });
    const ogImage = hasCard ? `/media/${ogImageKey(post)}` : null;
    // The revision date is applied here because the Worker has no git.
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
        `${sql(post.writingStatus ?? null)}, ${sql(post.assumedAudience ?? null)}, ` +
        `${sql(post.keyTakeaways ? JSON.stringify(post.keyTakeaways) : null)}, ` +
        `${sql(post.changelog ? JSON.stringify(post.changelog) : null)}, ` +
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

  // Tags are additive: keeping an orphaned tag's row keeps tag ids stable across syncs.
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

  // Replaced wholesale: a per-post delete leaves refs for a removed post, and that row refuses the
  // delete of an image nothing cites.
  out.push(`DELETE FROM media_refs WHERE source_type = 'post';`);
  const seenRefs = new Set();
  for (const post of posts) {
    for (const ref of post.mediaRefs) {
      // The primary key makes the same image cited twice on one line in one form a single row; deduped
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
 * Both FTS tables are rebuilt outright, the documented bulk pattern for external-content fts5, which
 * does not depend on trigger ordering inside a batch.
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
 * Retried once, which is safe only because every file this runs deletes-and-replaces or upserts and
 * none appends.
 *
 * @param {string} args @param {string} label @returns {Promise<{ status: number, stdout: string, output: string }>}
 */
async function wranglerImport(args, label) {
  /** @type {{ status: number, stdout: string, output: string }} */
  let last = { status: 1, stdout: "", output: "" };
  try {
    return await retryRead(
      () => {
        last = runWrangler(args);
        // retryRead can only see a rejection; wrangler RETURNS on failure.
        if (last.status !== 0) throw new Error((last.output || "no output").slice(0, 200));
        return last;
      },
      { label },
    );
  } catch {
    return last;
  }
}

async function main() {
  const target = process.argv.includes("--remote") ? "--remote" : "--local";

  const artifact = JSON.parse(await readFile(ARTIFACT_PATH, "utf8"));
  // Every delete below converges D1 to this artifact, so an empty one would empty production.
  const posts = requirePosts(artifact, ARTIFACT_PATH);
  const { records } = artifact;
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(
      `${ARTIFACT_PATH} carries no search records. Run npm run build:content first; ` +
        `nothing was written.`,
    );
  }
  const problems = syncablePostProblems(posts);
  if (problems.length > 0) {
    throw new Error(
      `${ARTIFACT_PATH} has posts sync cannot trust, so nothing was written:\n  ` +
        problems.join("\n  "),
    );
  }

  // search_docs is replaced wholesale, so its floor compares the artifact against what D1 holds now.
  {
    const read = runWrangler(
      `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
        '"SELECT COUNT(*) AS docs FROM search_docs;"',
    );
    if (read.status !== 0) {
      console.error(read.output);
      throw new Error("the pre-write search_docs count failed, so the delete floor cannot hold");
    }
    const countMatch = read.stdout.match(/\[[\s\S]*\]/);
    if (!countMatch) throw new Error(`could not parse the search_docs count:\n${read.output}`);
    const current = JSON.parse(countMatch[0])[0].results[0]?.docs;
    const searchFloor = deleteFloor({
      what: "search records",
      keeping: records.length,
      removing: Number.isInteger(current) ? Math.max(0, current - records.length) : current,
    });
    if (searchFloor) {
      throw new Error(`REFUSED before any write: ${searchFloor}. D1 is untouched.`);
    }
  }

  // The write runs whatever this finds, because converging D1 to the build is the repair; the exit
  // goes nonzero at the very end so ship can let the deploy stand.
  /** @type {string[]} */
  const renderDrift = [];
  {
    const read = runWrangler(
      `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
        '"SELECT slug, source_blob_sha, render_hash FROM posts WHERE source_path IS NOT NULL;"',
    );
    if (read.status !== 0) {
      console.error(read.output);
      throw new Error("the pre-write drift read failed, so drift cannot be reported");
    }
    const rowsMatch = read.stdout.match(/\[[\s\S]*\]/);
    if (!rowsMatch) throw new Error(`could not parse the drift read:\n${read.output}`);
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

    // Before the drift line, which ship reads as "every write ran": a refusal must not print it.
    const postFloor = deleteFloor({
      what: "file-sourced posts",
      keeping: posts.length,
      removing: extra.length,
    });
    if (postFloor) {
      throw new Error(`REFUSED before any write: ${postFloor}. D1 is untouched.`);
    }

    // Ship reads this line, so it prints every run.
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
    console.error(applied.output);
    throw new Error("wrangler d1 execute failed");
  }

  // Read as a Buffer and decoded explicitly: it is compared byte for byte, and the platform text layer
  // is not UTF-8 here.
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
    console.error(settingsApplied.output);
    throw new Error("wrangler d1 execute failed for the llms.txt settings row");
  }

  // A separate statement file, so a failure here names the search index rather than the content.
  const searchPath = path.join(dir, "sync-search.sql");
  await writeFile(searchPath, buildSearchSql(records), "utf8");

  console.log(`sync:content applying ${records.length} search records`);
  const indexed = await wranglerImport(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --file "${searchPath}" --yes`,
    `sync:content search index import (${target})`,
  );
  if (indexed.status !== 0) {
    console.error(indexed.output);
    throw new Error("wrangler d1 execute failed for the search index");
  }

  // Counts the FTS docsize shadow: a count on an external-content fts5 table reads through to the
  // content table.
  const verify = runWrangler(
    `d1 execute ${resolveD1Address(DB_NAME, target)} ${target} --json --command ` +
      '"SELECT (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM posts_fts_docsize) AS fts, ' +
      '(SELECT COUNT(*) FROM posts WHERE source_path IS NOT NULL) AS file_posts, ' +
      '(SELECT COUNT(*) FROM post_tags) AS post_tags, (SELECT COUNT(*) FROM tags) AS tags, ' +
      '(SELECT COUNT(*) FROM search_docs) AS docs, ' +
      '(SELECT COUNT(*) FROM search_identity_docsize) AS identity, ' +
      '(SELECT COUNT(*) FROM search_prose_docsize) AS prose;"',
  );
  if (verify.status !== 0) {
    console.error(verify.output);
    throw new Error("post-sync verification query failed");
  }

  const match = verify.stdout.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`could not parse verification output:\n${verify.output}`);
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
  // File-sourced rows only: hand-authored pages would otherwise make up a shortfall in the posts.
  if (row.file_posts < posts.length) {
    throw new Error(
      `expected at least ${posts.length} file-sourced posts in D1, found ${row.file_posts}`,
    );
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

  // Nonzero last, after every write stood: render drift means the shared pipeline is not shared in practice.
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
