/**
 * Reads the ratified color tokens back out of the stylesheet that ships, so anything needing a
 * color at BUILD time resolves it here rather than restating a hex.
 *
 * BOUNDARY: `check:contrast` deliberately keeps its own copy of this parsing, being the gate whose
 * design is that two independent sources argue, so sharing a reader would give the palette one
 * implementation to be wrong in rather than two to disagree.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The stylesheet that declares the TOKENS. Still one file, deliberately: moving the palette would
 * be a gate change wearing a refactor's clothes.
 */
export const CSS_PATH = join(root, "app", "app.css");

/**
 * THE ADMIN PLANE'S ENTRY. One stylesheet stopped being the whole site's when the admin parts
 * moved out, and every gate reasoning about "the stylesheets" has to follow BOTH entries or it
 * silently narrows to the public plane. It happened again and FAILED AGAIN RATHER THAN PASSING
 * QUIETLY: a resolution scan dropped by half and tripped its own floor.
 */
export const ADMIN_CSS_PATH = join(root, "app", "admin.css");

/**
 * The module that declares the PUBLIC stylesheet set, and its order: it matches on every route,
 * so its CSS imports are the sheets every page loads. Before it, the order lived in `@import`
 * statements at the bottom of the entry sheet, which is a position CSS does not allow.
 */
const ROOT_MODULE_PATH = join(root, "app", "root.tsx");

/**
 * EVERY source stylesheet, in CASCADE ORDER, derived from the entries' own imports.
 *
 * WHY THIS EXISTS: one stylesheet became an entry importing sixteen parts, and any gate reading
 * that one path silently narrowed to the token block. DERIVED, NOT RESTATED: the order comes from
 * the entry module's CSS imports and each file's own `@import` lines, so adding a part means
 * editing the file that loads it. THE PUBLIC ORDER MOVED OUT OF CSS, and this follows it: those
 * sheets were `@import` statements at the BOTTOM of the entry, and CSS requires `@import` before
 * every other rule, so a late `@import` is dropped and they survived on a processor hoisting them.
 * This function read those `@import` lines. IMPORTS COME BEFORE THE FILE THAT IMPORTS THEM,
 * recursively, which is not a convention here but what the browser does.
 *
 * @returns {string[]} absolute paths, in cascade order
 */
export function stylesheetPaths() {
  /** @type {string[]} */
  const out = [];

  /** @param {string} file */
  const expand = (file) => {
    const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    for (const m of text.matchAll(/@import\s+"(\.[^"]+)"/g)) {
      expand(join(dirname(file), m[1]));
    }
    out.push(file);
  };

  /*
   * The PUBLIC cascade, read off root.tsx's own CSS imports in source order.
   * Matched as bare module imports, which is the only form a stylesheet import
   * takes.
   */
  /**
   * Every stylesheet a module names, in source order. BOTH IMPORT FORMS: a bare import puts the
   * sheet in that module's bundle and a `?url` import hands back a hashed URL, and a sheet reachable
   * only through the second is still the site's CSS.
   *
   * @param {string} source @param {string} base
   */
  const cssImportsOf = (source, base) =>
    [
      ...source
        .replace(/\r\n/g, "\n")
        .matchAll(/(?:^import\s+"|from\s+")([^"]+\.css)(?:\?url)?";/gm),
    ].map((m) => (m[1].startsWith("~/") ? join(root, "app", m[1].slice(2)) : join(base, m[1])));

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

  /*
   * THEN THE ROUTE-SCOPED SHEETS, public CSS having stopped being one bundle when a route began
   * importing the sheets its own markup needs. ORDER BETWEEN ROUTES IS NOT MEANINGFUL and is not
   * claimed to be; they are sorted so the list is stable. Order WITHIN a route is a real cascade.
   */
  /*
   * EVERY MODULE UNDER the app directory, not just the routes: the one sheet fetched when a reader
   * opens the palette is referenced by a component alone.
   */
  const routeDir = join(root, "app");
  /** @param {string} dir @returns {string[]} */
  const modulesUnder = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "enhance" ? [] : modulesUnder(full);
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
  const routeFiles = modulesUnder(routeDir).sort();
  /*
   * The admin entry FIRST among the non-root sheets, so an admin page's cascade is root-then-admin,
   * which is what it loads. Named rather than left to the route loop, so the set cannot narrow.
   */
  expand(ADMIN_CSS_PATH);

  const seen = new Set(out);
  for (const file of routeFiles) {
    for (const sheet of cssImportsOf(readFileSync(file, "utf8"), dirname(file))) {
      if (seen.has(sheet)) continue;
      expand(sheet);
      for (const p of out) seen.add(p);
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
 * Pulls the custom properties out of one rule block, located by its selector's literal text. Two
 * traps, both already paid for once in `check:contrast`:
 *
 *   1. Comments are stripped FIRST: the token block's own comment spells out all three selectors.
 *   2. CRLF is normalized FIRST: the file is not pinned by `.gitattributes` and this repo runs
 *      autocrlf, so a fresh clone gets CRLF and every multi-line selector match stops matching.
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
 * Fails closed twice over: on a token the stylesheet does not declare, and on one whose value is
 * not a plain hex. A `var()` indirection resolves in a browser and is meaningless to a build-time
 * renderer.
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
      throw new Error(`${label}: ${token} is "${value}", which is not a plain hex color`);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Normalizes a hex for comparison: the CSS toolchain rewrites long form to short, so a literal
 * comparison reports colors missing from output that carries them.
 *
 * @param {string} hex
 */
export function normalizeHex(hex) {
  const h = hex.trim().toLowerCase().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `#${full}`;
}
