// Posts, tags, series and the feeds, as read by the site, the admin and the operator.
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { HOME_CARDS, POSTS_PER_PAGE, pageCount, startHere } from "../lib/blog-listing.mjs";
import { seriesSlug } from "../lib/series-path.mjs";
import { timed, type Timings } from "../lib/timing";
import { media, postTags, posts, tags } from "./schema";
import { getDb, type DB, publiclyVisible, isBlogPost, notTrashed } from "./client";

/** Ask's cache replay re-checks visibility here because KV invalidation lags. */
export async function publiclyVisibleSlugs(
  env: Env,
  slugs: string[],
): Promise<Set<string>> {
  if (slugs.length === 0) return new Set();
  const rows = await getDb(env)
    .select({ slug: posts.slug })
    .from(posts)
    .where(and(inArray(posts.slug, slugs), publiclyVisible()));
  return new Set(rows.map((r) => r.slug));
}

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


/**
 * Composes `isBlogPost()` itself and takes only the extra clauses, so no caller can pass a `where`
 * missing the visibility predicate. Years come from SQLite, as in `listBlogYears`, so two
 * conversions cannot disagree across a new year in another time zone.
 */
function listingSpanSelect(db: DB, ...narrowing: (SQL | undefined)[]) {
  return db
    .select({
      total: count(),
      firstYear: sql<string | null>`strftime('%Y', min(${posts.publishAt}), 'unixepoch')`.as(
        "first_year",
      ),
      lastYear: sql<string | null>`strftime('%Y', max(${posts.publishAt}), 'unixepoch')`.as(
        "last_year",
      ),
      minutes: sql<number | null>`sum(${posts.readingTimeMinutes})`.as("minutes"),
    })
    .from(posts)
    .where(and(isBlogPost(), ...narrowing));
}

/** A NULL is not a zero: an empty list has no span, and the row omits itself. */
function spanOf(row: { firstYear: string | null; lastYear: string | null; minutes: number | null } | undefined) {
  return {
    firstYear: row?.firstYear ?? null,
    lastYear: row?.lastYear ?? null,
    minutes: row?.minutes ?? null,
  };
}

/** A subquery, not a join: a join would multiply rows. */
function carriesTag(db: DB, tagSlug: string) {
  return inArray(
    posts.id,
    db
      .select({ id: postTags.postId })
      .from(postTags)
      .innerJoin(tags, eq(tags.id, postTags.tagId))
      .where(eq(tags.slug, tagSlug)),
  );
}

/** One tag by slug, or null when no publicly visible post carries it (the archive 404s). */
export async function getBlogTag(env: Env, tagSlug: string) {
  const rows = await getDb(env)
    .select({ slug: tags.slug, name: tags.name, total: count(posts.id) })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(and(eq(tags.slug, tagSlug), isBlogPost()))
    .groupBy(tags.slug, tags.name)
    .limit(1);
  return rows[0] ?? null;
}

/** Groups each row's value under its key, keeping row order within a group. */
function groupValues<R, K, V>(rows: Iterable<R>, key: (row: R) => K, value: (row: R) => V) {
  const out = new Map<K, V[]>();
  for (const row of rows) {
    const list = out.get(key(row));
    if (list) list.push(value(row));
    else out.set(key(row), [value(row)]);
  }
  return out;
}

