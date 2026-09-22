/**
 * The site mark, as anything rendering it at build time embeds it: one definition, with the build
 * and `check:logo` as its two readers.
 *
 * BOUNDARY: NO PATH DATA IS STATED IN THIS FILE. The mark's single source is the component the
 * Worker renders, and this reads the fixtures `check:logo` binds that component to, which is the
 * same source one hop along a link something else keeps honest.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { THEME_SELECTORS, resolveTokens, tokenBlock } from "./tokens.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The mark's rendered height, in card pixels. Everything else is derived from
 * it and from the fixture's own viewBox.
 */
const HEIGHT = 64;

/**
 * The brand fill, RESOLVED from app.css rather than restated. The light block is the one a card
 * takes: a card is rendered once and served into a feed with no idea which theme a reader prefers.
 */
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
 * The mark, on brand surface, sized and framed for an embedded render.
 *
 * WHICH PATHS ARE THE BRAND PATHS IS DERIVED, NOT LISTED: the light and dark fixtures are
 * identical except for the fills on the purple paths, so the paths whose fill DIFFERS are exactly
 * the ones that take a brand color. Nothing here restates a hex or a path index.
 *
 * It fails closed on every way the fixtures could stop agreeing: a different viewBox, a different
 * path count, differing geometry, or no differing fill at all, which would silently paint the mark
 * in asset colors.
 *
 * @returns {Mark}
 */
export function readMark() {
  /** @param {string} file */
  const parse = (file) => {
    const source = readFileSync(join(ROOT, "public", file), "utf8");
    const viewBox = source.match(/viewBox="([^"]+)"/)?.[1];
    if (!viewBox) throw new Error(`mark: ${file} has no viewBox`);
    const paths = [
      ...source.matchAll(/<path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"\s*\/>/g),
    ].map((m) => ({ fill: m[1].toUpperCase(), d: m[2] }));
    if (paths.length === 0) throw new Error(`mark: ${file} has no paths`);
    return { file, viewBox, paths };
  };

  // The HEADER crop, because the band this sits in is the header: the square master would sit in a
  // taller band surrounded by its own whitespace.
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

  /*
   * SIZED FROM THE viewBox, AND THE viewBox PADDED TO THE BOX, never guessed. A width that is not
   * the viewBox's aspect times the height is a squashed mark and satori will not say so. The subtler
   * failure is measured: satori LAYS OUT at integer pixels and writes the embedded svg at the exact
   * aspect, so resvg letterboxes the difference and the mark renders fractionally short and off
   * center, which is invisible and is enough to stop it matching the fixture pixel for pixel, which
   * is how this mark is now proved. So the CROP is padded symmetrically until its aspect is exactly
   * the integer box's: only the empty margin moves and no path is touched.
   */
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
 * The mark as one satori element node, JSX-free so no caller needs a build step.
 *
 * satori takes an inline `svg` node and emits it as an `<image>` whose href is the same markup
 * URL-encoded, so the path data reaches resvg VERBATIM: no re-fitting, no simplification, no
 * reinterpretation of the arcs. Asserted by `check:logo` against a rasterisation of the fixture
 * rather than believed.
 *
 * @param {Record<string, unknown>} [style] layout only. The caller owns where
 *   the mark sits; it does not own how the mark is drawn.
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
