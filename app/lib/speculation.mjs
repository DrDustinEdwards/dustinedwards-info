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
 * eagerness the old list used. The header's behaviour is therefore UNCHANGED by
 * this file; everything else on the page gained.
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
 * Chrome caps moderate prerenders at TWO, FIFO, so a reader sweeping a page
 * costs at most two speculations in flight rather than one per link.
 *
 * ## WHAT IT EXCLUDES, AND WHY EACH ONE
 *
 * `/admin` and its subtree      a plane with its own shell, gated by auth
 * `/api` and its subtree        endpoints, and `/api/operator` takes a bearer
 * `/media` and its subtree      bytes, not documents
 * `/login`                      a door; prerendering it warms nothing
 * `/theme`                      a POST target, and a GET of it is not a page
 * `/search/ask`                 a BILLED endpoint. Prerendering it would spend
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
 *                               evict a useful one from the two-slot budget.
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
    prerender: [{ where: { and: conditions }, eagerness: DOCUMENT_EAGERNESS }],
  });
}
