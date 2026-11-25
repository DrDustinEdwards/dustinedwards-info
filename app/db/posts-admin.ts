import { and, asc, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { media, postTags, posts, tags } from "./schema";
import { getDb, type DB, isBlogPost } from "./client";
import { carriesTag, indexable, newestFirstOrder, tagsForPosts, withTags } from "./posts";

/** Admin only, so exempt from visibility. The files the media page lists: the library's, not trashed. */
export async function adminNavCounts(env: Env) {
  const mediaRow = await getDb(env)
    .select({ n: count() })
    .from(media)
    .where(isNull(media.trashedAt));
  return { media: Number(mediaRow[0]?.n ?? 0) };
}

export async function listAllPostsForAdmin(env: Env) {
  const [rows, tagRows] = await Promise.all([
    getDb(env)
      .select({
        slug: posts.slug,
        title: posts.title,
        status: posts.status,
        publishAt: posts.publishAt,
        updatedAt: posts.updatedAt,
        featured: posts.featured,
      })
      .from(posts)
      .where(eq(posts.kind, "post"))
      .orderBy(desc(posts.publishAt)),
    listAllPostTagsForAdmin(env),
  ]);
  return withTags(rows, tagRows);
}

/** Corpus for `withRelated`, drafts included: it filters candidates itself. */
export async function listPostCorpusForRelated(env: Env) {
  const rows = await getDb(env)
    .select({
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      publishAt: posts.publishAt,
      // For each neighbor's description in a saved related list; not scored.
      description: posts.description,
    })
    .from(posts)
    .where(and(eq(posts.kind, "post"), isNotNull(posts.sourcePath)));
  const tagRows = await listAllPostTagsForAdmin(env);

  return withTags(rows, tagRows);
}

/** Drafts included: it filters the linking post itself. Carries `html` because a backlink is read out of a rendered body. */
export async function listPostLinkCorpus(env: Env) {
  return getDb(env)
    .select({
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      publishAt: posts.publishAt,
      html: posts.html,
    })
    .from(posts)
    .where(and(eq(posts.kind, "post"), isNotNull(posts.sourcePath)));
}

/** The stored `related` and `backlinks` JSON of every file-sourced post, for the save's neighbor refresh to diff against. */
export async function listPostDerivedLists(env: Env) {
  return getDb(env)
    .select({ slug: posts.slug, related: posts.related, backlinks: posts.backlinks })
    .from(posts)
    .where(and(eq(posts.kind, "post"), isNotNull(posts.sourcePath)));
}

/** Markdown and covers for the citation scan, drafts included: they still block deletion. */
export async function listPostSourcesForCitations(env: Env) {
  return getDb(env)
    .select({
      slug: posts.slug,
      title: posts.title,
      body: posts.body,
      coverImage: posts.coverImage,
    })
    .from(posts)
    .where(eq(posts.kind, "post"));
}

/** All post tags, drafts included, for the related and backlinks corpora; `listBlogTags` hides drafts. */
async function listAllPostTagsForAdmin(env: Env) {
  return getDb(env)
    .select({ slug: posts.slug, tag: tags.slug })
    .from(postTags)
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(posts.kind, "post"))
    .orderBy(asc(tags.slug));
}

/** `id` is for the tag join, stripped after. */
const FEED_COLUMNS = {
  id: posts.id,
  slug: posts.slug,
  title: posts.title,
  description: posts.description,
  publishAt: posts.publishAt,
  updatedAt: posts.updatedAt,
  coverImage: posts.coverImage,
};

type FeedOptions = {
  perPage?: number;
  tag?: string | null;
  series?: string | null;
  /** `part` for a series feed; anything else is newest first. */
  orderBy?: "date" | "part";
  indexedOnly?: boolean;
};

/** The filter and order both feed listings share. Narrowed in the query: slicing afterwards would cap before narrowing. */
function feedScope(db: DB, options: FeedOptions) {
  const clauses = [isBlogPost()];
  if (options.tag) clauses.push(carriesTag(db, options.tag));
  if (options.series) clauses.push(eq(posts.series, options.series));
  if (options.indexedOnly) clauses.push(indexable());
  const order = options.orderBy === "part" ? [asc(posts.part), asc(posts.id)] : newestFirstOrder();
  return { where: and(...clauses), order };
}

/** Attaches each row's tags and strips the `id` the join needed. */
async function withFeedTags<R extends { id: number }>(db: DB, rows: R[]) {
  const tagMap = await tagsForPosts(
    db,
    rows.map((r) => r.id),
  );
  return rows.map(({ id, ...rest }) => ({ ...rest, tags: tagMap.get(id) ?? [] }));
}

/** Visible posts with markdown, newest first; limited in SQL because bodies are heavy. */
export async function listBlogPostsFullText(env: Env, options: FeedOptions = {}) {
  const db = getDb(env);
  const { where, order } = feedScope(db, options);
  const query = db
    .select({ ...FEED_COLUMNS, body: posts.body })
    .from(posts)
    .where(where)
    .orderBy(...order);
  return withFeedTags(db, await (options.perPage ? query.limit(options.perPage) : query));
}

/** Same posts with rendered HTML, for RSS. A sibling, not a union-returning flag. */
export async function listBlogPostsRendered(env: Env, options: FeedOptions = {}) {
  const db = getDb(env);
  const { where, order } = feedScope(db, options);
  const query = db
    .select({ ...FEED_COLUMNS, html: posts.html })
    .from(posts)
    .where(where)
    .orderBy(...order);
  return withFeedTags(db, await (options.perPage ? query.limit(options.perPage) : query));
}

export async function getBlogPostMarkdown(env: Env, slug: string) {
  const rows = await getDb(env)
    .select({ body: posts.body, title: posts.title })
    .from(posts)
    .where(and(eq(posts.slug, slug), isBlogPost()))
    .limit(1);
  return rows[0] ?? null;
}
