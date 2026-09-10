import { PUBLISHED_STATUS } from "~/lib/search/visibility.mjs";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { HOME_CARDS, POSTS_PER_PAGE, startHere } from "../lib/blog-listing.mjs";
import {
  FAILED_RETENTION_DAYS,
  REJECTED_RETENTION_DAYS,
  daysInMilliseconds,
} from "../lib/webmention/retention.mjs";
import { digestFromKey } from "../lib/media/classify.mjs";
import { exactTagNeedle, parseTags, serialiseTags } from "../lib/media/tags.mjs";
import { seriesSlug } from "../lib/series-path.mjs";
import { timed, type Timings } from "../lib/timing";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";
import {
  media,
  mediaRefs,
  postTags,
  posts,
  settings,
  tags,
  webmentions,
  type Media,
  type MediaRef,
} from "./schema";

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
    eq(posts.status, PUBLISHED_STATUS),
    or(isNull(posts.publishAt), lte(posts.publishAt, new Date())),
  );
}

/**
 * Which of these slugs are still publicly visible, as a Set.
 *
 * One query for the whole list, composing `publiclyVisible()` like every other
 * public read, so there is no second opinion about what "public" means.
 *
 * Exists for finding B010. A cached Ask answer carries its citations, and that
 * cache is invalidated by a KV `list` which is EVENTUALLY CONSISTENT: an answer
 * written moments before a post is unpublished can outlive the invalidation
 * meant to remove it, for as long as the seven day TTL. Replaying it would name
 * and link a post that is no longer public, which is the 2026-07-29 draft leak
 * arriving by a different route. The replay path asks this before it serves.
 */
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

/**
 * THE TAG PREDICATE, stated once.
 *
 * Four readers now ask "which posts carry this tag": the index's `?tag=`
 * filter, the tag archive, and the archive's two feeds. This was written out
 * inside `listBlogPosts` and copying it three times is how the page and its own
 * feed come to disagree about which posts a tag has, which is the failure a
 * reader notices by subscribing and getting a different list.
 *
 * A SUBQUERY on ids rather than a join, deliberately: joining `post_tags` here
 * would multiply rows by tag count and every caller would have to fold them
 * back. The id list is what the callers already paginate and limit against.
 *
 * The slug is matched exactly, against `tags.slug`, which is the normalisation
 * the write path already produced. Nothing here lowercases or re-slugifies: a
 * second normalisation is a second answer to "what is this tag called".
 */
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

