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

/**
 * Content rows: both static pages and dated posts live here, split by `kind`.
 * FTS5 mirrors (title, body) through triggers defined in drizzle/0001_init.sql.
 */
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
    /** Rendered body. Written by the content generator alongside `body`. */
    html: text("html"),
    description: text("description"),
    coverImage: text("cover_image"),
    coverAlt: text("cover_alt"),
    readingTimeMinutes: integer("reading_time_minutes"),
    /** The markdown file this row was generated from, if any. */
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
    /**
     * JSON array of { slug, title }: the posts on this site that link TO this one, computed over
     * the whole corpus like `related` above. Not the webmentions table, which is other people's
     * sites and is approved one at a time.
     */
    backlinks: text("backlinks"),
    /**
     * THE THREE OPTIONAL AUTHOR-SET HEAD BLOCKS, all nullable because absent is the normal case.
     *
     * Columns rather than frontmatter reads, because the public route reads the RENDERED row:
     * D1 holds the only rendered copy (hard rule 18) and a field that is not a column is a field
     * the page cannot show. They are derived from the repository like everything else here.
     *
     * NOT `status`, which is taken: that is the draft/published visibility column above. A post
     * may be published and still carry `writing_status: draft`, meaning the prose is a draft, and
     * one name for both facts would make that sentence unsayable.
     */
    writingStatus: text("writing_status"),
    assumedAudience: text("assumed_audience"),
    /** JSON array of strings, matching `related` rather than inventing a second list convention. */
    keyTakeaways: text("key_takeaways"),
    /**
     * THE AUTHOR-WRITTEN POST HISTORY. JSON array of { date, note }, in the same convention.
     *
     * `updatedAt` above already says WHEN and cannot say WHAT, and it is rewritten by every sync,
     * so it is a deploy timestamp carrying an edit's name. This is prose about a revision, which
     * only the author has, and it arrives through frontmatter like every other authored field.
     */
    changelog: text("changelog"),
    /** Generated social card path, set by sync after build:og uploads it. */
    ogImage: text("og_image"),
    /**
     * Git blob sha1 of the markdown file this row was rendered from, computed
     * by `gitBlobSha()` in app/lib/content/hashes.mjs. What the content-drift
     * health check compares against the Contents directory listing.
     */
    sourceBlobSha: text("source_blob_sha"),
    /** sha256 of the rendered HTML, by `renderHash()` in the same module. */
    renderHash: text("render_hash"),
  },
  (t) => [
    check("posts_kind_check", sql`${t.kind} in ('page', 'post')`),
    check("posts_status_check", sql`${t.status} in ('draft', 'published')`),
    /*
     * THE INDEXES, declared here because otherwise they are declared nowhere a reader of this file can
     * see. The schema-source rule calls this file the source of truth, and a query planner decision is part of
     * what the table IS: somebody reading only this file would have taken the visibility predicate every
     * public read composes for a table scan. Section 4 compares index NAMES AND COLUMNS against the
     * migrations in both directions.
     */
    /** Covers `publiclyVisible()`, which every public read composes. */
    index("posts_status_publish_idx").on(t.status, t.publishAt),
    /** One row per markdown file. UNIQUE in `0002_blog_content.sql`. */
    uniqueIndex("posts_source_path_idx").on(t.sourcePath),
    /** Covers the home page's featured selection. */
    index("posts_featured_idx").on(t.featured, t.publishAt),
    /** Covers a series' parts, in order. */
    index("posts_series_idx").on(t.series, t.part),
  ],
);

/** Tag vocabulary. Replaces the single `category` column for new reads. */
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

/** Many-to-many join between posts and tags. */
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

/**
 * Small key/value store for site configuration (for example the llms.txt body).
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * The media INDEX. Grounds are in `drizzle/0009_media_index.sql`.
 *
 * DERIVED, never authoritative. R2 and `public/` are the truth for what exists and this is the
 * queryable surface over them, reconciled by `check:media` in both directions. The conflict rule is
 * not negotiable: R2 WINS. A row with no object is deleted, an object with no row is backfilled,
 * never the reverse.
 *
 * It describes the ASSET and never the citations. Those live in `mediaRefs`, so no row here can
 * authorize a delete a fresh count would refuse.
 */
