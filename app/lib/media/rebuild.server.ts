import assetManifest from "../../../content/generated/assets.json";

import { deleteMediaRecord, listMediaRecords, upsertDerivedMedia } from "~/db";
import { bucketFor, classify, isRaster, roleOf, storageOf } from "./classify.mjs";
import { placeholderFor } from "./core.server";

/**
 * Re-derives the media index from the things that are actually true.
 *
 * THE RULE THIS MODULE EXISTS TO OBEY: hash, mime, bytes, dimensions and the placeholder are
 * RECOMPUTABLE from the object. `alt`, `caption`, `focal_x` and `focal_y` are AUTHORED and
 * recoverable from NOTHING. So a rebuild re-derives the first set and preserves the second, which is
 * why it walks through `upsertDerivedMedia` and never through a delete-then-insert.
 *
 * THE CONFLICT RULE, ONE DIRECTION ONLY: R2 WINS. A row whose object has disappeared is deleted, an
 * object with no row is indexed, and an object is never deleted because a row said so. This module
 * has no code path that could: it imports no delete and takes no bucket-write of any kind.
 *
 * BOTH SOURCES ARE ENUMERATED EXHAUSTIVELY BEFORE ANYTHING IS WRITTEN, because a partial listing
 * would make every absent key look like a deletion.
 */

export type RebuildReport = {
  scannedObjects: number;
  scannedFiles: number;
  indexed: number;
  removed: number;
  /** Keys that could not be derived. Reported, never silently skipped. */
  failures: string[];
};

/** Intrinsic dimensions, read from the bytes rather than trusted from anywhere. */
async function dimensionsFor(env: Env, body: ReadableStream) {
  try {
    const info = await env.IMAGES.info(body);
    // `info` is a union: an SVG reports no pixel dimensions because it has none.
    // Recording 0 would be a measurement; recording nothing is the truth.
    if ("width" in info && "height" in info) return { width: info.width, height: info.height };
    return null;
  } catch {
    return null;
  }
}

/** One object as both the rebuild and the reconciliation see it. */
export type MediaSource = { key: string; size: number; uploaded: string };

/**
 * EVERY ASSET THAT ACTUALLY EXISTS: both buckets, plus the static manifest.
 *
 * Extracted so the rebuild and the reconciliation CANNOT disagree about what the sources are. Two
 * enumerations of the same thing are two answers to "what exists", and the one used to grade the
 * other would be the one nobody checked. Rule 18: the bucket and the repository are the SOURCES, the
 * index is the projection, and this function is that sentence in code.
 *
 * EXHAUSTIVE, TO THE END OF THE CURSOR. A partial listing makes every absent key look like a
 * deletion, so a truncated page with no cursor throws rather than being mistaken for the whole
 * bucket.
 *
 * Two buckets, split on LIFECYCLE: MEDIA is irreplaceable, OG holds cards a command can regenerate.
 * Both are indexed, because an asset that existed and appeared nowhere is the invisible-object
 * problem the index exists to end.
 *
 * The static half comes from the committed manifest because A WORKER CANNOT LIST ITS OWN STATIC
 * ASSETS: the assets binding has exactly one method, `fetch()`.
 */
async function enumerateMediaSources(
  env: Env,
): Promise<{ objects: MediaSource[]; files: string[] }> {
  const objects: MediaSource[] = [];
  for (const bucket of [env.MEDIA, env.OG]) {
    let cursor: string | undefined;
    for (;;) {
      const page = await bucket.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
      for (const object of page.objects) {
        objects.push({
          key: object.key,
          size: object.size,
          uploaded:
            object.uploaded instanceof Date
              ? object.uploaded.toISOString()
              : String(object.uploaded ?? ""),
        });
      }
      if (!page.truncated) break;
      cursor = (page as { cursor?: string }).cursor;
      if (!cursor) throw new Error("R2 reported a truncated listing with no cursor");
    }
  }

  const files: string[] = assetManifest.paths;

  if (objects.length === 0 && files.length === 0) {
    throw new Error(
      "rebuild found neither R2 objects nor static files. Refusing to run: it would read as " +
        "'everything was deleted' and remove every row.",
    );
  }

  return { objects, files };
}