/**
 * One tag, by slug, or null when nothing publicly visible carries it.
 *
 * The archive's 404 test. It composes `isBlogPost()` through the same count
 * join `listBlogTags` uses, so "this tag exists" means exactly what the chip
 * list means by it: a tag carried only by drafts or by future-dated posts is
 * absent from both, and the archive for it is a 404 rather than an empty page.
 */
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
    /** Optional collector. Absent means no instrumentation and no cost. */
    timings?: Timings;
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
  // Through `carriesTag`, which the archive and its two feeds also call, so all
  // four agree on which posts a tag has.
  if (tag) clauses.push(carriesTag(db, tag));
  if (year) {
    clauses.push(sql`strftime('%Y', ${posts.publishAt}, 'unixepoch') = ${year}`);
  }
  const where = and(...clauses);

  // ONE ROUND TRIP, not three.
  //
  // This used to be `count`, then `rows`, then `tagsForPosts(rows.map(id))`,
  // strictly serial because the third needed ids the second had not returned
  // yet. Measured on the deployed Worker: 59 + 56 + 55 = 171ms of loader time,
  // of which D1 reported 0.1471ms as actual SQL for the count. The cost was
  // never the queries. It was three round trips to ENAM/ORD.
  //
  // Two changes, in this order:
  //
  //   1. The tag lookup becomes a LEFT JOIN onto the page of posts, removing
  //      the dependency that forced the third trip to wait.
  //   2. What remains, `count` and `rows`, have no dependency on each other, so
  //      `db.batch` sends both as one round trip.
  //
  // **The page is selected in a SUBQUERY and the join wraps it.** Joining first
  // and paginating after would apply LIMIT to JOINED rows, so a post with four
  // tags would consume four of the ten slots and the page would silently hold
  // fewer posts than it claimed. This is the trap that makes a many-to-many
  // LEFT JOIN wrong by default, and the subquery is what avoids it.
  // `id DESC` as an explicit tie-break, and it is load-bearing.
  //
  // Nine of the eleven published posts share a `publish_at` with at least one
  // other: four on 1785369600 and five on 1785196800. `ORDER BY publish_at DESC`
  // alone leaves their relative order UNSPECIFIED. It happened to come back id
  // DESC, and the listing has always been in that order, but by luck rather
  // than by instruction.
  //
  // That luck cannot survive this rewrite. The outer query below orders by tag
  // slug as its last key, so within a tie the rows of several posts INTERLEAVE
  // and the fold ends up ordering posts by their alphabetically-first tag.
  // Measured: the listing came back ordered by first tag rather than by date.
  // Stating the tie-break fixes it and also removes the original reliance on
  // undefined behaviour.
  const pageOfPosts = db
    .select({ ...postCard, id: posts.id })
    .from(posts)
    .where(where)
    .orderBy(desc(posts.publishAt), desc(posts.id))
    .limit(perPage)
    .offset((page - 1) * perPage)
    .as("page_of_posts");

  // Named one by one because drizzle will not select a subquery as a nested
  // object. A column added to `postCard` and forgotten here does not fail
  // silently: the field disappears from the return type and every consumer of
  // it stops typechecking.
  const [countRows, joined] = await timed(options.timings, "d1_batch", () =>
    db.batch([
      db.select({ total: count() }).from(posts).where(where),
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
          // ALIASED, and this is not cosmetic. `posts.slug` and `tags.slug` are
          // both named `slug`; D1 returns one flat row per result and drizzle
          // maps it back by COLUMN NAME, so without a distinct alias the two
          // collide: `slug` silently took the TAG's value and `tagSlug` came
          // back undefined. Every post then linked to `/blog/<a-tag-slug>` and
          // every tag rendered as `?tag=undefined`.
          //
          // The page still returned 200 with ten cards, correct titles, correct
          // dates and the right NUMBER of tag chips. It looked completely
          // normal. Caught only by comparing slugs and tag arrays before and
          // after, which is why that comparison is the gate here and not the
          // render.
          tagSlug: sql<string | null>`${tags.slug}`.as("tag_slug"),
        })
        .from(pageOfPosts)
        // LEFT, so a post carrying no tags keeps its row with a null tag rather
        // than vanishing from the listing. An INNER JOIN here would drop it.
        .leftJoin(postTags, eq(postTags.postId, pageOfPosts.id))
        .leftJoin(tags, eq(tags.id, postTags.tagId))
        // Post order FIRST and completely, then tag order. Both post keys must
        // appear before the tag key or a tie lets tag slugs interleave rows
        // from different posts, which is exactly what happened.
        .orderBy(desc(pageOfPosts.publishAt), desc(pageOfPosts.id), asc(tags.slug)),
    ]),
  );

  // A COUNT(*) with no GROUP BY always returns exactly one row, so the zero
  // is unreachable. It is also the honest answer if the row ever went missing:
  // no rows counted.
  const total = countRows[0]?.total ?? 0;

  // Fold the joined rows back into one entry per post, preserving both orders.
  // A Map keyed by id keeps first-seen post order, which the ORDER BY above
  // already fixed, and tags append in the slug order the same clause fixed.
  type Row = (typeof joined)[number];
  const byId = new Map<number, Omit<Row, "tagSlug"> & { tags: string[] }>();
  for (const row of joined) {
    const { tagSlug, ...post } = row;
    let entry = byId.get(post.id);
    if (!entry) {
      entry = { ...post, tags: [] };
      byId.set(post.id, entry);
    }
    // Null for a post with no tags, which is the LEFT JOIN doing its job.
    if (tagSlug !== null) entry.tags.push(tagSlug);
  }

  return {
    posts: [...byId.values()].map(({ id: _dropped, ...rest }) => rest),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

/**
 * The home page's "Start here": the featured post, then the newest others.
 *
 * ## THE DEFECT THIS REPLACES, measured on production 2026-09-10
 *
 * Home called `listBlogPosts({ perPage: 4 })` and handed the page to
 * `splitFeatured`, which looks for `featured` INSIDE the rows it was given. The
 * only featured post is the flagship, which sorts fifth by `publish_at`, so
 * `featured` came back null and the whole section is behind
 * `{featured ? ... : null}`. The heading, four cards and the "All N posts" link
 * rendered NOTHING on the site's front door, and had done since the home
 * rebuild. A 200 with a correct page is what that looks like from outside.
 *
 * Ruling 57: the lead is FETCHED, not hoped for.
 *
 * ## `posts_featured_idx` ALREADY EXISTED FOR THIS
 *
 * `schema.ts` has carried an index on `(featured, publish_at)` since the column
 * landed, commented "Covers the home page's featured selection". Nothing ever
 * issued the query it covers. This is that query.
 *
 * ## WHAT HAPPENS WITH NO FEATURED POST
 *
 * The section shows the four newest, and the lead is simply the newest. That is
 * ruling 57's own instruction rather than a fallback invented here, and it is
 * not hard rule 13's substituted value: nothing on this page LABELS the lead as
 * featured (unlike `/blog`, which draws a "Featured" chip), so a reader is told
 * only "start here", which the newest post answers honestly. An empty corpus
 * still yields null and the section stays dark, which is the correct dark.
 *
 * ## ONE ROUND TRIP
 *
 * Three statements in one `db.batch`, on `listBlogPosts`'s grounds: none reads
 * what another writes. `total` rides along because home renders it twice, in
 * the proof tile and in the "All N posts" link, and a second call for one
 * integer was the other half of what this replaces.
 *
 * Every statement composes `isBlogPost()`, which composes `publiclyVisible()`.
 * Hard rule 1: a draft cannot lead the front page.
 */
export async function listHomeStartHere(
  env: Env,
  options: { cards?: number; timings?: Timings } = {},
) {
  const db = getDb(env);
  /** Cards the section renders in total, lead included. */
  const cards = Math.max(1, options.cards ?? HOME_CARDS);

  /*
   * `cards` OTHERS, not `cards - 1`, and the extra row is what makes the
   * no-featured case work: it is the one promoted to lead. Asking for exactly
   * three would leave the section a card short on a corpus with nothing
   * featured, which is the state the plant for this ruling exercises.
   */
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

  /*
   * THE DECISION IS `startHere`'s, not this function's. The SQL above supplies
   * the two ordered lists; which of them leads is a rule that `check:microformats`
   * has to reproduce offline with no database, so it lives in a pure module both
   * callers import. See its docblock for the two branches.
   */
  const { featured, recent } = startHere(featuredRows, otherRows, cards);

  return { featured, recent, total: countRows[0]?.total ?? 0 };
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

/**
 * Every series with at least one publicly visible post, with its count.
 *
 * THE TAG LIST'S SHAPE AND THE TAG LIST'S RULE. It composes `isBlogPost()`, so
 * a series carried only by drafts or by future-dated posts is absent here for
 * exactly the reason its archive answers 404 and the sitemap does not list it.
 * That is one predicate serving all three, not three that agree today.
 *
 * `series` is a column on `posts` rather than a table of its own, so this is a
 * GROUP BY where the tag list is a join. The set is tiny by construction: a
 * series is a handful of posts an author wrote on purpose.
 */
export async function listBlogSeries(env: Env) {
  return getDb(env)
    .select({ name: posts.series, total: count(posts.id) })
    .from(posts)
    .where(and(isBlogPost(), isNotNull(posts.series)))
    .groupBy(posts.series)
    .orderBy(asc(posts.series));
}

/**
 * One series, by its URL slug, or null when nothing publicly visible carries it.
 *
 * RESOLVED BY SCANNING THE NAMES, because the slug is derived rather than
 * stored (see `series-path.mjs` for why). `listBlogSeries` is already the
 * visible set, so this inherits the visibility rule instead of restating it,
 * and the scan is over a handful of rows.
 *
 * AMBIGUITY IS REFUSED RATHER THAN GUESSED. Two names can slugify to one slug
 * ("Part One" and "part-one"), and picking either would make the archive show a
 * set the author never grouped. There are no series at all today, so this
 * guards a load of zero; it is here because the alternative is a silent wrong
 * answer the day somebody names a second series carelessly.
 */
export async function getBlogSeries(env: Env, slug: string) {
  const all = await listBlogSeries(env);
  const matches = all.filter((row) => row.name !== null && seriesSlug(row.name) === slug);
  const row = matches.length === 1 ? matches[0] : undefined;
  if (!row) return null;
  return { name: row.name as string, slug, total: Number(row.total) };
}

/**
 * The posts in one series, as CARDS, oldest part first.
 *
 * NOT `listSeriesParts`, and the difference is what each caller pays for.
 * `listSeriesParts` returns three columns for the in-post navigation and is on
 * the hot post path; a card needs the description, the reading time and the
 * TAGS, which is a second query to fold. Widening the lean one would make every
 * post page pay a tag join for an archive's benefit.
 *
 * Ordered by `part` ascending, which is the order the author numbered them and
 * the order a reader reads them. Every other listing on the site is newest
 * first; a series is the one place that is wrong.
 */
export async function listSeriesPosts(
  env: Env,
  series: string,
  options: { page?: number; perPage?: number } = {},
) {
  const db = getDb(env);
  const perPage = options.perPage ?? POSTS_PER_PAGE;
  const page = Math.max(1, options.page ?? 1);
  const where = and(isBlogPost(), eq(posts.series, series));

  const [totalRows, rows] = await db.batch([
    db.select({ n: count() }).from(posts).where(where),
    db
      .select({ ...postCard, id: posts.id })
      .from(posts)
      .where(where)
      .orderBy(asc(posts.part), asc(posts.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
  ]);

  const total = Number(totalRows[0]?.n ?? 0);
  const tagMap = await tagsForPosts(db, rows.map((r) => r.id));
  return {
    posts: rows.map(({ id, ...rest }) => ({ ...rest, tags: tagMap.get(id) ?? [] })),
    total,
    page,
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

/**
 * ONE DRAFT, by slug, for a preview link. Returns null for anything else.
 *
 * **This is the second read in this file that does not compose
 * `publiclyVisible()`, and it is the only one reachable without a session.** It
 * is therefore worth being exact about what it can and cannot hand back.
 *
 * `status = 'draft'` is not the absence of the visibility predicate, it is its
 * COMPLEMENT, narrowed. `publiclyVisible()` is `status = 'published' AND
 * (publish_at IS NULL OR publish_at <= now)`, so a scheduled post satisfies the
 * status half and fails the date half. This reads neither half loosely: a post
 * that is published, or scheduled, or archived, or absent, produces null. There
 * is no argument to this function that returns a row a reader could have got
 * some other way, and no argument that returns a row the author has not
 * explicitly held back.
 *
 * WHY IT IS SAFE TO CALL FROM A PUBLIC ROUTE. Reaching it requires a 32-byte
 * random token that the author minted for this exact slug, that has not been
 * revoked, and that has not expired. The token is checked BEFORE the slug is
 * known, because the slug comes out of the token's record rather than out of the
 * URL: there is no way to ask this function about a post you were not given a
 * link to.
 *
 * The route is `/preview/:token`, its headers carry no public branch, and its
 * 404 is byte-identical to the post route's, so a token that resolves to
 * nothing tells a caller nothing.
 *
 * Named in `VISIBILITY_EXEMPT` in `scripts/check-invariants.mjs` with this
 * reason, which is the only way a reader gets to skip the predicate.
 */
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

  // NO NEIGHBOURS, and that is deliberate rather than an omission. `getBlogPost`
  // computes previous and next under the visibility gate; a draft has no place
  // in that sequence, and a preview offering links onward would invite a
  // reviewer to navigate out of the one page the link was for. Both are null,
  // which is a shape the component already renders every day: it is what the
  // oldest and newest posts carry.
  return {
    ...post,
    tags: tagMap.get(post.id) ?? [],
    previous: null as { slug: string; title: string } | null,
    next: null as { slug: string; title: string } | null,
  };
}

/**
 * Every blog post for the admin list, drafts and future-dated included.
 *
 * One of two reads in this file that deliberately do NOT apply
 * publiclyVisible(). It is reachable only behind the admin middleware, and an
 * editor that could not see drafts would be useless. The other is
 * `getDraftPostForPreview`, which is reachable without a session and pays for
 * that with a much narrower predicate; the sentence here used to say "the one"
 * and went false the moment that landed.
 */
/**
 * THE TWO COUNTS THE ADMIN NAV CAN HONESTLY CARRY.
 *
 * The mockup badged four sections: Sites, Content, Posts and Media. **Two of
 * them no longer exist.**
 *
 * Both were stubs whose numbers were never real. `/admin/sites` rendered a
 * hardcoded array of six placeholder cards, every status "health check not
 * wired", so the only number available was that array's length.
 * `/admin/content` had `count: null` on all three of its sections, rendering
 * as the words "no data", and two of those sections (protocols, CV) described
 * content types this site does not have. Both were deleted rather than
 * finished, because a numeral in the sidebar is read as a measurement and
 * neither had measured anything.
 *
 * Posts and Media are real rows in D1, so they are real numbers.
 *
 * TWO QUERY-BUILDER READS, CONCURRENT, and deliberately NOT one hand-written
 * statement with two scalar subqueries. The single-statement version was
 * written first and was a real defect: invariants section 6 finds posts readers
 * by matching `.from(posts)`, so a count that reached the table from inside a
 * `sql` template was INVISIBLE to the chokepoint that exists to catch a public
 * read losing its visibility predicate. It would have passed the gate by not
 * being seen, which is this repo's most expensive failure class. One round trip
 * was not worth being unobservable; `Promise.all` gets most of it back anyway.
 *
 * NO `publiclyVisible()`, on purpose, and it is a NAMED EXEMPTION in
 * `check-invariants.mjs` for the same reason `listAllPostsForAdmin` is: this
 * badge counts what the admin can edit, so drafts and future-dated rows are the
 * point. It is reached only from the /admin layout, behind Better Auth.
 *
 * MEDIA EXCLUDES THE TRASH, through `notTrashed()` rather than a second spelling
 * of the same predicate, so this number and the one the media page's own head
 * prints cannot drift apart. Two counts of one library disagreeing by the size
 * of the bin is how somebody spends an afternoon looking for missing files.
 */
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
      /*
       * SELECTED SO THE LIST CAN SAY WHICH ROW IS THE HERO.
       *
       * The public index promotes one featured post above the rest, and this
       * list, the only place an author sees the whole corpus, could not see
       * which one that was: the flag was editable nowhere and visible nowhere,
       * so the answer lived in twelve markdown files.
       */
      featured: posts.featured,
    })
    .from(posts)
    .where(eq(posts.kind, "post"))
    .orderBy(desc(posts.publishAt));
}

/**
 * The corpus facts `withRelated` needs, drafts included, tags attached.
 *
 * Feeds `relatedFor` in publish.server.ts: relatedness is a property of the
 * whole corpus and the corpus lives HERE since the committed artifact left the
 * repository. Drafts are included because `withRelated` does its own draft
 * filtering of candidates while still computing a related list FOR a draft,
 * and pre-filtering here would silently change that half.
 */
export async function listPostCorpusForRelated(env: Env) {
  const rows = await getDb(env)
    .select({
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      publishAt: posts.publishAt,
      // Carried so a saved post's related list can hold each neighbour's
      // description, the same field the build's `withRelated` reads. It takes
      // no part in scoring; see the comment at the map in pipeline.mjs.
      description: posts.description,
    })
    .from(posts)
    .where(and(eq(posts.kind, "post"), isNotNull(posts.sourcePath)));
  const tagRows = await listAllPostTagsForAdmin(env);

  const bySlug = new Map(
    rows.map((r) => [r.slug, { ...r, tags: [] as string[] }]),
  );
  for (const row of tagRows) bySlug.get(row.slug)?.tags.push(row.tag);
  return [...bySlug.values()];
}

/**
 * What the media citation scan reads: every post's markdown and cover, drafts
 * included, because a draft citing an image must still refuse its deletion.
 *
 * D1 rather than the repository, since the artifact arc: `posts.body` is the
 * markdown both writers converge to. BOUNDARY, stated: a citation committed
 * from a clone is invisible here until the next sync, save, or content-drift
 * repair lands it, a window the scheduled health check bounds at its poll
 * interval. The committed-artifact read this replaces was ahead of D1 by the
 * same class of window in the other direction.
 */
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

/**
 * The operator list_posts projection: every post row, drafts included, with
 * the fields the tool has always reported.
 */
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

  const tagsBySlug = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsBySlug.get(row.slug) ?? [];
    list.push(row.tag);
    tagsBySlug.set(row.slug, list);
  }
  return rows.map((r) => ({ ...r, tags: tagsBySlug.get(r.slug) ?? [] }));
}

