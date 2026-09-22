/**
 * Gate over the shipped color tokens.
 *
 *   npm run check:contrast
 *
 * Hexes come from the stylesheet; pairs and thresholds from design-tokens.md, as names, so
 * an edited hex fails. WCAG 2.x fails a run; APCA is advisory. Renders nothing.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The same themes the pipeline highlights with, imported from the pipeline so
// the gate cannot drift from the renderer by checking a theme nothing uses.
import { LANGUAGES, SHIKI_THEMES } from "../app/lib/content/pipeline.mjs";

// Shared with /playground so both compute ratios by one rule. Only arithmetic is shared.
import { apca, contrast } from "../app/lib/contrast.mjs";

/* File discovery only; palette parsing stays here, independent of `tokens.mjs`. */
import { allSourceCss, stylesheetPaths } from "./lib/tokens.mjs";
import { assertFloor } from "./lib/floor.mjs";

const { light: githubLight, dark: githubDark } = SHIKI_THEMES;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_PATH = join(root, "app", "app.css");

/* Tokens, from the shipped stylesheet */

const cssSource = readFileSync(CSS_PATH, "utf8");

/** Strip comments first: the token block's comment names its selectors. */
const css = cssSource
  // CRLF first: a Windows clone gets CRLF and multi-line matches fail.
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
  /**
   * Every declaration, in order: a mixed fill ships its hex, then its `color-mix` recipe.
   * @type {Record<string, string[]>}
   */
  const allDecls = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const name = m[1];
    const value = m[2].trim();
    (allDecls[name] ??= []).push(value);
    // The FIRST declaration is the measured one: it is the hex both branches
    // paint, and the second is the recipe that must reproduce it.
    if (!(name in out)) out[name] = value;
  }
  if (Object.keys(out).length === 0) throw new Error(`${label}: parsed zero tokens`);
  Object.defineProperty(out, "__decls", { value: allDecls, enumerable: false });
  return out;
}

/**
 * Composite `color-mix(in srgb, A p%, B)` the way a browser does: sRGB channel
 * interpolation of two opaque colors, which is plain linear interpolation of
 * the 8-bit values.
 *
 * @param {string} expr
 * @returns {string|null} the composite as a hex, or null if this is not a mix
 */
