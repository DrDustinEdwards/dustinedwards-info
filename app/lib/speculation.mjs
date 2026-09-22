/**
 * THE SPECULATION RULES PAYLOAD, in one place, since 2026-08-28.
 *
 * ONE RULE. It replaces two components that each carried their own literal rule
 * object: `SiteSpeculation`, a `urls` list of the header's five paths, and
 * `BlogSpeculation`, a blog-prefix document rule rendered on the two blog
 * routes. Between them they covered the header and posts reached from a blog
 * page, and NOTHING ELSE: `/colophon`, `/privacy`, `/search` and a post linked
 * from anywhere but a blog page were reached by a cold document load. Measured
 * on production 2026-08-28 through CDP, a footer click to `/colophon` reported
 * `deliveryType` empty and produced no preloading attempt of any kind, against
 * `navigational-prefetch` on every header and post click.
 *
 * ## WHY A DOCUMENT RULE AND NOT A LIST, which is the whole change
 *
 * A list has to be maintained against the links that actually exist, and this
 * repo has the measurement saying it will not be: the blog rule covered posts
 * only because posts share a prefix, and the moment a page linked somewhere
 * else the rules said nothing about it. A document rule is DERIVED from the
 * links in the document, which is the same "derive, do not mirror" principle
 * that `~/lib/nav` was written for, applied to the thing nav was mirroring.
 *
 * **THE HEADER NO LONGER NEEDS A RULE OF ITS OWN**, and that is why
 * `HEADER_PATHS` lost its second consumer. A header link is an `<a href>` in
 * the document like any other, so `"/*"` already covers it at the same
 * eagerness the old list used. The header's behavior is therefore UNCHANGED by
 * this file; everything else on the page gained.
 *
 * ## THE ACTION IS `prefetch`, AND IT WAS `prerender` UNTIL 2026-08-28
 *
 * A prerendered document that has NOT PAINTED YET is still activatable, and
 * `moderate` eagerness starts the speculation on pointerdown, so a click with
 * no hover dwell activates an empty frame. Activation is a SWAP of the primary
 * frame host, not a navigation that keeps the old surface, so the browser's
 * paint holding never gets to run and the reader sees the themed canvas with
 * nothing on it until the destination's first contentful paint.
 *
 * Measured on production by screen capture, no CDP, on this Windows machine.
 * Fourteen runs, both themes, no-dwell clicks plus rapid alternation: with
 * prerendering on, all seven runs showed blank frames, every one of them 100%
 * of the `--paper` token at a luma standard deviation of ZERO, in light and in
 * dark. With prerendering off at the browser, none of the seven did. Chrome
 * 151.0.7922.172.
 *
 * **Prefetch warms the same response without creating a frame host to
 * activate**, so the click is an ordinary same-origin navigation, paint holding
 * keeps the previous page on screen, and the warmed response is what arrives.
 * The request stays credentialed: measured on the wire, a `prefetch` rule sends
 * `Sec-Purpose: prefetch` and carries the reader's cookie, so it still warms
 * the themed-cache entry a cookie-carrying reader will be served from.
 *
 * The cost is stated rather than hidden: a COMPLETED prerender is instant and a
 * prefetch is not. What replaces it is a snap whose length is the destination's
 * first contentful paint. That trade was taken deliberately, because the
 * instant case was the rare one and the empty-activation case was the one
 * Dustin kept seeing.
 *
 * ## EAGERNESS: `moderate`, ruled by Dustin 2026-08-28
 *
 * An `immediate` rule for the header's destinations was built and measured
 * first, on the reading that the spec's "keep the header targets immediate"
 * asked for it. **It cost 4 to 5 extra credentialed document requests on EVERY
 * public page load**, measured on the preview build, taking origin document
 * requests per page view from one to five or six, because a cookie-carrying
 * reader bypasses the platform cache (rule 8) and each speculation therefore
 * reaches this Worker. Reverted on Dustin's verdict: the cost is real and the
 * coverage gain came from the document rule, not from the eagerness.
 *
 * `moderate` is 200 ms of pointer hold OR pointerdown, whichever comes first.
 * Chrome caps moderate speculations, so a reader sweeping a page costs a
 * bounded number in flight rather than one per link. The cap was the reason
 * `moderate` was chosen over `immediate` and it survives the action change; the
 * exact figure is Chrome's and is deliberately not restated here.
 *
 * ## WHAT IT EXCLUDES, AND WHY EACH ONE
 *
 * `/admin` and its subtree      a plane with its own shell, gated by auth
 * `/api` and its subtree        endpoints, and `/api/operator` takes a bearer
 * `/media` and its subtree      bytes, not documents
 * `/login`                      a door; speculating it warms nothing
 * `/theme`                      a POST target, and a GET of it is not a page
 * `/search/ask`                 a BILLED endpoint. Speculating it would spend
 *                               model tokens on a click nobody made.
 * `.md` `.xml` `.json` `.txt`   the representation twins, both feeds, the
 *                               sitemap, robots and the two llms files. None is
 *                               a document a reader navigates to, and
 *                               `/blog/rss.xml` WAS being speculated: it
 *                               appeared in Chrome's own attempt-sources list
 *                               under the old blog-prefix rule, measured
 *                               2026-08-28.
 * any URL carrying a query      `?tag=`, `?page=`, `?q=`. These are filtered
 *                               views whose result set is a database read, and
 *                               a document rule over them would speculate a
 *                               different one for every tag chip on `/blog`.
 * the current path              a page cannot navigate to itself, and the
 *                               speculation costs an origin request that can
 *                               evict a useful one from the moderate budget.
 *                               Carried over from the 2026-08-27 self-exclusion.
 */