/** One post's rendered facts for the operator get_post response. */
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
  const rows = await getDb(env).select().from(media).where(inArray(media.key, keys));
  return new Map(rows.map((row) => [row.key, row]));
}

/** Every row, for reconciliation and for the library listing. */
export async function listMediaRecords(env: Env) {
  return getDb(env).select().from(media);
}

/**
 * "Nothing the renderer emitted cites this", as ONE predicate with two readers.
 *
 * The filter and the chip's COUNT have to mean the same thing or the library
 * says "3 unused" and lists five. Written once here rather than twice, which is
 * the same rule the picker's `insertable` clause below is written under.
 *
 * **IT USED TO BE NARROWER THAN "UNUSED" AND THAT WAS THE WHOLE PROBLEM.** The
 * old comment here said an asset a route references in code "is uncited by this
 * definition and cited by no other one available", which was true and was the
 * reason nine cohort photographs sat in the Unattached lens while the site
 * served them on every visit.
 *
 * There is now a second definition available. `template-refs.json` is built by
 * scanning `app/` and `workers/` for the literal path, and the keys it names are
 * passed in here, so unattached means what it says: **no post cites it AND no
 * repository code references it.** The scan runs at build time because nothing
 * inside the Worker can read the repository; see `template-refs.mjs`.
 *
 * THE KEYS ARE A PARAMETER RATHER THAN A SECOND QUERY, because this predicate
 * has two readers, the listing and the lens count, and they have to mean the
 * same thing or the chip says three and the grid shows five. Passing one list to
 * both is what keeps that true.
 *
 * @param templateKeys keys repository code references, from the build artifact
 */
function uncited(templateKeys: string[] = []) {
  const noPost = sql`NOT EXISTS (SELECT 1 FROM ${mediaRefs} WHERE ${mediaRefs.mediaKey} = ${media.key})`;
  // An empty list is not "exclude nothing" in SQL: `NOT IN ()` is a syntax
  // error in SQLite, so the clause is omitted rather than emitted empty. That
  // is also the honest behaviour when the artifact is missing: everything falls
  // back to the old two-state answer rather than the query throwing.
  if (templateKeys.length === 0) return noPost;
  return sql`${noPost} AND ${media.key} NOT IN ${templateKeys}`;
}

/**
 * The library's free-text filter, over the four columns a human has words for.
 *
 * `original_name` is what they called the file, `key` is what they pasted into a
 * post, and `alt` and `caption` are the two sentences they wrote. Nothing else
 * on the row is language.
 *
 * `coalesce` on the nullable one, because `lower(NULL) LIKE ...` is NULL rather
 * than false, and a row with no original name would then drop out of an OR that
 * another column satisfies.
 */
function matchesQuery(q: string) {
  const needle = `%${q.toLowerCase()}%`;
  return sql`(lower(coalesce(${media.originalName}, '')) LIKE ${needle}
    OR lower(${media.key}) LIKE ${needle}
    OR lower(${media.alt}) LIKE ${needle}
    OR lower(${media.caption}) LIKE ${needle}
    OR lower(${media.tags}) LIKE ${needle})`;
}

/**
 * NOT IN THE TRASH. The predicate every ordinary library view composes.
 *
 * Written once with two readers, exactly as `uncited()` is and for the same
 * reason: the listing and the counts have to mean the same thing, or the chips
 * say seventy and the grid shows sixty-eight.
 *
 * **Deliberately NOT applied by the reconciliation readers.** `check:media`
 * compares rows against R2 and `public/` in both directions and the object is
 * untouched by trashing, so `listMediaRecords`, `mediaRecordsFor`,
 * `existingMediaKeys` and `mediaRecord` must all keep seeing trashed rows. If
 * they filtered, the gate would see an object with no row and back it straight
 * into the library, which is trash undone by a gate on the next reconcile.
 */
/**
 * What counts as a large file, from the mockup's own `BIG`.
 *
 * One mebibyte. Stated once so the lens, its count and its label cannot
 * disagree about the number, which is the shape the Unused chip failed in.
 */
export const LARGE_FILE_BYTES = 1048576;

export function notTrashed() {
  return isNull(media.trashedAt);
}

/**
 * The ORDER BY for a listing, minus the stable tie-break the caller appends.
 *
 * Extracted so the sort is one expression with one fallback rather than a
 * conditional chain inside the query builder. `usage` orders by the citation
 * count from `media_refs`, computed as a correlated subquery: it is the one
 * sort key that is not a column, and it is the one an author actually asks
 * ("what is nothing using?"), so it is worth the subquery at this row count.
 *
 * @param options the listing options, read for sort, dir and trashed
 */
function orderFor(options: { sort?: string; dir?: string; trashed?: boolean }) {
  // MOST RECENTLY TRASHED FIRST in the Trash view, whatever the sort says. What
  // an author wants back is almost always what they just threw away, and the
  // Display control is about the library rather than about the bin.
  if (options.trashed) return [desc(media.trashedAt)];

  const descending = options.dir !== "asc";
  const way = <T extends Parameters<typeof desc>[0]>(column: T) =>
    descending ? desc(column) : asc(column);

  switch (options.sort) {
    case "name":
      // The NAME a human reads, falling back to the key for a static asset that
      // has none. Ordering by `original_name` alone would sort 58 NULLs into a
      // block, which is not "A to Z" by any reading.
      return [way(sql`lower(coalesce(${media.originalName}, ${media.key}))`)];
    case "size":
      return [way(media.bytes)];
    case "usage":
      return [
        way(
          sql`(SELECT count(*) FROM ${mediaRefs} WHERE ${mediaRefs.mediaKey} = ${media.key})`,
        ),
      ];
    default:
      return [
        sql`CASE ${media.role} WHEN 'content' THEN 0 WHEN 'generated' THEN 1 WHEN 'brand' THEN 2 ELSE 3 END`,
        way(media.uploadedAt),
      ];
  }
}

