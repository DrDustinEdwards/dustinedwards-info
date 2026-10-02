// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { cache } from "cloudflare:workers";

import { LLMS_CACHE_TAG } from "~/lib/llms/validate.mjs";
import { CV_CACHE_TAG } from "~/lib/cv/route";
import { CONTENT_PAGES_CACHE_TAG } from "~/lib/pages/route";
import { PUBLICATIONS_CACHE_TAG } from "~/lib/publications/paths.mjs";
import { cacheTags } from "~/lib/seo";
import { errorMessage } from "~/lib/error-message.mjs";

// A purge never throws and never blocks a write: a failed invalidation is a stale page and a log
// line, not a 500 after a publish that already succeeded.

/**
 * `true` purged, `false` failed (refused or threw: public pages stay stale until expiry), `null`
 * skipped because this runtime has no purge API (Miniflare, local dev). Only `false` is a problem.
 */
export type PurgeOutcome = boolean | null;

/** Several purges read as one: any failure fails, all done is done, otherwise skipped. */
export function combinePurges(...outcomes: PurgeOutcome[]): PurgeOutcome {
  if (outcomes.includes(false)) return false;
  return outcomes.every((outcome) => outcome === true) ? true : null;
}

type PurgeResult = { success: boolean; errors?: Array<{ code: number; message: string }> };

/**
 * @param tags the cache tags to invalidate
 * @param why  one phrase naming the write that caused this, for the log line
 */
async function purgeTags(tags: string[], why: string): Promise<PurgeOutcome> {
  // Miniflare has no Workers Cache, so the API may be absent; a TypeError here would fail a save.
  const purge = (cache as typeof cache & { purge?: (o: unknown) => Promise<PurgeResult> })?.purge;
  if (typeof purge !== "function") {
    console.log(`[cache-purge] skipped (${why}): no purge API on this runtime, tags ${tags.join(",")}`);
    return null;
  }

  try {
    // `purge` resolves `{ success: false }` on a refusal (usually the rate limit) rather than rejecting.
    const result = await purge({ tags });
    if (!result?.success) {
      console.error(
        JSON.stringify({
          alert: "cache-purge-refused",
          why,
          tags,
          errors: result?.errors ?? [],
        }),
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        alert: "cache-purge-threw",
        why,
        tags,
        detail: errorMessage(error),
      }),
    );
    return false;
  }
}

/**
 * @param slug the post whose page changed
 */
export async function purgePost(slug: string, why: string): Promise<PurgeOutcome> {
  return purgeTags([`post:${slug}`], why);
}

// Not `purgeEverything`, which would also drop the hand-authored pages no publish changes.
export async function purgePosts(why: string): Promise<PurgeOutcome> {
  return purgeTags([cacheTags()], why);
}

/** Every procedure page, sheet and twin carries this one tag (app/lib/procedures/route.ts). */
export async function purgeProcedures(why: string): Promise<PurgeOutcome> {
  return purgeTags(["procedures"], why);
}

/**
 * The publication pages, exports and twins carry their own tag. The home page, the search page and the
 * blog listings carry `posts` and show papers too (the three newest, the count, a search record), so a
 * save purges both.
 */
export async function purgePublications(why: string): Promise<PurgeOutcome> {
  return purgeTags([PUBLICATIONS_CACHE_TAG, cacheTags()], why);
}

/** Every content page and its twin carries this one tag (app/lib/pages/route.ts). */
export async function purgePages(why: string): Promise<PurgeOutcome> {
  return purgeTags([CONTENT_PAGES_CACHE_TAG], why);
}

/**
 * The roster is embedded in two pages: the list on /teaching/phage-discovery, which carries the content
 * pages' tag, and the counts on the home page, which carries `posts` (app/routes/home.tsx). A cohort save
 * purges both, because purging only the program page would leave the home page's counts stale.
 */
export async function purgeRoster(why: string): Promise<PurgeOutcome> {
  return purgeTags([CONTENT_PAGES_CACHE_TAG, cacheTags()], why);
}

/** /llms.txt carries this one tag (app/routes/llms.ts). */
export async function purgeLlms(why: string): Promise<PurgeOutcome> {
  return purgeTags([LLMS_CACHE_TAG], why);
}

/** The CV page, its charts and its markdown twin carry this one tag (app/lib/cv/route.ts). */
export async function purgeCv(why: string): Promise<PurgeOutcome> {
  return purgeTags([CV_CACHE_TAG], why);
}
