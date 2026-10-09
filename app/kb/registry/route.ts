// What the registry's pages, listings and twins share: the cache tags a save purges (app/lib/cache-purge.server.ts).
import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";

/** Every registry response carries it; a registry save and sync purge it. */
export const REGISTRY_CACHE_TAG = "registry";

/** The tags the registry's pages and twins carry: the registry's own, the content pages' (the inventory reads the phages, whose save purges that tag) and the procedures' (an item lists the protocols that use it). */
export const LAB_CACHE_TAGS = `${CONTENT_PAGE_HTML_TAGS},${REGISTRY_CACHE_TAG},${PROCEDURES_CACHE_TAG}`;
