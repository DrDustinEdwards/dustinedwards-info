/**
 * The one reader of app.css's token blocks, for build:tokens, check:contrast and every script that
 * paints in the palette. Two copies of the same algorithm were never independent: a parsing bug in
 * one was in both, and their disagreement over a doubled token was the only difference they had.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { walkFiles } from "@dustinedwards/devkit/node";
import { normalizeHex } from "@drdustinedwards/site-helpers/text";
import { readDeclarations, resolveToken, stripCss } from "capsomer/token-check";

/* CSS reading and the var() walk are Capsomer's (capsomer/token-check), and the hex form is Prelum's (text), shared
 * with every site's gate. */
export { normalizeHex, resolveToken, stripCss };

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const CSS_PATH = join(root, "app", "app.css");

/**
 * The public layout nests every visitor-facing route, so its CSS imports are the sheets every public page
 * loads. The admin plane is Capsomer's and has its own tokens (app/admin.css imports them from the package),
 * so it is not read here: these gates are about the site's palette. The order lives here, not in `@import`
 * lines at the bottom of the entry sheet: CSS drops a late `@import`.
 */
const ROOT_MODULE_PATH = join(root, "app", "routes", "legacy-public.tsx");

/** The admin plane's one sheet: Capsomer's tokens and components, outside the site's palette gates. */
const ADMIN_CSS_PATH = join(root, "app", "admin.css");
/** The /lab-bench workspace's sheet: Capsomer's plane like admin.css, built on its tokens, not the public palette. */
const LAB_CSS_PATH = join(root, "app", "lab.css");

/**
 * A relative `@import` in any spelling CSS accepts: `"./a.css"`, `'./a.css'`, `url("./a.css")` or
 * `url(./a.css)`. Comments are stripped first, so a commented-out import is not followed.
 *
 * @param {string} css
 * @returns {string[]}
 */
export function cssRelativeImports(css) {
  const code = stripCss(css);
  return [...code.matchAll(/@import\s+(?:url\(\s*)?(["']?)(\.[^"')\s;]+)\1\s*\)?/g)].map(
    (m) => m[2],
  );
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
 * Order comes from the public layout's CSS imports and each file's own `@import` lines. A sheet named by
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

  /** A package's own sheet (a font, Capsomer) is not the site's CSS, so only `~/` and relative paths are followed. */
  /** @param {string} source @param {string} base */
  const cssImportsOf = (source, base) =>
    moduleCssImports(source)
      .filter((spec) => spec.startsWith("~/") || spec.startsWith("."))
      .map((spec) => (spec.startsWith("~/") ? join(root, "app", spec.slice(2)) : join(base, spec)))
      .filter((sheet) => sheet !== ADMIN_CSS_PATH && sheet !== LAB_CSS_PATH);

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
 * Every declaration under the first match of `selector` in app.css, in order (Capsomer's reader).
 *
 * @param {string} label
 * @param {string} selector
 * @returns {Record<string, string[]>}
 */
export function tokenDeclarations(label, selector) {
  try {
    return readDeclarations(readFileSync(CSS_PATH, "utf8"), selector);
  } catch (error) {
    throw new Error(`${label}: ${/** @type {Error} */ (error).message} in app.css`);
  }
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
