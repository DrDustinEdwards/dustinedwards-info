import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { THEME_SELECTORS, resolveTokens, tokenBlock } from "./tokens.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const HEIGHT = 64;

// Light theme: a card is rendered once and served into feeds with no idea of the reader's theme.
const { mark: MARK } = resolveTokens(
  { mark: "--mark-on-chrome" },
  tokenBlock("mark", THEME_SELECTORS.light),
  "mark",
);

/**
 * @typedef {{ fill: string, d: string }} MarkPath
 * @typedef {{ viewBox: string, width: number, height: number, paths: MarkPath[] }} Mark
 */

/**
 * Brand paths are derived, not listed: the light and dark fixtures differ only in the brand fills.
 *
 * @returns {Mark}
 */
function readMark() {
  /** @param {string} file */
  const parse = (file) => {
    const source = readFileSync(join(ROOT, "public", file), "utf8");
    const viewBox = source.match(/viewBox="([^"]+)"/)?.[1];
    if (!viewBox) throw new Error(`mark: ${file} has no viewBox`);
    const paths = [
      ...source.matchAll(/<path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"\s*\/>/g),
    ].map((m) => ({ fill: m[1].toUpperCase(), d: m[2] }));
    if (paths.length === 0) throw new Error(`mark: ${file} has no paths`);
    // A path in any other shape (another attribute, another order) would be dropped from the mark, and
    // so would any non-path shape (a <rect>, a <circle>), which the parser does not read at all.
    const declared = (
      source.match(/<(path|rect|circle|ellipse|polygon|polyline|line|use|image|text)[\s>/]/g) ?? []
    ).length;
    if (declared !== paths.length) {
      throw new Error(`mark: ${file} declares ${declared} shape(s) and only ${paths.length} parse`);
    }
    return { file, viewBox, paths };
  };

  // The header crop: the square master would sit in its own whitespace.
  const light = parse("dustin-edwards-logo-header.svg");
  const dark = parse("dustin-edwards-logo-header-dark.svg");
  if (light.viewBox !== dark.viewBox) {
    throw new Error(`mark: ${light.file} and ${dark.file} disagree on the viewBox`);
  }
  if (light.paths.length !== dark.paths.length) {
    throw new Error(
      `mark: ${light.file} has ${light.paths.length} paths, ` +
        `${dark.file} has ${dark.paths.length}`,
    );
  }

  const paths = light.paths.map((p, i) => {
    if (p.d !== dark.paths[i].d) {
      throw new Error(`mark: path ${i} differs in geometry between the two fixtures`);
    }
    return { fill: p.fill === dark.paths[i].fill ? p.fill : MARK, d: p.d };
  });
  const branded = paths.filter((p) => p.fill === MARK).length;
  if (branded === 0) {
    throw new Error("mark: no path changes fill between the fixtures, so none is the brand");
  }

  // satori lays out at integer pixels but writes the svg at the exact aspect, so resvg letterboxes
  // the mark off center. Pad the viewBox symmetrically until its aspect matches the integer box.
  const [x, y, boxWidth, boxHeight] = light.viewBox.split(/\s+/).map(Number);
  const width = Math.round((HEIGHT * boxWidth) / boxHeight);
  const want = width / HEIGHT;
  const grow =
    boxWidth / boxHeight > want
      ? { dx: 0, dy: boxWidth / want - boxHeight }
      : { dx: boxHeight * want - boxWidth, dy: 0 };
  const viewBox = [
    x - grow.dx / 2,
    y - grow.dy / 2,
    boxWidth + grow.dx,
    boxHeight + grow.dy,
  ].join(" ");

  return { viewBox, width, height: HEIGHT, paths };
}

/**
 * @param {Record<string, unknown>} [style]
 * @returns {any}
 */
export function markElement(style = {}) {
  const mark = readMark();
  return {
    type: "svg",
    props: {
      width: mark.width,
      height: mark.height,
      viewBox: mark.viewBox,
      style,
      children: mark.paths.map((p) => ({ type: "path", props: { fill: p.fill, d: p.d } })),
    },
  };
}
