/**
 * Gate over the shipped colour tokens.
 *
 * OBSERVATION BOUNDARY: computes ratios from token values in the stylesheet. It
 * does not render a page, so it cannot see a token applied to the wrong element,
 * text over an image, or a pair that never occurs in the markup. It also skips
 * the built-CSS check when the build is older than app.css, and SAYS SO.
 *
 * **AND IT CANNOT SEE OPACITY.** It reads token hexes; `opacity` is compositing
 * applied by the browser afterwards, so a pair that measures 7:1 here can reach
 * the reader at 4.35:1. That is not hypothetical: it is what `.figure-credit`
 * did until 2026-08-21. EVERY opacity on text is a hole of this shape.
 *
 * ENUMERATED 2026-08-21, all 19 `opacity` declarations in app.css, classified,
 * so the next reader inherits the list rather than the search:
 *
 *   ON TEXT, PERSISTENT, and therefore the ones that matter:
 *     .figure-credit                   FIXED, was 0.8 and 4.35:1 in light
 *     .heading-anchor       0.55       inside @media (hover: none); the permalink
 *                                      glyph is the only thing it paints
 *     .search-why-sep       0.5        a "/" between why-terms. 3.06:1 light,
 *                                      4.18:1 dark. Incidental punctuation, so
 *                                      LEFT, and recorded rather than hidden
 *   ON TEXT, TRANSIENT (a pending state, admin plane, seconds at a time):
 *     .posts-table[data-pending]       0.55
 *     .media-grid[data-pending]        0.55
 *   DISABLED CONTROLS, which WCAG 1.4.3 exempts outright:
 *     .row-action:disabled             0.55
 *     .media-modal-actions .btn-danger[disabled]  0.5
 *   NOT TEXT: two scrims (.media-detail-scrim 0.28, .media-modal-scrim 0.5)
 *   REVEAL PAIRS, 0 then 1, so nothing is ever painted at a partial value:
 *     .heading-anchor, .media-card-body, .media-check-label, .media-toast
 *   KEYFRAMES: two `from { opacity: 0 }` steps
 *
 * NOT GATEABLE HERE, said plainly rather than left as a to-do. Deciding whether
 * a selector paints TEXT needs a rendering, and a hand-maintained list of
 * text-bearing selectors is the mirror this file exists to avoid. The instrument
 * that could measure it is `check:browser`, which renders and can read a
 * COMPUTED colour with the compositing already applied.
 *
 *   npm run check:contrast
 *
 * The point of this script is that it reads TWO INDEPENDENT SOURCES and makes
 * them argue. The hexes come out of the stylesheet that ships. The pairs and
 * their thresholds come from dustinedwards/design-tokens.md, transcribed below
 * as token NAMES rather than values. Nothing here restates a hex, so a hex
 * edited in app.css cannot also edit the expectation: it moves one side of the
 * comparison and the gate fails.
 *
 * A gate that has never been observed failing has not been verified. Plant a
 * violation and watch it fail before trusting a green run: change any hex in
 * app/app.css and this exits 1 naming the pair.
 *
 * WCAG 2.x contrast is what FAILS a run, because it is the ratified compliance
 * target. APCA Lc is computed and printed alongside as advisory only, since it
 * is the model that produced the fills-over-pastels rule and it disagrees with
 * WCAG in exactly the places worth watching.
 *
 * Pure: no database, no network, no build step. Safe to run on a clean
 * checkout, which is why it is in the check family.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The same themes the pipeline highlights with, imported from the pipeline so
// the gate cannot drift from the renderer by checking a theme nothing uses.
import { LANGUAGES, SHIKI_THEMES } from "../app/lib/content/pipeline.mjs";

// The colour maths, on exactly the footing query.mjs has with check:search: the
// Worker imports this module and so does this gate, so /playground's contrast
// lab cannot compute a ratio by a different rule than the one gated here. The
// functions moved out of this file unchanged; the keystone-vector check below
// and the matrix recomputation are what prove the move was lossless.
//
// This does NOT weaken the two-independent-sources design. The hexes still come
// from the shipped stylesheet and the pairs and thresholds are still transcribed
// here from design-tokens.md. Only the arithmetic is shared, and arithmetic is
// not one of the two sources.
// Only the two the gate calls directly. `channels` and `luminance` are exercised
// through them, exactly as they were when all four lived in this file.
import { apca, contrast } from "../app/lib/contrast.mjs";

/*
 * FILE DISCOVERY ONLY, and that distinction is what keeps this gate's design
 * intact. `tokens.mjs` says this file deliberately keeps its OWN palette
 * parsing, so the two can disagree, and that is unchanged: every hex below is
 * still read by the parser in this file from the block in this file's own
 * CSS_PATH. What is imported is the LIST OF STYLESHEETS, which is not one of
 * the two sources; it is the answer to "which files does the site ship", and
 * having two answers to that would be the drift, not the safeguard.
 */
import { allSourceCss, stylesheetPaths } from "./lib/tokens.mjs";

const { light: githubLight, dark: githubDark } = SHIKI_THEMES;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_PATH = join(root, "app", "app.css");

/* -------------------------------------------------------------------------
 * Reading the tokens back out of the stylesheet that ships
 * ---------------------------------------------------------------------- */

const cssSource = readFileSync(CSS_PATH, "utf8");

/**
 * Comments are stripped before anything is located, because the token block's
 * own comment SPELLS OUT the three selectors it documents. Searching the raw
 * file finds the prose first and then parses whichever block follows it. That
 * is not hypothetical: the first run of this gate read the light block three
 * times and reported the light values as the dark ones, and every dark row
 * passed for the wrong reason.
 */
const css = cssSource
  // CRLF is normalised FIRST. This repo runs core.autocrlf=true and app.css is
  // not pinned by .gitattributes, so a fresh clone on Windows gets CRLF and
  // every multi-line selector match below silently stops matching. Measured:
  // this gate threw "selector not found in app.css" on the first clean checkout
  // after a merge, having passed on the branch it was written on, purely
  // because the working tree there still had LF.
  .replace(/\r\n/g, "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Pulls the custom properties out of one rule block, located by the literal
 * text of its selector. Blocks carry no nested braces, so the first closing
 * brace ends the block.
 *
 * @param {string} label
 * @param {string} selector
 */
function tokenBlock(label, selector) {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`${label}: selector not found in app.css: ${selector}`);
  const open = css.indexOf("{", at + selector.length - 1);
  const close = css.indexOf("}", open);
  if (open === -1 || close === -1) throw new Error(`${label}: unterminated block`);
  const body = css.slice(open + 1, close);

  /** @type {Record<string, string>} */
  const out = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  if (Object.keys(out).length === 0) throw new Error(`${label}: parsed zero tokens`);
  return out;
}

