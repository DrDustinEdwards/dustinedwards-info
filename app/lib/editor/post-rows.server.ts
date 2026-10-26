// The post's D1 rows: the posts row, its tags, its search records and its media citations, written in one batch by a
// save and cleared by the same statements on a delete. publish.server.ts decides what is written; this file writes it.
import { combinePurges, purgePost, purgePosts } from "~/lib/cache-purge.server";
import { mediaRefKey } from "~/lib/media-ref-key.mjs";
import { recordsForPost } from "~/lib/search/records.mjs";
import { statusForDraft } from "~/lib/search/visibility.mjs";

export type PublishEnv = Env;

type RenderedPost = Awaited<ReturnType<typeof import("~/lib/content/pipeline.mjs").renderPost>>;

/** A rendered post with the corpus-wide lists renderRecord attaches. */
export type PostRecord = RenderedPost & { related?: unknown[]; backlinks?: unknown[] };

// One post's derived rows, cleared and rebuilt by the same statements whether it is saved or deleted.
const clearPostTags = (db: D1Database, slug: string) =>
  db.prepare(`DELETE FROM post_tags WHERE post_id = (SELECT id FROM posts WHERE slug = ?1)`).bind(slug);
const clearSearchDocs = (db: D1Database, slug: string) =>
  db.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(`post:${slug}`);
const clearMediaRefs = (db: D1Database, slug: string) =>
  db.prepare(`DELETE FROM media_refs WHERE source_type = 'post' AND source_id = ?1`).bind(slug);
const rebuildPostsFts = (db: D1Database) =>
  db.prepare(`INSERT INTO posts_fts (posts_fts) VALUES ('rebuild')`);
const rebuildSearchIndexes = (db: D1Database) => [
  db.prepare(`INSERT INTO search_identity (search_identity) VALUES ('rebuild')`),
  db.prepare(`INSERT INTO search_prose (search_prose) VALUES ('rebuild')`),
];

/**
 * A synced row's columns by name, as bound. syncPostToD1 writes these, and the Carrel preview decodes
 * the same values through the schema, so a preview and the published page read one row shape.
 */
export function postColumnValues(record: PostRecord) {
  return {
    slug: record.slug as string,
    title: record.title,
    body: record.markdown,
    html: record.html,
    description: record.description,
    status: statusForDraft(record.draft),
    publish_at: Math.floor(Date.parse(record.publishAt) / 1000),
    cover_image: record.cover ? record.cover.src : null,
    cover_alt: record.cover ? record.cover.alt : null,
    reading_time_minutes: record.readingTimeMinutes,
    source_path: record.sourcePath,
    toc: JSON.stringify(record.toc),
    featured: record.featured ? 1 : 0,
    series: record.series,
    part: record.part,
    further_reading: JSON.stringify(record.furtherReading),
    og_title: record.ogTitle,
    og_description: record.ogDescription,
    related: JSON.stringify(record.related ?? []),
    source_blob_sha: record.sourceBlobSha ?? null,
    render_hash: record.renderHash ?? null,
    // NULL, not an empty string, when absent: an empty value would read as the author saying something.
    writing_status: record.writingStatus ?? null,
    assumed_audience: record.assumedAudience ?? null,
    key_takeaways: record.keyTakeaways ? JSON.stringify(record.keyTakeaways) : null,
    changelog: record.changelog ? JSON.stringify(record.changelog) : null,
    backlinks: record.backlinks ? JSON.stringify(record.backlinks) : null,
    // The frontmatter `updated` at UTC midnight, the value the bulk sync's revisedDate writes, so a save and
    // the next sync agree. NULL when the author wrote none: the statement then stamps the save's own time.
    updated_at: record.updated
      ? Math.floor(Date.parse(`${record.updated}T00:00:00.000Z`) / 1000)
      : null,
  };
}

