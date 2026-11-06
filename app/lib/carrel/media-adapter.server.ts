// Carrel's media group, and the admin library's through the content kit: site-api's shared media library (v0.24.0)
// over this site's own index (mediaLibraryStore, app/db/media.ts) and its buckets. What is this site's own is set here
// and nowhere else: the content-addressed keys that carry a picture's size, the reference check, which files the
// library may change, where earlier bytes are kept, and the objects' metadata.

import {
  RefusedError,
  mediaLibrary,
  type MediaAdapter,
  type MediaKeyInput,
  type MediaResize,
  type MediaUse,
} from "@dustinedwards/site-api";
import { fromHex } from "@dustinedwards/site-runtime/encoding";

import { mediaLibraryStore, mediaRefsFor } from "~/db";
import { contentKey } from "~/lib/media/classify.mjs";
import { isManagedKey } from "~/lib/media/core.server";
import { resolveCitations } from "~/lib/media/resolvers.server";
import { suggestFor } from "~/lib/media/suggest.server";
import { ALLOWED, DATA_TYPES, MAX_BYTES } from "~/lib/media/upload-contract.mjs";
import { IMMUTABLE_CACHE_CONTROL } from "~/lib/seo";
import templateRefs from "../../../content/generated/template-refs.json";

/**
 * What an upload shrinks to when it asks (Carrel's, unless it says `resize=no`): the longer edge kept, and the quality
 * it is encoded at. Wide enough that a phone photo (4032 pixels) keeps its size; a larger camera file is shrunk, its
 * original kept in MEDIA_REVISIONS and in the file's history.
 */
const RESIZE: MediaResize = { maxEdge: 4096, quality: 85 };

/** Repository code that names a file by its address (build:template-refs), which a post scan cannot see. */
const TEMPLATE_REFS = (templateRefs as { refs: Record<string, string[]> }).refs;

/**
 * The key for a new file: dustin-edwards-<name>-<16 hex>-<w>x<h>.<ext> (classify.mjs contentKey), the digest the stored
 * bytes' hash, so the key pins them. Every page's srcset and aspect come from the size in it (the library refuses a
 * picture Images could not measure); a data file (CSV) carries none. A taken key, which only the same bytes under the
 * same name can give, takes -2, -3 and on in its name part.
 */
function keyFor(file: MediaKeyInput, attempt: number): string {
  const extension = ALLOWED.get(file.contentType);
  if (!extension) throw new RefusedError(`This site does not store ${file.contentType} files.`);
  const size = file.width && file.height ? { width: file.width, height: file.height } : null;
  if (!size && !DATA_TYPES.has(file.contentType))
    throw new RefusedError("A picture with no measured size gets no address on this site.");
  // Short enough that the number survives the key's 48-character name.
  const stem = file.filename.replace(/\.[^.]*$/, "");
  const name = attempt === 1 ? file.filename : `${stem.slice(0, 40)}-${attempt}.${extension}`;
  return contentKey(fromHex(file.storedSha256), extension, size, name);
}

/**
 * Every place that uses each file: the posts the resolver finds it in, then each reference the render pipeline recorded
 * (media_refs) from an item no citation already names, then the repository code that names it. A resolver that fails
 * throws, so the library refuses a delete rather than reading the failure as "nothing uses it".
 */
async function usesOf(env: Env, asked?: string[]): Promise<Map<string, MediaUse[]>> {
  const keys = asked ?? (await mediaLibraryStore(env).all()).map((r) => r.key);
  const [resolution, refs] = await Promise.all([
    resolveCitations(env, keys),
    mediaRefsFor(env, keys),
  ]);
  if (!resolution.complete)
    throw new Error(`the reference scan failed (${resolution.failed.join(", ")})`);
  const uses = new Map<string, MediaUse[]>();
  for (const key of keys) {
    const citations = resolution.citations.get(key) ?? [];
    const found: MediaUse[] = citations.map((c) => ({
      type: c.type,
      id: c.id,
      title: c.title.slice(0, 1000),
      detail: c.detail.slice(0, 500),
    }));
    const named = new Set(citations.map((c) => `${c.type}:${c.id}`));
    for (const ref of refs.get(key) ?? []) {
      if (named.has(`${ref.sourceType}:${ref.sourceId}`)) continue;
      found.push({
        type: ref.sourceType,
        id: ref.sourceId,
        title: ref.sourceId,
        detail: `recorded ${ref.form}${ref.detail ? `, ${ref.detail}` : ""}`.slice(0, 500),
      });
    }
    for (const file of TEMPLATE_REFS[key] ?? [])
      found.push({
        type: "template",
        id: file,
        title: file,
        detail: "named in the repository's code",
      });
    if (found.length > 0) uses.set(key, found);
  }
  return uses;
}

export function carrelMediaAdapter(env: Env): MediaAdapter {
  return mediaLibrary({
    store: mediaLibraryStore(env),
    bucket: env.MEDIA,
    images: env.IMAGES,
    limits: { maxBytes: MAX_BYTES, types: [...ALLOWED.keys()] },
    url: (key) => `/media/${key}`,
    key: keyFor,
    resize: RESIZE,
    // Every address carries its picture's size, so a stored picture is never shrunk in place, a replace keeps the size
    // and a quarter turn of a picture that is not square is a new file.
    shrink: false,
    replaceKeepsSize: true,
    usage: (keys) => usesOf(env, keys),
    // Only an upload's content-addressed key is the library's to change or delete; an older key stays as it is.
    deletable: (record) => isManagedKey(record.key),
    // MEDIA_REVISIONS, which /media never serves (app/routes/media.$.ts reads MEDIA or OG through bucketFor) and nothing
    // deletes from (check:destructive). Copies before v0.24.0 are at replaced/<time>/<key> and resized/<time>/<key>,
    // and each revision row names its own, so a revert still finds them.
    history: { bucket: env.MEDIA_REVISIONS, prefix: "replaced/" },
    httpMetadata: () => ({ cacheControl: IMMUTABLE_CACHE_CONTROL }),
    // The name is on the object too: a content-addressed key cannot yield it, and the R2 events re-derive the row from it.
    customMetadata: (record): Record<string, string> =>
      record.filename ? { originalName: record.filename } : {},
    suggest: (picture, id) => suggestFor(env, picture, id),
    // The package checks every address and each redirect before this fetch runs.
    importFetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, init)) as typeof fetch,
  });
}