const light = tokenBlock("light", ':root,\n[data-theme="light"]');
const darkMedia = tokenBlock("dark (prefers-color-scheme)", ":root:not([data-theme])");
const darkAttr = tokenBlock("dark (attribute)", '[data-theme="dark"]');

/* -------------------------------------------------------------------------
 * Assertions
 * ---------------------------------------------------------------------- */

let checks = 0;
/** @type {string[]} */
const failures = [];

/** @param {string} label */
function fail(label) {
  failures.push(label);
}

/**
 * An assertion that read nothing is not an assertion. Count everything.
 * @param {string} label
 * @param {boolean} ok
 */
function assert(label, ok) {
  checks += 1;
  if (!ok) fail(label);
}

// --- Structural: the two dark blocks and the name parity ------------------
//
// Both theme blocks land on the html element, so they do not cascade into one
// another. A token declared in light and forgotten in dark keeps its LIGHT
// value under a dark theme, which is invisible to every other check here.

{
  const lightNames = Object.keys(light).sort();
  const darkNames = Object.keys(darkAttr).sort();
  const missingInDark = lightNames.filter((n) => !darkNames.includes(n));
  const orphanInDark = darkNames.filter((n) => !lightNames.includes(n));

  assert(
    `light declares ${lightNames.length} tokens the dark block also declares` +
      (missingInDark.length ? `\n    missing from dark: ${missingInDark.join(", ")}` : ""),
    missingInDark.length === 0,
  );
  assert(
    `dark declares no token light does not` +
      (orphanInDark.length ? `\n    orphaned in dark: ${orphanInDark.join(", ")}` : ""),
    orphanInDark.length === 0,
  );

  // The prefers-color-scheme block and the attribute block must agree exactly,
  // or "system" and "dark" would render as two different themes.
  const drift = Object.keys({ ...darkMedia, ...darkAttr }).filter(
    (n) => darkMedia[n] !== darkAttr[n],
  );
  assert(
    `both dark blocks carry identical values` +
      (drift.length ? `\n    differ: ${drift.join(", ")}` : ""),
    drift.length === 0,
  );
}

// --- Every token is a literal hex -----------------------------------------
//
// A token resolving to var(...) would make this gate read a name where it
// needs a value, and would silently check nothing.
/** @type {Array<[string, Record<string, string>]>} */
const MODES = [
  ["light", light],
  ["dark", darkAttr],
];

for (const [mode, block] of MODES) {
  for (const [name, value] of Object.entries(block)) {
    assert(
      `${mode} ${name} is a literal hex, got: ${value}`,
      /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value),
    );
  }
}

/* -------------------------------------------------------------------------
 * The APCA implementation, checked against the published vectors
 * ---------------------------------------------------------------------- */

/**
 * An advisory number nobody has verified is decoration.
 *
 * These are the keystone vectors published with apca-w3, taken from the shipped
 * `test/index.js` of version 0.1.9 (algorithm 0.0.98G-4g) rather than quoted
 * from a write-up, because secondary sources get them wrong. There are EIGHT,
 * not four: every pair appears in both polarities, which makes them a test of
 * the sign convention as well as of the magnitude.
 *
 * Two further pairs (#123 on #234 and its reverse) sit in the same upstream
 * block but are explicitly marked as NOT matching apca-w3, and both return 0
 * under loClip. They are deliberately absent.
 *
 * Positive is dark text on a light background; negative is light on dark.
 */
const APCA_KEYSTONE = [
  ["#888", "#fff", 63.056469930209424],
  ["#fff", "#888", -68.54146436644962],
  ["#000", "#aaa", 58.146262578561334],
  ["#aaa", "#000", -56.24113336839742],
  ["#123", "#def", 91.66830811481631],
  ["#def", "#123", -93.06770049484275],
  ["#123", "#444", 8.32326136957393],
  ["#444", "#123", -7.526878460278154],
];

let apcaWorstDelta = 0;
for (const [text, bg, expected] of APCA_KEYSTONE) {
  const got = apca(String(text), String(bg));
  const delta = Math.abs(got - Number(expected));
  if (delta > apcaWorstDelta) apcaWorstDelta = delta;
  assert(
    `APCA keystone ${text} on ${bg}: expected ${expected}, got ${got}`,
    delta < 1e-9,
  );
  // The sign is half the assertion. A magnitude-only check would happily pass
  // an implementation whose polarity was backwards.
  assert(
    `APCA keystone ${text} on ${bg}: sign should be ${Number(expected) >= 0 ? "positive" : "negative"}`,
    Math.sign(got) === Math.sign(Number(expected)),
  );
}

/* -------------------------------------------------------------------------
 * The matrix, transcribed from design-tokens.md as NAMES
 * ---------------------------------------------------------------------- */

// A fill is specified as a BUTTON BACKGROUND carrying text, never as a bare
// shape on the page, so there is no --fill-* against --bg row here. Measured:
// gold on caliche is 2.07:1 and dark crimson on prairie night is 2.49:1, and
// neither would ever clear 3:1. Where app.css does use a fill as a shape, the
// status dots, the discernible boundary is the family's --border-* ring, and
// those rows below are what verify it.
const TEXT = 4.5; // WCAG 1.4.3 AA, normal text
const UI = 3.0; // WCAG 1.4.11, non-text UI and graphical objects
const DISABLED = 3.0; // House floor. WCAG exempts disabled controls entirely.

