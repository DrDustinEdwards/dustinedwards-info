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
  const rows = await getDb(env).select().from(media).where(inArray(media.key, keys));
  return new Map(rows.map((row) => [row.key, row]));
}

/** Every row, for reconciliation and for the library listing. */
export async function listMediaRecords(env: Env) {
  return getDb(env).select().from(media);
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
  if (options.unusedOnly) {
    // NOT EXISTS against media_refs, which is what the PIPELINE recorded. The
    // resolver scan is a second and more conservative opinion and cannot be
    // expressed here, so it still runs per page and the card's own usage line
    // remains the authority. This filter therefore means "nothing the renderer
    // emitted cites it", which is narrower than "unused" and is why the chip
    // carries that wording rather than a bare claim.
    clauses.push(
      sql`NOT EXISTS (SELECT 1 FROM ${mediaRefs} WHERE ${mediaRefs.mediaKey} = ${media.key})`,
    );
  }
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
    .values({
      key: record.key,
      ...derived,
      // Only ever set on INSERT. On a rebuild the existing name is kept, because
      // the object no longer carries the filename once keys are content
      // addressed: this column IS the only surviving copy.
      originalName: record.originalName ?? null,
    })
    .onConflictDoUpdate({ target: media.key, set: derived });
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
    const id = `${ref.mediaKey} ${ref.form} ${ref.detail ?? ""}`;
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
