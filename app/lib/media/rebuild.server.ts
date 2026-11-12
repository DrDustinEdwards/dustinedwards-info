import assetManifest from "../../../content/generated/assets.json";

import { deleteSiteAsset, listSiteAssets, upsertSiteAsset } from "~/db";
import { classify, isRaster, roleOf, storageOf } from "./classify.mjs";
import { measureDimensions } from "./core.server";
import { errorMessage } from "@dustinedwards/site-runtime/log";
import { setDrift } from "~/lib/health/verdicts.mjs";

// The index of the site's own files (site_assets): the Worker's generated objects in OG and the paths in public/.
// Every column is derived, and the files win: rows are removed, objects never. The library's uploads in MEDIA are
// not here: site-api's mediaLibrary writes their rows (app/db/media.ts).

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
  if (!body)
    return { dimensions: null, failure: "the object vanished before it could be measured" };
  try {
    return { dimensions: await measureDimensions(env, body), failure: null };
  } catch (error) {
    return { dimensions: null, failure: errorMessage(error) };
  }
}

type AssetSource = { key: string; size: number; uploaded: string };

// Shared with the reconciliation so the two cannot disagree about what exists. Exhaustive to the end of
// the cursor: a partial listing makes every absent key look like a deletion. A Worker cannot list its
// own static assets (the binding only has `fetch()`), so the static half is the committed manifest.
async function enumerateSiteAssets(env: Env): Promise<{ objects: AssetSource[]; files: string[] }> {
  const objects: AssetSource[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await env.OG.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
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

  const files: string[] = assetManifest.paths;

  if (objects.length === 0 && files.length === 0) {
    throw new Error(
      "rebuild found neither OG objects nor static files. Refusing to run: it would read as " +
        "'everything was deleted' and remove every row.",
    );
  }

  return { objects, files };
}

// Both sides read after any write. `missing` and `extra` are kept apart so they cannot cancel out.
export async function siteAssetStatus(env: Env): Promise<{
  expected: number;
  present: number;
  missing: string[];
  extra: string[];
}> {
  const [{ objects, files }, rows] = await Promise.all([
    enumerateSiteAssets(env),
    listSiteAssets(env),
  ]);

  const expected = new Set<string>([...objects.map((o) => o.key), ...files]);
  const present = new Set<string>(rows.map((r) => r.key));

  return setDrift(expected, present);
}

// The failure to report for one OG object, or null once it is indexed and measured.
async function indexObject(env: Env, object: AssetSource): Promise<string | null> {
  try {
    const { kind, mime } = classify(object.key);
    const measured = isRaster(object.key)
      ? await env.OG.get(object.key).then((o) => dimensionsFor(env, o?.body ?? null))
      : null;
    const dimensions = measured?.dimensions ?? null;

    await upsertSiteAsset(env, {
      key: object.key,
      storage: storageOf(object.key),
      kind,
      role: roleOf(object.key),
      mime,
      bytes: object.size,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      uploadedAt: object.uploaded,
    });
    return measured?.failure ? `${object.key}: ${measured.failure}` : null;
  } catch (error) {
    return `${object.key}: ${errorMessage(error)}`;
  }
}

// The failure to report for one static file, or null once it is indexed and measured.
async function indexStaticFile(env: Env, path: string): Promise<string | null> {
  try {
    const { kind, mime } = classify(path);
    // The ASSETS binding ignores the hostname and matches only the pathname.
    const response = await env.ASSETS.fetch(new Request(`https://assets.local${path}`));
    if (!response.ok) return `${path}: ASSETS returned ${response.status}`;
    const buffer = await response.arrayBuffer();

    const measured = isRaster(path)
      ? await dimensionsFor(env, new Response(buffer).body as ReadableStream)
      : null;
    const dimensions = measured?.dimensions ?? null;

    await upsertSiteAsset(env, {
      key: path,
      storage: storageOf(path),
      kind,
      role: roleOf(path),
      mime,
      bytes: buffer.byteLength,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      // No upload event: a build-machine mtime would be an invented fact.
      uploadedAt: null,
    });
    return measured?.failure ? `${path}: ${measured.failure}` : null;
  } catch (error) {
    return `${path}: ${errorMessage(error)}`;
  }
}

export async function rebuildSiteAssets(env: Env): Promise<RebuildReport> {
  const failures: string[] = [];

  const { objects, files } = await enumerateSiteAssets(env);

  let indexed = 0;

  for (const object of objects) {
    const failure = await indexObject(env, object);
    if (failure) failures.push(failure);
    else indexed += 1;
  }

  for (const path of files) {
    const failure = await indexStaticFile(env, path);
    if (failure) failures.push(failure);
    else indexed += 1;
  }

  // Last, and from the same enumerations just written from, so a transient read failure cannot delete.
  const live = new Set<string>([...objects.map((o) => o.key), ...files]);
  const rows = await listSiteAssets(env);
  let removed = 0;
  for (const row of rows) {
    if (live.has(row.key)) continue;
    await deleteSiteAsset(env, row.key);
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