async function tagsForPosts(db: DB, postIds: number[]) {
  if (postIds.length === 0) return new Map<number, string[]>();

  const rows = await db
    .select({ postId: postTags.postId, name: tags.name, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(inArray(postTags.postId, postIds))
    .orderBy(asc(tags.slug));

  return groupValues(rows, (row) => row.postId, (row) => row.slug);
}

export async function listBlogPosts(
  env: Env,
  options: {
    tag?: string | null;
    year?: string | null;
    page?: number;
    perPage?: number;
    timings?: Timings;
  } = {},
) {
  const db = getDb(env);
  const perPage = options.perPage ?? POSTS_PER_PAGE;
  const page = Math.max(1, options.page ?? 1);
  const tag = options.tag?.trim() || null;
  const year = options.year?.trim() || null;

  /* The filters stay apart from the visibility predicate because `listingSpanSelect` composes its own. */
  const narrowing: (SQL | undefined)[] = [];
  if (tag) narrowing.push(carriesTag(db, tag));
  if (year) {
    narrowing.push(sql`strftime('%Y', ${posts.publishAt}, 'unixepoch') = ${year}`);
  }
  const where = and(isBlogPost(), ...narrowing);

  // One round trip. The page is a subquery the tag join wraps; joining first would LIMIT
  // joined rows. `id DESC` breaks ties, or posts sharing `publish_at` interleave by tag.
  const pageOfPosts = db
    .select({ ...postCard, id: posts.id })
    .from(posts)
    .where(where)
    .orderBy(desc(posts.publishAt), desc(posts.id))
    .limit(perPage)
    .offset((page - 1) * perPage)
    .as("page_of_posts");

  // Named one by one: drizzle will not select a subquery as a nested object.
  const [statRows, joined] = await timed(options.timings, "d1_batch", () =>
    db.batch([
      listingSpanSelect(db, ...narrowing),
      db
        .select({
          id: pageOfPosts.id,
          slug: pageOfPosts.slug,
          title: pageOfPosts.title,
          description: pageOfPosts.description,
          publishAt: pageOfPosts.publishAt,
          updatedAt: pageOfPosts.updatedAt,
          coverImage: pageOfPosts.coverImage,
          coverAlt: pageOfPosts.coverAlt,
          readingTimeMinutes: pageOfPosts.readingTimeMinutes,
          featured: pageOfPosts.featured,
          series: pageOfPosts.series,
          part: pageOfPosts.part,
          // Aliased: `posts.slug` and `tags.slug` collide in drizzle's by-name row mapping.
          tagSlug: sql<string | null>`${tags.slug}`.as("tag_slug"),
        })
        .from(pageOfPosts)
        // LEFT, so a post with no tags keeps its row.
        .leftJoin(postTags, eq(postTags.postId, pageOfPosts.id))
        .leftJoin(tags, eq(tags.id, postTags.tagId))
        // Both post keys before the tag key, or ties interleave rows of different posts.
        .orderBy(desc(pageOfPosts.publishAt), desc(pageOfPosts.id), asc(tags.slug)),
    ]),
  );

  const stats = statRows[0];
  const total = stats?.total ?? 0;

  // One entry per post; the Map keeps the ORDER BY's post and tag order.
  type Row = (typeof joined)[number];
  const byId = new Map<number, Omit<Row, "tagSlug"> & { tags: string[] }>();
  for (const row of joined) {
    const { tagSlug, ...post } = row;
    let entry = byId.get(post.id);
    if (!entry) {
      entry = { ...post, tags: [] };
      byId.set(post.id, entry);
    }
    if (tagSlug !== null) entry.tags.push(tagSlug);
  }

  return {
    posts: [...byId.values()].map(({ id: _dropped, ...rest }) => rest),
    total,
    page,
    perPage,
    pageCount: pageCount(total, perPage),
    /* The whole filtered list, not this page of it. */
    span: spanOf(stats),
  };
}

/** The featured post leads, then the newest others; with nothing featured the newest leads. */
export async function listHomeStartHere(
  env: Env,
  options: { cards?: number; timings?: Timings } = {},
) {
  const db = getDb(env);
  /** Cards the section renders in total, lead included. */
  const cards = Math.max(1, options.cards ?? HOME_CARDS);

  /* `cards` others, not `cards - 1`: the extra row leads when nothing is featured. */
  const [featuredRows, otherRows, countRows] = await timed(options.timings, "d1_batch", () =>
    db.batch([
      db
        .select(postCard)
        .from(posts)
        .where(and(isBlogPost(), eq(posts.featured, true)))
        .orderBy(desc(posts.publishAt), desc(posts.id))
        .limit(1),
      db
        .select(postCard)
        .from(posts)
        .where(and(isBlogPost(), eq(posts.featured, false)))
        .orderBy(desc(posts.publishAt), desc(posts.id))
        .limit(cards),
      db.select({ total: count() }).from(posts).where(isBlogPost()),
    ]),
  );

  /* Which list leads is `startHere`'s rule, shared with `check:machine-readable`. */
  const { featured, recent } = startHere(featuredRows, otherRows, cards);

  return { featured, recent, total: countRows[0]?.total ?? 0 };
}

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

export async function listSeriesParts(env: Env, series: string) {
  return getDb(env)
    .select({ slug: posts.slug, title: posts.title, part: posts.part })
    .from(posts)
    .where(and(isBlogPost(), eq(posts.series, series)))
    .orderBy(asc(posts.part));
}

export async function listBlogSeries(env: Env) {
  return getDb(env)
    .select({ name: posts.series, total: count(posts.id) })
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
  const tagMap = await tagsForPosts(db, rows.map((r) => r.id));
  return {
    posts: rows.map(({ id, ...rest }) => ({ ...rest, tags: tagMap.get(id) ?? [] })),
    total,
    page,
    pageCount: pageCount(total, perPage),
    span: spanOf(statRows[0]),
  };
}

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

  // Neighbors use the same visibility gate, so prev/next cannot reach a draft. Ordered as the listing
  // is (publish_at, then id), so two posts sharing a publish_at are neighbors rather than skipped.
  const at = post.publishAt ?? new Date();
  const [[previous], [next]] = await Promise.all([
    db
      .select({ slug: posts.slug, title: posts.title })
      .from(posts)
      .where(
        and(
          isBlogPost(),
          or(lt(posts.publishAt, at), and(eq(posts.publishAt, at), lt(posts.id, post.id))),
        ),
      )
      .orderBy(desc(posts.publishAt), desc(posts.id))
      .limit(1),
    db
      .select({ slug: posts.slug, title: posts.title })
      .from(posts)
      .where(
        and(
          isBlogPost(),
          or(gt(posts.publishAt, at), and(eq(posts.publishAt, at), gt(posts.id, post.id))),
        ),
      )
      .orderBy(asc(posts.publishAt), asc(posts.id))
      .limit(1),
  ]);

  return {
    ...post,
    tags: tagMap.get(post.id) ?? [],
    previous: previous ?? null,
    next: next ?? null,
  };
}

/** Exempt from `publiclyVisible()`: matches `status = 'draft'` only, with the slug from a valid preview token. */
export async function getDraftPostForPreview(env: Env, slug: string) {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.kind, "post"), eq(posts.status, "draft")))
    .limit(1);

  const post = rows[0];
  if (!post) return null;

  const tagMap = await tagsForPosts(db, [post.id]);

  // No neighbors: a draft has no place in the visible sequence.
  return {
    ...post,
    tags: tagMap.get(post.id) ?? [],
    previous: null as { slug: string; title: string } | null,
    next: null as { slug: string; title: string } | null,
  };
}

