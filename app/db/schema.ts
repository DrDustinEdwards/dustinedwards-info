import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
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
    /** Superseded by the tags relation. Kept until nothing reads it. */
    category: text("category"),
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
    /** Generated social card path, set by sync after build:og uploads it. */
    ogImage: text("og_image"),
  },
  (t) => [
    check("posts_kind_check", sql`${t.kind} in ('page', 'post')`),
    check("posts_status_check", sql`${t.status} in ('draft', 'published')`),
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
 * The media INDEX. Grounds are in drizzle/0009_media_index.sql.
 *
 * DERIVED, never authoritative. R2 and `public/` are the truth for what exists;
 * this is the queryable surface over them, and `check:media` reconciles the two
 * in both directions. The conflict rule is not negotiable and is stated once:
 * **R2 WINS.** A row with no object is deleted, an object with no row is
 * backfilled, never the reverse.
 *
 * It still describes the ASSET and never the citations. Those live in
 * `mediaRefs`, written by the pipeline at render time, so no row here can
 * authorise a delete that a fresh count would refuse.
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
  ],
);

/**
 * Who cites what. Written by the PIPELINE at render time, populated in Phase 3.
 *
 * Usage stays DERIVED (ruling 2, carried forward): this table is a record of
 * what the renderer emitted, not a cache anyone may consult to decide existence.
 * Writing refs at render time is what closes the fail-open, because anything
 * through the pipeline is indexed by construction and anything else is an
 * enumerable gap rather than a silent one.
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

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Media = typeof media.$inferSelect;
export type MediaRef = typeof mediaRefs.$inferSelect;
