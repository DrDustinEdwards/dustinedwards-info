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
  type SQL,
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

/** Public visibility: published, publish_at unset or past. Every public read applies it. */
export function publiclyVisible() {
  return and(
    eq(posts.status, PUBLISHED_STATUS),
    or(isNull(posts.publishAt), lte(posts.publishAt, new Date())),
  );
}

/** Visible subset of these slugs. Ask's cache replay checks it: KV invalidation lags. */
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

/* Blog readers. Every one composes publiclyVisible(). */

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
 * THE COUNT AND THE THREE FACTS BESIDE IT, as ONE statement over a listing's own narrowing, so the
 * evidence row over a list cannot describe a different list than the rows under it. The index, the
 * tag archive and the series archive all state the same three and take them from here.
 *
 * IT COMPOSES `isBlogPost()` ITSELF and takes only the EXTRA clauses. Written first to take a
 * finished `where` from the caller, which read fine and was wrong twice over: `check:invariants`
 * section 6 could not see a predicate in this body and failed it, correctly, and a future caller
 * could have passed a `where` without one and nothing would have said so. Hard rule 1 is a
 * chokepoint, not a convention, so the predicate belongs where it cannot be left out.
 *
 * The years come from SQLite rather than from a JavaScript date: `publish_at` is epoch seconds,
 * `listBlogYears` already asks for a year exactly this way, and two spellings of one conversion
 * are two answers waiting to disagree across a new year in a different zone.
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

/**
 * The span row as the page reads it. A NULL IS NOT A ZERO: an empty list has no first year and
 * nothing to read, and the row omits itself rather than claiming a span nothing occupies.
 */
function spanOf(row: { firstYear: string | null; lastYear: string | null; minutes: number | null } | undefined) {
  return {
    firstYear: row?.firstYear ?? null,
    lastYear: row?.lastYear ?? null,
    minutes: row?.minutes ?? null,
  };
}

/** One tag predicate so index, archive and feeds agree. A join would multiply rows. */
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

/** Paginated blog index, optionally filtered to one tag, filtered in SQL. */
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

  /* Filtered in the query, so the shipped HTML is already narrowed. The two filter clauses are
     kept apart from the predicate because `listingSpanSelect` composes its own: one narrowing,
     two statements, and neither can be given a where that forgot hard rule 1. */
  const narrowing: (SQL | undefined)[] = [];
  // Via `carriesTag`, shared with the tag archive and its feeds.
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
      /* The count and the evidence row's three facts, over the same narrowing as the rows. */
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

  // COUNT(*) without GROUP BY always returns one row.
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
    // Null for a post with no tags, which is the LEFT JOIN doing its job.
    if (tagSlug !== null) entry.tags.push(tagSlug);
  }

  return {
    posts: [...byId.values()].map(({ id: _dropped, ...rest }) => rest),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    /* THE WHOLE FILTERED LIST, not this page of it: a reader on page 2 of a 36-post archive is
       still reading a 36-post archive. */
    span: spanOf(stats),
  };
}

/**
 * The featured post leads, then the newest others; with nothing featured the newest leads.
 * Unlabelled, so not hard rule 13's substituted value. Hard rule 1: composes `isBlogPost()`.
 */
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

  /* Which list leads is `startHere`'s rule, shared with `check:microformats`. */
  const { featured, recent } = startHere(featuredRows, otherRows, cards);

  return { featured, recent, total: countRows[0]?.total ?? 0 };
}

/** Publication years with a post count, newest first, grouped in SQL. */
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

/** Series with a publicly visible post, and its count, via `isBlogPost()`. */
export async function listBlogSeries(env: Env) {
  return getDb(env)
    .select({ name: posts.series, total: count(posts.id) })
    .from(posts)
    .where(and(isBlogPost(), isNotNull(posts.series)))
    .groupBy(posts.series)
    .orderBy(asc(posts.series));
}

/** Series by URL slug, or null; scans `listBlogSeries`. Ambiguous slugs are refused. */
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
    /* The same statement the index counts with, so the archive's evidence row states the same
       three facts about its own list rather than a second set with its own arithmetic. */
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
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    span: spanOf(statRows[0]),
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

  // Neighbours use the same visibility gate, so prev/next cannot reach a draft.
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
 * One draft by slug for a preview link, else null. Exempt from `publiclyVisible()` in
 * `VISIBILITY_EXEMPT`: matches `status = 'draft'` only, with the slug from a valid token.
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

  // No neighbours: a draft has no place in the visible sequence.
  return {
    ...post,
    tags: tagMap.get(post.id) ?? [],
    previous: null as { slug: string; title: string } | null,
    next: null as { slug: string; title: string } | null,
  };
}