/** Admin only, so exempt from visibility. Media via `notTrashed()` to match the media page. */
export async function adminNavCounts(env: Env) {
  const db = getDb(env);
  const [postRow, mediaRow] = await Promise.all([
    db.select({ n: count() }).from(posts).where(eq(posts.kind, "post")),
    db.select({ n: count() }).from(media).where(notTrashed()),
  ]);
  return { posts: Number(postRow[0]?.n ?? 0), media: Number(mediaRow[0]?.n ?? 0) };
}

export async function listAllPostsForAdmin(env: Env) {
  return getDb(env)
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
    .orderBy(desc(posts.publishAt));
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

  const tagsBySlug = groupValues(tagRows, (row) => row.slug, (row) => row.tag);
  return rows.map((r) => ({ ...r, tags: tagsBySlug.get(r.slug) ?? [] }));
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

/** Operator list_posts projection, drafts included. */
export async function listPostsForOperator(env: Env) {
  const rows = await getDb(env)
    .select({
      slug: posts.slug,
      title: posts.title,
      description: posts.description,
      status: posts.status,
      publishAt: posts.publishAt,
      updatedAt: posts.updatedAt,
      series: posts.series,
      part: posts.part,
      sourcePath: posts.sourcePath,
    })
    .from(posts)
    .where(and(eq(posts.kind, "post"), isNotNull(posts.sourcePath)))
    .orderBy(asc(posts.slug));
  const tagRows = await listAllPostTagsForAdmin(env);

  const tagsBySlug = groupValues(tagRows, (row) => row.slug, (row) => row.tag);
  return rows.map((r) => ({ ...r, tags: tagsBySlug.get(r.slug) ?? [] }));
}

export async function getAdminPostRow(env: Env, slug: string) {
  return (
    (await getDb(env)
      .select({
        html: posts.html,
        readingTimeMinutes: posts.readingTimeMinutes,
      })
      .from(posts)
      .where(and(eq(posts.kind, "post"), eq(posts.slug, slug)))
      .get()) ?? null
  );
}

/** All post tags, drafts included, for the admin filter; `listBlogTags` hides drafts. */
export async function listAllPostTagsForAdmin(env: Env) {
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
};

/** The filter and order both feed listings share. Narrowed in the query: slicing afterwards would cap before narrowing. */
function feedScope(db: DB, options: FeedOptions) {
  const clauses = [isBlogPost()];
  if (options.tag) clauses.push(carriesTag(db, options.tag));
  if (options.series) clauses.push(eq(posts.series, options.series));
  const order =
    options.orderBy === "part" ? [asc(posts.part), asc(posts.id)] : [desc(posts.publishAt)];
  return { where: and(...clauses), order };
}

/** Attaches each row's tags and strips the `id` the join needed. */
async function withFeedTags<R extends { id: number }>(db: DB, rows: R[]) {
  const tagMap = await tagsForPosts(db, rows.map((r) => r.id));
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
