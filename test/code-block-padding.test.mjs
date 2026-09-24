/**
 * A reader with NO SCRIPT gets no reserved gap above a code fence.
 *
 * REPLAYS THE DEFECT, per the replay rule. `.prose pre` carried
 * `padding-top: 2.25rem` unconditionally, to reserve room for a copy button and
 * a language label that only script can add. So every fence on every post
 * opened with 2.25rem of empty space, and for a reader without script the thing
 * it was reserved for never arrived. The audit's tier 3 finding.
 *
 * The rule is now conditional two ways, and both are legitimate:
 *
 *   `@media (scripting: enabled)` reserves it at first paint where the media
 *   feature is understood, so nothing shifts when the button lands.
 *
 *   `.prose pre[data-enhanced]` is set by the enhancement itself, covering a
 *   browser that runs script and does not know the feature.
 *
 * `@media print` is exempt: it overrides the padding DOWN, and it also hides
 * the furniture, so it is the one place a `.prose pre` padding rule is allowed
 * to be unconditional.
 *
 * ## OBSERVATION BOUNDARY
 *
 * This reads the STYLESHEET. It does not render, so it cannot see the computed
 * padding, and it says nothing about whether the button attaches or survives.
 * That half needs a browser, which only `check:browser` has: `verify-live`
 * matches strings in server HTML, so it cannot see a script-added node at all. The
 * copy button was measured absent on production while every gate was green.
 *
 * @see app/app.css, app/enhance/blog.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { allSourceCss } from "../scripts/lib/tokens.mjs";

/**
 * COMMENTS STRIPPED FIRST, and the plant is what proved this necessary.
 *
 * The brace walk below accumulates everything since the last brace as a rule's
 * prelude, so a comment sitting above a rule becomes part of its "selector".
 * The comment written to explain this very fix mentions `[data-enhanced]`, and
 * that alone made the guard below consider the unguarded rule guarded: the
 * planted defect went green. That is the comment-satisfied anchor class from
 * the vacuity rule, caught by planting rather than by reading.
 */
/**
 * THE WHOLE STYLESHEET SET, and it now comes from the SHARED derivation rather
 * than a second copy of it.
 *
 * app.css was one 9,269-line file and is now an ENTRY that imports its parts.
 * The fence rules moved to `app/styles/blog-enhancements.css`, so reading the
 * entry alone parsed the tokens and found no `.prose pre` at all. This test
 * FAILED rather than passing over an empty search, which is the scope
 * assertion below doing its job.
 *
 * IT THEN FAILED A SECOND TIME, on 2026-08-23, for the same reason one layer
 * out: the admin parts moved to a SECOND entry, `app/admin.css`, and this
 * file's own copy of the import walk followed only the first. The parsed rule
 * count fell below the floor below and the test went red.
 *
 * So the walk is gone and `allSourceCss()` from `scripts/lib/tokens.mjs` is
 * the one owner. That function had to learn about the second entry anyway,
 * because `check:contrast` reads it; re-implementing the walk
 * here is what made this the THIRD place to fix rather than the second. One
 * derivation, several readers, which is the rule this repo applies to the CSP
 * nonce and had not applied to its own stylesheet list.
 */
const css = allSourceCss().replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Every style rule in the sheet, with the at-rules it sits inside.
 *
 * A brace walk rather than a regex over the whole file: the rules that matter
 * here are nested inside `@media`, and the enclosing at-rule IS the thing under
 * test, so a matcher that could not see nesting would be answering a different
 * question.
 *
 * @returns {Array<{ selector: string, body: string, context: string[] }>}
 */
function rules(source) {
  /** @type {Array<{ selector: string, body: string, context: string[] }>} */
  const out = [];
  /** @type {string[]} */
  const context = [];
  let prelude = "";
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      const head = prelude.trim();
      prelude = "";
      if (head.startsWith("@")) {
        context.push(head);
        continue;
      }
      // A style rule. Take its body up to the matching close.
      let depth = 1;
      let j = i + 1;
      for (; j < source.length && depth > 0; j += 1) {
        if (source[j] === "{") depth += 1;
        else if (source[j] === "}") depth -= 1;
      }
      out.push({ selector: head, body: source.slice(i + 1, j - 1), context: [...context] });
      i = j - 1;
      continue;
    }
    if (ch === "}") {
      context.pop();
      prelude = "";
      continue;
    }
    prelude += ch;
  }
  return out;
}

/**
 * The TOP padding a rule sets, in rem, or null if it sets none.
 *
 * Reads the shorthand as well as the longhand, because `padding: 3rem 1rem`
 * reserves exactly the same gap as `padding-top: 3rem` and a check that only
 * knew the longhand could be walked around without meaning to. Last
 * declaration wins, as the cascade does within one block.
 *
 * Only rem and px are understood; anything else returns null and is reported
 * rather than silently treated as zero.
 */
function topPaddingRem(body) {
  let value = null;
  for (const m of body.matchAll(/(^|[;{\s])padding(-top)?\s*:\s*([^;}]+)/g)) {
    value = m[2] ? m[3].trim() : m[3].trim().split(/\s+/)[0];
  }
  if (value === null) return null;
  const rem = /^([\d.]+)rem$/.exec(value);
  if (rem) return Number(rem[1]);
  const px = /^([\d.]+)px$/.exec(value);
  if (px) return Number(px[1]) / 16;
  return null;
}

/** The gap the furniture needs. Anything at or above this is a reservation. */
const RESERVE_REM = 2;

const all = rules(css);
// Rules whose selector list touches a code fence in post prose.
const fenceRules = all.filter((r) => /\.prose\s+pre\b/.test(r.selector));
const padding = fenceRules.filter((r) => topPaddingRem(r.body) !== null);

test("the stylesheet parsed into rules at all", () => {
  // Scope check. Everything below filters this list; "0 violations" across an
  // empty parse would pass while reading nothing.
  assert.ok(all.length > 500, `parsed only ${all.length} rule(s), which cannot be right`);
});

test("the fence rules were actually found", () => {
  // Second scope check, and the sharper one: a selector rename would empty this
  // list and quietly make the real assertion vacuous.
  assert.ok(fenceRules.length > 0, "no rule matched .prose pre, so nothing below is under test");
  assert.ok(padding.length > 0, "no .prose pre rule declares padding, so nothing is under test");
});

/** Whether a rule only applies where script is known to be running. */
const guarded = (r) =>
  r.context.some((c) => /scripting\s*:\s*enabled/.test(c)) || /\[data-enhanced\]/.test(r.selector);

test("no rule reserves fence padding unconditionally", () => {
  const offenders = padding
    // Print overrides the padding DOWN and hides the furniture, so it is the
    // one place an unconditional fence padding is correct.
    .filter((r) => !r.context.some((c) => /@media\s+print/.test(c)))
    .filter((r) => !guarded(r))
    .filter((r) => (topPaddingRem(r.body) ?? 0) >= RESERVE_REM);

  assert.deepEqual(
    offenders.map((r) => `${r.selector} (${topPaddingRem(r.body)}rem)`),
    [],
    "a reader with no script gets this much empty space above every code fence",
  );
});

test("script-capable readers still get the room reserved", () => {
  // The other direction. Deleting the padding entirely would satisfy the test
  // above and drop the button on top of the first line of code.
  const reserving = padding.filter(
    (r) => guarded(r) && (topPaddingRem(r.body) ?? 0) >= RESERVE_REM,
  );
  assert.ok(
    reserving.length >= 2,
    `expected the scripting-enabled rule and the [data-enhanced] rule, found ${reserving.length}`,
  );
});