/**
 * One page of the library, newest first.
 *
 * **This is the query the whole index was ruled in to make possible.** Listing
 * from R2 could only ever paginate in KEY order, and once keys became content
 * addressed that order carried no meaning at all. Sort by date, filter to a
 * kind, count by storage: each is a query, and none of them can be built on a
 * key-ordered iterator without listing the entire bucket per request.
 *
 * `uploaded_at DESC, key ASC`. SQLite sorts NULL below every other value, so a
 * DESC ordering puts the static rows last, which is right: a build-time asset
 * has no upload event and NULL is the honest value for one. `key` breaks the tie
 * so the order within that block is stable rather than whatever the planner
 * returns, because an unstable sort makes offset pagination skip and repeat
 * rows.
 *
 * OFFSET pagination rather than a cursor. The row count here is dozens; offset's
 * cost is a scan the planner does anyway, and it buys a page NUMBER, which is
 * what a library UI wants and what an opaque R2 cursor could never provide.
 */
export async function listMediaPage(
  env: Env,
  options: {
    page?: number;
    limit?: number;
    insertableOnly?: boolean;
    role?: string;
    unusedOnly?: boolean;
    q?: string;
    /** An exact tag, already normalised by the caller. */
    tag?: string;
    /**
     * A QUALITY LENS, which is a question a person actually has, as opposed to
     * `role`, which is the system's own classification.
     *
     * 'unattached' | 'duplicates' | 'no-alt' | 'large'. Anything else is no
     * filter, because a hand-edited URL should show a library.
     */
    lens?: string;
    /**
     * Keys repository code references, from `content/generated/template-refs.json`.
     *
     * A PARAMETER rather than something this module reads for itself, because
     * the artifact is a build-time import and `app/db` is imported by scripts
     * that have no bundler. The loader owns the import and hands the list down,
     * which also means the lens count and the listing are given the SAME list by
     * construction rather than by two reads agreeing.
     */
    templateKeys?: string[];
    /** 'added' | 'name' | 'size' | 'usage'. Anything else falls back to added. */
    sort?: string;
    /** 'asc' | 'desc'. */
    dir?: string;
    /**
     * THE TRASH VIEW. The one caller that wants trashed rows and only those.
     *
     * A separate flag rather than a `role` value, because trash is orthogonal
     * to role: a trashed brand asset is still brand, and folding it into the
     * role chips would make the counts lie about what roles exist.
     */
    trashed?: boolean;
  } = {},
) {
  const limit = options.limit ?? 24;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * limit;

  // THE PICKER FILTER, on `role` rather than on `storage`.
  //
  // The storage-based version was wrong and the error was live: it assumed
  // static+image meant content, and so offered the site logos, every favicon,
  // and BOTH HALVES of every rendered diagram. Picking one half of a diagram
  // pair inserts an image the theme switch cannot swap and bypasses the
  // `:::diagram` directive entirely, which is a broken post rather than noise.
  //
  // `kind='image'` stays alongside it because the two answer different
  // questions: the 31 PDFs are genuinely `role='content'`, they are simply not
  // images and this picker inserts images.
  const insertable = and(eq(media.role, "content"), eq(media.kind, "image"));

  /* The library's own filters, as SQL rather than as a post-filter, so a page is
   * a full page and the pagination means what it says. */
  const clauses = [];
  /*
   * TRASH FIRST, and it is not optional in either direction.
   *
   * Every ordinary view excludes trashed rows and the Trash view includes only
   * those, so this is a branch rather than a conditional push: there is no
   * caller that legitimately wants both, and leaving the unfiltered case
   * reachable is how a trashed asset reappears in the picker.
   */
  clauses.push(options.trashed ? isNotNull(media.trashedAt) : notTrashed());
  if (options.insertableOnly) clauses.push(insertable);
  if (options.role) clauses.push(eq(media.role, options.role));
  // NOT EXISTS against media_refs, which is what the PIPELINE recorded. The
  // resolver scan is a second and more conservative opinion and cannot be
  // expressed here, so it still runs per page and the card's own usage line
  // remains the authority. This filter therefore means "nothing the renderer
  // emitted cites it", which is narrower than "unused" and is why the chip
  // carries that wording rather than a bare claim.
  if (options.unusedOnly) clauses.push(uncited(options.templateKeys));
  // SEARCH IN SQL, and this is the one place the library deliberately diverges
  // from the posts list. That page filters an in-memory array of the whole
  // corpus; this one PAGINATES at 24, so a filter applied after the page was
  // fetched would search one page and report a total for another.
  if (options.q) clauses.push(matchesQuery(options.q));
  /*
   * THE EXACT TAG FILTER, and the needle comes from `exactTagNeedle` rather
   * than being built here.
   *
   * The delimiter wrapping is the whole reason an exact match is possible with
   * LIKE, and a needle assembled at the call site is exactly how the two would
   * drift. A tag that normalises to nothing yields null, and null means NO
   * FILTER rather than a `%,,%` needle, which would match every tagged row.
   */
  if (options.tag) {
    const needle = exactTagNeedle(options.tag);
    if (needle) clauses.push(sql`lower(${media.tags}) LIKE ${needle}`);
  }

  /*
   * THE LENSES. Each is one predicate, and each answers a question somebody
   * asks out loud.
   *
   * `duplicates` is deliberately NOT here: exact content identity is computed
   * from the content-addressed key in JS by `mediaTwins`, not in SQL, so the
   * route filters that lens after the read. Putting a fake SQL predicate here
   * to keep the shape uniform would be a second definition of twin.
   */
  if (options.lens === "unattached") clauses.push(uncited(options.templateKeys));
  if (options.lens === "no-alt") clauses.push(eq(media.alt, ""));
  if (options.lens === "large") clauses.push(sql`${media.bytes} > ${LARGE_FILE_BYTES}`);
  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const db = getDb(env);
  const rows = await db
    .select()
    .from(media)
    .where(where)
    // ROLE FIRST, then newest.
    //
    // `uploaded_at DESC` alone put every static row last, because a build-time
    // asset has no upload event and SQLite sorts NULL below everything. The
    // effect was backwards: the 12 generated cards you can neither insert nor
    // delete came first, and the 9 roster photos, the only insertable images in
    // the corpus, landed on pages 2 and 3.
    //
    // So content sorts first as a rank, and only then by date. A CASE rather
    // than a second column: the ordering is a property of this VIEW, not of the
    // asset, and storing a sort key would be storing a UI decision in the index.
    /*
     * THE SORT, chosen by the reader, with the role rank kept as the DEFAULT
     * rather than as a permanent prefix.
     *
     * The rank exists because `uploaded_at DESC` alone put every static row
     * last (a build-time asset has no upload event and SQLite sorts NULL below
     * everything), which buried the only insertable images on pages two and
     * three. That reasoning applies to the DEFAULT ordering and to nothing
     * else: a reader who asked for "largest first" wants the largest file, not
     * the largest content file followed by the largest brand file.
     *
     * So the rank rides along with `added` and is dropped for every explicit
     * sort. `key ASC` always breaks the tie, because an unstable sort makes
     * offset pagination skip and repeat rows, and that is true of every column
     * here: `bytes` and `uploaded_at` both have duplicates in this corpus.
     */
    .orderBy(...orderFor(options), asc(media.key))
    .limit(limit + 1)
    .offset(offset);

  // One extra row is fetched rather than running a second COUNT query: the only
  // question the UI asks is "is there another page", and a row that exists
  // answers it for the cost of one row.
  const hasMore = rows.length > limit;
  return { rows: rows.slice(0, limit), page, hasMore };
}

/** How many rows the index holds, by storage tier. For the rebuild's report. */
export async function mediaCounts(env: Env) {
  const rows = await getDb(env)
    .select({ storage: media.storage, kind: media.kind, n: count() })
    .from(media)
    // Trashed rows are out, so this number and the grid agree. It is the
    // rebuild's report as well as the library's chips, and the rebuild's
    // question is "what does the library hold", not "how many rows exist".
    .where(notTrashed())
    .groupBy(media.storage, media.kind);
  return rows;
}

/**
 * The same rows, split by role.
 *
 * A SEPARATE query from `mediaCounts` because it answers a separate question.
 * The row count says whether a rebuild ran; this says whether `roleOf()` did
 * anything. Deriving role happens per row, after the row exists, so a rebuild
 * with a broken deriver still produces every row with the column default and the
 * two numbers disagree in a way that is only legible if both are shown.
 */
