// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { cache } from "cloudflare:workers";

import { PAGES_CACHE_TAG, cacheTags } from "~/lib/seo";

// A purge never throws and never blocks a write: a failed invalidation is a stale page and a log
// line, not a 500 after a publish that already succeeded.

type PurgeResult = { success: boolean; errors?: Array<{ code: number; message: string }> };

/**
 * @param tags the cache tags to invalidate
 * @param why  one phrase naming the write that caused this, for the log line
 */
async function purgeTags(tags: string[], why: string): Promise<boolean> {
  // Miniflare has no Workers Cache, so the API may be absent; a TypeError here would fail a save.
  const purge = (cache as typeof cache & { purge?: (o: unknown) => Promise<PurgeResult> })?.purge;
  if (typeof purge !== "function") {
    console.log(`[cache-purge] skipped (${why}): no purge API on this runtime, tags ${tags.join(",")}`);
    return false;
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
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  }
}

/**
 * @param slug the post whose page changed
 */
export async function purgePost(slug: string, why: string): Promise<boolean> {
  return purgeTags([`post:${slug}`], why);
}

// Not `purgeEverything`, which would also drop the hand-authored pages no publish changes.
export async function purgePosts(why: string): Promise<boolean> {
  return purgeTags([cacheTags()], why);
}

// Uncalled on purpose: only a deploy changes these pages, and the Worker version in the cache key
// already invalidates them then.
export async function purgePages(why: string): Promise<boolean> {
  return purgeTags([PAGES_CACHE_TAG], why);
}
