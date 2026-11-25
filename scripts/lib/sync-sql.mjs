/** The INSERT/DELETE statement text sync-content writes for each content table. */

import { textChunks } from "../../app/lib/content/chunks.mjs";
import { ogImageKey } from "../../app/lib/content/pipeline.mjs";
import { PROTECTED_PAGE_PATHS, protectedPageReason } from "../../app/lib/pages/protected.mjs";
import { isPubliclyVisible } from "@drdustinedwards/site-helpers/search";
import { statusForDraft } from "../../app/lib/search/visibility.mjs";
import { revisedDate } from "../build-content.mjs";
import { freezeSql } from "./freeze-sql.mjs";
import { sqlLiteral as sql } from "./sql-literal.mjs";

/** @param {number | null} value */
function num(value) {
  return value === null || value === undefined ? "NULL" : String(value);
}

/** @param {any[]} posts */
export function buildSql(posts) {
  /** @type {string[]} */
  const out = [];

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
        `search_fields, updated_at) VALUES (` +
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
        `${sql(post.searchFields ? JSON.stringify(post.searchFields) : null)}, ` +
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
        `backlinks = excluded.backlinks, search_fields = excluded.search_fields, ` +
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

  return `${out.join("\n")}\n`;
}

/**
 * The procedures table converged to the repository's files: every row whose file is gone is deleted and every other row is written from the build's compile; never an unscoped delete.
 * Published, versioned rows are also frozen (freezeSql).
 *
 * @param {any[]} rows content/generated/procedures.json's rows
 */
export function buildProceduresSql(rows) {
  if (rows.length === 0) throw new Error("buildProceduresSql refuses to delete every procedure");
  const keep = rows.map((r) => sql(r.sourcePath)).join(", ");
  const out = [`DELETE FROM procedures WHERE source_path NOT IN (${keep});`];
  for (const r of rows) {
    out.push(
      `INSERT INTO procedures (slug, path, profile, title, description, status, version, updated, record, ` +
        `markdown, source_path, source_blob_sha, synced_at) VALUES (${sql(r.slug)}, ${sql(r.path)}, ` +
        `${sql(r.profile)}, ${sql(r.title)}, ${sql(r.description)}, ${sql(r.status)}, ${sql(r.version)}, ` +
        `${sql(r.updated)}, ${sql(r.record)}, ${sql(r.markdown)}, ${sql(r.sourcePath)}, ${sql(r.sourceBlobSha)}, ` +
        `unixepoch()) ON CONFLICT(slug) DO UPDATE SET path = excluded.path, profile = excluded.profile, ` +
        `title = excluded.title, description = excluded.description, status = excluded.status, ` +
        `version = excluded.version, updated = excluded.updated, record = excluded.record, ` +
        `markdown = excluded.markdown, source_path = excluded.source_path, ` +
        `source_blob_sha = excluded.source_blob_sha, synced_at = CASE WHEN procedures.source_blob_sha = excluded.source_blob_sha THEN procedures.synced_at ELSE excluded.synced_at END;`,
    );
    out.push(...freezeSql(r));
  }
  return `${out.join("\n")}\n`;
}

/**
 * The publications table converged to the repository's files, on the procedures' terms. Citation counts
 * are upserted from the committed snapshot and only forward: a row a refresh has read since is never
 * overwritten, and none is deleted.
 *
 * @param {any[]} rows content/generated/publications.json's rows
 * @param {Array<{ doi: string, count: number, url: string | null, fetchedAt: string }>} seeds
 */
export function buildPublicationsSql(rows, seeds) {
  if (rows.length === 0)
    throw new Error("buildPublicationsSql refuses to delete every publication");
  const keep = rows.map((r) => sql(r.sourcePath)).join(", ");
  const out = [`DELETE FROM publications WHERE source_path NOT IN (${keep});`];
  for (const r of rows) {
    // D1 refuses a statement over 100 KB (SQLITE_TOOBIG) and a twin with the PDF's full text passes it, so the
    // twin is appended in chunks. The row is written with a blank source_blob_sha and given the real one in the
    // last statement, so a run that stops half way leaves a row the content sync and the save both read as
    // not current and rebuild, never a truncated twin that claims to match its file.
    const [first = "", ...rest] = textChunks(r.markdown);
    out.push(
      `INSERT INTO publications (slug, doi_key, status, stage, type, title, year, selected, record, csl, markdown, ` +
        `source_path, source_blob_sha, synced_at) VALUES (${sql(r.slug)}, ${sql(r.doiKey)}, ${sql(r.status)}, ` +
        `${sql(r.stage)}, ${sql(r.type)}, ${sql(r.title)}, ${num(r.year)}, ${num(r.selected)}, ${sql(r.record)}, ` +
        `${sql(r.csl)}, ${sql(first)}, ${sql(r.sourcePath)}, '', unixepoch()) ` +
        `ON CONFLICT(slug) DO UPDATE SET doi_key = excluded.doi_key, status = excluded.status, stage = excluded.stage, ` +
        `type = excluded.type, title = excluded.title, year = excluded.year, selected = excluded.selected, ` +
        `record = excluded.record, csl = excluded.csl, markdown = excluded.markdown, ` +
        `source_path = excluded.source_path, source_blob_sha = '', ` +
        `synced_at = CASE WHEN publications.source_blob_sha = ${sql(r.sourceBlobSha)} THEN publications.synced_at ELSE excluded.synced_at END;`,
    );
    for (const chunk of rest) {
      out.push(
        `UPDATE publications SET markdown = markdown || ${sql(chunk)} WHERE slug = ${sql(r.slug)};`,
      );
    }
    out.push(
      `UPDATE publications SET source_blob_sha = ${sql(r.sourceBlobSha)} WHERE slug = ${sql(r.slug)};`,
    );
  }
  for (const s of seeds) {
    out.push(
      `INSERT INTO publication_citations (doi, count, url, fetched_at) VALUES (${sql(s.doi)}, ${num(s.count)}, ` +
        `${sql(s.url)}, ${sql(s.fetchedAt)}) ON CONFLICT(doi) DO UPDATE SET count = excluded.count, ` +
        `url = excluded.url, fetched_at = excluded.fetched_at WHERE excluded.fetched_at > publication_citations.fetched_at;`,
    );
  }
  return `${out.join("\n")}\n`;
}