/** All posts for admin, drafts included; exempt from publiclyVisible(), admin only. */
/**
 * Admin nav counts. Query builder so invariants section 6 sees `.from(posts)`; a named
 * visibility exemption, admin only. Media via `notTrashed()` to match the media page.
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
      /* So the admin list shows which post is featured. */
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
      // For each neighbour's description in a saved related list; not scored.
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
 * Corpus for `withBacklinks`, drafts included: it filters the LINKING post itself.
 *
 * It carries `html` because a backlink is read out of a rendered body, which is the same reason
 * `listPostSourcesForCitations` below carries `body`. Admin plane only, on a save.
 */
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

/* Media annotations. No citations stored here; deletion safety comes from a live scan. */

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
 * Unattached: no post or repository code cites it. Shared by the filter and chip count.
 * @param templateKeys keys repository code references, from the build artifact
 */
function uncited(templateKeys: string[] = []) {
  const noPost = sql`NOT EXISTS (SELECT 1 FROM ${mediaRefs} WHERE ${mediaRefs.mediaKey} = ${media.key})`;
  // `NOT IN ()` is a syntax error in SQLite, so an empty list omits the clause.
  if (templateKeys.length === 0) return noPost;
  return sql`${noPost} AND ${media.key} NOT IN ${templateKeys}`;
}

/** Free-text filter. `coalesce`: `lower(NULL) LIKE` is NULL and would drop the row. */
function matchesQuery(q: string) {
  const needle = `%${q.toLowerCase()}%`;
  return sql`(lower(coalesce(${media.originalName}, '')) LIKE ${needle}
    OR lower(${media.key}) LIKE ${needle}
    OR lower(${media.alt}) LIKE ${needle}
    OR lower(${media.caption}) LIKE ${needle}
    OR lower(${media.tags}) LIKE ${needle})`;
}

/** Not trashed. Reconciliation readers must skip it, or `check:media` restores the rows. */
/** Large file threshold, stated once for the lens, its count and its label. */
export const LARGE_FILE_BYTES = 1048576;

export function notTrashed() {
  return isNull(media.trashedAt);
}

/**
 * ORDER BY for a listing, minus the caller's tie-break.
 * @param options the listing options, read for sort, dir and trashed
 */
function orderFor(options: { sort?: string; dir?: string; trashed?: boolean }) {
  // Trash view: most recently trashed first, whatever the sort says.
  if (options.trashed) return [desc(media.trashedAt)];

  const descending = options.dir !== "asc";
  const way = <T extends Parameters<typeof desc>[0]>(column: T) =>
    descending ? desc(column) : asc(column);

  switch (options.sort) {
    case "name":
      // Falls back to the key, or the NULL names would sort as one block.
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
      /*
       * Role rank, then newest. `uploaded_at DESC` alone put every static row last, because a
       * build-time asset has no upload event and SQLite sorts NULL below everything, which
       * buried the only insertable images in the corpus. A CASE in this view rather than a
       * stored sort column: the ordering is a property of the VIEW, and a sort key in the
       * index would be a UI decision stored in the index.
       */
      return [
        sql`CASE ${media.role} WHEN 'content' THEN 0 WHEN 'generated' THEN 1 WHEN 'brand' THEN 2 ELSE 3 END`,
        way(media.uploadedAt),
      ];
  }
}

