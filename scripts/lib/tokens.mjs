/**
 * The one reader of app.css's token blocks, for build:tokens, check:contrast and every script that
 * paints in the palette. Two copies of the same algorithm were never independent: a parsing bug in
 * one was in both, and their disagreement over a doubled token was the only difference they had.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { walkFiles } from "./walk-files.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const CSS_PATH = join(root, "app", "app.css");

/** Gates reading "the stylesheets" must follow both entries or silently narrow to the public plane. */
const ADMIN_CSS_PATH = join(root, "app", "admin.css");

/**
 * Root matches every route, so its CSS imports are the sheets every page loads. The order lives
 * here, not in `@import` lines at the bottom of the entry sheet: CSS drops a late `@import`.
 */
const ROOT_MODULE_PATH = join(root, "app", "root.tsx");

/**
 * CRLF first, because autocrlf gives a fresh clone CRLF and multi-line selectors stop matching;
 * then comments, because the token block's own comment spells out its selectors.
 *
 * @param {string} css
 */
export function stripCss(css) {
  return css.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * A relative `@import` in any spelling CSS accepts: `"./a.css"`, `'./a.css'`, `url("./a.css")` or
 * `url(./a.css)`. Comments are stripped first, so a commented-out import is not followed.
 *
 * @param {string} css
 * @returns {string[]}
 */
export function cssRelativeImports(css) {
  const code = stripCss(css);
  return [...code.matchAll(/@import\s+(?:url\(\s*)?(["']?)(\.[^"')\s;]+)\1\s*\)?/g)].map((m) => m[2]);
}

/**
 * A module's CSS imports, both forms (a sheet reachable only through a `?url` import is still the
 * site's CSS), in either quote, with or without a trailing semicolon.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function moduleCssImports(source) {
  return [
    ...source
      .replace(/\r\n/g, "\n")
      .matchAll(/(?:^import\s+|from\s+)(["'])([^"'\n]+\.css)(?:\?url)?\1/gm),
  ].map((m) => m[2]);
}

/**
 * Order comes from root.tsx's CSS imports and each file's own `@import` lines. A sheet named by
 * an `@import` comes before the file that imports it, recursively, which is what the browser does,
 * and CSS requires `@import` before every other rule, so a late `@import` is silently dropped.
 * Each sheet is listed once, at its first arrival, however many files import it.
 *
 * @returns {string[]}
 */
export function stylesheetPaths() {
  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();

  /** @param {string} file */
  const expand = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const rel of cssRelativeImports(readFileSync(file, "utf8"))) {
      expand(join(dirname(file), rel));
    }
    out.push(file);
  };

  /** @param {string} source @param {string} base */
  const cssImportsOf = (source, base) =>
    moduleCssImports(source).map((spec) =>
      spec.startsWith("~/") ? join(root, "app", spec.slice(2)) : join(base, spec),
    );

  const rootSheets = cssImportsOf(readFileSync(ROOT_MODULE_PATH, "utf8"), join(root, "app"));
  if (rootSheets.length === 0) {
    throw new Error(
      `${ROOT_MODULE_PATH} declares no CSS imports. Either the public stylesheet ` +
        `set moved again or this pattern stopped matching it; either way every ` +
        `gate reading this would examine a smaller stylesheet than the site ships, ` +
        `which is the failure this function was written after.`,
    );
  }
  for (const sheet of rootSheets) expand(sheet);

  // Order between routes is not meaningful, only sorted for stability. Every module under app/,
  // not just routes: the palette's sheet is referenced by a component alone.
  const routeDir = join(root, "app");
  const routeFiles = walkFiles(routeDir, {
    keep: (name) => /\.(ts|tsx|mts|mjs|js|jsx)$/.test(name),
    skipDir: (name) => name === "enhance",
  }).sort();
  // Admin first among non-root sheets: an admin page loads root then admin.
  expand(ADMIN_CSS_PATH);

  for (const file of routeFiles) {
    for (const sheet of cssImportsOf(readFileSync(file, "utf8"), dirname(file))) expand(sheet);
  }

  return out;
}

export function allSourceCss() {
  return stylesheetPaths()
    .map((p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n"))
    .join("\n");
}

/** "System" is the absence of the attribute, hence the `:not()`. */
export const THEME_SELECTORS = {
  light: ':root,\n[data-theme="light"]',
  darkSystem: ":root:not([data-theme])",
  dark: '[data-theme="dark"]',
};

/**
 * Every declaration under the first match of `selector` in app.css, in order. Palette blocks carry
 * no nested braces, so the first closing brace ends the block.
 *
 * @param {string} label
 * @param {string} selector
 * @returns {Record<string, string[]>}
 */
export function tokenDeclarations(label, selector) {
  const css = stripCss(readFileSync(CSS_PATH, "utf8"));

  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`${label}: selector not found in app.css: ${selector}`);
  const open = css.indexOf("{", at + selector.length - 1);
  const close = css.indexOf("}", open);
  if (open === -1 || close === -1) throw new Error(`${label}: unterminated block`);

  /** @type {Record<string, string[]>} */
  const out = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    (out[m[1]] ??= []).push(m[2].trim());
  }
  if (Object.keys(out).length === 0) throw new Error(`${label}: parsed zero tokens`);
  return out;
}

/**
 * The FIRST declaration of each name wins: a token declared twice is a hex followed by the
 * color-mix() recipe that must reproduce it, and the hex is what a browser that cannot mix paints.
 *
 * @param {string} label
 * @param {string} selector
 * @returns {Record<string, string>}
 */
export function tokenBlock(label, selector) {
  return Object.fromEntries(
    Object.entries(tokenDeclarations(label, selector)).map(([name, values]) => [name, values[0]]),
  );
}

/**
 * Follows a `var()` chain to its literal: a figure series slot is declared as a ramp step, and what
 * ships is the step's color. `value` is null on a missing name or a cycle.
 *
 * @param {Record<string, string>} block
 * @param {string} name
 * @returns {{ value: string | null, chain: string[] }}
 */
export function resolveToken(block, name) {
  /** @type {string[]} */
  const chain = [];
  let current = name;
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

/**
 * Plain hex only: a `var()` indirection resolves in a browser and means nothing at build time.
 *
 * @param {Record<string, string>} nameMap
 * @param {Record<string, string>} block
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
      throw new Error(`${label}: ${token} is "${value}", which is not a plain hex color`);
    }
    out[key] = value;
  }
  return out;
}

/**
 * The CSS toolchain rewrites long hex to short, so a literal comparison misses colors that are there.
 *
 * @param {string} hex
 */
export function normalizeHex(hex) {
  const h = hex.trim().toLowerCase().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `#${full}`;
}