/**
 * The pages table converged to the repository's files, on the procedures' terms.
 *
 * @param {any[]} rows content/generated/pages.json's rows
 */
export function buildPagesSql(rows) {
  if (rows.length === 0) throw new Error("buildPagesSql refuses to delete every page");
  // A protected page (/terms, the dataset license) with no published file would be deleted by the line below.
  for (const protectedPath of PROTECTED_PAGE_PATHS) {
    if (!rows.some((r) => r.path === protectedPath && r.status === "published")) {
      throw new Error(
        `buildPagesSql refuses: no published file for ${protectedPath}, and ${protectedPageReason(protectedPath)}`,
      );
    }
  }
  const keep = rows.map((r) => sql(r.sourcePath)).join(", ");
  const out = [`DELETE FROM pages WHERE source_path NOT IN (${keep});`];
  for (const r of rows) {
    out.push(
      `INSERT INTO pages (slug, path, title, description, status, record, markdown, source_path, ` +
        `source_blob_sha, synced_at) VALUES (${sql(r.slug)}, ${sql(r.path)}, ${sql(r.title)}, ` +
        `${sql(r.description)}, ${sql(r.status)}, ${sql(r.record)}, ${sql(r.markdown)}, ` +
        `${sql(r.sourcePath)}, ${sql(r.sourceBlobSha)}, unixepoch()) ON CONFLICT(slug) DO UPDATE SET ` +
        `path = excluded.path, title = excluded.title, description = excluded.description, ` +
        `status = excluded.status, record = excluded.record, markdown = excluded.markdown, ` +
        `source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha, ` +
        `synced_at = CASE WHEN pages.source_blob_sha = excluded.source_blob_sha THEN pages.synced_at ELSE excluded.synced_at END;`,
    );
  }
  return `${out.join("\n")}\n`;
}

/**
 * The cv table converged to the repository's files, on the procedures' terms.
 *
 * @param {any[]} rows content/generated/cv.json's rows
 */
export function buildCvSql(rows) {
  if (rows.length === 0) throw new Error("buildCvSql refuses to delete every CV file");
  const keep = rows.map((r) => sql(r.sourcePath)).join(", ");
  const out = [`DELETE FROM cv WHERE source_path NOT IN (${keep});`];
  for (const r of rows) {
    out.push(
      `INSERT INTO cv (slug, type, record, source_path, source_blob_sha, synced_at) VALUES (${sql(r.slug)}, ` +
        `${sql(r.type)}, ${sql(r.record)}, ${sql(r.sourcePath)}, ${sql(r.sourceBlobSha)}, unixepoch()) ` +
        `ON CONFLICT(slug) DO UPDATE SET type = excluded.type, record = excluded.record, ` +
        `source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha, ` +
        `synced_at = CASE WHEN cv.source_blob_sha = excluded.source_blob_sha THEN cv.synced_at ELSE excluded.synced_at END;`,
    );
  }
  return `${out.join("\n")}\n`;
}

/**
 * The dictionary_entries table converged to the repository's files, on the procedures' terms.
 *
 * @param {any[]} rows content/generated/dictionary.json's rows
 */
