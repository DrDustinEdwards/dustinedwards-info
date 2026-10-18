/**
 * Served by `systemInsidesPlugin()` in scripts/lib/system-insides-plugin.mjs: each system's inside layer on
 * /systems, by id, drawn at build time from data/system-model.json (scripts/lib/system-layout.mjs).
 *
 * Its own file, with no import or export, so the declaration is ambient.
 */
declare module "virtual:system-insides" {
  export const INSIDE_LAYERS: Readonly<Record<string, string>>;
  /** The same layers as one JSON asset, which the map's script fetches. */
  export const INSIDES_URL: string;
}