export async function mediaRoleCounts(env: Env) {
  return getDb(env)
    .select({ role: media.role, n: count() })
    .from(media)
    // Trashed rows are out of every role count, which is what makes the chip
    // numbers add up to what the grid shows. A trashed brand asset is still
    // brand, so without this the Brand chip would count six and list five.
    .where(notTrashed())
    .groupBy(media.role);
}


/**
 * TWINS: rows whose bytes are identical, found by CONTENT HASH ALONE.
 *
 * **EXACT IDENTITY ONLY, and this is a boundary rather than a first pass.** Two
 * rows are twins when the hash embedded in their keys is the same, which means
 * the bytes are the same. There is no perceptual comparison, no resize
 * detection, no similarity score, and none is coming: a "these look alike"
 * feature would put a judgement call in front of a delete button, and the whole
 * safety argument of this library is that deletion decisions are answerable
 * from facts.
 *
 * The hash is READ OFF THE KEY, never recomputed. Keys are content-addressed,
 * so the hash is already there; recomputing would mean reading every object out
 * of R2 to learn something the filename states.
 *
 * WHY THIS IS NOT A DUPLICATE-DELETION FEATURE. Two rows sharing bytes are two
 * separate objects at two separate public URLs, and either may be cited. The
 * page offers to TRASH one, which changes what the library shows and leaves
 * both URLs serving. Anything stronger runs through the ordinary guarded
 * delete, with its refcount refusal intact.
 *
 * Static rows are excluded: their keys are paths rather than hashes, so any
 * grouping over them would be grouping over the wrong string.
 */
export async function mediaTwins(env: Env) {
  const rows = await getDb(env)
    .select({ key: media.key, originalName: media.originalName, storage: media.storage })
    .from(media)
    .where(and(notTrashed(), sql`${media.storage} <> 'static'`));

  // The digest comes from the grammar's one reader in classify.mjs. The local
  // regex this replaces demanded a dot straight after the hex, so a raster key
  // carrying the dimension segment hashed to null and twin detection could not
  // see any uploaded raster.
  const byHash = new Map<string, { key: string; originalName: string | null }[]>();
  for (const row of rows) {
    const hash = digestFromKey(row.key);
    if (!hash) continue;
    const bucket = byHash.get(hash) ?? [];
    bucket.push({ key: row.key, originalName: row.originalName });
    byHash.set(hash, bucket);
  }

  /** key -> the OTHER rows carrying the same bytes. */
  const twins = new Map<string, { key: string; originalName: string | null }[]>();
  for (const bucket of byHash.values()) {
    if (bucket.length < 2) continue;
    for (const row of bucket) {
      twins.set(
        row.key,
        bucket.filter((other) => other.key !== row.key),
      );
    }
  }
  return twins;
}

/**
 * Every lens count, in one query, for the chip row.
 *
 * ONE ROUND TRIP rather than four, and the counts share the predicates the
 * filters use, so a chip and the page it leads to cannot disagree. That
 * agreement is the property the Unused chip lost when its count came from the
 * role histogram while its filter came from `uncited()`.
 *
 * `duplicates` is absent and the caller adds it: twins are computed from the
 * key in JS, and inventing a SQL approximation here would be a second
 * definition of a rule that already has one.
 */
export async function mediaLensCounts(env: Env, templateKeys: string[] = []) {
  const [row] = await getDb(env)
    .select({
      all: count(),
      /*
       * THROUGH `uncited()`, NOT A SECOND COPY OF ITS SQL.
       *
       * This restated the NOT EXISTS inline, which is precisely the shape the
       * predicate's own comment warns about: the chip counted one thing and the
       * filter selected another, and nothing could see them diverge. They did
       * diverge the moment the template scan landed, because widening the
       * predicate would have moved the filter and left the count behind. One
       * call, one definition, both readers.
       */
      unattached: sql<number>`sum(CASE WHEN ${uncited(templateKeys)} THEN 1 ELSE 0 END)`,
      noAlt: sql<number>`sum(CASE WHEN ${media.alt} = '' THEN 1 ELSE 0 END)`,
      large: sql<number>`sum(CASE WHEN ${media.bytes} > ${LARGE_FILE_BYTES} THEN 1 ELSE 0 END)`,
    })
    .from(media)
    .where(notTrashed());
  return {
    all: Number(row?.all ?? 0),
    unattached: Number(row?.unattached ?? 0),
    noAlt: Number(row?.noAlt ?? 0),
    large: Number(row?.large ?? 0),
  };
}

/**
 * How many rows are in the trash. The Trash lens needs a number of its own.
 *
 * Deliberately NOT `mediaRoleCounts` with a `trashed` pseudo-role. Trash is
 * orthogonal to role, and inventing a role for it would make the role counts
 * describe something that is not a role.
 */
export async function mediaTrashedCount(env: Env) {
  const [row] = await getDb(env)
    .select({ n: count() })
    .from(media)
    .where(isNotNull(media.trashedAt));
  return Number(row?.n ?? 0);
}

/**
 * Moves an asset into the library's trash. R2 IS NOT TOUCHED.
 *
 * The object, its public URL and every published page citing it are unaffected;
 * this changes what the library shows and nothing else. Grounds are on the
 * column in `drizzle/0011_media_trash_tags.sql`.
 *
 * IDEMPOTENT BY GUARD rather than by overwrite: trashing an already-trashed row
 * leaves the ORIGINAL timestamp alone, because "when did this go in the trash"
 * must not be reset by a second click on a stale page. Returns whether a row
 * moved, so a bulk caller can report per key.
 */
export async function trashMediaRecord(env: Env, key: string) {
  const result = await getDb(env)
    .update(media)
    .set({ trashedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
    .where(and(eq(media.key, key), notTrashed()))
    .run();
  return { moved: (result.meta?.changes ?? 0) > 0 };
}

/** Puts it back. Clears the flag; nothing else about the row changes. */
export async function restoreMediaRecord(env: Env, key: string) {
  const result = await getDb(env)
    .update(media)
    .set({ trashedAt: null, updatedAt: sql`(datetime('now'))` })
    .where(and(eq(media.key, key), isNotNull(media.trashedAt)))
    .run();
  return { restored: (result.meta?.changes ?? 0) > 0 };
}

/** Every key currently in the trash, for Empty trash to iterate. */
export async function trashedMediaKeys(env: Env) {
  const rows = await getDb(env)
    .select({ key: media.key })
    .from(media)
    .where(isNotNull(media.trashedAt))
    .orderBy(desc(media.trashedAt), asc(media.key));
  return rows.map((r) => r.key);
}

/**
 * Writes an asset's tags. The ONLY writer, so the storage form has one author.
 *
 * The caller hands over whatever the human typed; `serialiseTags` decides what
 * is stored. Passing a raw string through to the column here would be the
 * defect the delimiter rule exists to prevent, so this function does not accept
 * a pre-serialised value and there is no variant that does.
 */
export async function setMediaTags(env: Env, key: string, input: string[] | string) {
  await getDb(env)
    .update(media)
    .set({ tags: serialiseTags(input), updatedAt: sql`(datetime('now'))` })
    .where(eq(media.key, key))
    .run();
  return parseTags(serialiseTags(input));
}

/**
 * Every tag in use, with a count, for the filter chips.
 *
 * Assembled in JS rather than in SQL, and the reason is the storage form: the
 * tags live in one delimited column, so counting them in SQLite would mean a
 * recursive CTE splitting a string. At seventy rows reading the column and
 * counting here is clearer and costs nothing measurable. Trashed rows are
 * excluded, so a tag that only trashed assets carry does not offer a chip that
 * leads to an empty grid.
 */
export async function mediaTagCounts(env: Env) {
  const rows = await getDb(env)
    .select({ tags: media.tags })
    .from(media)
    .where(notTrashed());
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of parseTags(row.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, n]) => ({ tag, n }))
    .sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}

/**
 * One row by key, for the detail view.
 *
 * A separate read rather than a search through the current page: the detail
 * view is reachable by URL, so the row it names may be on any page or on none,
 * and finding it in `objects` would make a bookmarked link work only from the
 * page it was copied on.
 */
export async function mediaRecord(env: Env, key: string) {
  const [row] = await getDb(env).select().from(media).where(eq(media.key, key)).limit(1);
  return row ?? null;
}