export const media = sqliteTable(
  "media",
  {
    /** R2 object key, or the site-absolute public path when storage='static'. */
    key: text("key").primaryKey(),
    /** 'r2' | 'r2-derived' | 'static'. Derived by `storageOf()` in classify.mjs. */
    storage: text("storage").notNull().default("r2"),
    /** 'image' | 'document' | 'other'. Derived by `classify()`. */
    kind: text("kind").notNull().default("image"),
    /**
     * 'content' | 'brand' | 'generated' | 'icon'. Derived by `roleOf()`.
     *
     * What the asset is FOR. The picker takes `content` only, because inserting
     * one half of a generated diagram pair produces a broken post.
     */
    role: text("role").notNull().default("content"),
    mime: text("mime"),
    bytes: integer("bytes"),
    /** NULL means "not measured", which an SVG and a PDF legitimately are. */
    width: integer("width"),
    height: integer("height"),
    /** Where readability went when keys became content-addressed. */
    originalName: text("original_name"),

    /* The four AUTHORED columns, plus alt and caption. Everything above is
     * recomputable from the bytes; these are recoverable from nothing, which is
     * what makes a rebuild a merge rather than a truncate-and-reinsert. */
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    focalX: real("focal_x"),
    focalY: real("focal_y"),

    /**
     * Admin organisational labels, DELIMITER-WRAPPED: `,alpha,beta,` or "". The wrapping is what lets
     * an exact tag match use LIKE without `art` also matching `chart`. NEVER WRITTEN RAW:
     * `serialiseTags()` owns the form and strips the delimiter and both LIKE wildcards out of every
     * part. The four-point basis is in `drizzle/0011_media_trash_tags.sql`.
     */
    tags: text("tags").notNull().default(""),

    /**
     * When the LIBRARY stopped showing this asset. NULL means not trashed.
     *
     * A LIBRARY STATE, NOT AN OBJECT STATE. R2 and the public URL are untouched, so a trashed asset a
     * post cites keeps rendering for every reader while the library stops offering it.
     *
     * One nullable timestamp rather than a boolean plus a date, because two columns can disagree.
     * Reconciliation is blind to it on purpose: the object still exists, so only library views filter.
     */
    trashedAt: text("trashed_at"),

    /** LQIP as a base64 data URI. Renders with no script, per the zero-JS rule. */
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
     * Partial in the migration (`WHERE trashed_at IS NOT NULL`), because the only question asked of it
     * is which rows ARE trashed. Drizzle models the index and the predicate lives in the SQL that runs.
     * Section 4 of `check:invariants` compares columns, not index predicates, so this asymmetry is
     * invisible to it and is stated here instead.
     */
    index("media_trashed_idx").on(t.trashedAt),
  ],
);

/**
 * Who cites what. Written by the PIPELINE at render time.
 *
 * Usage stays DERIVED: this is a record of what the renderer emitted, not a cache anyone may consult
 * to decide existence. Writing refs at render time is what closes the fail-open, because anything
 * through the pipeline is indexed by construction and anything else is an enumerable gap.
 */
