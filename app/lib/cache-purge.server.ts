import { cache } from "cloudflare:workers";

import { PAGES_CACHE_TAG, cacheTags } from "~/lib/seo";

/**
 * Invalidating what a write just changed.
 *
 * **THE IMPORT FORM, because the write paths do not hold a `ctx`.** Every caller is a route action,
 * an editor helper or a health repair running well below the request handler, and the `cache` import
 * reaches the same API as `ctx.cache.purge`.
 *
 * **IT NEVER THROWS AND IT NEVER BLOCKS A WRITE.** A purge is bookkeeping ABOUT a write that already
 * succeeded, so a failed invalidation is a stale page and a log line, never a 500 handed to the
 * operator who just published: hard rule 18's second clause in a new place. `success` IS READ,
 * because `purge` resolves with `{ success, errors }` rather than rejecting on a refusal, so a
 * caller that awaited it and looked at nothing would report a purge that never happened. The
 * realistic way it comes back false is the purge rate limit, which is the Free-tier zone limit
 * regardless of plan.
 *
 * **LOCAL DEV HAS NO PURGE, AND THAT IS A GUARD RATHER THAN A HOPE.** Miniflare does not implement
 * Workers Cache, so there is nothing local to purge and the API may be absent entirely; absence is a
 * no-op with one log line, never an error, since the alternative is every local save failing on an
 * API the harness does not have.
 *
 * **THE PROOF OF THIS MODULE IS THEREFORE LIVE, ON THE WIRE**, in verify-live's measurement (d).
 * Nothing offline can establish it.
 */

/** What `cache.purge` resolves with. Narrowed here so the caller reads `success`. */
type PurgeResult = { success: boolean; errors?: Array<{ code: number; message: string }> };

/**
 * One purge, with every failure mode swallowed and named.
 *
 * @param tags the cache tags to invalidate
 * @param why  one phrase naming the write that caused this, for the log line
 */
async function purgeTags(tags: string[], why: string): Promise<boolean> {
  /*
   * THE API MAY NOT BE THERE. Local dev is the known case; a runtime that has
   * not shipped it yet is the same shape. Checked rather than assumed, because
   * a TypeError here would propagate into a save.
   */
  const purge = (cache as unknown as { purge?: (o: unknown) => Promise<PurgeResult> })?.purge;
  if (typeof purge !== "function") {
    console.log(`[cache-purge] skipped (${why}): no purge API on this runtime, tags ${tags.join(",")}`);
    return false;
  }

  try {
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
 * Invalidate ONE post's page, for a write that changed that page and nothing else. A mention
 * decision changes the rendered list under one post and touches nothing else, so purging `posts`
 * would throw away the whole corpus's cache to fix one page.
 *
 * @param slug the post whose page changed
 */
export async function purgePost(slug: string, why: string): Promise<boolean> {
  return purgeTags([`post:${slug}`], why);
}

/**
 * Invalidate everything that lists the corpus, the changed post included.
 *
 * `cacheTags()` with no argument IS the `posts` tag, so this reads the same vocabulary the
 * responses were tagged with rather than a second spelling of it.
 *
 * NOT `purgeEverything`, which would take the hand-authored pages with it, and no publish changes
 * those.
 */
export async function purgePosts(why: string): Promise<boolean> {
  return purgeTags([cacheTags()], why);
}

/**
 * Invalidate the hand-authored pages. EXPORTED AND UNCALLED, deliberately.
 *
 * `PAGES_CACHE_TAG` is on every shared-cacheable page that does not read the corpus, and nothing
 * purges it because only a deploy changes those pages, which already invalidates every entry through
 * the Worker version in the key. This exists so the tag has a named door rather than a string with no
 * reader. If it still has no caller a year from now, delete both.
 */
export async function purgePages(why: string): Promise<boolean> {
  return purgeTags([PAGES_CACHE_TAG], why);
}