/** @type {Array<[string, string, number, string]>} fg, bg, min, note */
const MATRIX = [
  // Body and neutrals
  ["--text", "--bg", TEXT, "body text"],
  ["--text", "--surface", TEXT, "body on surface"],
  // CodeMirror's syntax colours. The markdown editor paints headings and bold
  // in --text-heading and inline code in --text-accent, on --bg normally and on
  // --surface for the active line, so all four combinations ship. They are
  // drawn from tokens the matrix already knows rather than a syntax theme of
  // their own, which is the whole reason they can be checked here at all.
  ["--text-heading", "--bg", TEXT, "heading text on page"],
  ["--text-heading", "--surface", TEXT, "heading text on surface"],
  ["--text-accent", "--surface", TEXT, "accent text on surface"],
  ["--text", "--surface-popover", TEXT, "body on popover"],
  // The settings drawer sits on the popover step and puts its own inputs on
  // --surface inside it, so the drawer's field text is body-on-surface, and its
  // borders are the strong ones per the Session 1 elevated-surface rule.
  ["--text-heading", "--surface-popover", TEXT, "heading on popover"],
  // No --text-disabled on --surface-popover row, for the same reason there is
  // no --border one: it does not clear the floor there (2.71:1 light, 2.46:1
  // dark) and nothing ships it. The only disabled-coloured text in the editor
  // is the title placeholder, which sits on the canvas. If a placeholder ever
  // lands inside the drawer it needs a token that survives the elevation, and
  // this comment is the reason why rather than a puzzle to re-derive.
  ["--text", "--surface-code", TEXT, "body on code surface"],
  ["--text", "--surface-hero", TEXT, "body on hero surface"],
  ["--text", "--mark-bg", TEXT, "body on search highlight"],
  ["--text", "--selection-bg", TEXT, "body on selection"],
  ["--text", "--tint-brand", TEXT, "body on brand tint"],
  ["--text", "--tint-accent", TEXT, "body on accent tint"],
  ["--text-muted", "--bg", TEXT, "muted text"],
  ["--text-muted", "--surface", TEXT, "muted on surface"],
  ["--text-muted", "--surface-popover", TEXT, "muted on popover"],
  ["--text-disabled", "--bg", DISABLED, "disabled text (house floor)"],

  // Borders are non-text UI
  ["--border", "--bg", UI, "border on page"],
  ["--border", "--surface", UI, "border on surface"],
  // There is deliberately NO --border on --surface-popover row. It measures
  // 2.66:1 in dark (#746a5f on #322a25) and would fail, which this gate
  // reported the moment the admin's hovered table row was put on the popover
  // surface. --border only just clears on --surface (3.04:1), so it has no
  // headroom left for a third elevation, and anything drawn on the popover step
  // takes --border-strong instead. Asserting the failing pair here would red
  // the gate forever over a combination nothing ships; the two rows below are
  // what actually holds that rule up.
  ["--border-strong", "--bg", UI, "strong border"],
  ["--border-strong", "--surface", UI, "strong border on surface"],
  ["--border-strong", "--surface-popover", UI, "strong border on popover"],

  // Brand
  ["--brand", "--bg", TEXT, "brand text"],
  ["--brand", "--surface", TEXT, "brand on surface"],
  ["--brand", "--surface-popover", TEXT, "brand on popover"],
  // The cover picker rings the chosen thumbnail in brand, on the drawer.
  ["--brand", "--surface-popover", UI, "brand ring on popover"],
  ["--brand", "--tint-brand", TEXT, "brand on its own tint"],
  ["--brand-hover", "--bg", TEXT, "brand hover text"],
  // The admin identity block sits on the shell surface, not the page, so its
  // hover colour lands on a background the public header never puts it on.
  // The only genuinely new pairing the brand-parity pass introduced.
  ["--brand-hover", "--surface", TEXT, "brand hover on surface"],
  ["--brand-active", "--bg", TEXT, "brand active text"],
  ["--on-brand", "--brand", TEXT, "text on brand fill"],
  ["--on-brand", "--brand-hover", TEXT, "text on brand hover fill"],
  ["--on-brand", "--brand-active", TEXT, "text on brand active fill"],
  ["--visited", "--bg", TEXT, "visited link"],
  ["--focus-ring", "--bg", UI, "focus ring on page"],
  ["--focus-ring", "--surface", UI, "focus ring on surface"],
  ["--focus-ring-on-brand", "--brand", UI, "inner ring on brand fill"],
  // No --focus-ring-on-brand against --fill-danger. It measures 1.47:1 in dark,
  // so app.css does not draw that ring and this does not pretend it does.

  // Chrome (v4). The public header and footer are a brand SURFACE, so the text
  // they carry is measured against the chrome and not against the page canvas.
  // Nothing here retires an older row: every pair the pre-v4 header shipped
  // (--brand on --bg for the wordmark, --text-muted on --bg for the nav) is
  // still shipped elsewhere, by .hero-name and .eyebrow respectively, so the
  // rows stay for those.
  ["--on-chrome", "--surface-chrome", TEXT, "wordmark and current nav on chrome"],
  ["--on-chrome-muted", "--surface-chrome", TEXT, "nav at rest on chrome"],
  // The mark is a graphical object, not text, so it takes the 1.4.11 floor.
  ["--mark-on-chrome", "--surface-chrome", UI, "logo mark on chrome"],
  ["--focus-ring-on-chrome", "--surface-chrome", UI, "focus ring on chrome"],
  // The INVERTED pair: the pressed theme toggle's icon and the skip link's text,
  // both sitting on an --on-chrome-muted fill laid over the chrome, plus that
  // toggle's inset focus ring. WCAG contrast is symmetric, so this row computes
  // the same ratio as the one two above it and cannot fail alone; it is here
  // because APCA is NOT symmetric and is reported signed, and because a pair
  // that ships should be NAMED in the matrix rather than inferred from its
  // reverse. Read it as documentation with a number attached, not as an
  // independent assertion.
  ["--surface-chrome", "--on-chrome-muted", TEXT, "pressed toggle and skip link, inverted"],
  // THE TILE CAPTION SCRIM. The media grid lays a filename, a size and a copy
  // control over the picture on the selected tile, and this is the pair that
  // makes it provable: the band under the text is OPAQUE, so the ratio is a
  // constant rather than a function of whichever photograph is underneath.
  //
  // That opacity is the whole point of the row. The mockup fades its scrim to
  // transparent through the region the text sits in, which means the real
  // backdrop is the image: measured against a white backdrop, a #1a1614 scrim
  // reaches 4.70:1 at alpha 0.60 and 3.42:1 at 0.50, so a gradient through that
  // range crosses the floor at a point no gate can name and no reviewer can
  // see. design-tokens.md reached the same conclusion for the glass extension
  // and put a hard alpha floor on it. Here there is no alpha to floor: the
  // fade is a separate strip ABOVE the band, over which no text is ever drawn.
  //
  // Same values in both themes, deliberately. A scrim is a hole punched in the
  // page rather than a surface the page tints, so a "dark mode scrim" would be
  // a lighter one, which is backwards.
  ["--on-scrim", "--scrim", TEXT, "tile caption over the image"],

  // There is deliberately NO --border-strong on --surface-chrome row for the
  // header and footer seam. Measured 1.80:1 light and 3.22:1 dark, and the
  // ruling is explicit that a surface-to-surface seam carries no 3:1
  // obligation: the seam separates two backgrounds, it is not a control
  // boundary. Asserting it would red the gate forever over a value the ruling
  // already accepted. The dark seam is the one that needed the STRONG border at
  // all, because chrome-to-canvas there is 1.4:1.

  // Danger
  ["--text-danger", "--bg", TEXT, "danger text"],
  ["--text-danger", "--surface", TEXT, "danger text on surface"],
  // Revert to draft, as a row in the overflow menu on the popover step.
  ["--text-danger", "--surface-popover", TEXT, "danger text on popover"],
  ["--on-tint-danger", "--tint-danger", TEXT, "text on danger tint"],
  ["--border-danger", "--bg", UI, "danger border"],
  ["--on-fill-danger", "--fill-danger", TEXT, "text on danger fill"],
  ["--on-fill-danger", "--fill-danger-hover", TEXT, "text on danger hover fill"],

  // Warning
  ["--text-warning", "--bg", TEXT, "warning text"],
  ["--text-warning", "--surface", TEXT, "warning text on surface"],
  ["--on-tint-warning", "--tint-warning", TEXT, "text on warning tint"],
  ["--border-warning", "--bg", UI, "warning border"],
  ["--border-warning", "--tint-warning", UI, "warning border on its own tint"],
  // The dirty-state indicator in the command bar: amber text and an amber fill
  // dot, both on the shell surface rather than on the page.
  ["--text-warning", "--surface", TEXT, "dirty state on the command bar"],
  ["--border-warning", "--surface", UI, "dirty dot ring on the command bar"],
  ["--brand", "--tint-warning", UI, "brand fill edge on warning tint"],
  ["--on-fill-warning", "--fill-warning", TEXT, "text on warning fill"],

  // Success
  ["--text-success", "--bg", TEXT, "success text"],
  ["--text-success", "--surface", TEXT, "success text on surface"],
  ["--on-tint-success", "--tint-success", TEXT, "text on success tint"],
  ["--border-success", "--bg", UI, "success border"],
  ["--border-success", "--surface", UI, "success border on surface"],
  ["--on-fill-success", "--fill-success", TEXT, "text on success fill"],

  // Info
  ["--text-info", "--bg", TEXT, "info text"],
  ["--text-info", "--surface", TEXT, "info text on surface"],
  ["--on-tint-info", "--tint-info", TEXT, "text on info tint"],
  ["--border-info", "--bg", UI, "info border"],

  // Accent, decorative but still read as text
  ["--text-accent", "--bg", TEXT, "accent text"],
  ["--text-accent-lifted", "--bg", TEXT, "accent lifted text"],

  // Charts are graphical objects
  ["--chart-cadet", "--bg", UI, "chart cadet"],
  ["--chart-purple", "--bg", UI, "chart purple"],
  ["--chart-claret", "--bg", UI, "chart claret"],
  ["--chart-sage", "--bg", UI, "chart sage"],
  ["--chart-gold", "--bg", UI, "chart gold"],
  ["--chart-rust", "--bg", UI, "chart rust"],

  /*
   * DESTRUCTIVE, the v6 rust. A REVERSIBLE removal, not the danger family.
   *
   * Measured on all three surfaces it actually lands on in the media library:
   * the page background under the Trash heading, the card surface under a
   * trashed row, and the popover under the confirm dialog. Its own tint is
   * measured as a ground too, because the hover state puts the two together and
   * a token only ever measured against --bg would miss that pair entirely.
   */
  ["--text-destructive", "--bg", TEXT, "destructive text"],
  ["--text-destructive", "--surface", TEXT, "destructive text on a card"],
  ["--text-destructive", "--surface-popover", TEXT, "destructive text in a popover"],
  ["--text-destructive", "--tint-destructive", TEXT, "destructive text on its own tint"],
];

