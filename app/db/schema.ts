import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
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
    excerpt: text("excerpt"),
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
  (t) => [
    primaryKey({ columns: [t.postId, t.tagId] }),
    index("post_tags_tag_idx").on(t.tagId),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Derived: R2 and `public/` win any conflict. A row with no object is deleted, an object with no row
 * is backfilled, never the reverse. Citations live in `mediaRefs`, never here.
 */
export const media = sqliteTable(
  "media",
  {
    /** R2 object key, or the site-absolute public path when storage='static'. */
    key: text("key").primaryKey(),
    /** 'r2' | 'r2-derived' | 'static'. */
    storage: text("storage").notNull().default("r2"),
    /** 'image' | 'document' | 'other'. */
    kind: text("kind").notNull().default("image"),
    /**
     * 'content' | 'brand' | 'generated' | 'icon'. The picker takes `content` only, because inserting
     * one half of a generated diagram pair produces a broken post.
     */
    role: text("role").notNull().default("content"),
    mime: text("mime"),
    bytes: integer("bytes"),
    /** NULL means "not measured", which an SVG and a PDF legitimately are. */
    width: integer("width"),
    height: integer("height"),
    /** Keys are content-addressed, so the readable upload name survives only here. */
    originalName: text("original_name"),

    /* Authored, and recoverable from nothing: a rebuild merges these rather than truncating. */
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    focalX: real("focal_x"),
    focalY: real("focal_y"),

    /**
     * Delimiter-wrapped, `,alpha,beta,` or "", so an exact LIKE match on `art` does not hit `chart`.
     * Only `serialiseTags()` writes it; it strips the delimiter and both LIKE wildcards.
     */
    tags: text("tags").notNull().default(""),

    /**
     * NULL means not trashed. Library state only: R2 and the public URL are untouched, so a trashed
     * asset a post cites keeps rendering. Reconciliation ignores it on purpose.
     */
    trashedAt: text("trashed_at"),

    /** LQIP as a base64 data URI, so it renders with no script. */
    placeholder: text("placeholder"),
    uploadedAt: text("uploaded_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [
    index("media_uploaded_idx").on(t.uploadedAt),
    index("media_storage_idx").on(t.storage),
    index("media_kind_idx").on(t.kind),
    index("media_role_idx").on(t.role),
    /*
     * Partial in the migration (`WHERE trashed_at IS NOT NULL`). Drizzle cannot model the predicate
     * and the schema test does not compare predicates, so it lives only in the SQL.
     */
    index("media_trashed_idx").on(t.trashedAt),
  ],
);

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
    index("media_refs_key_idx").on(t.mediaKey),
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
