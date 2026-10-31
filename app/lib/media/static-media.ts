import assetManifest from "../../../content/generated/assets.json";

import type { AssetManifest } from "./manifest.mjs";

const placeholders = (assetManifest as AssetManifest).placeholders ?? {};

/**
 * A static photograph's version and placeholder, from the manifest build:assets writes (content/generated/assets.json):
 * the digest of its bytes and its 20 px placeholder. The version goes in its size URLs as `v=` (site-runtime ./image),
 * so a file replaced under the same name is a new URL and the route can cache each one for good.
 * @param src the site path, such as /phage-hunters/dustin-edwards-2025.webp
 */
export function staticPhoto(src: string): { version: string | null; placeholder: string | null } {
  const entry = placeholders[src];
  return { version: entry?.sha ?? null, placeholder: entry?.lqip ?? null };
}