/**
 * WHAT THE INDEX WOULD HAVE TO HOLD, AGAINST WHAT IT HOLDS. `expected` comes from the SOURCES and
 * `present` from the index, both read AFTER any write, so a caller cannot be told a sync succeeded
 * by an operation that merely ran: a loop over a wrongly enumerated set reports a healthy `indexed`
 * and leaves the index short.
 *
 * BOTH DIRECTIONS, and the two are not symmetric. A missing key is an asset the site has and the
 * index cannot describe; an extra key is a row for something that no longer exists. Neither is
 * allowed to average out against the other, which is why `drift` is their SUM.
 */
export async function mediaIndexStatus(env: Env): Promise<{
  expected: number;
  present: number;
  missing: string[];
  extra: string[];
}> {
  const [{ objects, files }, rows] = await Promise.all([
    enumerateMediaSources(env),
    listMediaRecords(env),
  ]);

  const expected = new Set<string>([...objects.map((o) => o.key), ...files]);
  const present = new Set<string>(rows.map((r) => r.key));

  return {
    expected: expected.size,
    present: present.size,
    missing: [...expected].filter((k) => !present.has(k)).sort(),
    extra: [...present].filter((k) => !expected.has(k)).sort(),
  };
}

export async function rebuildMediaIndex(env: Env): Promise<RebuildReport> {
  /** @type {string[]} */
  const failures: string[] = [];

  // ---- 1 and 2. The sources, enumerated once, by the same function the
  // reconciliation uses. See `enumerateMediaSources`.
  const { objects, files } = await enumerateMediaSources(env);

  let indexed = 0;

  // ---- 3. Index the R2 objects. -------------------------------------------
  for (const object of objects) {
    try {
      const { kind, mime } = classify(object.key);
      // An OG card lives in the OG bucket, so the read has to follow the key rather than assume MEDIA.
      // One shared function, never a fourth inline copy of that expression.
      const bucket = bucketFor(env, object.key);
      // Two separate GETs, because a body is a stream and can only be read once.
      // `.info()` and the transform each consume one.
      const measurable = isRaster(object.key);
      const dimensions = measurable
        ? await bucket.get(object.key).then((o) => (o ? dimensionsFor(env, o.body) : null))
        : null;
      const placeholder = measurable
        ? await bucket.get(object.key).then((o) => (o ? placeholderFor(env, o.body) : null))
        : null;

      // The filename, re-derived from the OBJECT rather than preserved by luck. This is what makes
      // `original_name` honestly a derived column: before the name rode in custom metadata, a row that
      // never got one could never acquire it.
      const named = await bucket.head(object.key);

      await upsertDerivedMedia(env, {
        key: object.key,
        storage: storageOf(object.key),
        kind,
        role: roleOf(object.key),
        originalName: named?.customMetadata?.originalName ?? null,
        mime,
        bytes: object.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        placeholder,
        uploadedAt: object.uploaded,
      });
      indexed += 1;
    } catch (error) {
      failures.push(`${object.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ---- 4. Index the static files. -----------------------------------------
  for (const path of files) {
    try {
      const { kind, mime } = classify(path);
      // The hostname is ignored and only the pathname is matched, which is what makes the static tier
      // first-class rather than a listing with no transforms.
      const response = await env.ASSETS.fetch(new Request(`https://assets.local${path}`));
      if (!response.ok) {
        failures.push(`${path}: ASSETS returned ${response.status}`);
        continue;
      }
      const buffer = await response.arrayBuffer();

      const measurable = isRaster(path);
      const dimensions = measurable
        ? await dimensionsFor(env, new Response(buffer.slice(0)).body as ReadableStream)
        : null;
      const placeholder = measurable
        ? await placeholderFor(env, new Response(buffer.slice(0)).body as ReadableStream)
        : null;

      await upsertDerivedMedia(env, {
        key: path,
        storage: storageOf(path),
        kind,
        role: roleOf(path),
        mime,
        bytes: buffer.byteLength,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        placeholder,
        // A static asset has no upload event. Its mtime is a property of the build machine rather than of
        // the asset, so recording one would be inventing a fact.
        uploadedAt: null,
      });
      indexed += 1;
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Remove rows whose source is gone. R2 and `public/` win. Deliberately LAST, and computed from the
  // SAME enumerations that were just written from, so a transient read failure cannot cause a
  // deletion.
  const live = new Set<string>([...objects.map((o) => o.key), ...files]);
  const rows = await listMediaRecords(env);
  let removed = 0;
  for (const row of rows) {
    if (live.has(row.key)) continue;
    await deleteMediaRecord(env, row.key);
    removed += 1;
  }

  return {
    scannedObjects: objects.length,
    scannedFiles: files.length,
    indexed,
    removed,
    failures,
  };
}
