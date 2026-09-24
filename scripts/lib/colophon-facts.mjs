/**
 * Every discrete fact each colophon section's RECORD BODY was assembled from, as needles to match
 * against the RENDERED page.
 *
 * BOUNDARY: these are authored independently of the record body rather than derived from it,
 * because the vacuity rule is that a gate whose expected values are produced by the process it checks
 * cannot fail, so the test asserts COVERAGE of the section set rather than equality of the values.
 *
 * @see app/lib/colophon-sections.mjs, scripts/verify-live.mjs
 */

import { AI_DISCLOSURE, SECURITY_TRADEOFF, statusLabel } from "../../app/lib/colophon-sections.mjs";

/**
 * Element-delimited, so a token cannot pass on a neighbor's substring: one dependency name is a
 * substring of two others, so a bare `includes` survives its entry being dropped entirely.
 *
 * @param {string} v
 */
export const el = (v) => `>${v}<`;

/**
 * The fact needles for one section, read from the same two JSON files the page renders.
 *
 * The status is swept through `statusLabel()` rather than as a literal, so this cannot drift from
 * what the page renders; the raw enum was indexed while the page rendered a label, and for one
 * value the token was on the page in no casing at all. Callers match these against HTML that has
 * had comments stripped and character references decoded.
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
     * The sentences themselves, from the SAME constant the record body is built from; the page
     * renders each as its own `<p>`, so the element delimiters are exact.
     */
    return SECURITY_TRADEOFF.map(el);
  if (id === "ai")
    /* Identical treatment to the section above, and from the same constant. */
    return AI_DISCLOSURE.map(el);
  if (id === "not-adopted")
    return stack.notAdopted.flatMap((/** @type {any} */ n) => [
      `${n.name} <`,
      `(${statusLabel(n.status)})`,
      el(n.reason),
    ]);
  // Fail closed: a section added with no rule here would be swept as its lead alone, which passes
  // and proves nothing about the content underneath it. KEPT even though a test catches the omission
  // offline, the test being the early warning and this the guarantee.
  throw new Error(`verify-live has no fact list for colophon section "${id}"`);
}
