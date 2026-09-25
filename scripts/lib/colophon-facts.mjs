// Authored independently of the record body: expected values derived from the thing checked cannot fail.

import { AI_DISCLOSURE, SECURITY_TRADEOFF, statusLabel } from "../../app/lib/colophon-sections.mjs";

/**
 * Element-delimited: one dependency name is a substring of two others, so a bare `includes`
 * survives its entry being dropped.
 *
 * @param {string} v
 */
const el = (v) => `>${v}<`;

/**
 * Status goes through `statusLabel()`, since the page renders the label, not the raw enum.
 *
 * @param {any} stack
 * @param {any} features
 * @param {string} id
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
    return SECURITY_TRADEOFF.map(el);
  if (id === "ai")
    return AI_DISCLOSURE.map(el);
  if (id === "not-adopted")
    return stack.notAdopted.flatMap((/** @type {any} */ n) => [
      `${n.name} <`,
      `(${statusLabel(n.status)})`,
      el(n.reason),
    ]);
  // Fail closed: a section with no rule here would be swept as its lead alone and pass vacuously.
  throw new Error(`verify-live has no fact list for colophon section "${id}"`);
}
