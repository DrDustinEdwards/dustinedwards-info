/**
 * The site mark, as anything rendering it at build time embeds it.
 *
 * ONE definition with TWO readers, and the second reader is the point. This
 * lived inside `build-og.mjs` when it was written, where the only way for a
 * gate to see what the card actually embeds was to import the card template.
 * Last session proved the render by hand and then deleted the harness, leaving
 * the gap `check:logo` names in its own boundary: nothing in this repo looks at
 * the SHAPE of a rendered raster, so a satori or resvg upgrade that resampled
 * the embedded svg would pass every gate.
 *
 * So the mark moved here, and it is a real seam rather than an export added for
 * a test: `build:og` builds its card from `markElement()`, `check:logo` renders
 * that same node and compares it against the committed fixture. Neither one
 * reaches into the other, and the thing under test is the thing that ships.
 *
 * NO PATH DATA IS STATED IN THIS FILE. The mark's single source is
 * `app/components/site-logo.tsx`, which the Worker renders, and the four
 * `public/*.svg` are the fixtures `check:logo` compares that module against in
 * both directions. A Node script cannot import the .tsx without a build step,
 * so it reads the fixtures the gate already binds the component to: the same
 * source one hop along a link something else keeps honest. Hand-edit either
 * side and `check:logo` fails before any of this runs.
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
 * The brand fill, RESOLVED from app.css rather than restated.
 *
 * `--mark-on-chrome` is the token the real header binds the mark to on brand
 * surface, and the light block is the one a card takes: a card is rendered once
 * and served into a feed with no idea which theme the reader prefers.
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
 * WHICH PATHS ARE THE BRAND PATHS IS DERIVED, NOT LISTED. The light and dark
 * fixtures are identical except for the fills on the purple paths, so the paths
 * whose fill DIFFERS between the two files are exactly the ones that take a
 * brand colour, and the warm ones (identical in both) keep the fill the asset
 * gives them. Nothing here restates a hex or a path index.
 *
 * It fails closed on every way the fixtures could stop agreeing: a different
 * viewBox, a different path count, a path whose geometry differs between the
 * variants, or no differing fill at all, which would mean the brand paths were
 * no longer identifiable and would silently paint the mark in asset colours.
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

  // The HEADER crop, 78 15 232 328, because the band this sits in is the
  // header. The square master would sit in a 132px band surrounded by its own
  // whitespace.
  const light = parse("logo-header.svg");
  const dark = parse("logo-header-dark.svg");
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
   * SIZED FROM THE viewBox, AND THE viewBox PADDED TO THE BOX, never guessed.
   *
   * A width that is not the viewBox's aspect times the height is a squashed
   * mark, and satori will not say so. The subtler failure is the one measured
   * here: satori LAYS OUT at integer pixels but writes the embedded svg at the
   * viewBox's exact aspect, so 232x328 at 64px tall gives a 45.27px-wide image
   * inside a 45px-wide box, and resvg letterboxes the difference. The mark then
   * renders 0.4% short and 0.2px off centre, which is invisible and is also
   * enough to stop the render matching the fixture pixel for pixel, which is
   * how this mark is now proved: `check:logo` asserts a max channel delta of
   * ZERO. Measured by removing this padding and running that gate, 2026-08-14:
   * 348 of 2880 pixels differ and the max channel delta is 45.
   *
   * So the CROP is padded, symmetrically, until its aspect is exactly the
   * integer box's. Only the empty margin around the mark moves; no path is
   * touched, and the padding here is 1.96 viewBox units, under a fifth of a
   * rendered pixel.
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
 * satori takes an inline `svg` node and emits it as an `<image>` whose href is
 * the same markup URL-encoded, so the path data reaches resvg VERBATIM: no
 * re-fitting, no simplification, no reinterpretation of the arcs. Measured on
 * satori 0.29.0, and asserted by `check:logo` against a rasterisation of the
 * fixture rather than believed.
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