/** Whole subtrees that are never speculated. Prefix AND subtree, both stated. */
export const EXCLUDED_PREFIXES = ["/admin", "/api", "/media"];

/** Exact paths that are never speculated. */
export const EXCLUDED_PATHS = ["/login", "/theme", "/search/ask"];

/** Extensions that are never speculated, because none of them is a page. */
export const EXCLUDED_SUFFIXES = [".md", ".xml", ".json", ".txt"];

/** Named rather than inlined, so a gate reads the value instead of a spelling. */
export const DOCUMENT_EAGERNESS = "moderate";

/**
 * The speculation ACTION, named for the same reason as the eagerness: the gates
 * assert the value rather than a spelling, and it is the one thing that moved
 * on 2026-08-28. See the action section at the top of this file.
 */
export const DOCUMENT_ACTION = "prefetch";

/**
 * Build the payload for one page.
 *
 * @param {object} args
 * @param {string} args.pathname the page the rules are being rendered on
 * @returns {string} the JSON payload for the speculationrules script
 */
export function buildSpeculationRules({ pathname }) {
  /** @param {string} pattern */
  const not = (pattern) => ({ not: { href_matches: pattern } });

  /*
   * ORDER IS NOT SEMANTIC in an `and`, so these are grouped by what they are
   * about rather than by how they match. Every clause is a `not` except the
   * first, which is what gives the rule a scope: without it the `and` would be
   * a list of exclusions over nothing, which matches every link there is.
   *
   * The positive clause is a PATHNAME pattern, so its origin comes from the
   * document and the rule is SAME-ORIGIN by construction rather than by a
   * clause anyone could delete.
   */
  const conditions = [
    { href_matches: "/*" },
    ...EXCLUDED_PREFIXES.flatMap((prefix) => [not(prefix), not(`${prefix}/*`)]),
    ...EXCLUDED_PATHS.map(not),
    ...EXCLUDED_SUFFIXES.map((suffix) => not(`/*${suffix}`)),
    /*
     * ANY non-empty query, as a URLPattern COMPONENT rather than as a pathname
     * glob, and the wrong spelling was PLANTED rather than reasoned about.
     *
     * **MEASURED 2026-08-28: the pathname-glob spelling does not merely fail to
     * exclude query URLs, it collapses the whole document rule.** Chrome
     * resolved ZERO candidates on every page: no post, no `/colophon`, no
     * `/privacy`, no `/search`. This comment first said it "would match
     * nothing", which was a prediction dressed as a measurement; what it
     * actually does is exclude everything, which is worse and silent, because a
     * page whose rule set speculates nothing looks exactly like a page whose
     * rule set is good.
     *
     * Inside a `not`, a pattern that over-matches over-EXCLUDES: safe for
     * correctness, expensive for coverage.
     */
    { not: { href_matches: { search: "(.+)" } } },
    not(pathname),
  ];

  return JSON.stringify({
    [DOCUMENT_ACTION]: [{ where: { and: conditions }, eagerness: DOCUMENT_EAGERNESS }],
  });
}
