// The media index in D1: the rows the rebuild and the R2 events keep in step with the buckets, and the store site-api's
// media library (v0.24.0) reads and writes Carrel's and the admin's library through (mediaLibraryStore).
import {
  MediaPlaceholder,
  type MediaLibraryStore,
  type MediaRecord,
  type MediaRecordFields,
  type MediaRevisionRecord,
} from "@dustinedwards/site-api";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { classify, digestFromKey, roleOf } from "../lib/media/classify.mjs";
import { parseTags, serializeTags } from "../lib/media/tags.mjs";
import { media, mediaChanges, mediaRefs, mediaRevisions, type MediaRef } from "./schema";
import { getDb, notTrashed } from "./client";

export async function listMediaRecords(env: Env) {
  return getDb(env).select().from(media);
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
  return (
    getDb(env)
      .select({ role: media.role, n: count() })
      .from(media)
      // Trashed rows are out, so the role chips add up to the grid.
      .where(notTrashed())
      .groupBy(media.role)
  );
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

/** Drops the row once the object is gone, never to make it go: R2 wins. */
export async function deleteMediaRecord(env: Env, key: string) {
  await getDb(env).delete(media).where(eq(media.key, key));
}

export async function mediaRefsFor(env: Env, keys: string[]) {
  if (keys.length === 0) return new Map<string, MediaRef[]>();
  const rows = await getDb(env)
    .select()
    .from(mediaRefs)
    // One JSON parameter, not an IN list: the library asks about every file at once, past D1's bound-parameter cap.
    .where(sql`${mediaRefs.mediaKey} IN (SELECT value FROM json_each(${JSON.stringify(keys)}))`);
  const out = new Map<string, MediaRef[]>(keys.map((key) => [key, []]));
  for (const row of rows) out.get(row.mediaKey)?.push(row);
  return out;
}

// ---------- The media library's store (site-api v0.24.0)

type MediaRow = typeof media.$inferSelect;

/**
 * The library's files are the uploads: rows whose object is in MEDIA. Static assets (repository paths) and the
 * Worker's derived objects in OG (`og/`, `derived/`) share the table and are never the library's.
 */
const isLibraryRow = eq(media.storage, "r2");

/** D1's "YYYY-MM-DD HH:MM:SS" (UTC) or an ISO time, as an ISO time; null for none or one that does not parse. */
function isoOf(value: string | null): string | null {
  if (!value) return null;
  const at = Date.parse(value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2Z"));
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

/** An ISO time in D1's datetime('now') spelling, the one `trashed_at` has always held, so its order stays one order. */
const d1Time = (iso: string) => new Date(iso).toISOString().replace("T", " ").slice(0, 19);

/** The two focal columns as site-runtime's "XxY", or null when either is unset. */
function focusFromColumns(x: number | null, y: number | null): string | null {
  if (x === null || y === null) return null;
  const part = (n: number) => String(Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000);
  return `${part(x)}x${part(y)}`;
}

/** The type a row was stored as; a row from before `mime` was kept takes its key's. */
function typeOf(row: MediaRow): string {
  if (row.mime) return row.mime;
  try {
    return classify(row.key).mime;
  } catch {
    return "application/octet-stream";
  }
}

function recordOf(row: MediaRow): MediaRecord {
  return {
    key: row.key,
    rev: row.rev,
    filename: row.originalName,
    contentType: typeOf(row),
    bytes: row.bytes ?? 0,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    alt: row.alt,
    caption: row.caption,
    tags: parseTags(row.tags),
    focus: focusFromColumns(row.focalX, row.focalY),
    credit: row.credit,
    license: row.license,
    sourceUrl: row.sourceUrl,
    licenseExpires: row.licenseExpires,
    takenAt: row.takenAt,
    // An older LQIP the contract cannot carry (not a small raster data: URI) is no placeholder.
    placeholder:
      row.placeholder && MediaPlaceholder.safeParse(row.placeholder).success
        ? row.placeholder
        : null,
    // The index keeps no main color.
    color: null,
    // A row the rebuild indexed before uploads were timed takes the time it was indexed.
    uploadedAt: isoOf(row.uploadedAt) ?? isoOf(row.createdAt) ?? new Date(0).toISOString(),
    trashedAt: isoOf(row.trashedAt),
  };
}

/** A write's fields as the index's columns. `color`, and the fields this site does not keep, have none. */
function columnsOf(fields: MediaRecordFields) {
  const set: Partial<typeof media.$inferInsert> = {};
  if (fields.filename !== undefined) set.originalName = fields.filename;
  if (fields.contentType !== undefined) set.mime = fields.contentType;
  if (fields.bytes !== undefined) set.bytes = fields.bytes;
  if (fields.width !== undefined) set.width = fields.width;
  if (fields.height !== undefined) set.height = fields.height;
  if (fields.sha256 !== undefined) set.sha256 = fields.sha256;
  if (fields.alt !== undefined) set.alt = fields.alt;
  if (fields.caption !== undefined) set.caption = fields.caption;
  if (fields.tags !== undefined) set.tags = serializeTags(fields.tags);
  if (fields.focus !== undefined) {
    const [x, y] = fields.focus === null ? [null, null] : fields.focus.split("x").map(Number);
    set.focalX = x ?? null;
    set.focalY = y ?? null;
  }
  if (fields.credit !== undefined) set.credit = fields.credit;
  if (fields.license !== undefined) set.license = fields.license;
  if (fields.sourceUrl !== undefined) set.sourceUrl = fields.sourceUrl;
  if (fields.licenseExpires !== undefined) set.licenseExpires = fields.licenseExpires;
  if (fields.takenAt !== undefined) set.takenAt = fields.takenAt;
  if (fields.placeholder !== undefined) set.placeholder = fields.placeholder;
  if (fields.uploadedAt !== undefined) set.uploadedAt = fields.uploadedAt;
  if (fields.trashedAt !== undefined)
    set.trashedAt = fields.trashedAt === null ? null : d1Time(fields.trashedAt);
  return set;
}

function revisionOf(row: typeof mediaRevisions.$inferSelect): MediaRevisionRecord {
  return {
    id: row.id,
    at: isoOf(row.at) ?? row.at,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    reason: row.reason as MediaRevisionRecord["reason"],
    sha256: row.sha256,
    // MEDIA_REVISIONS' key for these bytes: `replaced/<time>/<key>` and `resized/<time>/<key>` before v0.24.0.
    copyKey: row.backupKey,
  };
}

/** Recorded citations still name the file: the delete claim's condition, checked in its own statement. */
const cited = (key: string) =>
  sql`EXISTS (SELECT 1 FROM ${mediaRefs} WHERE ${mediaRefs.mediaKey} = ${key})`;

/** The store site-api's mediaLibrary keeps the site's files in: a mapping onto the `media` table's own columns. */
export function mediaLibraryStore(env: Env): MediaLibraryStore {
  const db = getDb(env);
  const one = async (key: string) => {
    const [row] = await db
      .select()
      .from(media)
      .where(and(eq(media.key, key), isLibraryRow))
      .limit(1);
    return row ? recordOf(row) : null;
  };

  return {
    record: one,

    async records(keys) {
      if (keys.length === 0) return [];
      const rows = await db
        .select()
        .from(media)
        .where(
          and(
            isLibraryRow,
            sql`${media.key} IN (SELECT value FROM json_each(${JSON.stringify(keys)}))`,
          ),
        );
      return rows.map(recordOf);
    },

    async all() {
      return (await db.select().from(media).where(isLibraryRow)).map(recordOf);
    },

    // By the row's own hash; then, for a row written before the hash was kept, by the digest its content-addressed key
    // carries (the first 16 hex of the same SHA-256); then by the bytes a file was uploaded with before a shrink.
    async byHash(sha256) {
      const [current] = await db
        .select()
        .from(media)
        .where(and(eq(media.sha256, sha256), isLibraryRow))
        .orderBy(asc(media.uploadedAt), asc(media.key))
        .limit(1);
      if (current) return recordOf(current);
      const prefix = sha256.slice(0, 16);
      const unhashed = await db
        .select()
        .from(media)
        .where(
          and(isNull(media.sha256), isLibraryRow, sql`instr(${media.key}, ${`-${prefix}`}) > 0`),
        )
        .orderBy(asc(media.uploadedAt), asc(media.key));
      const byKey = unhashed.find((row) => digestFromKey(row.key) === prefix);
      if (byKey) return recordOf(byKey);
      const [original] = await db
        .select({ key: mediaRevisions.mediaKey })
        .from(mediaRevisions)
        .where(
          and(
            eq(mediaRevisions.sha256, sha256),
            inArray(mediaRevisions.reason, ["upload", "import"]),
          ),
        )
        .orderBy(asc(mediaRevisions.id))
        .limit(1);
      return original ? one(original.key) : null;
    },

    async insert(record) {
      const { kind } = classify(record.key);
      await db.insert(media).values({
        ...columnsOf(record),
        key: record.key,
        storage: "r2",
        kind,
        role: roleOf(record.key),
        uploadedAt: record.uploadedAt,
      });
    },

    async writeAtRev(key, fields, expectedRev) {
      const [row] = await db
        .update(media)
        .set({
          ...columnsOf(fields),
          rev: sql`${media.rev} + 1`,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(and(eq(media.key, key), eq(media.rev, expectedRev), isLibraryRow))
        .returning();
      if (row) return { ok: true, record: recordOf(row) };
      const now = await one(key);
      return now ? { ok: false, reason: "stale", rev: now.rev } : { ok: false, reason: "missing" };
    },

    async follow(key, fields) {
      const set = columnsOf(fields);
      const [row] =
        Object.keys(set).length === 0
          ? await db
              .select()
              .from(media)
              .where(and(eq(media.key, key), isLibraryRow))
              .limit(1)
          : await db
              .update(media)
              .set(set)
              .where(and(eq(media.key, key), isLibraryRow))
              .returning();
      if (!row) throw new Error(`${key} changed its bytes, but its row is gone`);
      return recordOf(row);
    },

    async addRevision(key, revision) {
      const [added] = await db
        .insert(mediaRevisions)
        .values({
          mediaKey: key,
          at: revision.at,
          bytes: revision.bytes,
          width: revision.width,
          height: revision.height,
          reason: revision.reason,
          sha256: revision.sha256,
          backupKey: revision.copyKey,
        })
        .returning({ id: mediaRevisions.id });
      if (!added) throw new Error(`${key}'s revision was not recorded`);
      return added.id;
    },

    async revisions(key, limit = 100) {
      const rows = await db
        .select()
        .from(mediaRevisions)
        .where(eq(mediaRevisions.mediaKey, key))
        .orderBy(desc(mediaRevisions.id))
        .limit(limit);
      return rows.map(revisionOf);
    },

    async keepCopy(revisionId, copyKey) {
      await db
        .update(mediaRevisions)
        .set({ backupKey: copyKey })
        .where(eq(mediaRevisions.id, revisionId))
        .run();
    },

    // One batch: the row goes only at the version the reference check saw and while no recorded citation names it,
    // both checked in the delete itself, so a post saved since keeps its file; the revisions go only if the row did.
    async remove(key, rev) {
      if (!(await one(key))) return "missing";
      const [deleted] = await db.batch([
        db
          .delete(media)
          .where(and(eq(media.key, key), eq(media.rev, rev), isLibraryRow, sql`NOT ${cited(key)}`))
          .returning({ key: media.key }),
        db
          .delete(mediaRevisions)
          .where(
            and(
              eq(mediaRevisions.mediaKey, key),
              sql`NOT EXISTS (SELECT 1 FROM ${media} WHERE ${media.key} = ${key})`,
            ),
          ),
      ]);
      if (deleted.length > 0) return "removed";
      const now = await one(key);
      if (!now) return "missing";
      return now.rev === rev ? "in-use" : "stale";
    },

    async changeCursor() {
      const [row] = await db
        .select({ seq: sql<number | null>`max(${mediaChanges.seq})` })
        .from(mediaChanges);
      return Number(row?.seq ?? 0);
    },

    // The triggers log every row but a static one (drizzle/0035_media_library.sql), so the OG bucket's derived keys
    // (classify.mjs storageOf) are left out here, before the limit, or a page of them would read as removals.
    async changedSince(from, head, limit) {
      const latest = sql<number>`max(${mediaChanges.seq})`;
      return db
        .select({ key: mediaChanges.mediaKey, seq: latest })
        .from(mediaChanges)
        .where(
          sql`${mediaChanges.seq} > ${from} AND ${mediaChanges.seq} <= ${head} AND ${mediaChanges.mediaKey} NOT LIKE 'og/%' AND ${mediaChanges.mediaKey} NOT LIKE 'derived/%'`,
        )
        .groupBy(mediaChanges.mediaKey)
        .orderBy(asc(latest))
        .limit(limit + 1);
    },
  };
}
