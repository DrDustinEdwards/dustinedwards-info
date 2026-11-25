import { and, asc, count, desc, eq, isNotNull, max, sql } from "drizzle-orm";
import { POSTS_PER_PAGE } from "../lib/blog-listing.mjs";
import { pageEnvelope } from "capsomer/react/pagination";
import { seriesSlug } from "../lib/series-path.mjs";
import { postTags, posts, tags } from "./schema";
import { getDb, isBlogPost } from "./client";
import { listingSpanSelect, postCard, publishYear, spanOf, tagsForPosts } from "./posts";

export async function listBlogYears(env: Env) {
  return getDb(env)
    .select({
      year: publishYear<string>().as("year"),
      total: count(),
    })
    .from(posts)
    .where(isBlogPost())
    .groupBy(publishYear())
    .orderBy(desc(publishYear()));
}

export async function listSeriesParts(env: Env, series: string) {
  return getDb(env)
    .select({ slug: posts.slug, title: posts.title, part: posts.part })
    .from(posts)
    .where(and(isBlogPost(), eq(posts.series, series)))
    .orderBy(asc(posts.part));
}

export async function listBlogSeries(env: Env) {
  return getDb(env)
    .select({ name: posts.series, total: count(posts.id), lastmod: max(posts.updatedAt) })
    .from(posts)
    .where(and(isBlogPost(), isNotNull(posts.series)))
    .groupBy(posts.series)
    .orderBy(asc(posts.series));
}

/** Ambiguous slugs are refused. */
export async function getBlogSeries(env: Env, slug: string) {
  const all = await listBlogSeries(env);
  const matches = all.filter((row) => row.name !== null && seriesSlug(row.name) === slug);
  const row = matches.length === 1 ? matches[0] : undefined;
  if (!row) return null;
  return { name: row.name as string, slug, total: Number(row.total) };
}

/** One series as cards, oldest part first. Separate so post pages skip the tag join. */
export async function listSeriesPosts(
  env: Env,
  series: string,
  options: { page?: number; perPage?: number } = {},
) {
  const db = getDb(env);
  const perPage = options.perPage ?? POSTS_PER_PAGE;
  const page = Math.max(1, options.page ?? 1);
  const where = and(isBlogPost(), eq(posts.series, series));

  const [statRows, rows] = await db.batch([
    /* The same statement the index counts with, so every evidence row uses one arithmetic. */
    listingSpanSelect(db, eq(posts.series, series)),
    db
      .select({ ...postCard, id: posts.id })
      .from(posts)
      .where(where)
      .orderBy(asc(posts.part), asc(posts.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
  ]);

  const total = Number(statRows[0]?.total ?? 0);
  const tagMap = await tagsForPosts(
    db,
    rows.map((r) => r.id),
  );
  return {
    posts: rows.map(({ id, ...rest }) => ({ ...rest, tags: tagMap.get(id) ?? [] })),
    total,
    page,
    pageCount: pageEnvelope(page, perPage, total).pageCount,
    span: spanOf(statRows[0]),
  };
}

export async function listBlogTags(env: Env) {
  return getDb(env)
    .select({
      slug: tags.slug,
      name: tags.name,
      total: count(posts.id),
      lastmod: max(posts.updatedAt),
    })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(isBlogPost())
    .groupBy(tags.slug, tags.name)
    .orderBy(asc(tags.slug));
}

/** For the sitemap's image entries: each public post that renders an image, with its HTML. */
export async function listPostsWithImages(env: Env) {
  return getDb(env)
    .select({ slug: posts.slug, html: posts.html })
    .from(posts)
    .where(and(isBlogPost(), sql`${posts.html} LIKE '%<img%'`));
}
