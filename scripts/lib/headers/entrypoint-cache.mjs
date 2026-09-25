// Which entrypoint the platform may cache, read off wrangler.jsonc.example.

import { join } from "node:path";

import { parseJsonc } from "../wrangler-surface.mjs";
import { eq, root } from "./gate.mjs";

export function run() {
  /*
   * WHICH ENTRYPOINT THE PLATFORM MAY CACHE, which a config comparison cannot judge: gateway cache on
   * hides readership, Renderer cache off renders every request, cross_version on serves stale.
   */
  const example = parseJsonc(join(root, "wrangler.jsonc.example"));

  eq("the example config still enables Workers Cache at the top level", example.cache?.enabled, true);
  eq("the GATEWAY entrypoint has cache DISABLED", example.exports?.default?.cache?.enabled, false);
  eq("the RENDERER entrypoint has cache ENABLED", example.exports?.Renderer?.cache?.enabled, true);
  /* ABSENT rather than false: writing it would be a second place to state a safe default. */
  eq(
    "cross_version_cache is not enabled, so a deploy invalidates the cache",
    example.cache?.cross_version_cache ?? false,
    false,
  );
}
