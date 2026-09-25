// The media library's D1 index: listing, counts, trash, tags and the upserts that keep it in step with R2.
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { digestFromKey } from "../lib/media/classify.mjs";
import { exactTagNeedle, parseTags, serialiseTags } from "../lib/media/tags.mjs";
import { LARGE_FILE_BYTES } from "../lib/media/usage.mjs";
import { media, mediaRefs, type MediaRef } from "./schema";
import { getDb, notTrashed } from "./client";

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
