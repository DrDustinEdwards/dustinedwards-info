import { cache } from "cloudflare:workers";

import { PAGES_CACHE_TAG, cacheTags } from "~/lib/seo";

/**
 * Invalidating what a write just changed. Ruling 17, 2026-09-05.
 *
 * ## THIS REVERSES RULING 7, AND THE REVERSAL IS THE POINT
 *
 * Six weeks ago the answer was that there is no purge. The post page had two
 * caches and neither could be invalidated: the platform's had no purge API on
 * `workers.dev`, and the hand-built `caches.default` layer was PER DATA CENTRE,
 * so a delete on approve would have cleared the admin's own colo and nothing
 * else. An instrument that reads as whole and is partial is worse than none, so
 * ruling 7 chose to wait out `s-maxage` and say so on the admin page in plain
 * words.
 *
 * Workers Cache has `purge` now, with Instant Purge and global propagation, so
 * the reasoning did not change: the measured world did. A mention approved at
 * 10:00 appears under the post at 10:00 instead of by 10:10.
 *
 * ## THE IMPORT FORM, because the write paths do not hold a `ctx`
 *
 * Cloudflare documents two spellings, `ctx.cache.purge` and the `cache` import.
 * Every caller here is a route action, an editor helper or a health repair
 * running well below the request handler, and threading an ExecutionContext
 * down to each of them would be a parameter on a dozen signatures for one
 * optional side effect. The import reaches the same API.
 *
 * ## IT NEVER THROWS AND IT NEVER BLOCKS A WRITE
 *
 * A purge is bookkeeping ABOUT a write that already succeeded. If the row is
 * saved and the invalidation fails, the correct outcome is a stale page for up
 * to ten minutes and a log line, not a 500 handed to the operator who just
 * published. That is hard rule 18's second clause in a new place: a failed
 * index write never reverts the source.
 *
 * `success` IS READ, which is the half that is easy to skip. `purge` resolves
 * with `{ success, errors }` rather than rejecting on a refusal, so a caller
 * that awaited it and looked at nothing would report a purge that never
 * happened. Rate limits are the Free-tier zone limits regardless of plan, which
 * is the realistic way this comes back false.
 *
 * ## LOCAL DEV HAS NO PURGE, AND THAT IS A GUARD RATHER THAN A HOPE
 *
 * Miniflare does not implement Workers Cache: MEASURED 2026-09-05 under
 * `vite preview`, where a response with `public, s-maxage=600` and a fixed
 * `cf.cacheKey` was re-rendered on every one of three fetches and carried no
 * `Cf-Cache-Status` at all. So there is nothing local to purge and the API may
 * be absent entirely. Absence is treated as a no-op with one log line, never as
 * an error, because the alternative is every local save and every worker test
 * failing on an API that production has and the harness does not.
 *
 * **THE PROOF OF THIS MODULE IS THEREFORE LIVE, ON THE WIRE**, in verify-live's
 * measurement (d): approve a mention, fetch the post cookieless within five
 * seconds, and the section is there. Nothing offline can establish it, and
 * saying so is better than a green test that proved the guard works.
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
 * Invalidate ONE post's page. For a write that changed that page and nothing else.
 *
 * The mention decisions are the whole of this today. Approving, rejecting or
 * deleting a mention changes the rendered list under one post; it does not
 * touch the index, the feeds or any other post, so purging `posts` would throw
 * away the entire corpus's cache to fix one page.
 *
 * @param slug the post whose page changed
 */
export async function purgePost(slug: string, why: string): Promise<boolean> {
  return purgeTags([`post:${slug}`], why);
}

/**
 * Invalidate everything that lists the corpus, the changed post included.
 *
 * `cacheTags()` with no argument IS the `posts` tag, so this reads the same
 * vocabulary the responses were tagged with rather than a second spelling of
 * it. A publish moves the post page, the index, every tag archive, every series
 * hub, the feeds, the sitemap and llms.txt, and they all carry `posts` for
 * exactly this call.
 *
 * NOT `purgeEverything`. That would take the hand-authored pages with it, which
 * no publish changes, and it is the mode with the least ability to be wrong
 * about what it did.
 */
export async function purgePosts(why: string): Promise<boolean> {
  return purgeTags([cacheTags()], why);
}

/**
 * Invalidate the hand-authored pages. EXPORTED AND UNCALLED, deliberately.
 *
 * `PAGES_CACHE_TAG` is on every shared-cacheable page that does not read the
 * corpus, and nothing purges it because nothing changes those pages except a
 * deploy, which already invalidates every entry through the Worker version in
 * the key. This exists so the tag has a named door rather than being a string
 * with no reader, and so the next person who needs it does not invent a second
 * spelling. If it still has no caller a year from now, delete both.
 */
export async function purgePages(why: string): Promise<boolean> {
  return purgeTags([PAGES_CACHE_TAG], why);
}
