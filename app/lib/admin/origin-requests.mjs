// The route component reads these on the client too, where a `.server` module is stubbed
// out and every imported value arrives undefined. So they live here, not in traffic.server.ts.

export const WINDOW_DAYS = 7;

export const TOP_N = 20;

// Measured: a cache HIT produced no Analytics Engine point; the cold fetch produced one 72s later.
// Copy rule: never "visits", "visitors", "traffic" or "page views"; this number is none of them.
export const CACHE_SENTENCE =
  "Cached responses never reach the Worker, so they are not counted here. " +
  "Measured on this site by fetching one path twice, cold then cached: the cold " +
  "fetch produced a data point and the cached fetch produced none. What people " +
  "actually requested is therefore higher than these numbers, by however much " +
  "the edge served. A point also takes about a minute to arrive, 72 seconds when " +
  "it was measured, so a request from the last minute may not be here yet.";

// The query is ORDER BY ... LIMIT, so a limit is a cut. Set well above the site's path count; the
// caller compares it to `pathsReturned`, and a post below the cut is UNKNOWN, never zero.
export const READERSHIP_PATH_LIMIT = 200;

/**
 * Matches `recordTraffic` in workers/app.ts, which stores `url.pathname` verbatim.
 *
 * @param {string} slug
 * @returns {string}
 */
export function postReadershipPath(slug) {
  return `/blog/${slug}`;
}

// One sentence per cause: a dash with no sentence beside it reads as zero.
export const READERSHIP_ABSENT = {
  source: "No number: ",
  truncated:
    "No number: more paths had activity than this view asks for, so this post " +
    "may or may not be among them. Not zero.",
};