/** One library page, newest first; `key` keeps offset pagination stable. */
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
    /** A quality lens: 'unattached' | 'duplicates' | 'no-alt' | 'large'. Else no filter. */
    lens?: string;
    /** Keys repository code references. A parameter: scripts import `app/db` unbundled. */
    templateKeys?: string[];
    /** 'added' | 'name' | 'size' | 'usage'. Anything else falls back to added. */
    sort?: string;
    /** 'asc' | 'desc'. */
    dir?: string;
    /** Trashed rows only. A flag, not a `role`: trash is orthogonal to role. */
    trashed?: boolean;
  } = {},
) {
  const limit = options.limit ?? 24;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * limit;

  // `role`, not `storage`: logos, favicons and diagram halves must never be inserted.
  const insertable = and(eq(media.role, "content"), eq(media.kind, "image"));

  /* The library's own filters, as SQL rather than as a post-filter, so a page is
   * a full page and the pagination means what it says. */
  const clauses = [];
  /* A branch, never optional, or trashed assets reappear in the picker. */
  clauses.push(options.trashed ? isNotNull(media.trashedAt) : notTrashed());
  if (options.insertableOnly) clauses.push(insertable);
  if (options.role) clauses.push(eq(media.role, options.role));
  // Pipeline citations only; the card's resolver scan stays the authority.
  if (options.unusedOnly) clauses.push(uncited(options.templateKeys));
  // In SQL because this listing paginates: a post-filter would search one page.
  if (options.q) clauses.push(matchesQuery(options.q));
  /* Needle from `exactTagNeedle`; null means no filter, never a match-all `%,,%`. */
  if (options.tag) {
    const needle = exactTagNeedle(options.tag);
    if (needle) clauses.push(sql`lower(${media.tags}) LIKE ${needle}`);
  }

  /* `duplicates` is not SQL: the route filters it via `mediaTwins`. */
  if (options.lens === "unattached") clauses.push(uncited(options.templateKeys));
  if (options.lens === "no-alt") clauses.push(eq(media.alt, ""));
  if (options.lens === "large") clauses.push(sql`${media.bytes} > ${LARGE_FILE_BYTES}`);
  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const db = getDb(env);
  const rows = await db
    .select()
    .from(media)
    .where(where)
    /*
     * The role rank is the DEFAULT ordering and never a prefix on an explicit sort: a reader
     * who asked for "largest first" wants the largest file, not the largest content file
     * followed by the largest brand file. `key ASC` always breaks the tie, because an
     * unstable sort makes offset pagination skip and repeat rows.
     */
    .orderBy(...orderFor(options), asc(media.key))
    .limit(limit + 1)
    .offset(offset);

  // One extra row answers "is there another page" without a COUNT.
  const hasMore = rows.length > limit;
  return { rows: rows.slice(0, limit), page, hasMore };
}

/** How many rows the index holds, by storage tier. For the rebuild's report. */
export async function mediaCounts(env: Env) {
  const rows = await getDb(env)
    .select({ storage: media.storage, kind: media.kind, n: count() })
    .from(media)
    // Trashed rows are out, so this matches the grid.
    .where(notTrashed())
    .groupBy(media.storage, media.kind);
  return rows;
}

/** By role. Separate from `mediaCounts` so a broken `roleOf()` shows. */
export async function mediaRoleCounts(env: Env) {
  return getDb(env)
    .select({ role: media.role, n: count() })
    .from(media)
    // Trashed rows are out, so the role chips add up to the grid.
    .where(notTrashed())
    .groupBy(media.role);
}


/**
 * Twins by the key's content hash, EXACT IDENTITY ONLY, and that is a boundary rather than a
 * first pass. There is no perceptual comparison, no resize detection, no similarity score, and
 * none is coming: a "these look alike" feature would put a judgement call in front of a delete
 * button, and this library's whole safety argument is that deletion decisions are answerable
 * from facts.
 *
 * The hash is READ OFF THE KEY, never recomputed. Keys are content-addressed, so recomputing
 * would mean reading every object out of R2 to learn what the filename already states.
 *
 * NOT A DUPLICATE-DELETION FEATURE. Two rows sharing bytes are two separate objects at two
 * separate public URLs, either of which may be cited. The page offers to TRASH one, which
 * changes what the library shows and leaves both URLs serving.
 *
 * Static rows are excluded: their keys are paths rather than hashes.
 */
