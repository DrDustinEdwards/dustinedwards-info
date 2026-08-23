/**
 * WHO IS ALLOWED TO SPEND THE ASK BUDGET.
 *
 * ## The threat, stated precisely, because it is not the usual one
 *
 * Ask is ANONYMOUS. There is no session, no cookie and no ambient authority to
 * borrow, so the classic CSRF story does not apply and `SameSite` buys nothing
 * here. What a third-party page CAN do is make its own visitors' browsers POST
 * to this endpoint, and every one of those POSTs costs real money: a Workers AI
 * generation against a daily ceiling shared by everyone.
 *
 * So the asset being protected is the BUDGET, not a user's identity, and the
 * attack is a foreign page spending it with other people's IP addresses. The
 * per-IP limiter cannot see that: a thousand readers of one hostile page are a
 * thousand different IPs, each comfortably inside its own allowance.
 *
 * ## Why an Origin check is the right instrument
 *
 * A browser sets `Origin` on every POST it issues and a page cannot forge it,
 * which makes it the one field on a cross-site request that the attacker does
 * not control. That is exactly the property needed here.
 *
 * ## ABSENT Origin IS ALLOWED, and this is the part worth reading
 *
 * A missing header is not treated as a refusal. Who sends none:
 *
 *   - **non-browser clients**: curl, scripts, anything hand-rolled. They send
 *     no Origin because nothing makes them.
 *   - **very old Safari** on same-origin form submissions. Current Safari,
 *     Chrome and Firefox all send it.
 *
 * THE GAP IS ACCEPTABLE BECAUSE IT IS NOT THE THREAT. A script that omits
 * Origin is spending its OWN IP's allowance, which the per-IP limiter and the
 * daily ceiling already bound; it is not borrowing a crowd. The whole value of
 * this check is that a hostile PAGE cannot conscript its readers, and a hostile
 * page cannot omit the header. Refusing absent Origin would buy nothing against
 * the attack and would break the no-script `<form method="post">` this route's
 * body parsing was deliberately written to accept.
 *
 * ## `Origin: null` IS REFUSED, and it is not the same as absent
 *
 * The literal string "null" is what a sandboxed iframe and some cross-origin
 * redirects send. That is a real browser request from an opaque origin, which
 * is precisely the shape a hostile page uses, so it is refused. A JavaScript
 * `null` from `headers.get()` means the header was not present at all. Two
 * different things one character apart, and the tests hold them apart.
 *
 * @see test/ask-origin.test.mjs
 * @see app/routes/search.ask.ts
 */

/**
 * May this request spend Ask budget?
 *
 * Compared against the REQUEST'S OWN origin rather than the exported
 * `SITE_ORIGIN`. The site is pre-cutover and answers on workers.dev today and
 * on the apex later; pinning the comparison to a constant would refuse every
 * real request from whichever host is not the constant, and would do it at the
 * moment of the cutover, when everything else is also moving.
 *
 * @param {string | null | undefined} origin the `Origin` header, verbatim
 * @param {string} requestUrl the request's own URL
 * @returns {{ ok: boolean, reason: string }}
 */
export function askOriginVerdict(origin, requestUrl) {
  if (origin === null || origin === undefined || origin === "") {
    return { ok: true, reason: "absent" };
  }

  let self;
  try {
    self = new URL(requestUrl).origin;
  } catch {
    // An unparseable request URL cannot be shown to match, so it does not.
    return { ok: false, reason: "unparseable-request-url" };
  }

  if (origin === self) return { ok: true, reason: "same-origin" };
  return { ok: false, reason: "cross-origin" };
}

/** What a refused caller is told. Nothing about the corpus, the budget or Ask. */
export const ASK_ORIGIN_REFUSAL = "Ask does not take cross-origin requests.";