/** @type {Array<{mode: string, note: string, lc: number, ratio: number}>} */
const advisory = [];

for (const [mode, block] of MODES) {
  for (const [fgName, bgName, min, note] of MATRIX) {
    const fg = block[fgName];
    const bg = block[bgName];
    checks += 1;
    if (!fg || !bg) {
      fail(`${mode}: ${note} references a token that does not exist (${fgName} on ${bgName})`);
      continue;
    }
    const ratio = contrast(fg, bg);
    const lc = apca(fg, bg);
    advisory.push({ mode, note, lc, ratio });
    if (ratio < min) {
      fail(
        `${mode}: ${note}\n    ${fgName} ${fg} on ${bgName} ${bg}` +
          `\n    ${ratio.toFixed(2)}:1, needs ${min}:1`,
      );
    }
  }
}

/* -------------------------------------------------------------------------
 * Resolution: a token USED and never declared is invisible to everything above
 * ---------------------------------------------------------------------- */

/*
 * THIS GATE WALKS DECLARED TOKENS. A token that is USED and never declared is
 * structurally outside every assertion in this file: name parity compares two
 * declaration blocks, the literal-hex pass iterates declarations, and
 * participation starts from declarations. `var(--nothing)` resolves to the
 * empty string, the property is dropped, and the element inherits or falls back
 * to the initial value. Transparent, usually.
 *
 * IT HAS BITTEN TWICE, both caught by a person rather than by anything here:
 * `--surface-2`, the floor every media tile paints on, and `--border-accent`.
 * Both are declared today, which is why this section has no live finding to
 * show; it exists so the third one is not found by eye either.
 *
 * ## THE EXEMPTION MAP IS FOR TOKENS DECLARED SOMEWHERE THIS FILE CANNOT SEE
 *
 * Not every var() is meant to resolve in the stylesheet. Shiki writes its four
 * colour tokens as INLINE STYLE ATTRIBUTES on each highlighted span, one set per
 * token per code block, and app.css reads them back with attribute selectors.
 * They are correctly used and correctly never declared here. Naming them costs
 * four lines; a blanket "ignore anything starting with --shiki" would exempt a
 * future typo in the same family.
 *
 * SELF-POLICING, on the same rule as NON_PARTICIPATING below: an entry naming a
 * token that is no longer USED, or one that has since been DECLARED, fails here
 * rather than quietly widening the hole.
 */

/** @type {Map<string, string>} token -> why it is declared outside app.css */
const DECLARED_ELSEWHERE = new Map([
  [
    "--shiki-light",
    "written inline by Shiki on each highlighted span, per token, per code block",
  ],
  ["--shiki-dark", "the dark half of the same inline pair"],
  [
    "--shiki-light-bg",
    "inline on the span; app.css matches it with span[style*=...] and reads it back",
  ],
  ["--shiki-dark-bg", "the dark half of the same inline background pair"],
]);