export async function mediaTwins(env: Env) {
  const rows = await getDb(env)
    .select({ key: media.key, originalName: media.originalName, storage: media.storage })
    .from(media)
    .where(and(notTrashed(), sql`${media.storage} <> 'static'`));

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

/** All lens counts in one query, on the filters' own predicates. Caller adds `duplicates`. */
export async function mediaLensCounts(env: Env, templateKeys: string[] = []) {
  const [row] = await getDb(env)
    .select({
      all: count(),
      /* Through `uncited()`, never a copy, so count and filter cannot diverge. */
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

/** Rows in the trash. Not a pseudo-role: trash is orthogonal to role. */
export async function mediaTrashedCount(env: Env) {
  const [row] = await getDb(env)
    .select({ n: count() })
    .from(media)
    .where(isNotNull(media.trashedAt));
  return Number(row?.n ?? 0);
}

/** Trashes an asset; R2 untouched. A repeat keeps the first timestamp. Returns if moved. */
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

/** The only tag writer; `serialiseTags` owns the stored form. */
export async function setMediaTags(env: Env, key: string, input: string[] | string) {
  await getDb(env)
    .update(media)
    .set({ tags: serialiseTags(input), updatedAt: sql`(datetime('now'))` })
    .where(eq(media.key, key))
    .run();
  return parseTags(serialiseTags(input));
}

/** Tag counts, in JS since tags share one delimited column. Trashed rows excluded. */
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

/** One row by key, for the detail view, which a URL can reach from any page. */
export async function mediaRecord(env: Env, key: string) {
  const [row] = await getDb(env).select().from(media).where(eq(media.key, key)).limit(1);
  return row ?? null;
}

/**
 * Writes derived columns only, named, never spread. Never delete-then-insert: alt,
 * caption and focal point are recoverable from nothing.
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
        // Written when present, never blanked by a caller that cannot measure one.
        ...(record.placeholder ? { placeholder: record.placeholder } : {}),
        // Written when present, never blanked by a caller with no name.
        ...(record.originalName ? { originalName: record.originalName } : {}),
      },
    });
}

/** Creates or updates one object's annotation; the row may not exist yet. */
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

/** Drops the row once the object is gone, never to make it go: R2 wins. */
export async function deleteMediaRecord(env: Env, key: string) {
  await getDb(env).delete(media).where(eq(media.key, key));
}

/**
 * Claims a key for deletion in one statement, so no citation lands between the
 * `NOT EXISTS` check and the removal. False means refuse. Row before object: R2 wins.
 * Query builder, so column names come from the schema.
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

/* media_refs: written by the pipeline at render, never by a scan. */

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

/** Columns both feeds carry, owned once. `id` is for the tag join, stripped after. */
const FEED_COLUMNS = {
  id: posts.id,
  slug: posts.slug,
  title: posts.title,
  description: posts.description,
  publishAt: posts.publishAt,
  updatedAt: posts.updatedAt,
  coverImage: posts.coverImage,
};

/** Visible posts with markdown, newest first; limited in SQL because bodies are heavy. */
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
  /* Narrowed in the query: slicing afterwards would cap before narrowing. */
  const clauses = [isBlogPost()];
  if (options.tag) clauses.push(carriesTag(db, options.tag));
  if (options.series) clauses.push(eq(posts.series, options.series));
  const where = and(...clauses);
  /* By part for a series, oldest first; `id` breaks ties. */
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

/** Same posts with rendered HTML, for RSS. A sibling, not a union-returning flag. */
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
  /* Narrowed in the query, as above. */
  const clauses = [isBlogPost()];
  if (options.tag) clauses.push(carriesTag(db, options.tag));
  if (options.series) clauses.push(eq(posts.series, options.series));
  const where = and(...clauses);
  /* Series order, as above. */
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

/* Webmentions. Section 6 does not see this table; `webmentionTarget` applies visibility. */

/** Statuses the global cap counts, stated once so the cap and the sweep agree. */
const OPEN_WEBMENTION_STATUSES = ["unverified", "pending"] as const;

/**
 * Can a stranger mention this slug? Composes `isBlogPost()` so drafts cannot be probed.
 * Returns a boolean, never the row.
 */
export async function webmentionTarget(env: Env, slug: string): Promise<boolean> {
  const rows = await getDb(env)
    .select({ slug: posts.slug })
    .from(posts)
    .where(and(eq(posts.slug, slug), isBlogPost()))
    .limit(1);
  return rows.length > 0;
}

/** Open mentions; the endpoint refuses at the ceiling. */
export async function countOpenWebmentions(env: Env): Promise<number> {
  const rows = await getDb(env)
    .select({ n: count() })
    .from(webmentions)
    .where(inArray(webmentions.status, [...OPEN_WEBMENTION_STATUSES]));
  return rows[0]?.n ?? 0;
}

/**
 * Writes or resets one (source, target) row, clearing any decision; returns its id.
 * `received_at` is set here: the default applies on insert only.
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
  /* Unreachable. Not zero, a valid-looking rowid (hard rule 13's shape). */
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

/** Only a row still `unverified` takes a verdict, so a stale fetch cannot overwrite a reset. */
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
 * Approved mentions, newest first. The EXISTS on `posts` puts this in section 6's scan,
 * so an unpublished post's mentions stay hidden. Hard rule 1 (hard rule 1's second paragraph).
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

/** Every mention, unfiltered, for the admin moderation queue. */
export async function listWebmentionsForAdmin(env: Env) {
  return getDb(env).select().from(webmentions).orderBy(desc(webmentions.receivedAt));
}

/** Decidable: `unverified` has no evidence and `failed` has evidence against. */
const DECIDABLE_WEBMENTION_STATUSES = ["pending", "approved", "rejected"] as const;

/** Approve or reject one mention. Reversible, so decided rows stay decidable. */
export async function decideWebmention(
  env: Env,
  id: number,
  status: "approved" | "rejected",
  now: Date = new Date(),
): Promise<string | null> {
  /* Returns the slug from the write so `purgePost` names the moved row; null purges nothing. */
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

/** Rows the sweep would remove now, on `sweepWebmentions`'s predicates. */
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
 * Retention sweep (windows: webmention/retention.mjs), one statement per window.
 * Open statuses never expire: the global cap counts them.
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
