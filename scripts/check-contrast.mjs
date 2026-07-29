/**
 * Gate over the shipped colour tokens.
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

const { light: githubLight, dark: githubDark } = SHIKI_THEMES;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_PATH = join(root, "app", "app.css");

/* -------------------------------------------------------------------------
 * Colour maths
 * ---------------------------------------------------------------------- */

/** @param {string} hex */
function channels(hex) {
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

/** WCAG 2.x relative luminance. @param {string} hex */
function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1 to 21. @param {string} a @param {string} b */
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * APCA (SAPC) lightness contrast, W3C draft 0.1.9 constants.
 *
 * Advisory only. It is reported because the dark-mode fills rule was decided on
 * it: the dark semantic pastels clear WCAG comfortably and APCA still rates
 * them around Lc 57 to 60, which is why interactive semantics take fills.
 * Sign carries polarity; magnitude is what is compared.
 *
 * @param {string} textHex
 * @param {string} bgHex
 */
function apca(textHex, bgHex) {
  /** @param {string} hex */
  const Y = (hex) => {
    const [r, g, b] = channels(hex);
    return 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  };
  /** @param {number} y */
  const clampBlack = (y) => (y < 0.022 ? y + (0.022 - y) ** 1.414 : y);

  const Ytxt = clampBlack(Y(textHex));
  const Ybg = clampBlack(Y(bgHex));
  if (Math.abs(Ybg - Ytxt) < 0.0005) return 0;

  let out;
  if (Ybg > Ytxt) {
    const sapc = (Ybg ** 0.56 - Ytxt ** 0.57) * 1.14;
    out = sapc < 0.1 ? 0 : sapc - 0.027;
  } else {
    const sapc = (Ybg ** 0.65 - Ytxt ** 0.62) * 1.14;
    out = sapc > -0.1 ? 0 : sapc + 0.027;
  }
  return out * 100;
}

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
const css = cssSource.replace(/\/\*[\s\S]*?\*\//g, "");

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

/** @param {string} msg */
function fail(msg) {
  failures.push(msg);
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
  ["--text", "--surface-popover", TEXT, "body on popover"],
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
  ["--border-strong", "--bg", UI, "strong border"],

  // Brand
  ["--brand", "--bg", TEXT, "brand text"],
  ["--brand", "--surface", TEXT, "brand on surface"],
  ["--brand", "--tint-brand", TEXT, "brand on its own tint"],
  ["--brand-hover", "--bg", TEXT, "brand hover text"],
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

  // Danger
  ["--text-danger", "--bg", TEXT, "danger text"],
  ["--text-danger", "--surface", TEXT, "danger text on surface"],
  ["--on-tint-danger", "--tint-danger", TEXT, "text on danger tint"],
  ["--border-danger", "--bg", UI, "danger border"],
  ["--on-fill-danger", "--fill-danger", TEXT, "text on danger fill"],
  ["--on-fill-danger", "--fill-danger-hover", TEXT, "text on danger hover fill"],

  // Warning
  ["--text-warning", "--bg", TEXT, "warning text"],
  ["--text-warning", "--surface", TEXT, "warning text on surface"],
  ["--on-tint-warning", "--tint-warning", TEXT, "text on warning tint"],
  ["--border-warning", "--bg", UI, "warning border"],
  ["--on-fill-warning", "--fill-warning", TEXT, "text on warning fill"],

  // Success
  ["--text-success", "--bg", TEXT, "success text"],
  ["--text-success", "--surface", TEXT, "success text on surface"],
  ["--on-tint-success", "--tint-success", TEXT, "text on success tint"],
  ["--border-success", "--bg", UI, "success border"],
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
const cssMtime = statSync(CSS_PATH).mtimeMs;
if (existsSync(assetDir)) {
  const sheets = readdirSync(assetDir).filter((f) => f.endsWith(".css"));
  const newest = Math.max(
    0,
    ...sheets.map((f) => statSync(join(assetDir, f)).mtimeMs),
  );
  if (newest < cssMtime) {
    // A build older than the source proves nothing about the source. Say so
    // rather than failing, and rather than passing quietly.
    builtNote = "build is OLDER than app.css, skipped as stale";
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

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`\n${checks} checks, 0 failures`);