{
  /*
   * THE WHOLE STYLESHEET SET, not app.css alone, since the 2026-08-21 split.
   *
   * `css` above is app.css, which now holds the tokens and the imports and
   * almost no rules. Scanning it alone dropped this from 69 var() uses to 13,
   * and the scope floor below FAILED rather than reporting a clean sweep over a
   * thirteenth of the stylesheet. That failure is the reason this line exists.
   *
   * COMMENTS ARE STRIPPED HERE, and it is not a duplicate of the stripping
   * app.css already gets: `allSourceCss()` returns RAW text for every part. The
   * dependency is load-bearing, because app.css documents the Shiki contract in
   * prose that spells out all four token names, so a scan over raw source reads
   * documentation as though it were CSS and reports every one as a use.
   */
  const code = allSourceCss().replace(/\/\*[\s\S]*?\*\//g, " ");

  const used = new Set([...code.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((m) => m[1]));
  const declaredAnywhere = new Set(
    [...code.matchAll(/(?:^|[;{]|\s)(--[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]),
  );

  /*
   * SCOPE, ASSERTED, BOTH SIDES. An empty `used` set finds no undeclared token
   * because it looked at nothing, and an empty `declaredAnywhere` set reports
   * every token as undeclared, which fails for the wrong reason and sends the
   * reader to the stylesheet instead of to this parser. Measured 2026-08-21 and
   * unchanged when re-measured 2026-08-24: 69 used, 79 declared. The floors were
   * 50 and 60, roughly a quarter under, and are now about eight percent under.
   *
   * The participation floor further down is DELIBERATELY NOT set this way: it is
   * bound to the token count `design-tokens.md` states, which is an independent
   * source, and moving it to track the measurement would make this gate check
   * its own output.
   */
  assert(
    `resolution scope: ${used.size} var() token(s) found in app.css`,
    used.size >= 63,
  );
  assert(
    `resolution scope: ${declaredAnywhere.size} token declaration(s) found in app.css`,
    declaredAnywhere.size >= 72,
  );

  const unresolved = [...used]
    .filter((n) => !declaredAnywhere.has(n) && !DECLARED_ELSEWHERE.has(n))
    .sort();

  assert(
    `every var(--token) used in app.css resolves to a declaration` +
      (unresolved.length
        ? `\n    used but never declared: ${unresolved.join(", ")}`
        : ""),
    unresolved.length === 0,
  );

  // The exemption map polices itself in both directions.
  for (const [name, why] of DECLARED_ELSEWHERE) {
    assert(`exemption ${name} names a token app.css still uses (${why})`, used.has(name));
    assert(
      `exemption ${name} is still undeclared in app.css`,
      !declaredAnywhere.has(name),
    );
  }
}

/* -------------------------------------------------------------------------
 * Participation: a declared token that no pair measures is not proven
 * ---------------------------------------------------------------------- */

// The gap this closes was LIVE AND GREEN. v4's five chrome tokens landed in all
// three theme blocks; name parity passed, the literal-hex pass passed, the
// built-CSS pass found all of them, and this gate printed 587 checks and zero
// failures -- while nothing whatsoever measured the chrome's contrast, because
// MATRIX is a hand-transcribed list and none of the five was on it.
//
// Name parity proves a token is DECLARED twice. It never proved a token is
// MEASURED once. Every previous amendment happened to add its rows by hand, so
// the omission had no way to show itself until an amendment forgot.
//
// The exemption map is CLOSED and self-policing: an entry naming a token that
// no longer exists, or one that has since joined the matrix, fails here rather
// than quietly widening the hole.
/** @type {Map<string, string>} token -> why no ratio of its own can be asserted */
const NON_PARTICIPATING = new Map([]);

{
  const inMatrix = new Set(MATRIX.flatMap(([fg, bg]) => [fg, bg]));
  const declared = Object.keys(light).filter((n) => n in darkAttr && n in darkMedia);

  // A zero-scope search reports zero violations. Floor it against the doc's
  // stated 53 purpose-named tokens per mode, so a parser that stopped finding
  // tokens cannot pass this section by finding nothing to check.
  assert(
    `participation scope is non-empty: ${declared.length} tokens declared in all three blocks`,
    declared.length >= 53,
  );

  const unproven = declared.filter((n) => !inMatrix.has(n) && !NON_PARTICIPATING.has(n));
  assert(
    `every declared token appears in at least one matrix pair` +
      (unproven.length
        ? `\n    declared but never measured: ${unproven.join(", ")}`
        : ""),
    unproven.length === 0,
  );

  for (const [name, why] of NON_PARTICIPATING) {
    assert(`exemption ${name} names a token that is still declared`, declared.includes(name));
    assert(`exemption ${name} is still outside the matrix (${why})`, !inMatrix.has(name));
  }
}

/* -------------------------------------------------------------------------
 * The prefers-contrast: more tier (v3 amendment 3)
 * ---------------------------------------------------------------------- */

/**
 * The high-contrast tier is a palette too, so it is held to the same matrix.
 *
 * It is narrow by design: only muted text and the default border move. That is
 * exactly why it needs checking rather than eyeballing, because a tier nobody
 * verifies is a tier that can quietly contain a value LOWER than the one it
 * replaced and still look like a high-contrast mode.
 *
 * @param {string} label
 * @param {string} selector
 */
function contrastTierBlock(label, selector) {
  const at = css.indexOf("@media (prefers-contrast: more)");
  if (at === -1) throw new Error("prefers-contrast tier not found in app.css");
  const region = css.slice(at);
  const sel = region.indexOf(selector);
  if (sel === -1) throw new Error(`${label}: not found inside the tier`);
  const open = region.indexOf("{", sel + selector.length - 1);
  const close = region.indexOf("}", open);
  const body = region.slice(open + 1, close);

  /** @type {Record<string, string>} */
  const out = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  if (Object.keys(out).length === 0) throw new Error(`${label}: parsed zero tokens`);
  return out;
}

{
  const tierLight = contrastTierBlock("tier light", '[data-theme="light"]');
  const tierDark = contrastTierBlock("tier dark", '[data-theme="dark"]');

  for (const [mode, tier, base] of /** @type {Array<[string, Record<string,string>, Record<string,string>]>} */ ([
    ["light", tierLight, light],
    ["dark", tierDark, darkAttr],
  ])) {
    // Muted text must clear AA against every surface it can land on, as before.
    for (const surface of ["--bg", "--surface", "--surface-popover"]) {
      checks += 1;
      const ratio = contrast(tier["--text-muted"], base[surface]);
      if (ratio < TEXT) {
        fail(
          `${mode} prefers-contrast: muted on ${surface}` +
            `
    ${tier["--text-muted"]} on ${base[surface]}` +
            `
    ${ratio.toFixed(2)}:1, needs ${TEXT}:1`,
        );
      }
    }
    checks += 1;
    const borderRatio = contrast(tier["--border"], base["--bg"]);
    if (borderRatio < UI) {
      fail(
        `${mode} prefers-contrast: border on --bg` +
          `
    ${tier["--border"]} on ${base["--bg"]}` +
          `
    ${borderRatio.toFixed(2)}:1, needs ${UI}:1`,
      );
    }

    // The whole point of the tier: it must be STRICTLY better than the default,
    // or it is not a high-contrast mode, it is a different one.
    assert(
      `${mode} prefers-contrast raises muted text` +
        ` (${contrast(base["--text-muted"], base["--bg"]).toFixed(2)}` +
        ` -> ${contrast(tier["--text-muted"], base["--bg"]).toFixed(2)})`,
      contrast(tier["--text-muted"], base["--bg"]) >
        contrast(base["--text-muted"], base["--bg"]),
    );
    assert(
      `${mode} prefers-contrast raises the default border` +
        ` (${contrast(base["--border"], base["--bg"]).toFixed(2)}` +
        ` -> ${contrast(tier["--border"], base["--bg"]).toFixed(2)})`,
      contrast(tier["--border"], base["--bg"]) > contrast(base["--border"], base["--bg"]),
    );
    // The doc says the border promotes to border-strong. Assert the identity,
    // not just that it went up.
    assert(
      `${mode} prefers-contrast border equals border-strong`,
      tier["--border"].toLowerCase() === base["--border-strong"].toLowerCase(),
    );
  }
}

/* -------------------------------------------------------------------------
 * Shiki syntax tokens against the NEW code surfaces
 * ---------------------------------------------------------------------- */

/**
 * The prior verification was against the themes' own backgrounds and is void:
 * app.css now drops those and puts code on --surface-code, with the
 * highlighted-line band on --surface-popover. Every token colour the theme can
 * emit is checked against both, in the mode that theme serves.
 */
/**
 * A theme rule may PAIR a foreground with a background of its own. Those tokens
 * never touch our surfaces, so checking them against one would be measuring a
 * combination no reader sees. They are checked against the background they
 * actually ship on, and everything else against both code surfaces.
 *
 * @param {any} theme
 */
function themeRules(theme) {
  /** @type {Array<{fg: string, bg: string | null, scope: string}>} */
  const out = [];
  /** @param {unknown} v @returns {string | null} */
  const hex = (v) =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v) ? v.slice(0, 7) : null;

  const editorFg = hex(theme.fg);
  if (editorFg) out.push({ fg: editorFg, bg: null, scope: "(editor default)" });
  for (const rule of theme.settings ?? theme.tokenColors ?? []) {
    const fg = hex(rule?.settings?.foreground);
    if (!fg) continue;
    out.push({
      fg,
      bg: hex(rule?.settings?.background),
      scope: Array.isArray(rule.scope) ? rule.scope.join(", ") : String(rule.scope ?? "?"),
    });
  }
  return out;
}

/**
 * Every rule that pairs a background is a VCS scope: the diff markup family
 * and carriage-return. None of them can be emitted here, because `diff` is not
 * a loaded grammar and the content paths are pinned to LF by .gitattributes.
 *
 * Three of them fail against their own backgrounds upstream in
 * github-dark-high-contrast (carriage-return 2.12, markup.deleted 4.35,
 * markup.changed 3.31). They are reported and not counted as failures, but the
 * exemption FAILS CLOSED: it is conditioned on `diff` being absent from
 * LANGUAGES, which is asserted rather than assumed. Add diff as a language and
 * this gate goes red until those colours are dealt with.
 */
const VCS_SCOPE = /^(markup\.(deleted|inserted|changed|ignored|untracked)|carriage-return|meta\.diff)/;
const diffReachable = LANGUAGES.includes("diff");

/** @type {Array<[string, any, Record<string, string>]>} */
const shikiCases = [
  ["light", githubLight, light],
  ["dark", githubDark, darkAttr],
];

let shikiTokensChecked = 0;
/** @type {string[]} */
const shikiUnreachable = [];

for (const [mode, theme, block] of shikiCases) {
  const rules = themeRules(theme);
  // An assertion that can pass by reading nothing is not an assertion.
  assert(`${mode}: parsed a non-empty shiki theme`, rules.length > 10);

  for (const rule of rules) {
    if (rule.bg) {
      // Paired: measured against its own background, which is what ships.
      checks += 1;
      shikiTokensChecked += 1;
      const ratio = contrast(rule.fg, rule.bg);
      if (ratio >= TEXT) continue;

      const unreachable = !diffReachable && VCS_SCOPE.test(rule.scope);
      const detail =
        `${mode}: shiki ${rule.scope}\n    ${rule.fg} on its own bg ${rule.bg}` +
        `\n    ${ratio.toFixed(2)}:1, needs ${TEXT}:1`;
      if (unreachable) {
        shikiUnreachable.push(detail);
      } else {
        fail(detail);
      }
      continue;
    }
    for (const surfaceName of ["--surface-code", "--surface-popover"]) {
      const surface = block[surfaceName];
      checks += 1;
      shikiTokensChecked += 1;
      const ratio = contrast(rule.fg, surface);
      if (ratio < TEXT) {
        fail(
          `${mode}: shiki ${rule.scope}\n    ${rule.fg} on ${surfaceName} ${surface}` +
            `\n    ${ratio.toFixed(2)}:1, needs ${TEXT}:1`,
        );
      }
    }
  }
}

/* -------------------------------------------------------------------------
 * The built stylesheet, when there is one
 * ---------------------------------------------------------------------- */

/**
 * app.css is what ships, but only after Vite has had it. If a build is present
 * this confirms the values survived it, so "shipped" is measured rather than
 * assumed. Absent a build this is skipped and said so, never silently passed.
 */
const assetDir = join(root, "build", "client", "assets");
let builtNote = "no build present, skipped";
/*
 * THE NEWEST OF EVERY SOURCE STYLESHEET, not app.css alone.
 *
 * This was `statSync(CSS_PATH).mtimeMs` and it narrowed the moment there was a
 * second entry: from 2026-08-23 an edit to `app/admin.css` or any admin part
 * leaves app.css untouched, so a build predating that edit compared as FRESH
 * and the shipped-value section below examined a stylesheet that no longer
 * matched the source. That is the same silence this block was written to end,
 * arriving through a file it could not see.
 *
 * Derived from `stylesheetPaths()`, the one owner of which files the site
 * ships, so a future entry is covered without editing this line.
 */
const cssMtime = Math.max(...stylesheetPaths().map((p) => statSync(p).mtimeMs));
if (existsSync(assetDir)) {
  const sheets = readdirSync(assetDir).filter((f) => f.endsWith(".css"));
  const newest = Math.max(
    0,
    ...sheets.map((f) => statSync(join(assetDir, f)).mtimeMs),
  );
  /*
   * A STALE BUILD IS NOW A FAILURE, and an ABSENT one is still not. The
   * distinction is the whole finding.
   *
   * This block used to say "skipped as stale" and pass. The external audit
   * measured what that costs: `touch app/app.css` and nothing else drops this
   * gate from 567 checks to 461, EXIT 0. One hundred and six assertions, 18.7
   * percent, gone in silence.
   *
   * And the trigger is the ordinary case. EDITING app.css is what makes it
   * newer than the build, so the section that verifies the SHIPPED stylesheet
   * skipped itself on exactly the runs where a token had just changed, which
   * are the runs it exists for. Absent a build there is genuinely nothing to
   * compare and reporting is right; present-but-stale means someone changed the
   * source and this gate would have told them nothing.
   */
  if (newest < cssMtime) {
    builtNote = "build is OLDER than a source stylesheet";
    fail(
      "the built stylesheet is not stale: a build exists but predates a source " +
        "stylesheet, so the " +
        "shipped-value comparison would silently examine nothing. Run npm run build.",
    );
    sheets.length = 0;
  }
  const built = sheets.map((f) => readFileSync(join(assetDir, f), "utf8")).join("\n");
  if (sheets.length === 0) {
    // Stale build, already reported above.
  } else if (!built) {
    fail("build/client/assets exists but carries no CSS");
  } else {
    // Compare NORMALISED values, never raw text. Lightning CSS rewrites
    // #ffffff to #fff, so a substring match reports three tokens missing from
    // a stylesheet that carries all of them. Measured, not guessed: the first
    // run of this block failed on --on-brand, --on-fill-danger and
    // --on-fill-success, every one of them a white that had been shortened.
    /** @param {string} v */
    const norm = (v) => {
      const h = v.trim().toLowerCase().replace("#", "");
      const full =
        h.length === 3
          ? h
              .split("")
              .map((c) => c + c)
              .join("")
          : h;
      return `#${full}`;
    };

    /** @type {Map<string, Set<string>>} */
    const shipped = new Map();
    for (const m of built.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
      if (!shipped.has(m[1])) shipped.set(m[1], new Set());
      shipped.get(m[1])?.add(norm(m[2]));
    }

    let missing = 0;
    for (const [mode, block] of MODES) {
      for (const [name, value] of Object.entries(block)) {
        checks += 1;
        if (!shipped.get(name)?.has(norm(value))) {
          missing += 1;
          fail(
            `built CSS does not carry ${mode} ${name}: ${value}` +
              `\n    shipped values for that token: ${[...(shipped.get(name) ?? [])].join(", ") || "none"}`,
          );
        }
      }
    }
    const total = Object.keys(light).length + Object.keys(darkAttr).length;
    builtNote = `${sheets.length} stylesheet(s), ${total - missing} of ${total} light+dark values found`;
  }
}

/* -------------------------------------------------------------------------
 * Report
 * ---------------------------------------------------------------------- */

console.log("check:contrast");
console.log(`  tokens        light ${Object.keys(light).length}, dark ${Object.keys(darkAttr).length}`);
console.log(`  matrix        ${MATRIX.length} pairs x 2 modes`);
console.log(
  `  APCA impl     ${APCA_KEYSTONE.length}/${APCA_KEYSTONE.length} keystone vectors, worst delta ${apcaWorstDelta.toExponential(2)}`,
);
console.log(`  shiki         ${shikiTokensChecked} token/surface pairs`);
if (shikiUnreachable.length > 0) {
  console.log(
    `  unreachable   ${shikiUnreachable.length} low-contrast VCS token(s), no diff grammar loaded:`,
  );
  for (const d of shikiUnreachable) {
    console.log(`      ${d.split("\n")[0].trim()}`);
  }
}
console.log(`  built CSS     ${builtNote}`);

// APCA, advisory. Report the pairs the ratified rules lean on, lowest first,
// because the low end is where the two models disagree.
const worst = advisory
  .filter((a) => Math.abs(a.lc) > 0)
  .sort((a, b) => Math.abs(a.lc) - Math.abs(b.lc))
  .slice(0, 8);
// SIGNED Lc, required by APCA conformance. The sign IS the polarity: positive
// is dark text on a light background, negative is light on dark. Reporting a
// bare magnitude throws that away, and it is the half of the number that says
// which of the two asymmetric curves produced it. Ranked by magnitude, because
// the question is "what is weakest", not "what is most negative".
console.log("\n  APCA Lc (SIGNED, advisory only), eight weakest of the matrix:");
for (const a of worst) {
  const lc = `${a.lc >= 0 ? "+" : ""}${a.lc.toFixed(1)}`;
  console.log(
    `    Lc ${lc.padStart(6)}  ${a.ratio.toFixed(2).padStart(5)}:1  ${a.mode.padEnd(5)} ${a.note}`,
  );
}

/*
 * A FLOOR ON THIS GATE'S OWN EXECUTED ASSERTIONS.
 *
 * Every other floor in this repo guards a SCOPE: files walked, sites found. A
 * scope floor cannot see control flow skipping a block it already reached, and
 * that is the failure the external audit measured here.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE, 2026-08-13: 599 with the built
 * stylesheet compared, 483 without. Both re-measured by RUNNING the gate, the
 * second by renaming build/client/assets aside and restoring it, never by
 * adding up the sections by hand. Superseded 2026-08-11's 567 and 461: v4 added
 * five chrome pairs (10 checks across two modes), the participation section (2),
 * and ten built-CSS value assertions.
 *
 * CONDITIONAL ON A BUILD BEING PRESENT, and that is not a softening. A fresh
 * checkout has no `build/` at all, because it is gitignored, so a flat floor
 * failed inside check:head's extraction on the first attempt: the gate was
 * green on disk and red against HEAD, which is exactly the divergence check:head
 * exists to surface. It surfaced mine.
 *
 * Absent a build there is genuinely nothing to compare and 483 is the honest
 * full count. Present-but-stale is a failure on its own above; this floor is
 * the second lock on the same door, for the case where that assertion is ever
 * weakened.
 *
 * **RE-MEASURED 2026-08-16, BOTH TIERS, BY RUNNING THEM: 625 with the build
 * present and 501 without.** The scrim pair landed for the media v6 caption
 * bar (`--scrim`, `--on-scrim`), which the participation assertion caught the
 * moment the tokens were declared and before either had a pair.
 *
 * **THE OWED MEASUREMENT IS PAID.** The previous note recorded that renaming
 * `build/` aside had been refused by this filesystem twice, so the no-build
 * tier had never actually been run and 460 was left deliberately loose with the
 * measurement stated as owed rather than done. The rename succeeded this time
 * (`build/client/assets` moved aside, gate run, moved back), and the tier reads
 * 501.
 *
 * **THE ARITHMETIC WOULD HAVE BEEN WRONG AGAIN, THIRD INSTANCE.** Subtracting
 * the previously recorded 132-check gap from 625 predicts 493; the measurement
 * is 501. The two prior instances are on the record in the same class:
 * verify-live's predicted 213 measured 214, and this gate's own prior note
 * carried 599 in its failure message while its prose carried 615. A count is
 * measured or it is a guess with a number attached.
 *
 * Both floors are 94 percent of their own measurement, which is the margin the
 * other gates use: 587 of 625, and 470 of 501.
 */
/* ---- partial opacity on text is refused ------------------------------- */

/*
 * THE HOLE THIS CLOSES, and this gate's own header has described it for a week.
 *
 * Everything above reads token hexes and computes ratios. `opacity` is
 * compositing the browser applies AFTERWARDS, so a pair that measures 7:1 here
 * can reach the reader at 4.35:1 and nothing in this file can tell. The header
 * calls every opacity on text "a hole of this shape" and enumerates nineteen
 * declarations by hand. A hand enumeration in a comment is not a gate: it was
 * right when written and could not notice the twentieth.
 *
 * `.heading-anchor` is what made it worth building. Under `(hover: none)` it
 * was `opacity: 0.55` over `--text-muted`, which is a measured token painted at
 * an unmeasured strength, on every heading of every post for every touch
 * reader. It is gone; this is what stops the next one.
 *
 * ## WHAT COUNTS AS PARTIAL, AND WHY 0 AND 1 DO NOT
 *
 * Only `0 < value < 1` is refused. `opacity: 0` and `opacity: 1` are a REVEAL
 * PAIR: the element is either absent or painted at full strength, so nothing is
 * ever composited at a value nobody measured. That is the arrangement
 * `.heading-anchor` now uses inside `@media (hover: hover)`, and refusing it
 * would refuse the fix along with the defect.
 *
 * ## WHAT IT CANNOT DECIDE, WHICH IS WHY THERE IS A LIST
 *
 * Whether a selector paints TEXT needs a rendering, and this gate has none. So
 * the rule is inverted: every partial opacity is refused unless it is named
 * here with a reason. A new one fails until somebody classifies it, which is
 * the direction that cannot go quietly wrong. The reasons below are lifted from
 * the header's own enumeration rather than invented, so there is one
 * classification rather than two.
 *
 * ## KEYED BY PATTERN, NOT BY SELECTOR TEXT, and the first attempt was not
 *
 * The exemptions were written as exact selector strings, and the gate refused
 * `.row-action:disabled` on its first run: the declaration in the file is a
 * comma-separated GROUP of eight disabled-control selectors, and the name I had
 * copied was only its last line. That is the mirror failure in miniature, and
 * the repair is to describe the CLASS rather than transcribe the instance.
 *
 * A group is exempt only when EVERY member of it matches an entry. One
 * unclassified selector in a group of eight is still an unclassified selector,
 * and the alternative rule (exempt if ANY member matches) would let a text
 * selector ride along beside a scrim.
 *
 * @type {Array<{ test: RegExp, why: string }>}
 */
const OPACITY_EXEMPT = [
  {
    test: /:disabled|\[disabled\]/,
    why: "a disabled control, which WCAG 1.4.3 exempts outright",
  },
  {
    test: /\[data-pending\]/,
    why: "a transient pending state, seconds at a time, on the admin plane",
  },
  { test: /-scrim/, why: "a scrim, not text" },
  {
    test: /^\.search-why-sep$/,
    why: 'incidental punctuation, the "/" between why-terms, recorded as LEFT in this header',
  },
];

/**
 * True when every selector in a group is covered by some exemption.
 * @param {string} selectorGroup
 * @returns {boolean}
 */
function opacityExempt(selectorGroup) {
  const members = selectorGroup
    .split(",")
    .map((one) => one.trim())
    .filter(Boolean);
  if (members.length === 0) return false;
  return members.every((/** @type {string} */ one) =>
    OPACITY_EXEMPT.some((entry) => entry.test.test(one)),
  );
}

{
  /** @type {Array<{ file: string, selector: string, value: string }>} */
  const partial = [];
  let declarations = 0;

  for (const file of stylesheetPaths()) {
    const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "");
    const name = file.split(/[\\/]/).slice(-1)[0];

    for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = match[1].trim().split("\n").map((l) => l.trim()).join(" ");
      const block = match[2];
      for (const decl of block.matchAll(/(?:^|;)\s*opacity\s*:\s*([0-9.]+)\s*(?:;|$)/g)) {
        declarations += 1;
        const value = Number(decl[1]);
        if (value > 0 && value < 1) partial.push({ file: name, selector, value: decl[1] });
      }
    }
  }

  /*
   * SCOPE FLOOR. A regex that stopped matching would report no partial opacity
   * anywhere, which is exactly what a clean sweep reports. The site has never
   * had fewer than a handful of opacity declarations of any value.
   */
  assert(
    `the opacity scan read declarations at all (${declarations} found)`,
    declarations >= 8,
  );

  const unclassified = partial.filter((d) => !opacityExempt(d.selector));
  assert(
    unclassified.length === 0
      ? "every partial opacity is classified"
      : `UNCLASSIFIED partial opacity: ${unclassified
          .map((d) => `${d.file} ${d.selector} at ${d.value}`)
          .join("; ")}`,
    unclassified.length === 0,
  );

  /*
   * AND THE LIST DOES NOT ROT. An exemption naming a selector that no longer
   * carries a partial opacity is a licence nobody is using, and the next reader
   * would take it as evidence the pattern is fine.
   */
  const stale = OPACITY_EXEMPT.filter(
    (entry) =>
      !partial.some((d) =>
        d.selector.split(",").some((/** @type {string} */ one) => entry.test.test(one.trim())),
      ),
  ).map((entry) => String(entry.test));
  assert(
    stale.length === 0
      ? "every opacity exemption covers a live declaration"
      : `STALE opacity exemption(s): ${stale.join(", ")}`,
    stale.length === 0,
  );
}

/* ---- the theme-color meta tags are a SECOND COPY of two tokens ---------- */

/*
 * `<meta name="theme-color">` paints the browser chrome and the OS task
 * switcher, and neither resolves a custom property, so root.tsx writes the two
 * background hexes out literally. That is a second copy of a value the palette
 * owns, which is exactly what rule 17 forbids leaving unwatched, and the copy
 * is in a file no colour gate reads.
 *
 * So it is watched here. The tags are matched by their media query rather than
 * by position, because two tags differing only in an attribute are the easiest
 * pair in the file to transpose, and a light hex under the dark media query is
 * a defect no page renders differently: it shows up on the phone's chrome and
 * nowhere in any screenshot.
 */
{
  const rootSource = readFileSync(join(root, "app", "root.tsx"), "utf8");
  const declared = Object.fromEntries(
    [
      ...rootSource.matchAll(
        /<meta\s+name="theme-color"\s+media="\(prefers-color-scheme:\s*(light|dark)\)"\s+content="(#[0-9a-fA-F]{3,8})"/g,
      ),
    ].map((m) => [m[1], m[2].toLowerCase()]),
  );

  assert(
    "root.tsx declares a theme-color for BOTH schemes",
    Boolean(declared.light) && Boolean(declared.dark),
  );
  assert(
    `theme-color light ${declared.light} is the light --bg ${light["--bg"]}`,
    declared.light === String(light["--bg"]).toLowerCase(),
  );
  assert(
    `theme-color dark ${declared.dark} is the dark --bg ${darkAttr["--bg"]}`,
    declared.dark === String(darkAttr["--bg"]).toLowerCase(),
  );
}

const buildPresent = existsSync(assetDir);
const MINIMUM_CHECKS = buildPresent ? 593 : 476;
if (checks < MINIMUM_CHECKS) {
  failures.push(
    `only ${checks} assertions executed, expected at least ${MINIMUM_CHECKS} ` +
      `(build ${buildPresent ? "present" : "absent"}). A block was SKIPPED rather than ` +
      `failing. Measured 2026-08-28: 642 with the built stylesheet compared. Both ` +
      `floors move by exactly the assertions added: three theme-color ones on ` +
      `2026-08-27 and three partial-opacity ones on 2026-08-28. All six read source ` +
      `only and execute in both branches, which is why the absent-build floor moves ` +
      `without being re-run.`,
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`\n${checks} checks, 0 failures`);