/**
 * Writes the DERIVED half of a row and leaves the AUTHORED half alone.
 *
 * This is the whole reason a rebuild is not `DELETE` then `INSERT`. Hash, mime,
 * bytes, dimensions and the placeholder are recomputable from the object; alt,
 * caption, focal_x and focal_y are recoverable from NOTHING, and are the only
 * media data in this system that can be permanently lost. A rebuild that
 * reinserted rows would silently destroy every alt text on the site, and would
 * look exactly like a successful rebuild while doing it.
 *
 * So the conflict clause names the derived columns EXPLICITLY and never spreads
 * the caller's object. A column added later is then absent from this list and
 * simply not updated, which is the safe failure; spreading would have made the
 * unsafe direction the default.
 *
 * TWO OF THE DERIVED COLUMNS ARE WRITE-WHEN-PRESENT rather than write-always,
 * `original_name` and `placeholder`, and each earned it the same way: a caller
 * that could not measure the value was blanking one a caller that could had
 * already stored. Recomputable does not mean cheap to recompute, and "leave it
 * alone" is the only answer that is right for both callers.
 */
export async function upsertDerivedMedia(
  env: Env,
  record: {
    key: string;
    storage: string;
    kind: string;
    role: string;
    mime?: string | null;
    bytes?: number | null;
    width?: number | null;
    height?: number | null;
    originalName?: string | null;
    placeholder?: string | null;
    uploadedAt?: string | null;
  },
) {
  const now = new Date().toISOString();
  const derived = {
    storage: record.storage,
    kind: record.kind,
    role: record.role,
    mime: record.mime ?? null,
    bytes: record.bytes ?? null,
    width: record.width ?? null,
    height: record.height ?? null,
    uploadedAt: record.uploadedAt ?? null,
    updatedAt: now,
  };
  await getDb(env)
    .insert(media)
    .values({
      key: record.key,
      ...derived,
      originalName: record.originalName ?? null,
      placeholder: record.placeholder ?? null,
    })
    .onConflictDoUpdate({
      target: media.key,
      set: {
        ...derived,
        // WRITTEN WHEN THERE IS ONE, NEVER BLANKED. Same rule as the filename
        // below, and it was found the same way.
        //
        // The queue consumer upserts on every R2 event and passed no
        // placeholder, so `?? null` wrote NULL over whatever the last rebuild
        // had derived: an upload erased its own placeholder moments after the
        // bulk pass computed one, and the only way back was another bulk pass.
        // The consumer now derives one itself, which makes the common case
        // correct, and this makes the CLASS correct: any caller that cannot
        // measure a placeholder leaves the stored one alone rather than
        // destroying it.
        //
        // The cost, taken knowingly: a placeholder cannot be CLEARED through
        // this door. Nothing wants to. It is recomputable from the object, an
        // object is content-addressed and immutable, and a static file that
        // changes shape keeps a stale placeholder only until the next rebuild
        // overwrites it with a real one.
        ...(record.placeholder ? { placeholder: record.placeholder } : {}),
        // WRITTEN WHEN THERE IS ONE, NEVER BLANKED.
        //
        // The comment here used to say this column was the only surviving copy
        // of the filename and so must only ever be set on INSERT. That was true
        // and it was the bug: the queue consumer inserts from an R2 event, and
        // if it won the race it inserted NULL and nothing could ever fill it,
        // because a content-addressed key carries no name and the upload
        // route's D1 write is deliberately non-fatal.
        //
        // The name now rides in the object's custom metadata, so callers that
        // read the object can supply it and this can safely update. Callers
        // that cannot (a static asset has no metadata) pass null, and null
        // means LEAVE IT ALONE rather than erase, which is what keeps a name
        // already recorded from being lost by a later pass that did not see one.
        ...(record.originalName ? { originalName: record.originalName } : {}),
      },
    });
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
    key: string;
    alt?: string;
    caption?: string;
    storage?: string;
    kind?: string;
    role?: string;
    mime?: string | null;
    bytes?: number | null;
    originalName?: string | null;
    uploadedAt?: string | null;
    width?: number | null;
    height?: number | null;
  },
) {
  const now = new Date().toISOString();
  await getDb(env)
    .insert(media)
    .values({
      key: record.key,
      alt: record.alt ?? "",
      caption: record.caption ?? "",
      storage: record.storage ?? "r2",
      kind: record.kind ?? "image",
      role: record.role ?? "content",
      mime: record.mime ?? null,
      bytes: record.bytes ?? null,
      originalName: record.originalName ?? null,
      uploadedAt: record.uploadedAt ?? null,
      width: record.width ?? null,
      height: record.height ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: media.key,
      set: {
        // Only the fields the caller actually supplied. An alt edit must not
        // blank the dimensions a backfill measured.
        ...(record.alt !== undefined ? { alt: record.alt } : {}),
        ...(record.caption !== undefined ? { caption: record.caption } : {}),
        ...(record.storage !== undefined ? { storage: record.storage } : {}),
        ...(record.kind !== undefined ? { kind: record.kind } : {}),
        ...(record.role !== undefined ? { role: record.role } : {}),
        ...(record.mime !== undefined ? { mime: record.mime } : {}),
        ...(record.bytes !== undefined ? { bytes: record.bytes } : {}),
        ...(record.originalName !== undefined ? { originalName: record.originalName } : {}),
        ...(record.uploadedAt !== undefined ? { uploadedAt: record.uploadedAt } : {}),
        ...(record.width !== undefined ? { width: record.width } : {}),
        ...(record.height !== undefined ? { height: record.height } : {}),
        updatedAt: now,
      },
    });
}

/**
 * Drops the row.
 *
 * Called when the OBJECT is already gone, never as a way of making it go. The
 * conflict rule runs one way only: R2 wins, so a row is deleted because an
 * object is absent, and an object is never deleted because a row is.
 */
export async function deleteMediaRecord(env: Env, key: string) {
  await getDb(env).delete(media).where(eq(media.key, key));
}

/**
 * Claims a media key for deletion, atomically, and says whether it won.
 *
 * Finding B009: the delete action read the citations, found none, and then
 * deleted the blob. Between those two steps a concurrent save can insert a
 * `media_refs` row, and the object is removed anyway, leaving the post that
 * just cited it rendering a broken image.
 *
 * This makes the decisive step ONE statement, so the "is it still unreferenced"
 * test and the row removal cannot be separated by anything: D1 executes a
 * single statement atomically, and `NOT EXISTS` is evaluated inside it. A
 * return of false means either the key was already gone or something cited it,
 * and the caller must refuse either way.
 *
 * Deleting the ROW is what claims the key, and it deliberately runs BEFORE the
 * object. The module's conflict rule is that R2 wins, so the failure mode of
 * stopping here is a surviving object with no row, which the next rebuild
 * backfills; the reverse order would leave a row pointing at nothing, which is
 * the direction `check:media` treats as the error.
 *
 * **Built through the query builder, so every table and column name comes from
 * the schema rather than from a string.** The first version of this was raw SQL
 * and named the primary key `r2_key`, which is what `0007_media.sql` creates and
 * NOT what the table has: `0009_media_index.sql` renames it to `key`, because
 * the column stopped holding only R2 keys once static assets were indexed in
 * place. The statement was therefore guaranteed to throw on the one path it
 * exists to protect, and nothing caught it, because no gate and no typecheck
 * reads a SQL string. Reading the migration that CREATES a table is not reading
 * the schema; the migration that last touched it is what counts, and
 * `app/db/schema.ts` is what both agree on.
 *
 * `RETURNING` rather than a rowcount so the outcome is a row this code can see,
 * which does not depend on how a driver reports `changes`.
 */
export async function claimMediaKeyForDelete(env: Env, key: string) {
  const claimed = await getDb(env)
    .delete(media)
    .where(
      and(
        eq(media.key, key),
        sql`NOT EXISTS (SELECT 1 FROM ${mediaRefs} WHERE ${mediaRefs.mediaKey} = ${key})`,
      ),
    )
    .returning({ key: media.key });
  return claimed.length > 0;
}

/** Keys that already have a row, so a backfill can skip them. */
export async function existingMediaKeys(env: Env) {
  const rows = await getDb(env).select({ key: media.key }).from(media);
  return new Set(rows.map((row) => row.key));
}

/* ---- media_refs: who cites what --------------------------------------------
 *
 * Written by the PIPELINE at render time, never by a scan. That is what closes
 * the fail-open: a content type whose resolver was never registered used to
 * return no citations, `resolveCitations` reported complete, and the library
 * showed "Unused" beside a working Delete button. Absence is not failure.
 * Anything that goes through the renderer is indexed by construction.
 */

/** Every ref for a set of keys, for the refcount and for a refusal message. */
export async function mediaRefsFor(env: Env, keys: string[]) {
  if (keys.length === 0) return new Map<string, MediaRef[]>();
  const rows = await getDb(env)
    .select()
    .from(mediaRefs)
    .where(inArray(mediaRefs.mediaKey, keys));
  const out = new Map<string, MediaRef[]>(keys.map((key) => [key, []]));
  for (const row of rows) out.get(row.mediaKey)?.push(row);
  return out;
}

/**
 * The columns both feeds carry, minus the body.
 *
 * ONE OWNER, because the two feeds differ in exactly one column and a second
 * hand-kept list is how they start differing in more. The id rides along for
 * the tag join and is stripped before either feed sees a row.
 */