/** One batch, so the row, its tags and the index move together. FTS is rebuilt, as the bulk sync does. */
export async function syncPostToD1(env: PublishEnv, record: PostRecord) {
  const db = env.DB;
  const v = postColumnValues(record);

  const statements = [
    db
      .prepare(
        `INSERT INTO posts (slug, kind, title, body, html, description, status, publish_at,
           cover_image, cover_alt, reading_time_minutes, source_path, toc, featured, series, part,
           further_reading, og_title, og_description, related, source_blob_sha, render_hash,
           writing_status, assumed_audience, key_takeaways, changelog, backlinks,
           updated_at)
         VALUES (?1, 'post', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
           ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26,
           COALESCE(?27, unixepoch()))
         ON CONFLICT(slug) DO UPDATE SET
           kind = excluded.kind, title = excluded.title, body = excluded.body,
           html = excluded.html, description = excluded.description, status = excluded.status,
           publish_at = excluded.publish_at, cover_image = excluded.cover_image,
           cover_alt = excluded.cover_alt, reading_time_minutes = excluded.reading_time_minutes,
           source_path = excluded.source_path, toc = excluded.toc, featured = excluded.featured,
           series = excluded.series, part = excluded.part,
           further_reading = excluded.further_reading, og_title = excluded.og_title,
           og_description = excluded.og_description, related = excluded.related,
           source_blob_sha = excluded.source_blob_sha, render_hash = excluded.render_hash,
           writing_status = excluded.writing_status,
           assumed_audience = excluded.assumed_audience,
           key_takeaways = excluded.key_takeaways, changelog = excluded.changelog,
           backlinks = excluded.backlinks,
           updated_at = excluded.updated_at`,
      )
      .bind(
        v.slug,
        v.title,
        v.body,
        v.html,
        v.description,
        v.status,
        v.publish_at,
        v.cover_image,
        v.cover_alt,
        v.reading_time_minutes,
        v.source_path,
        v.toc,
        v.featured,
        v.series,
        v.part,
        v.further_reading,
        v.og_title,
        v.og_description,
        v.related,
        v.source_blob_sha,
        v.render_hash,
        v.writing_status,
        v.assumed_audience,
        v.key_takeaways,
        v.changelog,
        v.backlinks,
        v.updated_at,
      ),
    ...record.tags.map((tag: string) =>
      db
        .prepare(`INSERT OR IGNORE INTO tags (slug, name) VALUES (?1, ?1)`)
        .bind(tag),
    ),
    clearPostTags(db, record.slug),
    ...record.tags.map((tag: string) =>
      db
        .prepare(
          `INSERT INTO post_tags (post_id, tag_id)
           SELECT p.id, t.id FROM posts p, tags t WHERE p.slug = ?1 AND t.slug = ?2`,
        )
        .bind(record.slug, tag),
    ),
    rebuildPostsFts(db),
    ...searchStatements(db, record),
    ...mediaRefStatements(db, record),
  ];

  await db.batch(statements);
}

/** Scoped to this slug, unlike the bulk sync, and in the post's batch so citations land with the save. */
function mediaRefStatements(db: D1Database, record: PostRecord) {
  const statements = [clearMediaRefs(db, record.slug)];
  const seen = new Set<string>();
  for (const ref of record.mediaRefs ?? []) {
    // mediaRefKey joins with NUL: any printable separator collides, since details carry spaces.
    const id = mediaRefKey({
      mediaKey: ref.key,
      form: ref.form,
      detail: ref.detail ?? null,
    });
    if (seen.has(id)) continue;
    seen.add(id);
    statements.push(
      db
        .prepare(
          `INSERT INTO media_refs (media_key, source_type, source_id, form, detail)
           VALUES (?1, 'post', ?2, ?3, ?4)`,
        )
        .bind(ref.key, record.slug, ref.form, ref.detail ?? null),
    );
  }
  return statements;
}

/** Incremental is safe here, unlike related: a post's sections depend only on its own markdown. */
function searchStatements(db: D1Database, record: PostRecord) {
  const records = recordsForPost(record);
  return [
    clearSearchDocs(db, record.slug),
    ...records.map((r) =>
      db
        .prepare(
          `INSERT INTO search_docs (uid, url, type, title, body, tags, doc_tags, doc_uid,
             doc_title, doc_url, anchor, ordinal, status, publish_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
        )
        .bind(
          r.uid,
          r.url,
          r.type,
          r.title,
          r.body,
          r.tags,
          r.docTags,
          r.docUid,
          r.docTitle,
          r.docUrl,
          r.anchor,
          r.ordinal,
          r.status,
          r.publishAt ? Math.floor(Date.parse(r.publishAt) / 1000) : null,
        ),
    ),
    ...rebuildSearchIndexes(db),
  ];
}

/** Tag rows stay, as in the bulk sync. Stale media_refs would block deleting the image forever. */
export async function deletePostFromD1(env: PublishEnv, slug: string) {
  // Purged BEFORE the delete: a purge landing after a slow delete could re-store the removed page.
  const purgedPage = await purgePost(slug, `deletePostFromD1 ${slug}`);
  const purgedListings = await purgePosts(`deletePostFromD1 ${slug}`);
  const db = env.DB;
  await db.batch([
    clearPostTags(db, slug),
    db.prepare(`DELETE FROM posts WHERE slug = ?1`).bind(slug),
    rebuildPostsFts(db),
    clearSearchDocs(db, slug),
    ...rebuildSearchIndexes(db),
    clearMediaRefs(db, slug),
  ]);
  return { purged: combinePurges(purgedPage, purgedListings) };
}
