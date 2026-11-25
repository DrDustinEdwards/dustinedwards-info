/** check:contrast's built-CSS pass: the palette values survive the Vite build, so "shipped" is measured rather than assumed. */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { normalizeHex, stylesheetPaths } from "./tokens.mjs";
import { assert, darkAttr, fail, light, MODES, root } from "./contrast-model.mjs";

/**
 * Every light and dark palette value, looked for in the built CSS. Counted once per value and
 * failed per value, so a partial build names what it dropped.
 *
 * @param {string} built every built stylesheet, joined
 * @returns {{ missing: number, total: number }}
 */
function compareBuiltCss(built) {
  // Compare normalized values: Lightning CSS shortens #ffffff to #fff.
  /** @type {Map<string, Set<string>>} */
  const shipped = new Map();
  for (const m of built.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
    if (!shipped.has(m[1])) shipped.set(m[1], new Set());
    shipped.get(m[1])?.add(normalizeHex(m[2]));
  }
  // Slots ship as `var()`, minified without the space after the colon.
  for (const m of built.matchAll(/(--[a-z0-9-]+)\s*:\s*(var\(\s*--[a-z0-9-]+\s*\))/g)) {
    if (!shipped.has(m[1])) shipped.set(m[1], new Set());
    shipped.get(m[1])?.add(m[2].replace(/\s+/g, ""));
  }

  let missing = 0;
  for (const [mode, block] of MODES) {
    for (const [name, value] of Object.entries(block)) {
      const wanted = value.trim().startsWith("var(")
        ? value.replace(/\s+/g, "")
        : normalizeHex(value);
      const carried = shipped.get(name)?.has(wanted) ?? false;
      if (!carried) missing += 1;
      assert(
        `built CSS does not carry ${mode} ${name}: ${value}` +
          `\n    shipped values for that token: ${[...(shipped.get(name) ?? [])].join(", ") || "none"}`,
        carried,
      );
    }
  }
  const total = Object.keys(light).length + Object.keys(darkAttr).length;
  return { missing, total };
}

/*
 * Confirms the values survived the Vite build, so "shipped" is measured rather than assumed.
 * Absent a build this is skipped and said so, never silently passed.
 */
export const assetDir = join(root, "build", "client", "assets");
/** @returns {string} what the pass found, for the summary line */
export function checkBuiltCss() {
  let builtNote = "no build present, skipped";
  /* Newest of every source stylesheet, from `stylesheetPaths()`, not app.css alone. */
  const cssMtime = Math.max(...stylesheetPaths().map((p) => statSync(p).mtimeMs));
  if (existsSync(assetDir)) {
    const sheets = readdirSync(assetDir).filter((f) => f.endsWith(".css"));
    const newest = Math.max(0, ...sheets.map((f) => statSync(join(assetDir, f)).mtimeMs));
    /* Stale fails, absent does not: editing a source is what makes the build stale. An asset
       directory with no CSS at all is its own failure, said as itself rather than as "stale". */
    if (sheets.length === 0) {
      builtNote = "build/client/assets holds no CSS";
      fail("build/client/assets exists but carries no CSS. Run npm run build.");
    } else if (newest < cssMtime) {
      builtNote = "build is OLDER than a source stylesheet";
      fail(
        "the built stylesheet is not stale: a build exists but predates a source " +
          "stylesheet, so the " +
          "shipped-value comparison would silently examine nothing. Run npm run build.",
      );
      sheets.length = 0;
    }
    const built = sheets.map((f) => readFileSync(join(assetDir, f), "utf8")).join("\n");
    if (sheets.length > 0 && !built.trim()) {
      fail("build/client/assets carries only empty CSS files. Run npm run build.");
    } else if (sheets.length > 0) {
      const { missing, total } = compareBuiltCss(built);
      builtNote = `${sheets.length} stylesheet(s), ${total - missing} of ${total} light+dark values found`;
    }
  }

  return builtNote;
}
