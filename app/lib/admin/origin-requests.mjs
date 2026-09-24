/**
 * Constants the origin-requests panel needs on BOTH sides of the boundary.
 *
 * WHY THIS FILE EXISTS, measured rather than anticipated. These three lived in
 * `traffic.server.ts` and the route component imported them from there. The
 * component renders on the client too, so the `.server` module is stubbed out
 * of that bundle and every imported value arrived `undefined`: the window and
 * the cap rendered as `Top NaN of 23 paths` and the pending caption sentence
 * vanished from the page entirely. Only the rendered markup shows that
 * failure.
 *
 * So anything the COMPONENT reads lives here, and `traffic.server.ts` keeps
 * only what touches the network: the query builders, the fetch and the token.
 * A `.server` module is for code that must never reach the client, not for
 * constants that must.
 */

/** Days of history the panel reports. Stated in the caption, not just here. */
export const WINDOW_DAYS = 7;

/** Paths displayed. The remainder is rolled up rather than dropped silently. */
export const TOP_N = 20;

/**
 * THE CACHE SENTENCE, MEASURED. It replaces a stated absence that stood here
 * from the day the panel was built until the token existed to answer it.
 *
 * ## WHAT WAS RUN, AND WHAT IT ESTABLISHED
 *
 * `npm run ae-probe`, 2026-08-14, against the live Worker with the read token
 * provisioned as a secret. Three legs were written; TWO of them are evidence
 * and the third is not, which is recorded here rather than rounded off:
 *
 *   W  plain GET, warming the edge. `cf-cache-status: EXPIRED`, so the request
 *      reached the Worker. IT PRODUCED A POINT, 72 seconds later.
 *   H  plain GET of the SAME URL, expecting the warmed edge to answer.
 *      `cf-cache-status: HIT`. NO POINT inside the 240 second cap.
 *   N  the documented cache bypass. It came back `HIT`, so the bypass did not
 *      bypass, and the leg tested NOTHING. It is not a third confirmation and
 *      it is not averaged into anything.
 *
 * **The finding rests on H alone, and H is enough.** Same URL, same method,
 * same client, one variable: whether the edge already had the response. The
 * miss produced a data point and the hit produced none, which is the direct
 * observation that a cache hit does not invoke the Worker and therefore is not
 * counted. Nothing about N weakens that; a leg that failed to create the
 * condition it was testing is silent, not contradictory.
 *
 * Sampling: weighted 2 against 2 raw rows, so the sampling interval was 1 and
 * sampling was NOT active at this volume. Ingestion lag: 72 seconds observed.
 *
 * ## WHY THE SENTENCE SAYS WHAT IT SAYS
 *
 * A reader looking at this panel wants to know whether the number is their
 * traffic. It is not, it is a FLOOR under it, and the size of the gap is
 * exactly the share the edge served, which this panel cannot see. Saying
 * "origin requests" in the heading is not enough on its own, because the word
 * does not tell a reader that the difference is the cache.
 *
 * The lag is in the sentence for the same reason: without it, a fresh request
 * that has not appeared yet reads as a panel that is broken.
 *
 * ## THE WORD THIS SENTENCE MAY NOT USE
 *
 * "visits", "visitors", "traffic" and "page views" are forbidden anywhere this
 * panel renders, because every one of them names something this number is
 * not. The first draft said "real traffic is therefore higher" and was refused, which is the copy law working on the very sentence
 * written to explain the copy law's subject. It says "what people actually
 * requested" instead.
 */
export const CACHE_SENTENCE =
  "Cached responses never reach the Worker, so they are not counted here. " +
  "Measured on this site by fetching one path twice, cold then cached: the cold " +
  "fetch produced a data point and the cached fetch produced none. What people " +
  "actually requested is therefore higher than these numbers, by however much " +
  "the edge served. A point also takes about a minute to arrive, 72 seconds when " +
  "it was measured, so a request from the last minute may not be here yet.";

/**
 * Paths the per-post readership read asks for.
 *
 * `trafficQuery` is ORDERED BY origin_requests DESC and LIMITed, so a limit is
 * a cut, not a page. This one is set well above the number of distinct paths
 * this site has ever had so the cut does not bite, and the caller compares it
 * against `pathsReturned` to KNOW whether it bit rather than assuming it did
 * not. When it does bite, a post missing from the result is reported as
 * UNKNOWN, never as zero: the query cannot tell "no origin requests" from
 * "below the cut" and neither may the column.
 */
export const READERSHIP_PATH_LIMIT = 200;

/**
 * The public route whose origin requests are a post's readership floor.
 *
 * `recordTraffic` in `workers/app.ts` writes `url.pathname` verbatim for
 * anything that is not a preview, so this is the exact key to look up. HTML
 * only and status 200 only, which means the markdown twin and every redirect
 * are already out of the dataset and out of this number.
 *
 * @param {string} slug
 * @returns {string}
 */
export function postReadershipPath(slug) {
  return `/blog/${slug}`;
}

/**
 * Why a post has no number, in the reader's words.
 *
 * ONE SENTENCE PER CAUSE, because "unavailable" covers two situations that a
 * reader would act on differently: the source is off, or the source is on and
 * this post fell outside what was asked for. Ruling 2 of the blog roadmap says
 * the fallback is that the number is ABSENT and the panel says which readers it
 * cannot see. A dash with no sentence beside it reads as zero, which is the one
 * thing this must never be mistaken for.
 */
export const READERSHIP_ABSENT = {
  /** The source could not be read at all. Carries the source's own message. */
  source: "No number: ",
  /** The source answered, but this path was below the query's cut. */
  truncated:
    "No number: more paths had activity than this view asks for, so this post " +
    "may or may not be among them. Not zero.",
};
