/**
 * The path an analytics row is allowed to carry.
 *
 * PURE, and `.mjs`, for the same reason `preview-token.mjs` is: this is a rule
 * about what leaves the Worker and lands in a store nobody can edit afterwards,
 * so it is testable by `node --test` rather than only observable on a deploy.
 *
 * ## Why this exists, measured on production 2026-08-15
 *
 * The capture in `workers/app.ts` wrote `url.pathname` verbatim into the dataset
 * and used it as the sampling index. The first real use of a draft preview link
 * therefore stored the WHOLE 43-character capability token in Analytics Engine,
 * and `/admin/origin-requests` rendered it in full as a row label:
 *
 *     /preview/CPWahe1WuFGSMh0pOltNbJBwYLxzJzAuRvpSyOBLstI    4
 *
 * That defeats the drawer's six-character truncation, which exists precisely so
 * a live capability is never printed on a screen somebody might share. Worse, it
 * OUTLIVES the thing it names: the token expires in seven days and revocation
 * deletes it from KV, while an Analytics Engine row is immutable and ages out
 * only with the dataset's retention.
 *
 * ## What the fix trades away, stated
 *
 * ONE ROW PER REQUEST IS UNCHANGED. Only the identifier is removed, so the count
 * of preview reads stays exactly as truthful as every other path's count. What
 * is lost is the ability to tell two preview links apart in analytics, which was
 * never a question the panel should have been able to answer.
 *
 * The sampling index changes with it, and that is an improvement rather than a
 * cost: a distinct index per token fragmented the sampling key space with
 * values that each appear a handful of times, which is the worst possible shape
 * for a sampling key.
 *
 * ## Residual, bounded and accepted
 *
 * **AE ROWS ARE IMMUTABLE.** Tokens already recorded before this landed cannot
 * be redacted, deleted or rewritten. They age out with the dataset's retention
 * and nothing here reaches them. The exposure is bounded on two sides: a token
 * stops working after its seven day TTL whatever the dataset remembers, and
 * reading the dataset at all requires `ANALYTICS_READ_TOKEN`, which is a Worker
 * secret. Accepted on that basis in decisions vol 6.
 */

/**
 * The literal recorded in place of any preview path.
 *
 * A ROUTE PATTERN, not a redaction marker, and the choice is deliberate: it
 * reads in the admin panel as the thing it is, one row per preview read, rather
 * than as something withheld. `[redacted]` would invite somebody to go looking
 * for the unredacted version.
 */
export const PREVIEW_PATH_LABEL = "/preview/:token";

/** The prefix whose remainder is a capability. Matches `routes.ts`. */
const PREVIEW_PREFIX = "/preview/";

/**
 * The path safe to store for a request.
 *
 * Everything that is not a preview passes through UNCHANGED. This is not a
 * general-purpose scrubber and must not become one: a function that rewrote
 * paths by guessing which segments look secret would be wrong in both
 * directions, silently. It knows about exactly one route, because exactly one
 * route puts a secret in its path.
 *
 * @param {string} pathname a URL pathname, already parsed by the caller
 * @returns {string} the pathname, or the preview label
 */
export function analyticsPath(pathname) {
  if (typeof pathname !== "string") return "";
  // The bare `/preview` with no token carries no capability and is not a preview
  // read either; it has no route, so it never reaches the capture. Handled by
  // the prefix requiring the trailing slash rather than by a second branch.
  return pathname.startsWith(PREVIEW_PREFIX) ? PREVIEW_PATH_LABEL : pathname;
}

/**
 * Whether a stored path still carries a token. For tests and for a reader.
 *
 * Deliberately NOT used by `analyticsPath` itself. A rule and its check written
 * as one function cannot disagree, which sounds like a virtue and means the
 * check can never catch the rule being wrong.
 *
 * @param {string} stored a path as it would be recorded
 * @returns {boolean}
 */
export function carriesPreviewToken(stored) {
  return typeof stored === "string" && /\/preview\/[A-Za-z0-9_-]{43}/.test(stored);
}
