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
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import * as authSchema from "./auth-schema";
import * as schema from "./schema";
import { postTags, posts, settings, tags } from "./schema";

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
  options: { tag?: string | null; page?: number; perPage?: number } = {},
) {
  const db = getDb(env);
  const perPage = options.perPage ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const tag = options.tag?.trim() || null;

  const where = tag
    ? and(
        isBlogPost(),
        inArray(
          posts.id,
          db
            .select({ id: postTags.postId })
            .from(postTags)
            .innerJoin(tags, eq(tags.id, postTags.tagId))
            .where(eq(tags.slug, tag)),
        ),
      )
    : isBlogPost();

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