function compositeMix(expr) {
  const m = /^color-mix\(\s*in\s+srgb\s*,\s*(#[0-9a-fA-F]{6})\s+([\d.]+)%\s*,\s*(#[0-9a-fA-F]{6})\s*\)$/.exec(
    expr.trim(),
  );
  if (!m) return null;
  const [, a, pct, b] = m;
  const p = Number(pct) / 100;
  /** @param {string} hex @param {number} i */
  const ch = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const light = tokenBlock("light", ':root,\n[data-theme="light"]');
const darkMedia = tokenBlock("dark (prefers-color-scheme)", ":root:not([data-theme])");
const darkAttr = tokenBlock("dark (attribute)", '[data-theme="dark"]');

/* Canary: the first selector match wins; `--paper` is only in the palette blocks. */
/** @type {Array<[string, Record<string, string>]>} */
const PALETTE_BLOCKS = [
  ["light", light],
  ["dark (prefers-color-scheme)", darkMedia],
  ["dark (attribute)", darkAttr],
];
for (const [label, block] of PALETTE_BLOCKS) {
  if (!("--paper" in block)) {
    throw new Error(
      `${label}: the block parsed for this selector does not declare --paper, so it is not the palette ` +
        `block. A theme block was almost certainly added above the palette; move it below.`,
    );
  }
}

/* Assertions */

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

// Name parity: a token missing from dark keeps its light value there.

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

// Each token must resolve through same-block `var()` to a literal hex.

/**
 * Follow a chain of same-block `var()` references to the value it lands on.
 *
 * @param {Record<string, string>} block
 * @param {string} name
 * @returns {{value: string|null, chain: string[]}}
 */
function resolveToken(block, name) {
  /** @type {string[]} */
  const chain = [];
  let current = name;
  // A cycle cannot outlast the number of tokens in the block.
  for (let i = 0; i <= Object.keys(block).length; i += 1) {
    const raw = block[current];
    if (raw === undefined) return { value: null, chain };
    const ref = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(raw.trim());
    if (!ref) return { value: raw.trim(), chain };
    if (chain.includes(ref[1])) return { value: null, chain };
    chain.push(ref[1]);
    current = ref[1];
  }
  return { value: null, chain };
}

/** @type {Array<[string, Record<string, string>]>} */
const MODES = [
  ["light", light],
  ["dark", darkAttr],
];

for (const [mode, block] of MODES) {
  for (const name of Object.keys(block)) {
    const { value } = resolveToken(block, name);
    assert(
      `${mode} ${name} resolves to a literal hex, got: ${value ?? `unresolvable (${block[name]})`}`,
      value !== null && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value),
    );
  }
}

/* A mixed fill's recipe must still produce its hex, one unit per channel. */
for (const [mode, block] of MODES) {
  const decls = /** @type {Record<string, string[]>} */ (
    /** @type {any} */ (block).__decls
  );
  for (const [name, values] of Object.entries(decls)) {
    if (values.length === 1) continue;
    assert(
      `${mode} ${name} is declared at most twice, got ${values.length}`,
      values.length === 2,
    );
    const [hex, recipe] = values;
    const composite = compositeMix(recipe);
    assert(
      `${mode} ${name}'s second declaration is a color-mix, got: ${recipe}`,
      composite !== null,
    );
    if (composite === null) continue;
    /** @param {string} h @param {number} i */
    const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    const close =
      /^#[0-9a-fA-F]{6}$/.test(hex) &&
      [0, 1, 2].every((i) => Math.abs(ch(hex, i) - ch(composite, i)) <= 1);
    assert(
      `${mode} ${name}: the recipe composites to the hex beside it` +
        (close ? "" : `\n    ${recipe}\n    composites to ${composite}, declared ${hex}`),
      close,
    );
  }
}

/* APCA, checked against the published vectors */

/** apca-w3 0.1.9 keystone vectors, both polarities, so the sign is tested. */
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

/* The matrix, from design-tokens.md, as names */

// No --fill-* on --paper row: a fill always carries text.
const TEXT = 4.5; // WCAG 1.4.3 AA, normal text
const UI = 3.0; // WCAG 1.4.11, non-text UI and graphical objects
// No disabled floor: WCAG exempts inactive components.

/** @type {Array<[string, string, number, string]>} fg, bg, min, note */
const MATRIX = [
  // Body and neutrals
  ["--text", "--paper", TEXT, "body text on paper"],
  // CodeMirror syntax colors, on --paper and the active line's --paper.
  ["--text-heading", "--paper", TEXT, "heading text on paper"],
  ["--text-accent", "--paper", TEXT, "accent text on paper"],
  ["--text", "--surface-popover", TEXT, "body on popover"],
  // The settings drawer: inputs on --paper inside the popover step.
  ["--text-heading", "--surface-popover", TEXT, "heading on popover"],
  // No --text-disabled on --surface-popover row: it fails there, nothing ships it.
  ["--text", "--mark-bg", TEXT, "body on search highlight"],
  ["--text", "--selection-bg", TEXT, "body on selection"],
  ["--text", "--tint-brand", TEXT, "body on brand tint"],
  ["--text-secondary", "--paper", TEXT, "quiet ink on paper"],
  ["--text-secondary", "--surface-popover", TEXT, "muted on popover"],
  // No disabled row: WCAG exempts inactive controls. See NON_PARTICIPATING.

  // Borders are non-text UI
  ["--border", "--paper", UI, "a hairline on paper"],
  // No --border on --surface-popover row: it fails there, so the popover step takes
  // --border-strong.
  ["--border-strong", "--paper", UI, "a control edge on paper"],
  ["--border-strong", "--surface-popover", UI, "strong border on popover"],

  // Brand
  ["--brand", "--paper", TEXT, "a link, a focus ring and the header mark, all on paper"],
  ["--brand", "--surface-popover", TEXT, "a link and its focus ring on the popover step"],
  // The cover picker rings the chosen thumbnail in brand, on the drawer.
  ["--brand", "--tint-brand", TEXT, "brand on its own tint"],
  ["--brand-hover", "--paper", TEXT, "a hovered link on paper"],
  // The admin identity block hovers on the shell surface, not the page.
  ["--brand-pressed", "--paper", TEXT, "a pressed link on paper"],
  ["--on-brand", "--brand", TEXT, "text on brand fill"],
  ["--on-brand", "--brand-hover", TEXT, "text on brand hover fill"],
  ["--on-brand", "--brand-pressed", TEXT, "the label on a pressed primary button"],
  ["--visited", "--paper", TEXT, "a visited link on paper"],
  ["--focus-ring-on-brand", "--brand", UI, "inner ring on brand fill"],
  // No --focus-ring-on-brand against --fill-danger. It measures 1.47:1 in dark,
  // so app.css does not draw that ring and this does not pretend it does.

  // Chrome text is measured against the chrome, not the page.
  ["--on-chrome", "--surface-chrome", TEXT, "wordmark and current nav on chrome"],
  ["--on-chrome-muted", "--surface-chrome", TEXT, "nav at rest on chrome"],
  // The mark is a graphical object, not text, so it takes the 1.4.11 floor.
  ["--mark-on-chrome", "--surface-chrome", UI, "logo mark on chrome"],
  ["--focus-ring-on-chrome", "--surface-chrome", UI, "focus ring on chrome"],
  // Inverted pair: WCAG is symmetric, APCA is not.
  ["--surface-chrome", "--on-chrome-muted", TEXT, "pressed toggle and skip link, inverted"],
  // The caption band is opaque, so the ratio ignores the picture.
  ["--on-scrim", "--scrim", TEXT, "tile caption over the image"],

  // No --border-strong on --surface-chrome row: a seam has no 3:1 obligation.

  // Danger
  ["--text-danger", "--paper", TEXT, "danger text on paper"],
  // Revert to draft, as a row in the overflow menu on the popover step.
  ["--text-danger", "--surface-popover", TEXT, "danger text on popover"],
  ["--on-tint-danger", "--tint-danger", TEXT, "text on danger tint"],
  ["--border-danger", "--paper", UI, "danger border"],
  ["--on-fill-danger", "--fill-danger", TEXT, "text on danger fill"],
  ["--on-fill-danger", "--fill-danger-hover", TEXT, "text on danger hover fill"],

  // Warning
  ["--text-warning", "--paper", TEXT, "warning text on paper, including the command bar dirty state"],
  ["--on-tint-warning", "--tint-warning", TEXT, "text on warning tint"],
  ["--border-warning", "--paper", UI, "a warning border on paper, including the dirty dot ring"],
  ["--border-warning", "--tint-warning", UI, "warning border on its own tint"],
  // The dirty-state indicator in the command bar: amber text and an amber fill
  // dot, both on the shell surface rather than on the page.
  ["--brand", "--tint-warning", UI, "brand fill edge on warning tint"],
  ["--on-fill-warning", "--fill-warning", TEXT, "text on warning fill"],

  // Success
  ["--text-success", "--paper", TEXT, "success text on paper"],
  ["--on-tint-success", "--tint-success", TEXT, "text on success tint"],
  ["--border-success", "--paper", UI, "a success border on paper"],
  ["--on-fill-success", "--fill-success", TEXT, "text on success fill"],

  // Accent, decorative but still read as text

  // Charts are graphical objects
  ["--chart-cadet", "--paper", UI, "chart cadet"],
  ["--chart-purple", "--paper", UI, "chart purple"],
  ["--chart-claret", "--paper", UI, "chart claret"],
  ["--chart-sage", "--paper", UI, "chart sage"],
  ["--chart-gold", "--paper", UI, "chart gold"],
  ["--chart-rust", "--paper", UI, "chart rust"],

  /* Destructive, on every surface it lands on and its own tint. */
  ["--text-destructive", "--paper", TEXT, "destructive text on paper"],
  ["--text-destructive", "--surface-popover", TEXT, "destructive text in a popover"],
  ["--text-destructive", "--tint-destructive", TEXT, "destructive text on its own tint"],

  /* Paper, glass, light: pairs from the handoffs, as names */

  // Text on the two paper surfaces, and on the one glass that touches paper.
  ["--text", "--glass-fill-paper", TEXT, "body on paper glass, composited"],
  ["--text-secondary", "--glass-fill-paper", TEXT, "muted copy on paper glass"],
  // The placeholder must sit below the value that replaces it.
  ["--placeholder", "--paper", TEXT, "placeholder in a field"],

  /*
   * Brand, its two states, and the second shade a followed link takes. THE HEADER MARK RIDES THE
   * FIRST ROW: ruling 118.2 draws it in the logo's own colors on --paper, and its five purple paths
   * take --brand, so the pair below measures it at the 4.5 floor rather than the 1.4.11 one it
   * would be owed. No second row at UI for the mark: a weaker floor over the same pair cannot fail
   * while this one passes, and an assertion that cannot fail is not coverage (hard rule 10).
   *
   * NO ROWS FOR THE MARK'S THREE WARM PATHS, and they would fail: on limestone they measure 2.72,
   * 1.93 and 1.58 to one. They are the logotype's own ink, which 1.4.11 exempts, the mark is
   * aria-hidden beside a wordmark that names the link, and the drawing's outline is carried by the
   * purple at 9.10 to one light and 7.89 dark. Measured 2026-09-21. This is the same reason the
   * chrome row above measures only --mark-on-chrome.
   */
  ["--brand", "--glass-fill-paper", TEXT, "link on paper glass"],
  /* PR #52's measured pair, moved onto the surviving name by ruling 128's collapse. */
  ["--visited", "--glass-fill-paper", TEXT, "visited link on paper glass"],
  // A followed link inside an alert tint.
  ["--visited", "--error-tint", TEXT, "visited link on an error tint"],
  ["--visited", "--warning-tint", TEXT, "visited link on a warning tint"],
  ["--visited", "--success-tint", TEXT, "visited link on a success tint"],

  // No bar rows: a pair against a surface nothing paints is not coverage (rule 10's class).

  // No --dust row on paper: it cannot identify a control; --line-strong does.
  ["--line-strong", "--paper", UI, "a control edge on paper"],

  // Semantic, and only where the state is real.
  ["--error", "--paper", TEXT, "error text on paper"],
  ["--error", "--error-tint", TEXT, "error text on its own tint"],
  ["--on-error-fill", "--error-fill", TEXT, "label on a destructive fill"],
  ["--warning", "--paper", TEXT, "warning text on paper"],
  ["--warning", "--warning-tint", TEXT, "warning text on its own tint"],
  ["--on-warning-fill", "--warning-fill", TEXT, "label on a warning fill"],
  ["--success", "--paper", TEXT, "success text on paper"],
  ["--success", "--success-tint", TEXT, "success text on its own tint"],
  ["--on-success-fill", "--success-fill", TEXT, "label on a success fill"],

  // Figures. EVERY SERIES CARRIES LINES AND LABELS, so every series clears the
  // 1.4.11 floor against the ground: a series' stroke is the thing that has to
  // be seen. An area FILL may sit lighter and has no row, by the same rule.
  ["--fig-s1", "--fig-ground", UI, "figure series 1 stroke"],
  ["--fig-s2", "--fig-ground", UI, "figure series 2 stroke"],
  ["--fig-s3", "--fig-ground", UI, "figure series 3 stroke"],
  ["--fig-s4", "--fig-ground", UI, "figure series 4 stroke"],
  ["--fig-s5", "--fig-ground", UI, "figure series 5 stroke"],
  // Axis and grid take --fig-dust-400: an axis carries meaning, so 1.4.11 applies.
  ["--fig-dust-400", "--fig-ground", UI, "figure axis and grid stroke"],
  ["--text-secondary", "--fig-ground", TEXT, "figure label"],
  ["--text", "--fig-ground", TEXT, "figure key label"],
  /*
   * PLATE I. A leader starts at its plaque's center, so it crosses the LAWN, and it identifies which
   * label names which plaque: 1.4.11 applies. The plate draws it in oxide 400 light and 300 dark;
   * 300 is the pair measured in every theme because it is the weaker of the two on the light lawn
   * (3.2:1 against 400's 4.3:1), so a pass here covers both. The plaque outlines are ink on the
   * lawn and on the turbid tone.
   */
  ["--fig-oxide-300", "--fig-lawn", UI, "plate leader on the lawn"],
  ["--text", "--fig-lawn", UI, "plaque outline on the lawn"],
  ["--text", "--fig-turbid", UI, "plaque outline on the turbid tone"],
];

/** @type {Array<{mode: string, note: string, lc: number, ratio: number}>} */
const advisory = [];

for (const [mode, block] of MODES) {
  for (const [fgName, bgName, min, note] of MATRIX) {
    // RESOLVED, not raw: a series slot is declared as its ramp step, and the
    // ratio that ships is the ramp's hex.
    const fg = resolveToken(block, fgName).value;
    const bg = resolveToken(block, bgName).value;
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

/* Resolution: a token used and never declared */

/*
 * An undeclared `var()` drops silently, and every pass above walks declarations.
 * DECLARED_ELSEWHERE lists tokens set outside CSS, and polices itself.
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
  [
    "--swatch",
    "written inline by the :swatch directive on each chip, one per chip, per post; " +
      "prose.css reads it back as var(--swatch, transparent). Same shape as the four " +
      "Shiki tokens above and for the same reason: the value is per instance and comes " +
      "from the post, so there is no theme block it could live in. It is deliberately " +
      "NOT declared, which is what keeps the participation assertion below untouched " +
      "and its exemption map empty: the color being SHOWN is not a color this system " +
      "chose, and no ratio can be asserted about it",
  ],
]);

{
  /* All source stylesheets, stripped: app.css prose names the Shiki tokens. */
  const code = allSourceCss().replace(/\/\*[\s\S]*?\*\//g, " ");

  const used = new Set([...code.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((m) => m[1]));
  const declaredAnywhere = new Set(
    [...code.matchAll(/(?:^|[;{]|\s)(--[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[1]),
  );

  /* Scope, both sides: an empty set on either side fails for the wrong reason. */
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

/* Participation: every declared token is measured by some pair */

// Parity proves a token declared, not measured. Exemptions police themselves.
/** @type {Map<string, string>} token -> why no ratio of its own can be asserted */
const NON_PARTICIPATING = new Map([
  // Paper, glass, light tokens with no contrast obligation.
  [
    "--dust",
    "lines only, and deliberately below the floor: 1.57:1 on limestone. It rules, hairlines and " +
      "outlines a disabled control, and it may never be the thing that identifies one. That is why " +
      "--line-strong exists, and --line-strong carries the rows",
  ],
  [
    "--text-disabled",
    "an INACTIVE component, which WCAG 1.4.3 exempts outright. MEASURED 2.46:1 on limestone and " +
      "recorded as failing rather than quietly unmeasured: a disabled control that met 4.5:1 would " +
      "read as available. It is identified by the disabled attribute, the recess, and text beside it",
  ],
  [
    "--lamp-chroma-on-paper",
    "a catch hue mixed in behind the one paper glass surface. The brief's rule is that light is " +
      "atmosphere and never meaning, so nothing reads it and no pair can be required of it. Its " +
      "companion --lamp-chroma-on-bar was deleted 2026-09-14 with the bar it lit",
  ],
  /*
   * DUST 300 IS TEXTURE ON PLATE I: the halo's dashed outer ring, drawn on the turbid tone. It
   * marks the edge of a diffuse zone rather than identifying anything, which the ink ring inside it
   * does (ruling 122: texture, never a series). Whether the plate's tones separate is a shot.
   */
  [
    "--fig-dust-300",
    "texture: the halo's dashed ring on Plate I, below the stroke floor because it identifies nothing",
  ],
  // Unused ramp steps: interiors may sit below 3:1, only edges may not.
  ...(/** @type {Array<[string, string]>} */ (
    [
      "--fig-purple-400",
      "--fig-leaf-100",
      "--fig-leaf-400",
      "--fig-leaf-500",
      "--fig-oxide-100",
      "--fig-oxide-200",
      "--fig-oxide-500",
      "--fig-dust-100",
      "--fig-dust-200",
    ].map((t) => [
      t,
      "a ramp step no series slot resolves through: a fill or a letterbox ground, which step 4 " +
        "exempts from the stroke floor",
    ])
  )),
]);

{
  const named = new Set(MATRIX.flatMap(([fg, bg]) => [fg, bg]));

  /* Transitive: a slot declared as `var(--ramp)` measures the ramp step. */
  const inMatrix = new Set(named);
  for (const [, block] of MODES) {
    for (const n of named) {
      for (const step of resolveToken(block, n).chain) inMatrix.add(step);
    }
  }

  const declared = Object.keys(light).filter((n) => n in darkAttr && n in darkMedia);

  // Floored at the doc's 53 purpose-named tokens per mode, so an empty parse fails.
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

/* content/tokens.json: the swatch inventory /playground/ui renders */

/*
 * A Worker cannot read a stylesheet, so the inventory page's swatches come from
 * a committed build product. This re-derives the answer from app.css with the
 * parser above rather than reading the generator's, so agreement means two
 * readings of the sheet agree.
 */
{
  const inventory = JSON.parse(readFileSync(join(root, "content", "tokens.json"), "utf8"));
  /** @type {Array<{name: string, light: string, dark: string}>} */
  const rows = inventory.tokens ?? [];

  const expected = Object.keys(light).map((name) => ({
    name,
    light: resolveToken(light, name).value,
    dark: resolveToken(darkAttr, name).value,
  }));

  assert(
    `tokens.json scope is non-empty: ${rows.length} row(s) against ${expected.length} palette tokens`,
    expected.length >= 53 && rows.length === expected.length,
  );

  const drift = expected.filter((want, i) => {
    const got = rows[i];
    return !got || got.name !== want.name || got.light !== want.light || got.dark !== want.dark;
  });
  assert(
    `content/tokens.json matches app.css, token for token and in order` +
      (drift.length ? `\n    first disagreement: ${drift[0].name}. Run npm run build:tokens.` : ""),
    drift.length === 0,
  );
}

/* prefers-contrast: more */

/**
 * The high-contrast tier is held to the same matrix, so it cannot lower a value.
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
    for (const surface of ["--paper", "--paper", "--surface-popover"]) {
      checks += 1;
      const ratio = contrast(tier["--text-secondary"], base[surface]);
      if (ratio < TEXT) {
        fail(
          `${mode} prefers-contrast: muted on ${surface}` +
            `
    ${tier["--text-secondary"]} on ${base[surface]}` +
            `
    ${ratio.toFixed(2)}:1, needs ${TEXT}:1`,
        );
      }
    }
    checks += 1;
    const borderRatio = contrast(tier["--border"], base["--paper"]);
    if (borderRatio < UI) {
      fail(
        `${mode} prefers-contrast: border on --paper` +
          `
    ${tier["--border"]} on ${base["--paper"]}` +
          `
    ${borderRatio.toFixed(2)}:1, needs ${UI}:1`,
      );
    }

    // The whole point of the tier: it must be STRICTLY better than the default,
    // or it is not a high-contrast mode, it is a different one.
    assert(
      `${mode} prefers-contrast raises muted text` +
        ` (${contrast(base["--text-secondary"], base["--paper"]).toFixed(2)}` +
        ` -> ${contrast(tier["--text-secondary"], base["--paper"]).toFixed(2)})`,
      contrast(tier["--text-secondary"], base["--paper"]) >
        contrast(base["--text-secondary"], base["--paper"]),
    );
    assert(
      `${mode} prefers-contrast raises the default border` +
        ` (${contrast(base["--border"], base["--paper"]).toFixed(2)}` +
        ` -> ${contrast(tier["--border"], base["--paper"]).toFixed(2)})`,
      contrast(tier["--border"], base["--paper"]) > contrast(base["--border"], base["--paper"]),
    );
    // The doc says the border promotes to border-strong. Assert the identity,
    // not just that it went up.
    assert(
      `${mode} prefers-contrast border equals border-strong`,
      tier["--border"].toLowerCase() === base["--border-strong"].toLowerCase(),
    );
  }
}

/* Shiki syntax tokens against the code surfaces */

/**
 * Paired rules are measured on their own background; the rest on both code surfaces.
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

/** VCS scopes are reported, not counted, only while `diff` is not in LANGUAGES. */
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
    for (const surfaceName of ["--paper", "--surface-popover"]) {
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

/* The built stylesheet, when present */

/**
 * app.css is what ships, but only after Vite has had it. If a build is present
 * this confirms the values survived it, so "shipped" is measured rather than
 * assumed. Absent a build this is skipped and said so, never silently passed.
 */
const assetDir = join(root, "build", "client", "assets");
let builtNote = "no build present, skipped";
/* Newest of every source stylesheet, from `stylesheetPaths()`, not app.css alone. */
const cssMtime = Math.max(...stylesheetPaths().map((p) => statSync(p).mtimeMs));
if (existsSync(assetDir)) {
  const sheets = readdirSync(assetDir).filter((f) => f.endsWith(".css"));
  const newest = Math.max(
    0,
    ...sheets.map((f) => statSync(join(assetDir, f)).mtimeMs),
  );
  /* Stale fails, absent does not: editing a source is what makes the build stale. */
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
    // Compare normalized values: Lightning CSS shortens #ffffff to #fff.
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
    // Slots ship as `var()`, minified without the space after the colon.
    for (const m of built.matchAll(/(--[a-z0-9-]+)\s*:\s*(var\(\s*--[a-z0-9-]+\s*\))/g)) {
      if (!shipped.has(m[1])) shipped.set(m[1], new Set());
      shipped.get(m[1])?.add(m[2].replace(/\s+/g, ""));
    }

    let missing = 0;
    for (const [mode, block] of MODES) {
      for (const [name, value] of Object.entries(block)) {
        checks += 1;
        const wanted = value.trim().startsWith("var(")
          ? value.replace(/\s+/g, "")
          : norm(value);
        if (!shipped.get(name)?.has(wanted)) {
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

/* Report */

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
// Signed Lc: the sign is the polarity. Ranked by magnitude.
console.log("\n  APCA Lc (SIGNED, advisory only), eight weakest of the matrix:");
for (const a of worst) {
  const lc = `${a.lc >= 0 ? "+" : ""}${a.lc.toFixed(1)}`;
  console.log(
    `    Lc ${lc.padStart(6)}  ${a.ratio.toFixed(2).padStart(5)}:1  ${a.mode.padEnd(5)} ${a.note}`,
  );
}

/* Partial opacity on text is refused */

/*
 * Refuses 0 < opacity < 1 unless listed (0 and 1 are a reveal pair). A group is exempt only
 * when every member matches.
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
    /* Anchored at the end, per hard rule 10: a bare `backdrop` matches `.backdrop-blur`. */
    test: /(?:::backdrop|-backdrop)$/,
    why:
      "a modal veil, not text. Nothing is drawn on this layer: it exists to dim " +
      "what is behind it, so there is no foreground to price a ratio against. " +
      "Same class as -scrim above, reached by a different selector shape since " +
      "the dialogs became native <dialog> and their scrims became ::backdrop",
  },
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

  /* Scope floor: a regex that stopped matching reports what a clean sweep reports. */
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

  /* An exemption no partial opacity uses is stale and fails. */
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

/* theme-color meta tags copy two tokens */

/* root.tsx copies the background hexes. Matched by media query, as a swap is invisible. */
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
    `theme-color light ${declared.light} is the light --paper ${light["--paper"]}`,
    declared.light === String(light["--paper"]).toLowerCase(),
  );
  assert(
    `theme-color dark ${declared.dark} is the dark --paper ${darkAttr["--paper"]}`,
    declared.dark === String(darkAttr["--paper"]).toLowerCase(),
  );
}

const buildPresent = existsSync(assetDir);

/*
 * Floors: counts from running the gate with build/ present and absent, one under
 * check:floors' tolerance. Only CI reaches the absent branch.
 *
 * RE-MEASURED 2026-09-22 after ruling 128 collapsed four grounds into --paper, by RUNNING both
 * branches: the absent count is taken by moving build/ aside, never by reasoning about which
 * assertions skip. 36 duplicate pairs merged, so the matrix fell from 117 pairs to 81.
 */
const MINIMUM_CHECKS = buildPresent ? 818 : 628;
const floorBreach = assertFloor(
  "check:contrast",
  buildPresent ? "checks-build-present" : "checks-build-absent",
  checks,
  MINIMUM_CHECKS,
  `Build ${buildPresent ? "present" : "absent"}. RE-MEASURED 2026-08-28 by RUNNING ` +
    `the gate in BOTH branches, taken by moving build/ aside rather than by reasoning ` +
    `about which assertions skip.` +
    `\n        THE ABSENT-BUILD FLOOR WAS THE STALE ONE, and it was stale because ` +
    `it was DERIVED rather than run: each change added its new assertions to the ` +
    `previous derived figure, and the chain had drifted about ten below the real ` +
    `count. A floor arrived at by arithmetic over a floor arrived at by arithmetic ` +
    `is a number nobody has measured.`,
);
if (floorBreach) failures.push(floorBreach);

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`\n${checks} checks, 0 failures`);
