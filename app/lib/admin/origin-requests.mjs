/**
 * Constants the origin-requests panel needs on BOTH sides of the boundary.
 *
 * WHY THIS FILE EXISTS, measured rather than anticipated. These three lived in
 * `traffic.server.ts` and the route component imported them from there. The
 * component renders on the client too, so the `.server` module is stubbed out
 * of that bundle and every imported value arrived `undefined`: the window and
 * the cap rendered as `Top NaN of 23 paths` and the pending caption sentence
 * vanished from the page entirely. `check:admin-ui` caught it by rendering the
 * route and reading the markup, which is the only place that failure is
 * visible.
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
 * THE PENDING CAPTION SENTENCE.
 *
 * The caption owes a sentence saying whether a cached serve is counted, and
 * that sentence has to be MEASURED rather than reasoned: `npm run ae-probe`
 * answers it by fetching a live path three ways and watching which fetches
 * produce a data point. The probe has not been run, because it needs a token
 * that has not been minted.
 *
 * So the absence is NAMED rather than papered over. This constant exists to be
 * seen: `check:admin-ui` asserts it is present while the sentence is missing,
 * and `check:head` refuses to let it reach a deploy. Ship day is therefore loud
 * rather than silent, and the panel cannot go live claiming something nobody
 * measured.
 */
export const CACHE_SENTENCE_PENDING_PROBE =
  "Whether a cached serve is counted has not been measured yet. Run npm run ae-probe.";
