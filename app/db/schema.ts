import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Pages and posts, split by `kind`. FTS5 mirrors (title, body) through triggers in drizzle/0001_init.sql. */
export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    kind: text("kind", { enum: ["page", "post"] }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: ["draft", "published"] }).notNull(),
    publishAt: integer("publish_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    html: text("html"),
    description: text("description"),
    coverImage: text("cover_image"),
    coverAlt: text("cover_alt"),
    readingTimeMinutes: integer("reading_time_minutes"),
    sourcePath: text("source_path"),
    /** JSON array of { depth, id, text }, written by the content generator. */
    toc: text("toc"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    series: text("series"),
    part: integer("part"),
    /** JSON array of { title, url }. */
    furtherReading: text("further_reading"),
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    /** JSON array of { slug, title, shared }, computed over the whole corpus. */
    related: text("related"),
    /** JSON array of { slug, title }: posts on THIS site linking here. Not webmentions, which are other sites. */
    backlinks: text("backlinks"),
    /**
     * Not `status`, which is the draft/published visibility column: a published post can still carry
     * `writing_status: draft`, meaning the prose is a draft.
     */
    writingStatus: text("writing_status"),
    assumedAudience: text("assumed_audience"),
    /** JSON array of strings. */
    keyTakeaways: text("key_takeaways"),
    /** JSON array of { date, note }, authored. Not `updatedAt`, which every sync rewrites. */
    changelog: text("changelog"),
    ogImage: text("og_image"),
    /** JSON of site-api's search fields beside description ({ searchTitle, image, imageAlt, canonical, noindex }), NULL when none. */
    searchFields: text("search_fields"),
    /** Git blob sha1 of the source markdown (`gitBlobSha()`), what the content-drift check compares. */
    sourceBlobSha: text("source_blob_sha"),
    renderHash: text("render_hash"),
  },
  (t) => [
    check("posts_kind_check", sql`${t.kind} in ('page', 'post')`),
    check("posts_status_check", sql`${t.status} in ('draft', 'published')`),
    /** Covers `publiclyVisible()`, which every public read composes. */
    index("posts_status_publish_idx").on(t.status, t.publishAt),
    uniqueIndex("posts_source_path_idx").on(t.sourcePath),
    /** Covers the home page's featured selection. */
    index("posts_featured_idx").on(t.featured, t.publishAt),
    /** Covers a series' parts, in order. */
    index("posts_series_idx").on(t.series, t.part),
  ],
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("post_tags_tag_idx").on(t.tagId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// The media library (drizzle/0044_shared_media_store.sql, site-api's MEDIA_LIBRARY_SQL): the uploads in MEDIA, written
// only by d1MediaStore (app/db/media.ts). Citations live in `mediaRefs`, never here. site-api's own mirrors.
export { media, mediaRevisions, mediaChanges } from "@dustinedwards/site-api/drizzle";

/**
 * The site's own files, derived: the paths in public/ (storage 'static', from the committed asset manifest) and the
 * Worker's generated objects in OG (storage 'r2-derived': og/ cards, derived/ documents). Written only by the rebuild
 * and the R2 events (app/lib/media/rebuild.server.ts, workers/media-events.ts); OG and public/ win any conflict, so a
 * row with no file is deleted and a file with no row is indexed, never the reverse. Never the library's.
 */
export const siteAssets = sqliteTable("site_assets", {
  /** The site-absolute path when storage is 'static', else the OG object key. */
  key: text("key").primaryKey(),
  /** 'static' | 'r2-derived' (classify.mjs storageOf). */
  storage: text("storage").notNull(),
  /** 'image' | 'document' | 'other'. */
  kind: text("kind").notNull(),
  /** 'content' | 'brand' | 'generated' | 'icon' (classify.mjs roleOf). */
  role: text("role").notNull(),
  mime: text("mime"),
  bytes: integer("bytes"),
  /** NULL means "not measured", which an SVG and a PDF legitimately are. */
  width: integer("width"),
  height: integer("height"),
  /** When OG stored the object; NULL for a file in public/, which has no upload event. */
  uploadedAt: text("uploaded_at"),
});

/**
 * Who cites what, written by the pipeline at render time. A record of what the renderer emitted,
 * never a cache to consult when deciding whether an object exists.
 */
export const mediaRefs = sqliteTable(
  "media_refs",
  {
    mediaKey: text("media_key").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    /** markdown-image | figure-directive | frontmatter-cover | link | html | other */
    form: text("form").notNull(),
    /** Line number, so a refusal can name where the citation is. */
    detail: text("detail"),
  },
  (t) => [
    primaryKey({
      columns: [t.mediaKey, t.sourceType, t.sourceId, t.form, t.detail],
    }),
    index("media_refs_source_idx").on(t.sourceType, t.sourceId),
  ],
);

/**
 * The site-wide search index, derived. Every read stays in raw SQL: the visibility check scans raw
 * SQL for the composed predicate and would not see a query-builder read. The two FTS5 mirrors are
 * `CREATE VIRTUAL TABLE` and stay out of drizzle.
 */
export const searchDocs = sqliteTable(
  "search_docs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uid: text("uid").notNull().unique(),
    url: text("url").notNull(),
    type: text("type", { enum: ["post", "page"] }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Feeds the identity index. Carried by the DOCUMENT record only. */
    tags: text("tags").notNull().default(""),
    /** Feeds filtering and facets. Carried by EVERY record, pipe-delimited. */
    docTags: text("doc_tags").notNull().default(""),
    /** Grouping. For a document record this equals `uid` and `anchor` is null. */
    docUid: text("doc_uid").notNull(),
    docTitle: text("doc_title").notNull(),
    docUrl: text("doc_url").notNull(),
    anchor: text("anchor"),
    ordinal: integer("ordinal").notNull().default(0),
    /**
     * Visibility is carried on the record, not joined: a future `publish_at` must be evaluated per
     * request, or a scheduled post would leak or stay hidden once its date passed.
     */
    status: text("status", { enum: ["draft", "published"] }).notNull(),
    publishAt: integer("publish_at"),
  },
  (t) => [
    check("search_docs_type_check", sql`${t.type} in ('post', 'page')`),
    check("search_docs_status_check", sql`${t.status} in ('draft', 'published')`),
    /** Covers the visibility predicate every public search read composes. */
    index("search_docs_visible_idx").on(t.status, t.publishAt),
    /** Covers the type facet and its count. */
    index("search_docs_type_idx").on(t.type),
    /** Covers collapsing section hits back onto their owning document. */
    index("search_docs_doc_idx").on(t.docUid, t.ordinal),
  ],
);

/**
 * Webmentions from other sites: neither authored nor derived, so no rebuild can repair it.
 * No IP column, ever: `/privacy` relies on its absence. Author and excerpt fields come from pages
 * this site does not control, so they are stored as plain text, never markup.
 */
export const webmentions = sqliteTable(
  "webmentions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Absolute http(s) URL of the page that linked here. */
    sourceUrl: text("source_url").notNull(),
    /**
     * A slug, not a URL: a stored URL carries the origin it arrived on, so a host change would split
     * one post into two dedup targets.
     */
    targetSlug: text("target_slug").notNull(),
    /**
     * `unverified -> pending | failed`, then `pending -> approved | rejected`. The endpoint writes
     * `unverified` before fetching so the global cap counts it at once. Only `approved` renders.
     */
    status: text("status", {
      enum: ["unverified", "pending", "approved", "rejected", "failed"],
    }).notNull(),
    authorName: text("author_name"),
    authorUrl: text("author_url"),
    /** Plain text, at most 280 characters. Never markup. */
    excerpt: text("excerpt"),
    /** One of the fixed reasons in app/lib/webmention/verify.server.ts. */
    failureReason: text("failure_reason"),
    receivedAt: integer("received_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
  },
  (t) => [
    check(
      "webmentions_status_check",
      sql`${t.status} in ('unverified', 'pending', 'approved', 'rejected', 'failed')`,
    ),
    /** One row per (source, target), so re-announcing a mention cannot grow the table. */
    uniqueIndex("webmentions_source_target_idx").on(t.sourceUrl, t.targetSlug),
    /** Covers the moderation queue's grouping and the retention sweep's window. */
    index("webmentions_status_received_idx").on(t.status, t.receivedAt),
  ],
);

/**
 * Zero-result search queries, kept as a demand signal. Neither authored nor derived, so nothing
 * rebuilds it; the retention sweep and the primary key bound it. No IP, user agent, session or
 * cookie column by design: `/privacy` states that as a fact about the schema.
 */
export const zeroResultQueries = sqliteTable(
  "zero_result_queries",
  {
    /** Normalized by the writer, so a repeated miss is one row with a count, not many rows. */
    query: text("query").primaryKey(),
    count: integer("count").notNull().default(1),
    firstSeen: integer("first_seen", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastSeen: integer("last_seen", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    /** Capped in the database too. The schema test does not compare check predicates, so the SQL owns the number. */
    check("zero_result_queries_length_check", sql`length(${t.query}) <= 200`),
    check("zero_result_queries_nonempty_check", sql`length(${t.query}) > 0`),
    /** The admin list orders by demand. */
    index("zero_result_queries_count_idx").on(t.count),
    /** The 90-day retention sweep selects on the window. */
    index("zero_result_queries_last_seen_idx").on(t.lastSeen),
  ],
);

export type MediaRef = typeof mediaRefs.$inferSelect;
export type Webmention = typeof webmentions.$inferSelect;

// Scheduled updates to live posts (drizzle/0033_scheduled_updates.sql, SCHEDULED_UPDATES_SQL) and site-api's store
// (drizzle/0037, 0040, 0042, SITE_API_STORE_SQL): read and written only through the package's d1ScheduledUpdates and
// d1SiteApiStore (app/lib/carrel/). site-api's own mirrors, re-exported so drizzle-kit and the schema test see them.
export {
  scheduledUpdates,
  siteApiWrites,
  hookRetries,
  previewLinks,
  webmentionTargets,
  mediaUploads,
  gonePaths,
  hookRuns,
} from "@dustinedwards/site-api/drizzle";

// What Carrel's contract needs about posts that a post's file does not hold (drizzle/0038_carrel_posts.sql,
// app/lib/carrel/post-state.server.ts): the trash, the redirects a rename leaves, and the first publishes that go live
// by time. Times are UTC ISO text.
export const contentTrash = sqliteTable("content_trash", {
  contentId: text("content_id").primaryKey(),
  trashedAt: text("trashed_at").notNull(),
  changeId: text("change_id").notNull(),
});

export const postRedirects = sqliteTable("post_redirects", {
  fromSlug: text("from_slug").primaryKey(),
  toSlug: text("to_slug").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const scheduledPublishes = sqliteTable(
  "scheduled_publishes",
  {
    contentId: text("content_id").primaryKey(),
    publishAt: text("publish_at").notNull(),
    changeId: text("change_id").notNull(),
  },
  (t) => [index("scheduled_publishes_due").on(t.publishAt)],
);

// The 404 counts (drizzle/0041_not_found.sql, site-runtime's NOT_FOUND_SQL), counted by site-runtime's not-found wrapper in workers/app.ts
// and read by Carrel's 404 report (notFoundReport). site-runtime's own mirror, re-exported so the schema test sees its index.
export { page404Daily } from "@dustinedwards/site-runtime/drizzle";
