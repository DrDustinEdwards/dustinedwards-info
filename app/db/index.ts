import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { POSTS_PER_PAGE } from "../lib/blog-listing.mjs";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";
import { media, postTags, posts, settings, tags, type Media } from "./schema";

export function getDb(env: Env) {
  return drizzle(env.DB, { schema: { ...schema, ...authSchema } });
}

export type DB = ReturnType<typeof getDb>;

/**
 * The single gate for public content. A row is visible only when it is published
 * and its publish_at is either unset or already in the past. Every public read
 * must apply this predicate.
 */
export function publiclyVisible() {
  return and(
    eq(posts.status, "published"),
    or(isNull(posts.publishAt), lte(posts.publishAt, new Date())),
  );
}

export async function listPublicPosts(env: Env) {
  return getDb(env)
    .select()
    .from(posts)
    .where(publiclyVisible())
    .orderBy(desc(posts.publishAt));
}

export async function getPublicPostBySlug(env: Env, slug: string) {
  const rows = await getDb(env)
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), publiclyVisible()))
    .limit(1);
  return rows[0] ?? null;
}

/* Blog ---------------------------------------------------------------------
 *
 * Blog rows are `kind = 'post'` and carry a source_path, since they are
 * generated from content/posts. Every read below composes publiclyVisible(),
 * which is the only place draft and future publish_at are handled.
 */

/** Columns the index and feed need. Deliberately excludes body and html. */
const postCard = {
  slug: posts.slug,
  title: posts.title,
  description: posts.description,
  publishAt: posts.publishAt,
  updatedAt: posts.updatedAt,
  coverImage: posts.coverImage,
  coverAlt: posts.coverAlt,
  readingTimeMinutes: posts.readingTimeMinutes,
  featured: posts.featured,
  series: posts.series,
  part: posts.part,
};

function isBlogPost() {
  return and(eq(posts.kind, "post"), publiclyVisible());
}

