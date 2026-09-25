import assetManifest from "../../../content/generated/assets.json";

import { deleteMediaRecord, listMediaRecords, upsertDerivedMedia } from "~/db";
import { bucketFor, classify, isRaster, roleOf, storageOf } from "./classify.mjs";
import { measureDimensions, placeholderFor } from "./core.server";
import { errorMessage } from "~/lib/error-message.mjs";
import { setDrift } from "~/lib/health/verdicts.mjs";

// `alt`, `caption`, `focal_x` and `focal_y` are AUTHORED and recoverable from nothing, so a rebuild
// upserts derived columns only, never delete-then-insert. R2 wins: rows are removed, objects never.

type RebuildReport = {
  scannedObjects: number;
  scannedFiles: number;
  indexed: number;
  removed: number;
  failures: string[];
};

type Measured = { dimensions: { width: number; height: number } | null; failure: string | null };

// A failed read still writes the row (the upsert leaves stored sizes alone) but is reported as a
// failure, so the rebuild is never counted converged over sizes it could not measure.
async function dimensionsFor(env: Env, body: ReadableStream | null): Promise<Measured> {
  if (!body) return { dimensions: null, failure: "the object vanished before it could be measured" };
  try {
    return { dimensions: await measureDimensions(env, body), failure: null };
  } catch (error) {
    return { dimensions: null, failure: errorMessage(error) };
  }
}

type MediaSource = { key: string; size: number; uploaded: string };

// Shared with the reconciliation so the two cannot disagree about what exists. Exhaustive to the end of
// the cursor: a partial listing makes every absent key look like a deletion. A Worker cannot list its
// own static assets (the binding only has `fetch()`), so the static half is the committed manifest.
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

// Both sides read after any write. `missing` and `extra` are kept apart so they cannot cancel out.
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

  return setDrift(expected, present);
}

export async function rebuildMediaIndex(env: Env): Promise<RebuildReport> {
  const failures: string[] = [];

  const { objects, files } = await enumerateMediaSources(env);

  let indexed = 0;

  for (const object of objects) {
    try {
      const { kind, mime } = classify(object.key);
      // An OG card lives in the OG bucket, so the read follows the key rather than assuming MEDIA.
      const bucket = bucketFor(env, object.key);
      // Two GETs: a body is a stream and can be read only once.
      const measurable = isRaster(object.key);
      const measured = measurable
        ? await bucket.get(object.key).then((o) => dimensionsFor(env, o?.body ?? null))
        : null;
      const dimensions = measured?.dimensions ?? null;
      const placeholder = measurable
        ? await bucket.get(object.key).then((o) => (o ? placeholderFor(env, o.body) : null))
        : null;

      // The filename is re-derived from the object's custom metadata, so `original_name` is truly derived.
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
      if (measured?.failure) {
        failures.push(`${object.key}: ${measured.failure}`);
        continue;
      }
      indexed += 1;
    } catch (error) {
      failures.push(`${object.key}: ${errorMessage(error)}`);
    }
  }

  for (const path of files) {
    try {
      const { kind, mime } = classify(path);
      // The ASSETS binding ignores the hostname and matches only the pathname.
      const response = await env.ASSETS.fetch(new Request(`https://assets.local${path}`));
      if (!response.ok) {
        failures.push(`${path}: ASSETS returned ${response.status}`);
        continue;
      }
      const buffer = await response.arrayBuffer();

      const measurable = isRaster(path);
      const measured = measurable
        ? await dimensionsFor(env, new Response(buffer.slice(0)).body as ReadableStream)
        : null;
      const dimensions = measured?.dimensions ?? null;
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
        // No upload event: a build-machine mtime would be an invented fact.
        uploadedAt: null,
      });
      if (measured?.failure) {
        failures.push(`${path}: ${measured.failure}`);
        continue;
      }
      indexed += 1;
    } catch (error) {
      failures.push(`${path}: ${errorMessage(error)}`);
    }
  }

  // Last, and from the same enumerations just written from, so a transient read failure cannot delete.
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
