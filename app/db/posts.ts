// Posts, tags, series and the feeds, as read by the site, the admin and the operator.

import { and, asc, count, desc, eq, gt, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";
import {
  HOME_CARDS,
  HOME_PICKS,
  POSTS_PER_PAGE,
  picksFirst,
  startHere,
} from "../lib/blog-listing.mjs";
import { inList } from "@dustinedwards/site-runtime/d1";
import { pageEnvelope } from "capsomer/react/pagination";
import { PUBLISHED_STATUS } from "@drdustinedwards/site-helpers/search";
import { timed } from "@dustinedwards/site-runtime/server-timing";
import { postTags, posts, tags } from "./schema";
import { type Timings } from "../lib/timing";
import { getDb, type DB, publiclyVisible, isBlogPost } from "./client";

/** Ask's cache replay re-checks visibility here because KV invalidation lags. */
export async function publiclyVisibleSlugs(env: Env, slugs: string[]): Promise<Set<string>> {
  if (slugs.length === 0) return new Set();
  const rows = await getDb(env)
    .select({ slug: posts.slug })
    .from(posts)
    .where(and(inList(posts.slug, slugs), publiclyVisible()));
  return new Set(rows.map((r) => r.slug));
}

/**
 * The earliest publish_at still ahead on a published post, or null. Nothing purges when one passes,
 * so the pages that list posts cap their edge lifetime at it.
 */
export async function nextScheduledPublishAt(env: Env): Promise<Date | null> {
  const [row] = await getDb(env)
    .select({ publishAt: posts.publishAt })
    .from(posts)
    .where(
      and(
        eq(posts.kind, "post"),
        eq(posts.status, PUBLISHED_STATUS),
        gt(posts.publishAt, new Date()),
      ),
    )
    .orderBy(asc(posts.publishAt))
    .limit(1);
  return row?.publishAt ?? null;
}

/**
 * The listing order, newest first: publish instant, then a series together with its latest part first, then
 * the later row. app/lib/post-order.mjs states the rule and applies it to the header's build-time list; this is
 * the same rule in SQL, so the /writing listing, the home page, the feeds and the header cannot disagree.
 *
 * `groupKey` is the largest id among the published posts sharing this row's instant and series, or the row's
 * own id when it has no series. It is what keeps a series together and sorts it among its day's other posts.
 */
const groupKey = sql<number>`COALESCE(CASE WHEN "posts"."series" IS NULL THEN NULL ELSE (SELECT MAX(g.id) FROM posts g WHERE g.kind = 'post' AND g.status = ${PUBLISHED_STATUS} AND g.publish_at = "posts"."publish_at" AND g.series = "posts"."series") END, "posts"."id")`;
const partKey = sql<number>`COALESCE(${posts.part}, 0)`;
export const newestFirstOrder = (direction: typeof desc | typeof asc = desc) => [
  direction(posts.publishAt),
  direction(groupKey),
  direction(partKey),
  direction(posts.id),
];

/** Columns the index and feed need. Deliberately excludes body and html. */
export const postCard = {
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
export function listingSpanSelect(db: DB, ...narrowing: (SQL | undefined)[]) {
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
export function spanOf(
  row: { firstYear: string | null; lastYear: string | null; minutes: number | null } | undefined,
) {
  return {
    firstYear: row?.firstYear ?? null,
    lastYear: row?.lastYear ?? null,
    minutes: row?.minutes ?? null,
  };
}

/** A subquery, not a join: a join would multiply rows. */
export function carriesTag(db: DB, tagSlug: string) {
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

/** The year a post was published, as SQL; a new chunk each call, because `.as()` marks the chunk it is called on. */
export const publishYear = <T = unknown>() =>
  sql<T>`strftime('%Y', ${posts.publishAt}, 'unixepoch')`;

/** Each row with its tags, by slug, from the admin's tag rows. */
export function withTags<R extends { slug: string }>(
  rows: R[],
  tagRows: { slug: string; tag: string }[],
) {
  const tagsBySlug = groupValues(
    tagRows,
    (row) => row.slug,
    (row) => row.tag,
  );
  return rows.map((r) => ({ ...r, tags: tagsBySlug.get(r.slug) ?? [] }));
}

export async function tagsForPosts(db: DB, postIds: number[]) {
  if (postIds.length === 0) return new Map<number, string[]>();

  const rows = await db
    .select({ postId: postTags.postId, name: tags.name, slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(inList(postTags.postId, postIds))
    .orderBy(asc(tags.slug));

  return groupValues(
    rows,
    (row) => row.postId,
    (row) => row.slug,
  );
}

/** Leaves out a post marked noindex (site-api's search field), for the sitemap and llms-full.txt. */
export const indexable = () =>
  sql`COALESCE(json_extract(${posts.searchFields}, '$.noindex'), 0) = 0`;

export async function listBlogPosts(
  env: Env,
  options: {
    tag?: string | null;
    year?: string | null;
    indexedOnly?: boolean;
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
  if (options.indexedOnly) narrowing.push(indexable());
  if (year) {
    narrowing.push(sql`${publishYear()} = ${year}`);
  }
  const where = and(isBlogPost(), ...narrowing);

  // One round trip. The page is a subquery the tag join wraps; joining first would LIMIT
  // joined rows. The rest of newestFirstOrder breaks ties, or posts sharing `publish_at` interleave by tag.
  const pageOfPosts = db
    .select({ ...postCard, id: posts.id, groupKey: groupKey.as("group_key") })
    .from(posts)
    .where(where)
    .orderBy(...newestFirstOrder())
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
        // Every post key before the tag key, or ties interleave rows of different posts.
        .orderBy(
          desc(pageOfPosts.publishAt),
          desc(pageOfPosts.groupKey),
          desc(sql`COALESCE(${pageOfPosts.part}, 0)`),
          desc(pageOfPosts.id),
          asc(tags.slug),
        ),
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
    pageCount: pageEnvelope(page, perPage, total).pageCount,
    /* The whole filtered list, not this page of it. */
    span: spanOf(stats),
  };
}

/** The featured post leads, then the hand-picked others, then the newest; with nothing featured the first of those leads. */
export async function listHomeStartHere(
  env: Env,
  options: { cards?: number; timings?: Timings } = {},
) {
  const db = getDb(env);
  /** Cards the section renders in total, lead included. */
  const cards = Math.max(1, options.cards ?? HOME_CARDS);

  /* `cards` others, not `cards - 1`: the extra row leads when nothing is featured. */
  const [featuredRows, pickedRows, newestRows, countRows] = await timed(
    options.timings,
    "d1_batch",
    () =>
      db.batch([
        db
          .select(postCard)
          .from(posts)
          .where(and(isBlogPost(), eq(posts.featured, true)))
          .orderBy(...newestFirstOrder())
          .limit(1),
        db
          .select(postCard)
          .from(posts)
          .where(and(isBlogPost(), eq(posts.featured, false), inArray(posts.slug, HOME_PICKS))),
        db
          .select(postCard)
          .from(posts)
          .where(and(isBlogPost(), eq(posts.featured, false)))
          .orderBy(...newestFirstOrder())
          .limit(cards),
        db.select({ total: count() }).from(posts).where(isBlogPost()),
      ]),
  );

  /* Which list leads is `startHere`'s rule, shared with `check:content`. */
  const otherRows = picksFirst([...pickedRows, ...newestRows]);
  const { featured, recent } = startHere(featuredRows, otherRows, cards);

  return { featured, recent, total: countRows[0]?.total ?? 0 };
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
  return withNeighbors(db, post, tagMap.get(post.id) ?? []);
}

export type PostRow = typeof posts.$inferSelect;

/**
 * The Carrel preview's twin of getBlogPost, for a row built in memory rather than read from D1: the
 * same tags shape and the same neighbors, so the page renders exactly as it would once published.
 */
export async function previewBlogPost(env: Env, post: PostRow, tagSlugs: string[]) {
  return withNeighbors(getDb(env), post, [...tagSlugs].sort());
}

async function withNeighbors(db: DB, post: PostRow, tagSlugs: string[]) {
  // Neighbors use the same visibility gate, so prev/next cannot reach a draft. Ordered as the listing is
  // (newestFirstOrder), so posts sharing a publish_at are neighbors rather than skipped, and the parts of a
  // series follow one another. The slug is excluded so a previewed post, whose row may differ from the stored
  // one, is not its own neighbor.
  const at = post.publishAt ?? new Date();
  // This post's place in the order within its instant: its group key (the newest id of its series that day,
  // else its own id), worked out in the same statement as the neighbors so there is one round trip.
  const ownGroup = post.series
    ? sql`COALESCE((SELECT MAX(g.id) FROM posts g WHERE g.kind = 'post' AND g.status = ${PUBLISHED_STATUS} AND g.publish_at = ${Math.floor(at.getTime() / 1000)} AND g.series = ${post.series}), ${post.id})`
    : sql`${post.id}`;
  const ownPart = post.part ?? 0;
  /** Strictly before (`lt`) or after (`gt`) this post, by the listing's keys in turn. */
  const beyond = (cmp: typeof lt) =>
    or(
      cmp(posts.publishAt, at),
      and(
        eq(posts.publishAt, at),
        or(
          cmp(groupKey, ownGroup),
          and(
            eq(groupKey, ownGroup),
            or(cmp(partKey, ownPart), and(eq(partKey, ownPart), cmp(posts.id, post.id))),
          ),
        ),
      ),
    );
  const [[previous], [next]] = await Promise.all([
    db
      .select({ slug: posts.slug, title: posts.title })
      .from(posts)
      .where(and(isBlogPost(), ne(posts.slug, post.slug), beyond(lt)))
      .orderBy(...newestFirstOrder())
      .limit(1),
    db
      .select({ slug: posts.slug, title: posts.title })
      .from(posts)
      .where(and(isBlogPost(), ne(posts.slug, post.slug), beyond(gt)))
      .orderBy(...newestFirstOrder(asc))
      .limit(1),
  ]);

  return {
    ...post,
    tags: tagSlugs,
    previous: previous ?? null,
    next: next ?? null,
  };
}
