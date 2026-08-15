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
import { mediaRefKey } from "../lib/media-ref-key.mjs";
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

  const total = countRows[0].total;

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
    posts: [...byId.values()].map(({ id, ...rest }) => rest),
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
 * It is narrower than "unused" and the page says so: `media_refs` records what
 * the PIPELINE emitted, so an asset a route references in code, rather than a
 * post referencing it in markdown, is uncited by this definition and cited by
 * no other one available here.
 */
function uncited() {
  return sql`NOT EXISTS (SELECT 1 FROM ${mediaRefs} WHERE ${mediaRefs.mediaKey} = ${media.key})`;
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
    OR lower(${media.caption}) LIKE ${needle})`;
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
  if (options.insertableOnly) clauses.push(insertable);
  if (options.role) clauses.push(eq(media.role, options.role));
  // NOT EXISTS against media_refs, which is what the PIPELINE recorded. The
  // resolver scan is a second and more conservative opinion and cannot be
  // expressed here, so it still runs per page and the card's own usage line
  // remains the authority. This filter therefore means "nothing the renderer
  // emitted cites it", which is narrower than "unused" and is why the chip
  // carries that wording rather than a bare claim.
  if (options.unusedOnly) clauses.push(uncited());
  // SEARCH IN SQL, and this is the one place the library deliberately diverges
  // from the posts list. That page filters an in-memory array of the whole
  // corpus; this one PAGINATES at 24, so a filter applied after the page was
  // fetched would search one page and report a total for another.
  if (options.q) clauses.push(matchesQuery(options.q));
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
    .orderBy(
      sql`CASE ${media.role} WHEN 'content' THEN 0 WHEN 'generated' THEN 1 WHEN 'brand' THEN 2 ELSE 3 END`,
      desc(media.uploadedAt),
      asc(media.key),
    )
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
    .groupBy(media.role);
}

/**
 * How many rows nothing the renderer emitted cites.
 *
 * The Unused chip was the only one without a number, and that was not a cost
 * decision: the chips take their counts from `mediaRoleCounts`, `unused` is not
 * a role, so the lookup missed and the span was skipped. This is the query that
 * gives it one, and it SHARES `uncited()` with the filter so the count and the
 * page it leads to can never disagree.
 */
export async function mediaUnusedCount(env: Env) {
  const [row] = await getDb(env).select({ n: count() }).from(media).where(uncited());
  return Number(row?.n ?? 0);
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
    placeholder: record.placeholder ?? null,
    uploadedAt: record.uploadedAt ?? null,
    updatedAt: now,
  };
  await getDb(env)
    .insert(media)
    .values({ key: record.key, ...derived, originalName: record.originalName ?? null })
    .onConflictDoUpdate({
      target: media.key,
      set: {
        ...derived,
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

/**
 * Replaces every ref for one source, atomically in intent.
 *
 * DELETE-then-INSERT scoped to the source, rather than an upsert: an edit that
 * REMOVES the last image from a post has to remove the ref too, and an upsert
 * has no way to express a row that should no longer exist. Scoped to the source
 * so re-rendering one post cannot disturb another post's refs.
 */
export async function replaceMediaRefsForSource(
  env: Env,
  sourceType: string,
  sourceId: string,
  refs: Array<{ mediaKey: string; form: string; detail: string | null }>,
) {
  const db = getDb(env);
  await db
    .delete(mediaRefs)
    .where(and(eq(mediaRefs.sourceType, sourceType), eq(mediaRefs.sourceId, sourceId)));
  if (refs.length === 0) return;

  // Deduplicated before insert. The primary key is
  // (media_key, source_type, source_id, form, detail), so a post citing the same
  // image twice on the SAME line in the same form is one row, and inserting it
  // twice would fail the batch rather than being merged.
  const seen = new Set<string>();
  const values = [];
  for (const ref of refs) {
    // Key shape and the collision it prevents: see mediaRefKey.
    const id = mediaRefKey(ref);
    if (seen.has(id)) continue;
    seen.add(id);
    values.push({
      mediaKey: ref.mediaKey,
      sourceType,
      sourceId,
      form: ref.form,
      detail: ref.detail,
    });
  }
  await db.insert(mediaRefs).values(values);
}

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

/** Wipes every ref for a source type. Used before a full re-sync. */
export async function clearMediaRefs(env: Env, sourceType: string) {
  await getDb(env).delete(mediaRefs).where(eq(mediaRefs.sourceType, sourceType));
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
