/**
 * Reads the ratified colour tokens back out of the stylesheet that ships.
 *
 * `app/app.css` is the single source of the palette. Anything that needs a
 * colour at BUILD time (the diagram renderer, and the gate over what it wrote)
 * resolves it from here rather than restating a hex, so a retuned token moves
 * the thing that uses it instead of quietly disagreeing with it. That is the
 * same discipline `check:contrast` is built on.
 *
 * `check:contrast` deliberately keeps its own copy of this parsing. It is the
 * gate whose entire design is that two independent sources argue, and it also
 * reads a third block to assert the two dark blocks agree, which nothing else
 * needs. Sharing a reader with it would give the palette one implementation to
 * be wrong in rather than two to disagree.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The stylesheet that declares the TOKENS. Still one file, deliberately.
 *
 * app.css was split on 2026-08-21 and the token block stayed here, because this
 * module and `check:contrast` both parse this path and moving the palette would
 * have been a gate change wearing a refactor's clothes.
 */
export const CSS_PATH = join(root, "app", "app.css");

/**
 * THE ADMIN PLANE'S ENTRY, since the CSS split of 2026-08-23.
 *
 * `app.css` stopped being the whole site's stylesheet that day: the seven admin
 * parts moved to `app/admin.css` so a public reader stops downloading them.
 * Every gate that reasons about "the stylesheets" has to follow BOTH entries or
 * it silently narrows to the public plane, which is the identical failure the
 * comment on `stylesheetPaths` below records from the 2026-08-21 split.
 *
 * It happened again, and it FAILED AGAIN RATHER THAN PASSING QUIETLY:
 * `check:contrast`'s resolution scan dropped from 69 var() uses to 38 and
 * tripped its own floor. Two splits, two narrowings, two catches by the same
 * anti-vacuity assertion. That is the floor earning its place twice.
 *
 * NOT the token block. The tokens, the `@theme` block and the three theme
 * selectors all stay in `app.css`, which is why `tokenBlock` still reads
 * `CSS_PATH` alone and this constant is only ever used for the SWEEP.
 */
export const ADMIN_CSS_PATH = join(root, "app", "admin.css");

/**
 * The stylesheet ENTRY POINTS, in the order an admin page loads them.
 *
 * `app/root.tsx` imports `app.css` on every route; `routes/admin.tsx` and
 * `routes/login.tsx` import `admin.css` on top. So this order is the cascade an
 * admin page actually sees, and a gate reading the concatenation sees what the
 * browser sees there. A public page loads the first entry alone, which is a
 * strict prefix of this, so a rule that wins here and comes from the first
 * entry also wins there.
 */
const CSS_ENTRIES = [CSS_PATH, ADMIN_CSS_PATH];

/**
 * EVERY source stylesheet, in CASCADE ORDER, derived from the entries' own imports.
 *
 * ## WHY THIS EXISTS
 *
 * app.css was ONE 9,269-line file until 2026-08-21 and is now an entry that
 * imports sixteen parts. Any gate that reasoned about "the stylesheet" by
 * reading that one path silently narrowed to the token block the moment the
 * split landed. That is not hypothetical: `check:contrast`'s resolution scan
 * dropped from 69 var() uses to 13, and `check:logo` found one of the mark's
 * two fill bindings. Both FAILED rather than passing quietly, which is the
 * anti-vacuity floors doing their job, and both are fixed by reading this.
 *
 * ## DERIVED, NOT RESTATED
 *
 * The order comes from parsing each ENTRY's `@import` lines, so adding a part
 * means editing that entry and nothing else. A hand-kept list here would be the
 * mirror this repo keeps paying for, and it would go stale in exactly the
 * direction that hides CSS from a gate. The ENTRIES themselves are a list, in
 * `CSS_ENTRIES` above, and that is the one thing a third entry has to be added
 * to; nothing in the CSS says which files a route imports, so it cannot be
 * derived.
 *
 * `@import "tailwindcss"` is skipped: it is a package, not a file in this repo,
 * and no gate asserts anything about what Tailwind generates.
 *
 * @returns {string[]} absolute paths, app.css first, then its imports in order
 */
