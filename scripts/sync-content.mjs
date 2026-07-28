/**
 * Pushes the generated content artifact into D1.
 *
 *   npm run sync:content -- --local
 *   npm run sync:content -- --remote
 *
 * Runs the gate first, so a stale or hand-edited artifact can never reach the
 * database. The database is the read path; these files are the source of truth.
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
import path from "node:path";
import os from "node:os";

import { ogImageKey } from "../app/lib/content/pipeline.mjs";
import { ARTIFACT_PATH, lastCommitDate } from "./build-content.mjs";

const DB_NAME = "dustinedwards";

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
    // A post with a cover never gets a generated card, so it stores none.
    const ogImage = post.cover ? null : `/media/${ogImageKey(post)}`;
    const revised = post.updated ?? lastCommitDate(post.sourcePath);
    const updatedAt = revised
      ? Math.floor(Date.parse(`${revised}T00:00:00.000Z`) / 1000)
      : null;
    out.push(
      `INSERT INTO posts (slug, kind, title, body, html, description, status, publish_at, ` +
        `cover_image, cover_alt, reading_time_minutes, source_path, toc, featured, series, part, ` +
        `further_reading, og_title, og_description, related, og_image, updated_at) VALUES (` +
        `${sql(post.slug)}, 'post', ${sql(post.title)}, ${sql(post.markdown)}, ${sql(post.html)}, ` +
        `${sql(post.description)}, '${status}', ${num(publishAt)}, ` +
        `${sql(post.cover ? post.cover.src : null)}, ${sql(post.cover ? post.cover.alt : null)}, ` +
        `${num(post.readingTimeMinutes)}, ${sql(post.sourcePath)}, ` +
        `${sql(JSON.stringify(post.toc))}, ${post.featured ? 1 : 0}, ${sql(post.series)}, ${num(post.part)}, ` +
        `${sql(JSON.stringify(post.furtherReading))}, ${sql(post.ogTitle)}, ${sql(post.ogDescription)}, ` +
        `${sql(JSON.stringify(post.related))}, ${sql(ogImage)}, ${updatedAt === null ? "unixepoch()" : num(updatedAt)}) ` +
        `ON CONFLICT(slug) DO UPDATE SET ` +
        `kind = excluded.kind, title = excluded.title, body = excluded.body, ` +
        `html = excluded.html, description = excluded.description, status = excluded.status, ` +
        `publish_at = excluded.publish_at, cover_image = excluded.cover_image, ` +
        `cover_alt = excluded.cover_alt, reading_time_minutes = excluded.reading_time_minutes, ` +
        `source_path = excluded.source_path, toc = excluded.toc, featured = excluded.featured, ` +
        `series = excluded.series, part = excluded.part, further_reading = excluded.further_reading, ` +
        `og_title = excluded.og_title, og_description = excluded.og_description, ` +
        `related = excluded.related, og_image = excluded.og_image, ` +
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

async function main() {
  const target = process.argv.includes("--remote") ? "--remote" : "--local";

  const artifact = await readFile(ARTIFACT_PATH, "utf8");
  const { posts, records } = JSON.parse(artifact);
  if (!Array.isArray(records)) {
    throw new Error(
      `${ARTIFACT_PATH} carries no records array. Run npm run build:content first.`,
    );
  }

  // mkdir returns undefined when the directory already exists, so the path is
  // computed here rather than taken from its return value.
  const dir = path.join(os.tmpdir(), "dustinedwards-sync");
  await mkdir(dir, { recursive: true });
  const sqlPath = path.join(dir, "sync-content.sql");
  await writeFile(sqlPath, buildSql(posts), "utf8");

  console.log(`sync:content applying ${posts.length} posts to ${target.slice(2)} D1`);
  const applied = wrangler(`d1 execute ${DB_NAME} ${target} --file "${sqlPath}" --yes`);
  if (applied.status !== 0) {
    console.error(applied.stdout);
    throw new Error("wrangler d1 execute failed");
  }

  // Search index second, as its own statement file. Kept separate from the post
  // sync so a failure here names the search index rather than looking like a
  // content failure, and so the posts path is unchanged by search work.
  const searchPath = path.join(dir, "sync-search.sql");
  await writeFile(searchPath, buildSearchSql(records), "utf8");

  console.log(`sync:content applying ${records.length} search records`);
  const indexed = wrangler(`d1 execute ${DB_NAME} ${target} --file "${searchPath}" --yes`);
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
}

main().catch((/** @type {unknown} */ error) => {
  console.error(
    `sync:content failed. ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
