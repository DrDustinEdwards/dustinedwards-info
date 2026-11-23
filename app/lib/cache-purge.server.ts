// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { exports, waitUntil } from "cloudflare:workers";

import { LLMS_CACHE_TAG } from "~/lib/llms/validate.mjs";
import { CV_CACHE_TAG } from "~/lib/cv/route";
import { CONTENT_PAGES_CACHE_TAG } from "~/lib/pages/route";
import { PUBLICATIONS_CACHE_TAG } from "~/lib/publications/paths.mjs";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { REGISTRY_CACHE_TAG } from "~/kb/registry/route";
import { cacheTags } from "~/lib/seo";

// A purge never throws and never blocks a write: a failed invalidation is a stale page and a log
// line, not a 500 after a publish that already succeeded. Cloudflare rations purge requests (Workers Caching is always
// on the Free limits, 5 a minute) and the Renderer asks again after a refusal for up to 15 s, so a write starts the purge
// in `waitUntil` and answers; a failure is kept in KV for /health (recordPurge) and logged.

/**
 * `true` purged, `false` failed (public pages stay stale until expiry), `null` started in the background (the outcome is
 * kept in KV for /health) or skipped because this runtime has no purge API (Miniflare, local dev). Only `false` is a
 * problem.
 */
export type PurgeOutcome = boolean | null;

/** Several purges read as one: any failure fails, all done is done, otherwise skipped. */
export function combinePurges(...outcomes: PurgeOutcome[]): PurgeOutcome {
  if (outcomes.includes(false)) return false;
  return outcomes.every((outcome) => outcome === true) ? true : null;
}

/**
 * The Renderer's purgePages (workers/app.ts, site-runtime ./edge-cache), over the Worker's own loopback: a purge reaches
 * only the cache of the entrypoint that calls it, and a save runs in the Renderer (an admin page), the gateway (Carrel's
 * step) or the cron. Never throws; inside a request it starts the purge in `waitUntil` and answers `null`, and `null` where
 * Miniflare has no purge API, and a refusal or a throw logged as
 * `cache-purge-refused` or `cache-purge-threw` (or `cache-purge-unreachable` when the loopback fails). A failure is kept
 * in KV until a purge succeeds (recordPurge, in the Renderer), which /health's cache-purge check shows.
 *
 * @param tags the cache tags to invalidate
 * @param why  one phrase naming the write that caused this, for the log line
 */
async function purge(tags: string[], why: string): Promise<PurgeOutcome> {
  const asked = (async () => {
    try {
      return await exports.Renderer.purgePages(why, tags);
    } catch (error) {
      // The loopback itself failed, so the Renderer recorded nothing: a failed purge, logged here.
      console.error(
        JSON.stringify({ alert: "cache-purge-unreachable", why, tags, detail: String(error) }),
      );
      return false;
    }
  })();
  try {
    waitUntil(asked);
    return null;
  } catch {
    // No request to hang it on (a script run outside one): this call waits for it.
    return asked;
  }
}

/**
 * @param slug the post whose page changed
 */
export async function purgePost(slug: string, why: string): Promise<PurgeOutcome> {
  return purge([`post:${slug}`], why);
}

// Not `purgeEverything`, which would also drop the hand-authored pages no publish changes.
export async function purgePosts(why: string): Promise<PurgeOutcome> {
  return purge([cacheTags()], why);
}

/** Every procedure page, sheet and twin carries this one tag (app/kb/procedures/route.ts). */
export async function purgeProcedures(why: string): Promise<PurgeOutcome> {
  return purge([PROCEDURES_CACHE_TAG], why);
}

/**
 * Every registry page, listing and twin carries this one tag (app/kb/registry/route.ts). A protocol page links
 * the registry's items by their own addresses and states none of their facts, so no other tag moves.
 */
export async function purgeRegistry(why: string): Promise<PurgeOutcome> {
  return purge([REGISTRY_CACHE_TAG], why);
}

/**
 * The publication pages, exports and twins carry their own tag. The home page, the search page and the
 * blog listings carry `posts` and show papers too (the three newest, the count, a search record), so a
 * save purges both.
 */
export async function purgePublications(why: string): Promise<PurgeOutcome> {
  return purge([PUBLICATIONS_CACHE_TAG, cacheTags()], why);
}

/** Every content page and its twin carries this one tag (app/lib/pages/route.ts). */
export async function purgePages(why: string): Promise<PurgeOutcome> {
  return purge([CONTENT_PAGES_CACHE_TAG], why);
}

/**
 * The roster is embedded in two pages: the list on /teaching/phage-discovery, which carries the content
 * pages' tag, and the counts on the home page, which carries `posts` (app/routes/home.tsx). A cohort save
 * purges both, because purging only the program page would leave the home page's counts stale.
 */
export async function purgeRoster(why: string): Promise<PurgeOutcome> {
  return purge([CONTENT_PAGES_CACHE_TAG, cacheTags()], why);
}

/**
 * The phage table is embedded in one page, /research/phages: its HTML and its markdown twin both carry the
 * content-pages tag, so a phage save purges that tag (and only it). A phage appears nowhere else.
 */
export async function purgePhages(why: string): Promise<PurgeOutcome> {
  return purge([CONTENT_PAGES_CACHE_TAG], why);
}

/** /llms.txt carries this one tag (app/routes/llms.ts). */
export async function purgeLlms(why: string): Promise<PurgeOutcome> {
  return purge([LLMS_CACHE_TAG], why);
}

/** The CV page, its charts and its markdown twin carry this one tag (app/lib/cv/route.ts). */
export async function purgeCv(why: string): Promise<PurgeOutcome> {
  return purge([CV_CACHE_TAG], why);
}