export function stylesheetPaths() {
  /** @type {string[]} */
  const out = [];
  for (const entry of CSS_ENTRIES) {
    const text = readFileSync(entry, "utf8").replace(/\r\n/g, "\n");
    out.push(entry);
    for (const m of text.matchAll(/@import\s+"(\.[^"]+)"/g)) {
      out.push(join(root, "app", m[1].replace(/^\.\//, "")));
    }
  }
  return out;
}

/**
 * Every source stylesheet's text, concatenated in cascade order.
 *
 * FAILS CLOSED on a missing file: a gate reading this must not silently examine
 * a smaller stylesheet than the site ships, which is the whole failure this
 * function was written after.
 */
export function allSourceCss() {
  return stylesheetPaths()
    .map((p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n"))
    .join("\n");
}

/**
 * The three selectors the site resolves its theme through. "System" is the
 * ABSENCE of the attribute, which is why the second one is a `:not()`.
 */
export const THEME_SELECTORS = {
  light: ':root,\n[data-theme="light"]',
  darkSystem: ":root:not([data-theme])",
  dark: '[data-theme="dark"]',
};

/**
 * Pulls the custom properties out of one rule block, located by the literal
 * text of its selector.
 *
 * Two traps, both already paid for once in `check:contrast`:
 *
 *   1. Comments are stripped FIRST. The token block's own comment spells out
 *      all three selectors, so searching the raw file finds the prose and then
 *      parses whichever block happens to follow it.
 *   2. CRLF is normalised FIRST. `app.css` is not pinned by `.gitattributes`
 *      and this repo runs `core.autocrlf=true`, so a fresh Windows clone gets
 *      CRLF and every multi-line selector match silently stops matching.
 *
 * @param {string} label
 * @param {string} selector
 * @returns {Record<string, string>}
 */
export function tokenBlock(label, selector) {
  const css = readFileSync(CSS_PATH, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`${label}: selector not found in app.css: ${selector}`);
  const open = css.indexOf("{", at + selector.length - 1);
  const close = css.indexOf("}", open);
  if (open === -1 || close === -1) throw new Error(`${label}: unterminated block`);

  /** @type {Record<string, string>} */
  const out = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  // An assertion that can pass by reading nothing is not an assertion.
  if (Object.keys(out).length === 0) throw new Error(`${label}: parsed zero tokens`);
  return out;
}

/**
 * Resolves a token name map into a colour map for one theme.
 *
 * Fails closed twice over: on a token the stylesheet does not declare, and on a
 * declared token whose value is not a plain hex. A `var()` indirection would
 * resolve in a browser and be meaningless to a build-time renderer, so it has
 * to be an error rather than a string passed along.
 *
 * @param {Record<string, string>} nameMap keys are arbitrary, values are token names
 * @param {Record<string, string>} block output of tokenBlock
 * @param {string} label
 * @returns {Record<string, string>}
 */
export function resolveTokens(nameMap, block, label) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, token] of Object.entries(nameMap)) {
    const value = block[token];
    if (value === undefined) {
      throw new Error(`${label}: ${key} wants ${token}, which app.css does not declare`);
    }
    if (!/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(value)) {
      throw new Error(`${label}: ${token} is "${value}", which is not a plain hex colour`);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Normalises a hex colour for comparison. Lightning CSS rewrites `#ffffff` to
 * `#fff`, and mermaid writes some of its own output in the short form, so a
 * substring or literal comparison reports colours missing from output that
 * carries them. Measured once already in `check:contrast`.
 *
 * @param {string} hex
 */
export function normalizeHex(hex) {
  const h = hex.trim().toLowerCase().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `#${full}`;
}
