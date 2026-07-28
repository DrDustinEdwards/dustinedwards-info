import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
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

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type Setting = typeof settings.$inferSelect;
