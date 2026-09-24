/**
 * A document rule, not a URL list: it derives from the links on the page, so it cannot go stale.
 */

export const EXCLUDED_PREFIXES = ["/admin", "/api", "/media"];

// `/search/ask` is billed: speculating it would spend model tokens on a click nobody made.
export const EXCLUDED_PATHS = ["/login", "/theme", "/search/ask"];

export const EXCLUDED_SUFFIXES = [".md", ".xml", ".json", ".txt"];

/**
 * Not `immediate`: a cookie-carrying reader bypasses the cache, so immediate cost 4 to 5 extra
 * origin document requests per page load. Chrome caps moderate speculations in flight.
 */
export const DOCUMENT_EAGERNESS = "moderate";

/**
 * Not `prerender`: moderate starts on pointerdown, and activating a prerender that has not painted
 * swaps in a blank frame (measured in Chrome 151). Prefetch keeps paint holding and stays credentialed.
 */
export const DOCUMENT_ACTION = "prefetch";

/**
 * @param {object} args
 * @param {string} args.pathname the page the rules are being rendered on
 * @returns {string} the JSON payload for the speculationrules script
 */
export function buildSpeculationRules({ pathname }) {
  /** @param {string} pattern */
  const not = (pattern) => ({ not: { href_matches: pattern } });

  // The positive clause is a pathname pattern, which makes the rule same-origin by construction.
  const conditions = [
    { href_matches: "/*" },
    ...EXCLUDED_PREFIXES.flatMap((prefix) => [not(prefix), not(`${prefix}/*`)]),
    ...EXCLUDED_PATHS.map(not),
    ...EXCLUDED_SUFFIXES.map((suffix) => not(`/*${suffix}`)),
    /*
     * A URLPattern `search` component, not a pathname glob: the glob spelling silently excludes
     * every link on the page.
     */
    { not: { href_matches: { search: "(.+)" } } },
    not(pathname),
  ];

  return JSON.stringify({
    [DOCUMENT_ACTION]: [{ where: { and: conditions }, eagerness: DOCUMENT_EAGERNESS }],
  });
}