/** Tags carried by a set of posts, as a slug-keyed map. */
async function tagsForPosts(db: DB, postIds: number[]) {
  /** @type Map<number, string[]> */
  const bySlug = new Map<number, string[]>();
  if (postIds.length === 0) return bySlug;

  const rows = await db
    .select({ postId: postTags.postId, name: tags.name, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(inArray(postTags.postId, postIds))
    .orderBy(asc(tags.slug));

  for (const row of rows) {
    const list = bySlug.get(row.postId) ?? [];
    list.push(row.slug);
    bySlug.set(row.postId, list);
  }
  return bySlug;
}

/**
 * Paginated blog index, optionally filtered to one tag. Filtering happens here
 * rather than in the component, so the HTML that ships is already the filtered
 * list.
 */
export async function listBlogPosts(
  env: Env,
  options: {
    tag?: string | null;
    year?: string | null;
    page?: number;
    perPage?: number;
  } = {},
) {
  const db = getDb(env);
  const perPage = options.perPage ?? POSTS_PER_PAGE;
  const page = Math.max(1, options.page ?? 1);
  const tag = options.tag?.trim() || null;
  const year = options.year?.trim() || null;

  // Both filters are applied in the query, so the HTML that ships is already
  // narrowed rather than hidden in the browser.
  const clauses = [isBlogPost()];
  if (tag) {
    clauses.push(
      inArray(
        posts.id,
        db
          .select({ id: postTags.postId })
          .from(postTags)
          .innerJoin(tags, eq(tags.id, postTags.tagId))
          .where(eq(tags.slug, tag)),
      ),
    );
  }
  if (year) {
    clauses.push(sql`strftime('%Y', ${posts.publishAt}, 'unixepoch') = ${year}`);
  }
  const where = and(...clauses);

  const [{ total }] = await db.select({ total: count() }).from(posts).where(where);

  const rows = await db
    .select({ ...postCard, id: posts.id })
    .from(posts)
    .where(where)
    .orderBy(desc(posts.publishAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const tagMap = await tagsForPosts(db, rows.map((r) => r.id));

  return {
    posts: rows.map(({ id, ...rest }) => ({ ...rest, tags: tagMap.get(id) ?? [] })),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

/**
 * Publication years with a post count, newest first.
 *
 * Drives the archive route. Computed in SQL rather than by pulling every post
 * and grouping in the loader, so the query cost does not grow with the corpus.
 */
export async function listBlogYears(env: Env) {
  return getDb(env)
    .select({
      year: sql<string>`strftime('%Y', ${posts.publishAt}, 'unixepoch')`.as("year"),
      total: count(),
    })
    .from(posts)
    .where(isBlogPost())
    .groupBy(sql`strftime('%Y', ${posts.publishAt}, 'unixepoch')`)
    .orderBy(desc(sql`strftime('%Y', ${posts.publishAt}, 'unixepoch')`));
}

/** Every part of a series, in order, for the part index on a post. */
export async function listSeriesParts(env: Env, series: string) {
  return getDb(env)
    .select({ slug: posts.slug, title: posts.title, part: posts.part })
    .from(posts)
    .where(and(isBlogPost(), eq(posts.series, series)))
    .orderBy(asc(posts.part));
}

/** Every tag that has at least one publicly visible post, with its count. */
export async function listBlogTags(env: Env) {
  return getDb(env)
    .select({ slug: tags.slug, name: tags.name, total: count(posts.id) })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(isBlogPost())
    .groupBy(tags.slug, tags.name)
    .orderBy(asc(tags.slug));
}

/** One post with its rendered HTML, tags, and neighbours. */
export async function getBlogPost(env: Env, slug: string) {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), isBlogPost()))
    .limit(1);

  const post = rows[0];
  if (!post) return null;

  const tagMap = await tagsForPosts(db, [post.id]);

  // Neighbours are computed under the same visibility gate, so an unpublished
  // post can never be reached through a prev/next link.
  const [previous] = await db
    .select({ slug: posts.slug, title: posts.title })
    .from(posts)
    .where(and(isBlogPost(), lt(posts.publishAt, post.publishAt ?? new Date())))
    .orderBy(desc(posts.publishAt))
    .limit(1);

  const [next] = await db
    .select({ slug: posts.slug, title: posts.title })
    .from(posts)
    .where(and(isBlogPost(), gt(posts.publishAt, post.publishAt ?? new Date())))
    .orderBy(asc(posts.publishAt))
    .limit(1);

  return {
    ...post,
    tags: tagMap.get(post.id) ?? [],
    previous: previous ?? null,
    next: next ?? null,
  };
}

/**
 * Every blog post for the admin list, drafts and future-dated included.
 *
 * The one read in this file that deliberately does NOT apply publiclyVisible().
 * It is reachable only behind the admin middleware, and an editor that could not
 * see drafts would be useless.
 */
export async function listAllPostsForAdmin(env: Env) {
  return getDb(env)
    .select({
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      publishAt: posts.publishAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(eq(posts.kind, "post"))
    .orderBy(desc(posts.publishAt));
}

/**
 * Every post's tags, DRAFTS INCLUDED, for the admin list's tag filter.
 *
 * Deliberately not `listBlogTags`, which filters through `isBlogPost()` and so
 * cannot see a draft's tags. Filtering the admin list by a tag that only drafts
 * carry has to return those drafts, or the filter would quietly disagree with
 * the list it is filtering.
 *
 * Returns one row per (post, tag) pair rather than a grouped string: SQLite's
 * `group_concat` would need raw sql and a delimiter that no tag may contain,
 * and at this corpus size grouping in the loader is clearer and costs nothing.
 */
export async function listAllPostTagsForAdmin(env: Env) {
  return getDb(env)
    .select({ slug: posts.slug, tag: tags.slug })
    .from(postTags)
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(posts.kind, "post"))
    .orderBy(asc(tags.slug));
}

/* ---- media annotations ---------------------------------------------------
 *
 * The table describes the IMAGE. It never stores citations, so nothing here can
 * be consulted to decide whether an object is safe to delete; that answer comes
 * from a live scan through the resolver seam every time.
 */

/** Annotations for a set of keys, as a map the library can index by key. */
export async function mediaRecordsFor(env: Env, keys: string[]) {
  if (keys.length === 0) return new Map<string, Media>();
  const rows = await getDb(env).select().from(media).where(inArray(media.r2Key, keys));
  return new Map(rows.map((row) => [row.r2Key, row]));
}

/**
 * Creates or updates the annotation for one object.
 *
 * Upsert on the key, because the row may not exist: an object uploaded before
 * this table shipped has none until a backfill or an edit creates one, and the
 * editing path should not have to care which case it is in.
 */
export async function upsertMediaRecord(
  env: Env,
  record: {
    r2Key: string;
    alt?: string;
    caption?: string;
    uploaded?: string | null;
    width?: number | null;
    height?: number | null;
  },
) {
  const now = new Date().toISOString();
  await getDb(env)
    .insert(media)
    .values({
      r2Key: record.r2Key,
      alt: record.alt ?? "",
      caption: record.caption ?? "",
      uploaded: record.uploaded ?? null,
      width: record.width ?? null,
      height: record.height ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: media.r2Key,
      set: {
        // Only the fields the caller actually supplied. An alt edit must not
        // blank the dimensions a backfill measured.
        ...(record.alt !== undefined ? { alt: record.alt } : {}),
        ...(record.caption !== undefined ? { caption: record.caption } : {}),
        ...(record.uploaded !== undefined ? { uploaded: record.uploaded } : {}),
        ...(record.width !== undefined ? { width: record.width } : {}),
        ...(record.height !== undefined ? { height: record.height } : {}),
        updatedAt: now,
      },
    });
}

/** Drops the annotation. Called only after the object itself is gone. */
export async function deleteMediaRecord(env: Env, key: string) {
  await getDb(env).delete(media).where(eq(media.r2Key, key));
}

/** Keys that already have a row, so a backfill can skip them. */
export async function existingMediaKeys(env: Env) {
  const rows = await getDb(env).select({ key: media.r2Key }).from(media);
  return new Set(rows.map((row) => row.key));
}

/** Every visible post with its markdown body, newest first, for llms-full.txt. */
export async function listBlogPostsFullText(env: Env) {
  const db = getDb(env);
  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      body: posts.body,
      publishAt: posts.publishAt,
    })
    .from(posts)
    .where(isBlogPost())
    .orderBy(desc(posts.publishAt));

  const tagMap = await tagsForPosts(db, rows.map((r) => r.id));
  return rows.map(({ id, ...rest }) => ({ ...rest, tags: tagMap.get(id) ?? [] }));
}

/** Raw markdown for the .md twin route. */
export async function getBlogPostMarkdown(env: Env, slug: string) {
  const rows = await getDb(env)
    .select({ body: posts.body, title: posts.title })
    .from(posts)
    .where(and(eq(posts.slug, slug), isBlogPost()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSetting(env: Env, key: string) {
  const rows = await getDb(env)
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}