const FEED_COLUMNS = {
  id: posts.id,
  slug: posts.slug,
  title: posts.title,
  description: posts.description,
  publishAt: posts.publishAt,
  updatedAt: posts.updatedAt,
  coverImage: posts.coverImage,
};

/**
 * Every visible post with its markdown body, newest first.
 *
 * Two readers: llms-full.txt takes the whole corpus, and the JSON feed takes
 * the newest `perPage`. The limit is applied IN THE QUERY, not by slicing a
 * full read, because the body column is the heavy one and a feed of 20 must
 * not pay for a corpus of hundreds.
 *
 * The card columns (description, updatedAt, coverImage) ride along for the
 * feed. llms-full.txt ignores them, which costs three narrow columns on a read
 * that already carries every body.
 *
 */
export async function listBlogPostsFullText(
  env: Env,
  options: {
    perPage?: number;
    tag?: string | null;
    series?: string | null;
    /** `part` for a series feed; anything else is newest first. */
    orderBy?: "date" | "part";
  } = {},
) {
  const db = getDb(env);
  /*
   * `tag` and `series` NARROW THE SAME QUERY rather than filtering a full read
   * afterwards. An archive's feed must be that archive's list, and slicing
   * after the fact would cap at `perPage` BEFORE narrowing, so a tag or series
   * whose posts sit outside the newest twenty would feed empty while its page
   * showed them.
   */
  const clauses = [isBlogPost()];
  if (options.tag) clauses.push(carriesTag(db, options.tag));
  if (options.series) clauses.push(eq(posts.series, options.series));
  const where = and(...clauses);
  /*
   * BY PART FOR A SERIES, which is the one ordering on this site that is not
   * newest first. A series is numbered by its author and read from part one, so
   * its feed hands a subscriber part one first; every other feed is a blog and
   * is reverse chronological. `id` breaks a tie so two parts sharing a number
   * cannot come back in an order the database chose.
   */
  const order =
    options.orderBy === "part" ? [asc(posts.part), asc(posts.id)] : [desc(posts.publishAt)];
  const query = db
    .select({ ...FEED_COLUMNS, body: posts.body })
    .from(posts)
    .where(where)
    .orderBy(...order);
  const rows = await (options.perPage ? query.limit(options.perPage) : query);

  const tagMap = await tagsForPosts(db, rows.map((r) => r.id));
  return rows.map(({ id, ...rest }) => ({ ...rest, tags: tagMap.get(id) ?? [] }));
}

/**
 * The same posts with the RENDERED body instead of the markdown one, for RSS.
 *
 * A SIBLING RATHER THAN A FLAG, and the reason is the return type. A single
 * function selecting `html` conditionally returns a union, so every caller has
 * to narrow a column it explicitly asked for, and the compiler cannot tell the
 * one that asked from the one that did not. Two functions over one shared
 * column set and one shared predicate say the same thing without that.
 *
 * NOT one function selecting both, either. `llms-full.txt` reads the WHOLE
 * corpus through `listBlogPostsFullText` and ignores `html`; carrying it would
 * put a second full copy of every post on that read to serve nobody.
 *
 * Composes `isBlogPost()`, so the feed is visible on exactly the terms the
 * index is.
 */
