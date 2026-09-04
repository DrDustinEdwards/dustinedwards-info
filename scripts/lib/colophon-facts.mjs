/**
 * Every discrete fact each colophon section's RECORD BODY was assembled from,
 * as needles to match against the RENDERED page.
 *
 * ## Why this is a module rather than a closure inside verify-live
 *
 * It is the colophon's SECOND registration site. `colophonPageInput` in
 * `app/lib/colophon-sections.mjs` is the first: add a section to
 * `COLOPHON_SECTIONS` without a body rule there and the build throws, offline,
 * on every clone. Add one without a fact list HERE and nothing said a word
 * until `verify-live` ran against a deploy, which needs a deploy and bills an
 * Ask probe.
 *
 * That is exactly what happened. The `security` section shipped in ship window
 * 8 with its body rule and without its fact list, and `verify-live` crashed on
 * `no fact list for colophon section "security"`. **The throw was correct**: it
 * failed closed on an unknown section rather than sweeping it as its lead alone.
 * The defect was that the throw was the FIRST thing to notice, and it noticed
 * after the deploy.
 *
 * Extracted so `test/colophon-facts.test.mjs` can assert offline that every
 * section in the descriptor has a non-empty fact list. A pure function is the
 * only part of a harness a test can hold, which is why `readCapped` and
 * `confirmationSatisfied` were extracted for the same reason.
 *
 * ## What was deliberately NOT done: deriving this from colophonPageInput
 *
 * The obvious close is to generate these needles from the record body the
 * indexer builds. **That would destroy the only thing this sweep is for.**
 *
 * `colophonPageInput` produces one joined STRING per section for the search
 * index. This produces DISCRETE needles delimited by element boundaries, and
 * the two are checked against different artifacts: the record body against the
 * index, these against the rendered HTML. A gate whose expected values are
 * produced by the process it checks cannot fail (hard rule 10, fixture
 * independence), and two independent sources is the property this sweep exists
 * to have. Deriving would leave the page and the index agreeing with each
 * other and with nothing else.
 *
 * So the two lists stay independently authored, and the test asserts COVERAGE
 * of the section set rather than equality of the values. That is the half that
 * can be mechanised without collapsing the two sources into one.
 *
 * @see app/lib/colophon-sections.mjs, scripts/verify-live.mjs
 */

import { AI_DISCLOSURE, SECURITY_TRADEOFF, statusLabel } from "../../app/lib/colophon-sections.mjs";

/**
 * Element-delimited, so a token cannot pass on a neighbour's substring.
 *
 * `react` is a substring of `react-dom` and `react-router`, so a bare
 * `includes("react")` survives the react entry being dropped entirely. That is
 * the "token that cannot fail" case, which reads as coverage and is worse than
 * a missing check. `>react<` is the rendered `<code>` and fails.
 *
 * @param {string} v
 */
export const el = (v) => `>${v}<`;

/**
 * The fact needles for one section.
 *
 * Read from the same two JSON files the page renders, never restated here.
 *
 * **`notAdopted[].status` IS swept, and its absence here is why the defect
 * survived.** Until 2026-08-05 the record body carried the raw enum,
 * `(refused)` and `(accepted-gap)`, while the page rendered the label through a
 * STATUS_LABEL that lived in `colophon.tsx`. For `accepted-gap` the hyphen
 * meant the indexed token was on the page in no casing at all. The map moved
 * into the descriptor so both readers share it, and the token is swept through
 * `statusLabel()` rather than as a literal, so this assertion cannot drift from
 * what the page renders.
 *
 * Callers match these against HTML that has already had comments stripped and
 * character references decoded. React escapes `'` to `&#x27;`, so prose taken
 * from a data file matches only after that decode.
 *
 * @param {any} stack    content/generated/stack.json
 * @param {any} features content/features.json
 * @param {string} id    a section id from COLOPHON_SECTIONS
 * @returns {string[]}
 */
export function colophonFacts(stack, features, id) {
  if (id === "runtime")
    return [
      el(stack.runtime.compatibilityDate),
      ...stack.runtime.compatibilityFlags.map(el),
      el(stack.runtime.nodeVersion),
    ];
  if (id === "bindings")
    return stack.bindings.flatMap((/** @type {any} */ b) => [
      el(b.name),
      `(${b.kind})`,
      el(b.what),
      b.whyLoadBearing,
    ]);
  if (id === "schema") return stack.migrations.map(el);
  if (id === "gates") return stack.gates.map(el);
  if (id === "dependencies")
    return stack.dependencies.flatMap((/** @type {any} */ d) => [el(d.name), el(d.range)]);
  if (id === "features")
    return features.features.flatMap((/** @type {any} */ f) => [
      el(f.component),
      el(f.name),
      el(f.what),
    ]);
  if (id === "security")
    /*
     * The sentences themselves. The page renders each as its own `<p>`, so the
     * element delimiters are exact, and they come from the SAME constant the
     * record body is built from, which is the whole point of that constant.
     *
     * This is the branch whose absence crashed verify-live after ship window 8.
     */
    return SECURITY_TRADEOFF.map(el);
  if (id === "ai")
    /*
     * The sentences themselves, from the SAME constant the record body is built
     * from, and the page renders each as its own `<p>` so the element
     * delimiters are exact. Identical treatment to `security` above, and added
     * WITH the section rather than after a deploy crashed on its absence, which
     * is the defect this file's header records.
     */
    return AI_DISCLOSURE.map(el);
  if (id === "not-adopted")
    return stack.notAdopted.flatMap((/** @type {any} */ n) => [
      `${n.name} <`,
      `(${statusLabel(n.status)})`,
      el(n.reason),
    ]);
  // Fail closed, for the reason colophonPageInput does: a section added to the
  // descriptor with no rule here would be swept as its lead alone, which passes
  // and proves nothing about the content underneath it.
  //
  // KEPT, even though test/colophon-facts.test.mjs now catches the omission
  // offline. The test is the early warning; this is the guarantee. A section id
  // can reach here from something the test does not enumerate, and sweeping a
  // section as its lead alone must never be the quiet outcome.
  throw new Error(`verify-live has no fact list for colophon section "${id}"`);
}
