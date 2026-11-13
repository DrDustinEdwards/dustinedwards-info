// The media library's index: site-api's d1MediaStore over the network's standard tables (MEDIA_LIBRARY_SQL), the store
// its mediaLibrary keeps Carrel's and the admin's library in (app/lib/carrel/media-adapter.server.ts), and the citations
// the render pipeline records. The site's own files are another index (./site-assets.ts).
import { d1MediaStore } from "@dustinedwards/site-api";
import { inList } from "@dustinedwards/site-runtime/d1";
import { mediaRefs, type MediaRef } from "./schema";
import { getDb } from "./client";

/**
 * A recorded citation still names the file, checked in the delete itself, so a post saved during a delete keeps its
 * file. The resolver's scan of the posts runs before it (the library's usage check).
 */
const CITED = "EXISTS (SELECT 1 FROM media_refs WHERE media_key = ?)";

export function mediaStore(env: Env) {
  return d1MediaStore(env.DB, { inUse: CITED });
}

export async function mediaRefsFor(env: Env, keys: string[]) {
  if (keys.length === 0) return new Map<string, MediaRef[]>();
  const rows = await getDb(env)
    .select()
    .from(mediaRefs)
    // inList binds one JSON parameter: the library asks about every file at once, past D1's bound-parameter cap.
    .where(inList(mediaRefs.mediaKey, keys));
  const out = new Map<string, MediaRef[]>(keys.map((key) => [key, []]));
  for (const row of rows) out.get(row.mediaKey)?.push(row);
  return out;
}