export function buildDictionarySql(rows) {
  if (rows.length === 0)
    throw new Error("buildDictionarySql refuses to delete every dictionary entry");
  const keep = rows.map((r) => sql(r.sourcePath)).join(", ");
  const out = [`DELETE FROM dictionary_entries WHERE source_path NOT IN (${keep});`];
  for (const r of rows) {
    out.push(
      `INSERT INTO dictionary_entries (key, path, term, status, record, source_path, source_blob_sha, synced_at) ` +
        `VALUES (${sql(r.key)}, ${sql(r.path)}, ${sql(r.term)}, ${sql(r.status)}, ${sql(r.record)}, ` +
        `${sql(r.sourcePath)}, ${sql(r.sourceBlobSha)}, unixepoch()) ON CONFLICT(key) DO UPDATE SET ` +
        `path = excluded.path, term = excluded.term, status = excluded.status, record = excluded.record, ` +
        `source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha, ` +
        `synced_at = CASE WHEN dictionary_entries.source_blob_sha = excluded.source_blob_sha THEN dictionary_entries.synced_at ELSE excluded.synced_at END;`,
    );
  }
  return `${out.join("\n")}\n`;
}

/**
 * The roster table converged to the repository's files, on the procedures' terms.
 *
 * @param {any[]} rows content/generated/roster.json's rows
 */
export function buildRosterSql(rows) {
  if (rows.length === 0) throw new Error("buildRosterSql refuses to delete every cohort");
  const keep = rows.map((r) => sql(r.sourcePath)).join(", ");
  const out = [`DELETE FROM roster WHERE source_path NOT IN (${keep});`];
  for (const r of rows) {
    out.push(
      `INSERT INTO roster (slug, year, record, source_path, source_blob_sha, synced_at) VALUES (${sql(r.slug)}, ` +
        `${num(r.year)}, ${sql(r.record)}, ${sql(r.sourcePath)}, ${sql(r.sourceBlobSha)}, unixepoch()) ` +
        `ON CONFLICT(slug) DO UPDATE SET year = excluded.year, record = excluded.record, ` +
        `source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha, ` +
        `synced_at = CASE WHEN roster.source_blob_sha = excluded.source_blob_sha THEN roster.synced_at ELSE excluded.synced_at END;`,
    );
  }
  return `${out.join("\n")}\n`;
}

/**
 * The phages table converged to the repository's files, on the procedures' terms.
 *
 * @param {any[]} rows content/generated/phages.json's rows
 */
export function buildPhagesSql(rows) {
  if (rows.length === 0) throw new Error("buildPhagesSql refuses to delete every phage");
  const keep = rows.map((r) => sql(r.sourcePath)).join(", ");
  const out = [`DELETE FROM phages WHERE source_path NOT IN (${keep});`];
  for (const r of rows) {
    out.push(
      `INSERT INTO phages (slug, name, year, record, source_path, source_blob_sha, synced_at) VALUES (${sql(r.slug)}, ` +
        `${sql(r.name)}, ${num(r.year)}, ${sql(r.record)}, ${sql(r.sourcePath)}, ${sql(r.sourceBlobSha)}, unixepoch()) ` +
        `ON CONFLICT(slug) DO UPDATE SET name = excluded.name, year = excluded.year, record = excluded.record, ` +
        `source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha, ` +
        `synced_at = CASE WHEN phages.source_blob_sha = excluded.source_blob_sha THEN phages.synced_at ELSE excluded.synced_at END;`,
    );
  }
  return `${out.join("\n")}\n`;
}

/**
 * The registry table converged to the repository's files, on the procedures' terms. An empty set is valid
 * (no kind may have records yet); it deletes only the rows a file under content/registry/ once made.
 *
 * @param {any[]} rows content/generated/registry.json's rows
 */
export function buildRegistrySql(rows) {
  const out = [
    rows.length === 0
      ? `DELETE FROM registry WHERE source_path LIKE 'content/registry/%';`
      : `DELETE FROM registry WHERE source_path NOT IN (${rows.map((r) => sql(r.sourcePath)).join(", ")});`,
  ];
  for (const r of rows) {
    out.push(
      `INSERT INTO registry (kind, id, name, status, record, source_path, source_blob_sha, synced_at) VALUES (${sql(r.kind)}, ` +
        `${sql(r.id)}, ${sql(r.name)}, ${sql(r.status)}, ${sql(r.record)}, ${sql(r.sourcePath)}, ${sql(r.sourceBlobSha)}, unixepoch()) ` +
        `ON CONFLICT(kind, id) DO UPDATE SET name = excluded.name, status = excluded.status, record = excluded.record, ` +
        `source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha, ` +
        `synced_at = CASE WHEN registry.source_blob_sha = excluded.source_blob_sha THEN registry.synced_at ELSE excluded.synced_at END;`,
    );
  }
  return `${out.join("\n")}\n`;
}

/**
 * Both FTS tables are rebuilt outright, the documented bulk pattern for external-content fts5, which
 * does not depend on trigger ordering inside a batch.
 *
 * @param {any[]} records
 */
export function buildSearchSql(records) {
  /** @type {string[]} */
  const out = [`DELETE FROM search_docs;`];

  for (const record of records) {
    const publishAt = record.publishAt ? Math.floor(Date.parse(record.publishAt) / 1000) : null;
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
