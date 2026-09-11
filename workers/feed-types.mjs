/**
 * Which content types get no Content-Security-Policy, as a function both the
 * Worker and its gate call.
 *
 * **IT LIVES HERE RATHER THAN IN `app.ts` FOR THE REASON `csp.mjs` DOES.** The
 * policy is conditional, and a list inside the Worker can only be checked by a
 * regex over the source, which reads the SPELLING of the list rather than the
 * answer the Worker gives. `check:headers` imports this and calls it with the
 * content-type each feed route actually declares, so a route and the exemption
 * list cannot drift apart without something failing.
 *
 * That drift is not hypothetical. Measured on the live host 2026-09-11:
 * `/blog/atom.xml` served a full CSP carrying a per-request nonce on a body
 * stored with `s-maxage=600`, and so did `/sitemap.xml`, while the comment at
 * the list called it "the two feeds". The list had been written when Atom did
 * not exist and nothing could see the route arrive.
 *
 * ## WHY A CSP IS TAKEN OFF THESE AT ALL, measured 2026-08-27
 *
 * A Content-Security-Policy governs what a DOCUMENT may load and execute. A
 * feed is parsed by a reader, not rendered as a browsing context, so the policy
 * on one has nothing to govern. On the wire it was 476 bytes of header on
 * `/blog/rss.xml`, whose whole body is 2,612, and it carried a PER-REQUEST
 * NONCE, which makes every response byte-unique for a header nobody applies.
 * On a body the shared cache stores that is worse than waste: the nonce in the
 * stored copy is served to every later reader.
 *
 * NAMED TYPES, not a negation of `text/html`. A negation would silently strip
 * the policy from anything whose content-type this Worker has not thought about
 * yet, including a route that starts serving a document under an unusual type.
 * The list grows by somebody deciding it should, and now by a gate noticing
 * that a route declares a type the list has not been told about.
 *
 * `application/xml` is the SITEMAP rather than a feed, and it is in the list on
 * the same reasoning: a crawler parses it, no browser renders it as a browsing
 * context, and it is served from the shared cache. The function is named for
 * the majority of its members, not for all of them.
 *
 * `X-Content-Type-Options: nosniff` is NOT part of this and stays on every
 * response: it is what stops a browser deciding a feed is HTML in the first
 * place, so removing the policy is safe only while that header is universal.
 */

/**
 * The exempt types, exported so a gate can report the whole set rather than
 * probing it one string at a time.
 *
 * @type {ReadonlySet<string>}
 */
export const UNPOLICED_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/json",
  "application/xml",
]);

/**
 * True for a response no browser will ever treat as a document.
 *
 * @param {string | null} contentType the response's own content-type, or null
 * @returns {boolean}
 */
export function isFeed(contentType) {
  if (!contentType) return false;
  // `split` always yields at least one element, so the fallback is
  // unreachable; an empty type falls through to the lookup below and answers
  // false, which is what an empty content-type should answer.
  const type = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  return UNPOLICED_TYPES.has(type);
}
