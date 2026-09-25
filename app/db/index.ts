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
  type MediaRef,
} from "./schema";

export function getDb(env: Env) {
  return drizzle(env.DB, { schema: { ...schema, ...authSchema } });
}

type DB = ReturnType<typeof getDb>;

export function publiclyVisible() {
  return and(
    eq(posts.status, PUBLISHED_STATUS),
    or(isNull(posts.publishAt), lte(posts.publishAt, new Date())),
  );
}

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

function isBlogPost() {
  return and(eq(posts.kind, "post"), publiclyVisible());
}

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
    pageCount: Math.max(1, Math.ceil(total / perPage)),
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
    pageCount: Math.max(1, Math.ceil(total / perPage)),
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

  const bySlug = new Map(
    rows.map((r) => [r.slug, { ...r, tags: [] as string[] }]),
  );
  for (const row of tagRows) bySlug.get(row.slug)?.tags.push(row.tag);
  return [...bySlug.values()];
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

  const tagsBySlug = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsBySlug.get(row.slug) ?? [];
    list.push(row.tag);
    tagsBySlug.set(row.slug, list);
  }
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

const LARGE_FILE_BYTES = 1048576;

/** Reconciliation readers must not use this filter, or a rebuild restores trashed rows. */
function notTrashed() {
  return isNull(media.trashedAt);
}

/** ORDER BY for a listing; the caller adds the tie-break. */
function orderFor(options: { sort?: string; dir?: string; trashed?: boolean }) {
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
       * Role rank, then newest: `uploaded_at DESC` alone sorts static rows (no upload event, so NULL)
       * last, burying the only insertable images.
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
    /** An exact tag, already normalized by the caller. */
    tag?: string;
    /** A quality lens: 'unattached' | 'duplicates' | 'no-alt' | 'large'. Else no filter. */
    lens?: string;
    /** Keys repository code references. A parameter: scripts import `app/db` unbundled. */
    templateKeys?: string[];
    /** 'added' | 'name' | 'size' | 'usage'. Anything else falls back to added. */
    sort?: string;
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

  /* As SQL, not a post-filter, so a page is a full page. */
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

  if (options.lens === "unattached") clauses.push(uncited(options.templateKeys));
  if (options.lens === "no-alt") clauses.push(eq(media.alt, ""));
  if (options.lens === "large") clauses.push(sql`${media.bytes} > ${LARGE_FILE_BYTES}`);
  /*
   * Twins are found by the digest inside the key, which SQLite cannot parse, so `mediaTwins` names
   * them; the filter is still SQL, before LIMIT and OFFSET, or a page of twins would come back short
   * or empty. One JSON parameter, not an IN list, so the count never meets D1's bound-parameter cap.
   */
  if (options.lens === "duplicates") {
    const twinKeys = JSON.stringify([...(await mediaTwins(env)).keys()]);
    clauses.push(sql`${media.key} IN (SELECT value FROM json_each(${twinKeys}))`);
  }
  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const db = getDb(env);
  const rows = await db
    .select()
    .from(media)
    .where(where)
    /*
     * The role rank is only the default, never a prefix on an explicit sort. `key ASC` breaks ties,
     * because an unstable sort makes offset pagination skip and repeat rows.
     */
    .orderBy(...orderFor(options), asc(media.key))
    .limit(limit + 1)
    .offset(offset);

  // One extra row answers "is there another page" without a COUNT.
  const hasMore = rows.length > limit;
  return { rows: rows.slice(0, limit), page, hasMore };
}

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
 * Twins by the key's content hash: exact identity only, never perceptual, so any delete decision
 * stays answerable from facts. The hash is read off the content-addressed key, not recomputed from R2.
 * Twins are separate objects at separate URLs, either of which may be cited, so the page offers
 * Trash, not delete. Static rows are excluded: their keys are paths.
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

export async function restoreMediaRecord(env: Env, key: string) {
  const result = await getDb(env)
    .update(media)
    .set({ trashedAt: null, updatedAt: sql`(datetime('now'))` })
    .where(and(eq(media.key, key), isNotNull(media.trashedAt)))
    .run();
  return { restored: (result.meta?.changes ?? 0) > 0 };
}

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
    uploadedAt: record.uploadedAt ?? null,
    updatedAt: now,
  };
  const measured = record.width != null && record.height != null;
  await getDb(env)
    .insert(media)
    .values({
      key: record.key,
      ...derived,
      width: record.width ?? null,
      height: record.height ?? null,
      originalName: record.originalName ?? null,
      placeholder: record.placeholder ?? null,
    })
    .onConflictDoUpdate({
      target: media.key,
      set: {
        ...derived,
        // Written when measured, never blanked by a caller whose Images read failed.
        ...(measured ? { width: record.width, height: record.height } : {}),
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
 * Claims a key for deletion in one statement, so no citation lands between the `NOT EXISTS`
 * check and the removal. False means refuse. Row before object: R2 wins.
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
  const clauses = [isBlogPost()];
  if (options.tag) clauses.push(carriesTag(db, options.tag));
  if (options.series) clauses.push(eq(posts.series, options.series));
  const where = and(...clauses);
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

export async function setSetting(env: Env, key: string, value: string) {
  await getDb(env)
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Statuses the global cap counts, stated once so the cap and the sweep agree. */
const OPEN_WEBMENTION_STATUSES = ["unverified", "pending"] as const;

/** Composes `isBlogPost()` so drafts cannot be probed. Returns a boolean, never the row. */
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
  // An upsert always returns its row; none means the write did not land, and a stand-in id would send
  // the verifier after a row that does not exist.
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error(`receiveWebmention: the upsert for ${fields.sourceUrl} returned no row`);
  }
  return id;
}

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

/** The EXISTS on `posts` keeps an unpublished post's mentions hidden. */
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
  // The slug comes back for the purge.
  const rows = await getDb(env)
    .delete(webmentions)
    .where(eq(webmentions.id, id))
    .returning({ targetSlug: webmentions.targetSlug });
  return rows[0]?.targetSlug ?? null;
}

/** One statement per retention window. Open statuses never expire: the global cap counts them. */
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