export const mediaRefs = sqliteTable(
  "media_refs",
  {
    mediaKey: text("media_key").notNull(),
    /** 'post' today. The seam an album or portfolio type would use. */
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
 * The site-wide search index. DERIVED, and the only table drizzle did not model.
 *
 * WHY IT IS DECLARED HERE: the schema-source rule makes this file the source of truth for the column schema,
 * and a table absent from it is absent from section 4's comparison against the migrations and the
 * live database. This table's column names live inside hand-written SQL strings.
 *
 * AND WHY EVERY READ STAYS IN RAW SQL: the visibility rule is enforced here by section 8, which scans the
 * raw SQL for the composed predicate, and section 6's drizzle-shaped scan knows only `posts`, so a
 * query-builder read would be seen by NEITHER. Section 4a asserts there is no such read; if one is
 * ever wanted, teach section 6 about this table FIRST and delete that assertion in the same commit.
 *
 * The two FTS5 mirrors stay out of drizzle: they are `CREATE VIRTUAL TABLE`.
 */
export const searchDocs = sqliteTable(
  "search_docs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** The ratified record id. Unique across documents and sections. */
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
     * Visibility, carried on the record rather than joined from `posts`. A future `publish_at` has to
     * be re-evaluated per request, so an index storing only what was visible at sync time would leak a
     * scheduled post the moment its date passed, or hide it forever.
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
 * WEBMENTIONS RECEIVED FROM OTHER SITES. Grounds in `drizzle/0014_webmentions.sql`.
 *
 * NEITHER AUTHORED NOR DERIVED. A row was written by a stranger's POST and there is no source to
 * converge it back to, so hard rule 18 does not reach this table.
 * A rebuild cannot repair it, and the only bound on its size is the one the endpoint enforces.
 *
 * NO IP COLUMN, AND THERE NEVER IS ONE. Nothing about the sender is recorded beyond what their own
 * page says, which is what `/privacy` claims and what this absence makes true.
 *
 * EVERY STRING IS PLAIN TEXT. `author_name`, `author_url` and `excerpt` are read out of a document
 * this site does not control, so they are stored as text and never as markup.
 */
export const webmentions = sqliteTable(
  "webmentions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Absolute http(s) URL of the page that linked here. */
    sourceUrl: text("source_url").notNull(),
    /**
     * THE POST SLUG, NOT A URL, and the difference is the point. A stored target URL would carry the
     * origin it was received on, so rows written before the cutover would name a host the render no
     * longer uses and deduplication would treat two spellings of one post as two targets.
     */
    targetSlug: text("target_slug").notNull(),
    /**
     * `unverified -> pending | failed`, then `pending -> approved | rejected`. `unverified` is what the
     * endpoint writes before it has fetched anything, so a row exists for the global cap to count from
     * the first moment. Only `approved` ever renders, which is why an unfetched or refused mention is
     * inert rather than merely unshown.
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
    /**
     * ONE ROW PER (SOURCE, TARGET). A sender re-announcing the same mention updates the row it already
     * has, so a loop against this endpoint cannot grow the table at all: the ceiling is a function of
     * how many pages link here, not of how fast somebody can POST.
     */
    uniqueIndex("webmentions_source_target_idx").on(t.sourceUrl, t.targetSlug),
    /** Covers the moderation queue's grouping and the retention sweep's window. */
    index("webmentions_status_received_idx").on(t.status, t.receivedAt),
  ],
);

/**
 * Zero-result search queries, kept as demand signal: the one search result worth storing is the one
 * that found nothing, because it names something a reader expected this site to have.
 *
 * THE SECOND TABLE THAT IS NEITHER AUTHORED NOR DERIVED, after `webmentions`. `posts` is authored in
 * the repository and `media`, `media_refs` and `search_docs` converge toward the repository and the
 * bucket under hard rule 18. These rows converge toward nothing, so a rebuild cannot repair this
 * table and no gate reconciles it against a source. What bounds it is the retention sweep and the
 * primary key, not a rebuild.
 *
 * FOUR COLUMNS, THREE OF THEM COUNTERS, AND NOWHERE TO PUT A READER. No IP, no user agent, no
 * session, no cookie, no fingerprint. That is a shape rather than a policy: a column that does not
 * exist cannot be filled in later by somebody who has not read this. `/privacy` can therefore say
 * that no search is attributable to a reader and be stating a fact about the schema.
 */
export const zeroResultQueries = sqliteTable(
  "zero_result_queries",
  {
    /**
     * THE QUERY IS THE KEY, normalized by the writer, so the same miss asked fifty times is one row
     * counted fifty times rather than fifty rows. It is what makes the table's size a function of
     * the distinct things people look for.
     */
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
    /**
     * CAPPED IN THE DATABASE, not only in the writer. A query past this length is not a question,
     * and the constraint is the difference between a demand signal and a place to put arbitrary
     * text. Section 4 does not compare a check predicate, so the SQL is the owner of the number.
     */
    check("zero_result_queries_length_check", sql`length(${t.query}) <= 200`),
    check("zero_result_queries_nonempty_check", sql`length(${t.query}) > 0`),
    /** The admin list orders by demand. */
    index("zero_result_queries_count_idx").on(t.count),
    /** The 90-day retention sweep selects on the window. */
    index("zero_result_queries_last_seen_idx").on(t.lastSeen),
  ],
);

export type Post = typeof posts.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Media = typeof media.$inferSelect;
export type MediaRef = typeof mediaRefs.$inferSelect;
export type SearchDoc = typeof searchDocs.$inferSelect;
export type Webmention = typeof webmentions.$inferSelect;
export type ZeroResultQuery = typeof zeroResultQueries.$inferSelect;
