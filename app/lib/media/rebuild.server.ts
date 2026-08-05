import assetManifest from "../../../content/generated/assets.json";

import { deleteMediaRecord, listMediaRecords, upsertDerivedMedia } from "~/db";
import { bucketFor, classify, isRaster, roleOf, storageOf } from "./classify.mjs";

/**
 * Re-derives the media index from the things that are actually true.
 *
 * **The rule this whole module exists to obey:** hash, mime, bytes, dimensions
 * and the placeholder are RECOMPUTABLE from the object. `alt`, `caption`,
 * `focal_x` and `focal_y` are AUTHORED and recoverable from NOTHING. They are
 * the only media data in this system that can be permanently lost, so a rebuild
 * re-derives the first set and preserves the second. That is why this walks
 * through `upsertDerivedMedia`, whose conflict clause names the derived columns
 * explicitly, and never through a delete-then-insert.
 *
 * **The conflict rule, one direction only: R2 WINS.** A row whose object has
 * disappeared is deleted. An object with no row is indexed. An object is never
 * deleted because a row said so, and this module has no code path that could:
 * it does not import `deleteMediaObject` and takes no bucket-write of any kind.
 *
 * Both sources are enumerated exhaustively before anything is written, because a
 * partial listing would make every absent key look like a deletion. That is the
 * failure this repo has already shipped once, when `items.list()` returned one
 * page and a prune reported "removed 0" for items that were real.
 */

export type RebuildReport = {
  scannedObjects: number;
  scannedFiles: number;
  indexed: number;
  removed: number;
  /** Keys that could not be derived. Reported, never silently skipped. */
  failures: string[];
};

/** The LQIP width. ~300 bytes as a data URI, which buys the zero-JS rule. */
const PLACEHOLDER_WIDTH = 20;

/**
 * A tiny base64 data URI standing in for the image until it loads.
 *
 * LQIP rather than ThumbHash or BlurHash: both of those need client-side
 * JavaScript to decode, and this site's zero-JS rule forbids that. A ~300 byte
 * data URI against ThumbHash's 25 is the price of the rule, and it renders with
 * no script at all.
 *
 * Returns null rather than throwing. A placeholder is an enhancement; an image
 * the transformer cannot read (an SVG, a PDF, a corrupt upload) simply has none,
 * and that must not be able to fail a rebuild.
 */
async function placeholderFor(env: Env, body: ReadableStream): Promise<string | null> {
  try {
    const result = await env.IMAGES.input(body)
      .transform({ width: PLACEHOLDER_WIDTH })
      .output({ format: "image/webp" });
    const buffer = await result.response().arrayBuffer();
    let binary = "";
    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
    return `data:image/webp;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

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

export async function rebuildMediaIndex(env: Env): Promise<RebuildReport> {
  /** @type {string[]} */
  const failures: string[] = [];

  // ---- 1. Enumerate BOTH buckets, exhaustively and to the end of the cursor.
  //
  // Two buckets, split on LIFECYCLE: MEDIA is irreplaceable, OG holds cards a
  // command can regenerate. Both are indexed, because the index describes every
  // asset the site has and an OG card that existed but appeared nowhere would be
  // exactly the invisible-object problem the index exists to end.
  const objects: Array<{ key: string; size: number; uploaded: string }> = [];
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

  // ---- 2. The static half, from the committed manifest. --------------------
  // A Worker cannot list its own static assets: the assets binding has exactly
  // one method, `fetch()`, so it can serve any path it is given and discover
  // none of them. `build:assets` walks public/ and commits the list; check:media
  // compares that list against the filesystem so a stale one is named as stale.
  const files: string[] = assetManifest.paths;

  if (objects.length === 0 && files.length === 0) {
    throw new Error(
      "rebuild found neither R2 objects nor static files. Refusing to run: it would read as " +
        "'everything was deleted' and remove every row.",
    );
  }

  let indexed = 0;

  // ---- 3. Index the R2 objects. -------------------------------------------
  for (const object of objects) {
    try {
      const { kind, mime } = classify(object.key);
      // An OG card lives in the OG bucket now, so the read has to follow the
      // key rather than assume MEDIA. This was the third inline copy of that
      // expression; it is one shared function since 2026-08-04.
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

      // The filename, re-derived from the OBJECT rather than preserved by luck.
      // This is what makes `original_name` recomputable and therefore honestly
      // a derived column: before the name rode in custom metadata, a rebuild
      // could only keep whatever D1 already had, and a row that never got one
      // could never acquire it.
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
      // The hostname is ignored; only the pathname is matched. Verified
      // 2026-08-02, which is what makes the static tier first-class rather than
      // a second-class listing with no transforms.
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
        // A static asset has no upload event. Its mtime is a property of the
        // build machine, not of the asset, so recording one would be inventing
        // a fact. Null is the honest value.
        uploadedAt: null,
      });
      indexed += 1;
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ---- 5. Remove rows whose source is gone. R2 and public/ win. -----------
  // Deliberately last, and deliberately computed from the SAME enumerations that
  // were just written from. Anything that failed above is still in `live` only
  // if it was indexed, so a transient read failure cannot cause a deletion.
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