export async function listBlogPostsRendered(
  env: Env,
  options: {
    perPage?: number;
    tag?: string | null;
    series?: string | null;
    /** `part` for a series feed; anything else is newest first. */
    orderBy?: "date" | "part";
  } = {},
) {
  const db = getDb(env);
  /*
   * `tag` and `series` NARROW THE SAME QUERY rather than filtering a full read
   * afterwards. An archive's feed must be that archive's list, and slicing
   * after the fact would cap at `perPage` BEFORE narrowing, so a tag or series
   * whose posts sit outside the newest twenty would feed empty while its page
   * showed them.
   */
  const clauses = [isBlogPost()];
  if (options.tag) clauses.push(carriesTag(db, options.tag));
  if (options.series) clauses.push(eq(posts.series, options.series));
  const where = and(...clauses);
  /*
   * BY PART FOR A SERIES, which is the one ordering on this site that is not
   * newest first. A series is numbered by its author and read from part one, so
   * its feed hands a subscriber part one first; every other feed is a blog and
   * is reverse chronological. `id` breaks a tie so two parts sharing a number
   * cannot come back in an order the database chose.
   */
  const order =
    options.orderBy === "part" ? [asc(posts.part), asc(posts.id)] : [desc(posts.publishAt)];
  const query = db
    .select({ ...FEED_COLUMNS, html: posts.html })
    .from(posts)
    .where(where)
    .orderBy(...order);
  const rows = await (options.perPage ? query.limit(options.perPage) : query);

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

/* Webmentions ---------------------------------------------------------------
 *
 * The received-mention queue, item H1. These sit in the chokepoint file with
 * every other reader for one reason: it is where a person looks to find out
 * what this site asks its database. Section 6 of `check:invariants` polices
 * `posts` readers and knows nothing about this table, so nothing here is
 * enforced by that gate; the placement is a convention and the visibility rule
 * is enforced somewhere else, at the one place it applies. `webmentionTarget`
 * below is that place, and it composes `publiclyVisible()` through
 * `isBlogPost()`.
 */

/**
 * The statuses the global cap counts: a mention that is still open.
 *
 * Stated once and read by both the counter and the retention sweep, because
 * "open" is a claim about which states are unfinished, and two spellings of it
 * would let the cap and the sweep disagree about what they are bounding.
 */
const OPEN_WEBMENTION_STATUSES = ["unverified", "pending"] as const;

/**
 * Does this slug name a post a stranger is allowed to mention?
 *
 * COMPOSES `publiclyVisible()` through `isBlogPost()`, which is the whole point
 * of the function existing rather than the route reading `posts` itself. Hard
 * rule 1's chokepoint is this file, and a draft or scheduled post must not be a
 * valid webmention target: accepting one would let a sender confirm that an
 * unpublished slug exists by watching which answer they got.
 *
 * Returns a BOOLEAN and never the row, so nothing about the post can escape
 * through the endpoint's answer even by accident.
 */
export async function webmentionTarget(env: Env, slug: string): Promise<boolean> {
  const rows = await getDb(env)
    .select({ slug: posts.slug })
    .from(posts)
    .where(and(eq(posts.slug, slug), isBlogPost()))
    .limit(1);
  return rows.length > 0;
}

/**
 * How many mentions are still open. The FOURTH bound, measured rather than
 * assumed: the endpoint refuses at the ceiling instead of trusting that the
 * other three bounds add up to one.
 */
export async function countOpenWebmentions(env: Env): Promise<number> {
  const rows = await getDb(env)
    .select({ n: count() })
    .from(webmentions)
    .where(inArray(webmentions.status, [...OPEN_WEBMENTION_STATUSES]));
  return rows[0]?.n ?? 0;
}

/**
 * Write or reset the row for one (source, target). Returns its id.
 *
 * A RE-SENT MENTION RESETS RATHER THAN DUPLICATING, which is the third bound.
 * The decision fields go back to null with it: a sender who edits their page
 * after a rejection is making a new claim, and leaving `decided_at` in place
 * would show the admin a rejected row whose evidence had changed underneath the
 * decision.
 *
 * `received_at` is stamped explicitly on the update arm because the column
 * default only applies to an insert, and a mention re-sent a year later is
 * received now.
 */
export async function receiveWebmention(
  env: Env,
  fields: { sourceUrl: string; targetSlug: string; now?: Date },
): Promise<number> {
  const now = fields.now ?? new Date();
  const rows = await getDb(env)
    .insert(webmentions)
    .values({
      sourceUrl: fields.sourceUrl,
      targetSlug: fields.targetSlug,
      status: "unverified",
      receivedAt: now,
    })
    .onConflictDoUpdate({
      target: [webmentions.sourceUrl, webmentions.targetSlug],
      set: {
        status: "unverified",
        receivedAt: now,
        verifiedAt: null,
        decidedAt: null,
        failureReason: null,
        authorName: null,
        authorUrl: null,
        excerpt: null,
      },
    })
    .returning({ id: webmentions.id });
  /*
   * The upsert always writes exactly one row, so the fallback is unreachable.
   * ZERO IS NOT SUBSTITUTED: it would be a valid-looking rowid naming nothing,
   * which is hard rule 13's shape. A negative id cannot be a rowid, so a caller
   * that ever received one would fail on its next statement rather than quietly
   * updating the wrong row.
   */
  return rows[0]?.id ?? -1;
}

/** What verification concluded about one row. */
export type WebmentionVerdict =
  | {
      status: "pending";
      authorName: string | null;
      authorUrl: string | null;
      excerpt: string | null;
    }
  | { status: "failed"; failureReason: string };

/**
 * Record what the verifier found.
 *
 * SCOPED TO A ROW STILL IN `unverified`. Verification runs in `waitUntil`, so a
 * second POST for the same (source, target) can reset the row while the first
 * fetch is in flight; without this clause the older fetch's verdict would land
 * on the newer row, and the newer fetch would then write on top of a state it
 * never observed. The write that loses is the stale one, which is the correct
 * direction.
 */
export async function recordWebmentionVerdict(
  env: Env,
  id: number,
  verdict: WebmentionVerdict,
  now: Date = new Date(),
): Promise<void> {
  const shared = { verifiedAt: now, decidedAt: null };
  const set =
    verdict.status === "pending"
      ? {
          ...shared,
          status: "pending" as const,
          failureReason: null,
          authorName: verdict.authorName,
          authorUrl: verdict.authorUrl,
          excerpt: verdict.excerpt,
        }
      : {
          ...shared,
          status: "failed" as const,
          failureReason: verdict.failureReason,
        };
  await getDb(env)
    .update(webmentions)
    .set(set)
    .where(and(eq(webmentions.id, id), eq(webmentions.status, "unverified")));
}

/**
 * The APPROVED mentions for one post, for the public render. Item H2.
 *
 * ## IT COMPOSES `publiclyVisible()` EVEN THOUGH NOTHING MADE IT
 *
 * The caller resolves the post through `getBlogPost` first, which composes the
 * predicate, and 404s before reaching this. So the slug handed in is already a
 * publicly visible post's, and a positional argument like that is a real
 * guarantee for exactly as long as the two calls stay in that order.
 *
 * That is the whole problem with it. Hard rule 1 is not "a draft's mentions are
 * unreachable today", it is that every public object derived from a post goes
 * through the predicate, and `check:invariants` sections 6 and 8 were both
 * checked before this was written: section 6 scans for `.from(<posts binding>)`
 * and section 8 knows only `search_docs`, so a read of `webmentions` alone is
 * invisible to both. Neither gate asked for anything.
 *
 * The EXISTS clause below is what makes them ask. It puts a `.from(posts)` in
 * this function, which brings it inside section 6's scan, and section 6 then
 * requires the predicate here forever. A positional guarantee became a gated
 * one for the price of a subquery, which is the trade hard rule 1's second
 * paragraph is describing.
 *
 * **It is not redundant even today.** A row can name a draft: `/admin/mentions`
 * cannot create one, but nothing stops a hand-written row, and H1's endpoint
 * refuses a draft target only at the moment of receipt. A post unpublished
 * AFTER its mentions were approved is the ordinary case, and without this
 * clause the only thing standing between those rows and a reader would be the
 * route's own 404.
 *
 * Ordered by `decided_at` descending: the newest judgement first, which is the
 * order the admin made them in and the order a reader meets them.
 */
export async function approvedMentionsFor(env: Env, slug: string) {
  const db = getDb(env);
  return db
    .select({
      id: webmentions.id,
      sourceUrl: webmentions.sourceUrl,
      authorName: webmentions.authorName,
      authorUrl: webmentions.authorUrl,
      excerpt: webmentions.excerpt,
      decidedAt: webmentions.decidedAt,
    })
    .from(webmentions)
    .where(
      and(
        eq(webmentions.targetSlug, slug),
        eq(webmentions.status, "approved"),
        exists(
          db
            .select({ visible: posts.id })
            .from(posts)
            .where(and(eq(posts.slug, slug), publiclyVisible())),
        ),
      ),
    )
    .orderBy(desc(webmentions.decidedAt));
}

/**
 * Every mention, for the moderation queue.
 *
 * UNFILTERED, and that is what the page is for: an admin moderating a queue has
 * to see what is in it, failures included. Reached only from `/admin/mentions`,
 * behind the admin layout's middleware.
 *
 * Ordered newest first WITHIN a status; the page does the grouping, because the
 * order the four groups are shown in is a presentation decision and SQLite has
 * no ordering over the status values that would express it.
 */
export async function listWebmentionsForAdmin(env: Env) {
  return getDb(env).select().from(webmentions).orderBy(desc(webmentions.receivedAt));
}

/**
 * The statuses a decision may be made from: a mention whose evidence has been
 * checked. `unverified` has no evidence yet and `failed` has evidence against
 * it, so neither is a thing to approve, and a `where` clause says so rather
 * than the page's button layout saying it.
 */
const DECIDABLE_WEBMENTION_STATUSES = ["pending", "approved", "rejected"] as const;

/**
 * Approve or reject one mention.
 *
 * A DECISION IS REVERSIBLE, which is why `approved` and `rejected` are in the
 * decidable set alongside `pending` rather than only `pending` being there. An
 * approve that could not be undone by a reject would be a one-way door on a
 * page whose whole job is judging strangers' claims, and `check:destructive`
 * would be right to call it destructive. It is not: no column is removed, the
 * row keeps its evidence, and the inverse button is on the same row.
 */
export async function decideWebmention(
  env: Env,
  id: number,
  status: "approved" | "rejected",
  now: Date = new Date(),
): Promise<string | null> {
  /*
   * IT RETURNS THE TARGET SLUG, and that is for the cache purge rather than for
   * the caller's convenience. The page that changed is that post's, and
   * `purgePost` needs to name it. Returning it from the write is the only way
   * to be sure the purge names the row the write actually moved: a separate
   * read could answer about a row this statement's `where` refused.
   *
   * NULL when nothing was updated, which is the unverified and failed cases the
   * clause exists to refuse. A null purges nothing, correctly.
   */
  const rows = await getDb(env)
    .update(webmentions)
    .set({ status, decidedAt: now })
    .where(
      and(
        eq(webmentions.id, id),
        inArray(webmentions.status, [...DECIDABLE_WEBMENTION_STATUSES]),
      ),
    )
    .returning({ targetSlug: webmentions.targetSlug });
  return rows[0]?.targetSlug ?? null;
}

/**
 * How many rows the sweep WOULD remove right now, by window.
 *
 * Exists so the confirmation step can state the quantity at stake instead of
 * asking an operator to authorise an unknown number. Same predicates as
 * `sweepWebmentions`, which is the property that makes the number honest; a
 * count computed a different way would be a second answer to the same question.
 */
export async function countExpiringWebmentions(
  env: Env,
  now: Date = new Date(),
): Promise<{ failed: number; rejected: number }> {
  const db = getDb(env);
  const failedBefore = new Date(now.getTime() - daysInMilliseconds(FAILED_RETENTION_DAYS));
  const rejectedBefore = new Date(now.getTime() - daysInMilliseconds(REJECTED_RETENTION_DAYS));
  const [failed, rejected] = await Promise.all([
    db
      .select({ n: count() })
      .from(webmentions)
      .where(and(eq(webmentions.status, "failed"), lt(webmentions.receivedAt, failedBefore))),
    db
      .select({ n: count() })
      .from(webmentions)
      .where(and(eq(webmentions.status, "rejected"), lt(webmentions.receivedAt, rejectedBefore))),
  ]);
  return { failed: failed[0]?.n ?? 0, rejected: rejected[0]?.n ?? 0 };
}

/** Remove one mention outright. The only delete an admin makes by hand. */
export async function deleteWebmention(env: Env, id: number): Promise<string | null> {
  // The slug comes back for the purge, on the same grounds as decideWebmention.
  const rows = await getDb(env)
    .delete(webmentions)
    .where(eq(webmentions.id, id))
    .returning({ targetSlug: webmentions.targetSlug });
  return rows[0]?.targetSlug ?? null;
}

/**
 * The retention sweep. Grounds for both windows: app/lib/webmention/retention.mjs.
 *
 * TWO STATEMENTS RATHER THAN ONE WITH AN `OR`, because the two windows are
 * different lengths and a single predicate would have to carry both cutoffs
 * anyway. Two also lets the caller report which window removed what, which is
 * the only part the admin can act on.
 *
 * `unverified` and `pending` are untouched at any age, deliberately: they are
 * exactly what the global cap counts, so expiring them would quietly raise the
 * cap.
 */
export async function sweepWebmentions(
  env: Env,
  now: Date = new Date(),
): Promise<{ failed: number; rejected: number }> {
  const db = getDb(env);
  const failedBefore = new Date(now.getTime() - daysInMilliseconds(FAILED_RETENTION_DAYS));
  const rejectedBefore = new Date(now.getTime() - daysInMilliseconds(REJECTED_RETENTION_DAYS));

  const failed = await db
    .delete(webmentions)
    .where(and(eq(webmentions.status, "failed"), lt(webmentions.receivedAt, failedBefore)))
    .returning({ id: webmentions.id });
  const rejected = await db
    .delete(webmentions)
    .where(and(eq(webmentions.status, "rejected"), lt(webmentions.receivedAt, rejectedBefore)))
    .returning({ id: webmentions.id });

  return { failed: failed.length, rejected: rejected.length };
}
