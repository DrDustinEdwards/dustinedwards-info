/**
 * Accept-header negotiation, shared by every route that has more than one
 * representation, and by the Worker's own cache key.
 *
 * Extracted from markdown-twin.ts when /search gained a JSON representation.
 * There is one q-value parser on purpose: a second one would drift, and the
 * failure mode is silent, since a browser that starts receiving JSON still
 * renders something.
 *
 * **PLAIN JAVASCRIPT SINCE 2026-08-27, and the extension is the point.** This
 * was `negotiate.ts` until the themed cache started answering requests before
 * any route ran, which made these predicates load-bearing for correctness
 * rather than for formatting. `check:tests` runs `node --test` over `test/`
 * and cannot import TypeScript, so the file that decides which representation
 * a reader gets was the one file no test could reach. Same move, same reason,
 * as `https-redirect.mjs` and `analytics-path.mjs`; the types are JSDoc and
 * `checkJs` is on, so `tsc -b` grades this exactly as it graded the .ts.
 */

/**
 * The q-value a client gave each media range, highest wins on repeats.
 *
 * A missing q defaults to 1, per RFC 9110. Parameters other than q are ignored.
 *
 * @param {Request} request
 * @returns {Map<string, number>}
 */
export function acceptQValues(request) {
  /** @type {Map<string, number>} */
  const values = new Map();
  const accept = request.headers.get("accept");
  if (!accept) return values;

  for (const part of accept.split(",")) {
    const [range, ...params] = part.trim().split(";");
    const type = range.trim().toLowerCase();
    if (!type) continue;

    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key?.trim().toLowerCase() === "q") {
        const parsed = Number.parseFloat(value ?? "");
        if (!Number.isNaN(parsed)) q = parsed;
      }
    }

    values.set(type, Math.max(values.get(type) ?? -1, q));
  }

  return values;
}

/**
 * Media ranges that mean "a browser, or a client with no opinion".
 *
 * `*_/_*` and `text/*` are what something sends when it does not care, and HTML
 * is the default representation, so they count as votes for HTML rather than
 * as votes for whatever else is on offer.
 */
const HTML_RANGES = ["text/html", "text/*", "*/*"];

/**
 * The highest weight the client put on any range that means HTML.
 *
 * ONE STATEMENT OF IT, because both predicates below compare against it and a
 * second copy would let them disagree about what a browser is. `-1` for a
 * client that named no HTML range at all, so that any positive q beats it.
 *
 * @param {Map<string, number>} values
 * @returns {number}
 */
function htmlWeight(values) {
  let html = -1;
  for (const range of HTML_RANGES) {
    html = Math.max(html, values.get(range) ?? -1);
  }
  return html;
}

/**
 * True when the client asked for `wanted` in preference to HTML.
 *
 * Compares q-values rather than substring-matching the header. A browser sends
 * `text/html,application/xhtml+xml,...` and must keep getting HTML; an agent
 * sending `Accept: application/json` must get JSON. A client that lists both at
 * equal weight gets HTML, because that is the older behaviour and the safer
 * default for anything that guessed.
 *
 * @param {Request} request @param {string} wanted
 * @returns {boolean}
 */
export function prefersType(request, wanted) {
  const values = acceptQValues(request);
  const target = values.get(wanted.toLowerCase()) ?? -1;
  return target > 0 && target > htmlWeight(values);
}

/**
 * True when this request would be answered with something OTHER than HTML.
 *
 * ## WHY THE WORKER'S CACHE NEEDS THIS, measured on the wire 2026-08-27
 *
 * `workers/app.ts` keys its own `caches.default` entry on the request URL plus
 * the resolved theme. Two routes serve more than one representation at ONE
 * URL: `/blog/:slug` answers `Accept: text/markdown` with markdown, and
 * `/search` answers `Accept: application/json` with JSON. Both declare
 * `Vary: Accept`, which the platform in front honours and which
 * `caches.default` cannot: it is keyed by the Request handed to it and carries
 * no headers at all.
 *
 * So the HTML representation was stored under a key the markdown request also
 * matched, and MEASURED IN PRODUCTION on the deploy of 2f0b4d5:
 * `Accept: text/markdown` on `/blog/ten-years-on-cloudflare` returned 31,869
 * bytes of `text/html` with `x-theme-cache: hit`. `verify-live` caught it as
 * two failures, "the Accept form and the .md path return the same markdown"
 * and "search: JSON twin negotiates".
 *
 * ## WHY A BYPASS RATHER THAN A KEY DIMENSION
 *
 * An `__accept` dimension would work and would fragment the entry by the exact
 * Accept string, which differs between browsers and browser versions, so the
 * HTML entry every reader shares would split several ways to serve a
 * representation that is `no-store` and never stored anyway. A request that
 * negotiates away from HTML skips the lookup and the store instead: it costs
 * those clients a render they were always paying for, and leaves the shared
 * entry undivided for the readers it exists for.
 *
 * THE PREDICATE IS DELIBERATELY WIDER THAN THE TWO ROUTES. It asks whether the
 * client preferred anything non-HTML, not whether this particular path offers
 * it, so a route that gains a third representation tomorrow is already
 * excluded rather than depending on somebody remembering this file. The cost
 * of being wide is a cache miss; the cost of being narrow is serving the wrong
 * bytes.
 *
 * A client sending no `Accept` at all, or `*_/_*`, is a vote for HTML and stays
 * cacheable. `prefersType(request, x)` implies this for every x, because both
 * compare against the same `htmlWeight`.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function negotiatesAwayFromHtml(request) {
  const values = acceptQValues(request);
  if (values.size === 0) return false;

  const html = htmlWeight(values);
  for (const [type, q] of values) {
    if (HTML_RANGES.includes(type)) continue;
    if (q > 0 && q > html) return true;
  }
  return false;
}
