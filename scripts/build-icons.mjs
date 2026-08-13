/**
 * Renders the icon suite from the ratified mark geometry.
 *
 * OBSERVATION BOUNDARY: this is a GENERATOR, not a gate. It renders; it asserts
 * nothing about what is already on disk. What proves its output is committed is
 * `check:media` against the `build:assets` manifest, and what proves the mark's
 * geometry is `check:logo` against the four SVG fixtures. Neither of those reads
 * a PNG's pixels, so nothing in this repo can see a render that is geometrically
 * right and visually wrong. Eyes are still the instrument for that.
 *
 *   node scripts/build-icons.mjs --out <dir>
 *
 * WHY THIS EXISTS. logo-spec.md records that the shipped PNGs came from a
 * parametric builder that was never in this repo: the assets arrived as a zip.
 * That was survivable while they never changed. v4 changed them, so the choice
 * was to hand-edit binaries nobody could reproduce, or to write the builder
 * down. Path data is taken VERBATIM from logo-spec.md, which is the same source
 * the component and the four fixtures come from, so a variation is a rebuild
 * from values and never a hand edit.
 *
 * THE V4 IDENTITY. logo-spec.md says favicons and manifest icons "intentionally
 * stay on the light mark: they render in browser chrome and third-party cards
 * whose backgrounds the theme does not control". v4 solves that same problem
 * the other way round, and supersedes it:
 *
 *   - favicon.svg CAN adapt, so it does, via an embedded prefers-color-scheme
 *     media query. Deep purple on light tab bars, lavender on dark.
 *   - Everything raster CANNOT adapt, so it stops depending on a background it
 *     does not own and brings its own: a brand-purple tile with the lavender
 *     mark. That is the same reasoning, applied to a format that cannot query.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The ratified purples. Transcribed from logo-spec.md, as check:logo does. */
const LIGHT = "#4F2D7F";
const DARK = "#B7A5E0";
/** The chrome tile. --surface-chrome light, which is brand. */
const TILE = "#4F2D7F";

/**
 * The mark hex for the FAVICON tiles only, ruled 2026-08-13 after the review.
 *
 * The tile was adopted partly on the ground that it "gives the silhouette an
 * edge" at 16px. It does, and it also halved the mark's contrast, which is the
 * opposite of what that rationale predicted. Measured against the tile:
 *
 *   #4F2D7F on white (what the old white-tile icons had)  10.43
 *   #B7A5E0 lavender on #4F2D7F                            4.70
 *   #EDE8F5 on #4F2D7F                                     8.67
 *
 * So 16, 32 and 48 take --on-chrome-muted, the value already shipping as the
 * header's nav-at-rest, and recover most of the loss. The LARGE tiles keep
 * lavender: at 180px and up the silhouette is not contrast-limited, and
 * lavender is the ratified mark variant. This is a legibility exception at the
 * sizes that need it, not a second identity.
 */
const ICO_MARK = "#EDE8F5";

/**
 * The eight paths in the spec's paint order: ring, bowl, base, arc, tube,
 * amber, pale, cap. VERBATIM from logo-spec.md. The five purple ones carry a
 * placeholder the caller substitutes; the warm three are constant across every
 * variant and are written as their literals, exactly as the component does.
 */
const BRAND = "(brand)";
const PATHS = [
  [BRAND, "M 271.75 306.65 A 112.5 112.5 0 1 1 167.85 117.27 L 177.21 159.48 A 69.2 69.2 0 1 0 238.83 273.73 L 271.75 306.65 Z"],
  [BRAND, "M 212.00 273.20 L 290.80 273.20 A 39.4 39.4 0 0 1 212.00 273.20 Z"],
  [BRAND, "M 81.40 341.70 A 44.9 44.9 0 0 1 119.10 312.62 L 271.60 312.62 A 44.9 44.9 0 0 1 309.30 341.70 L 81.40 341.70 Z"],
  ["#CE7F44", "M 173.37 117.10 A 111.6 111.6 0 0 1 288.36 170.46 L 306.63 201.48 L 275.44 219.85 L 257.17 188.83 A 75.4 75.4 0 0 0 193.75 151.72 Z"],
  [BRAND, "M 109.47 86.65 L 143.59 66.56 L 217.44 191.92 L 183.32 212.02 Z"],
  ["#E0A428", "M 225.72 207.36 L 257.51 188.63 L 275.78 219.65 L 243.99 238.38 Z"],
  ["#E2BC6B", "M 192.20 227.10 L 226.06 207.15 L 244.33 238.17 L 210.47 258.12 Z"],
  [BRAND, "M 134.88 51.38 L 100.42 71.68 L 80.12 37.21 L 114.58 16.91 Z"],
];

/**
 * The mark's INK bounding box in spec coordinates.
 *
 * Derived from the construction, not from the path control points, because the
 * extremes are on ARCS and a control-point box would crop the ring. The ring is
 * the circle about O (192.2, 227.1) at r 112.5, so it reaches x 79.7 and 304.7
 * and y 114.6; the base runs to x 309.3 and stops at the baseline y 341.7; the
 * cap's corner at y 16.91 is the top.
 */
const INK = { x0: 79.7, y0: 16.91, x1: 309.3, y1: 341.7 };
const INK_W = INK.x1 - INK.x0;
const INK_H = INK.y1 - INK.y0;
const INK_CX = (INK.x0 + INK.x1) / 2;
const INK_CY = (INK.y0 + INK.y1) / 2;

/**
 * One square icon as an SVG string.
 *
 * @param {object} o
 * @param {number} o.size        canvas edge, px
 * @param {string} o.mark        the hex the five purple paths take
 * @param {string|null} o.tile   background fill, or null for transparent
 * @param {number} o.pad         fraction of the edge left clear on each side
 */
function square({ size, mark, tile, pad }) {
  // Fit by the LONGER ink dimension so the padding is a real guarantee on both
  // axes rather than only on the one that happened to be measured.
  const k = (size * (1 - 2 * pad)) / Math.max(INK_W, INK_H);
  const body = PATHS.map(
    ([fill, d]) => `<path fill="${fill === BRAND ? mark : fill}" d="${d}"/>`,
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    (tile ? `<rect width="${size}" height="${size}" fill="${tile}"/>` : "") +
    `<g transform="translate(${size / 2} ${size / 2}) scale(${k}) translate(${-INK_CX} ${-INK_CY})">${body}</g>` +
    `</svg>`
  );
}

/** The og card: the same tile and mark, at 1200x630 rather than square. */
function ogCard({ width = 1200, height = 630, mark = DARK, tile = TILE } = {}) {
  const k = (height * (1 - 2 * 0.14)) / INK_H;
  const body = PATHS.map(
    ([fill, d]) => `<path fill="${fill === BRAND ? mark : fill}" d="${d}"/>`,
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${tile}"/>` +
    `<g transform="translate(${width / 2} ${height / 2}) scale(${k}) translate(${-INK_CX} ${-INK_CY})">${body}</g>` +
    `</svg>`
  );
}

/**
 * favicon.svg, the ONE asset that can answer the question itself.
 *
 * The media query lives inside the file because a favicon is rendered by the
 * browser's chrome, where no stylesheet of ours is in scope. The geometry and
 * the ratified crop are untouched; only the fill mechanism changes, so this is
 * still the same mark and not a variation.
 */
function faviconSvg() {
  const body = PATHS.map(([fill, d]) =>
    fill === BRAND ? `<path class="b" d="${d}"/>` : `<path fill="${fill}" d="${d}"/>`,
  ).join("\n  ");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="19.5 5.5 348 348">\n` +
    `  <style>\n` +
    `    .b { fill: ${LIGHT} }\n` +
    `    @media (prefers-color-scheme: dark) { .b { fill: ${DARK} } }\n` +
    `  </style>\n  ${body}\n</svg>\n`
  );
}

/** @param {string} svg @param {number} size */
function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}

/**
 * An ICO is a CONTAINER. This writes the same structure the shipped favicon.ico
 * already uses, measured before anything was regenerated: three PNG-encoded
 * images at 16, 32 and 48, 32bpp. No size is added and none is dropped.
 *
 * @param {Array<{ size: number, data: Buffer }>} images
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir[o] = size >= 256 ? 0 : size; // width, 0 means 256
    dir[o + 1] = size >= 256 ? 0 : size; // height
    dir[o + 2] = 0; // palette size
    dir[o + 3] = 0; // reserved
    dir.writeUInt16LE(1, o + 4); // colour planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

/* ------------------------------------------------------------------------ */

const outArg = process.argv.indexOf("--out");
const OUT = outArg === -1 ? join(ROOT, "public") : process.argv[outArg + 1];
mkdirSync(OUT, { recursive: true });

/** @param {string} name @param {Buffer|string} data */
function emit(name, data) {
  writeFileSync(join(OUT, name), data);
  const bytes = typeof data === "string" ? Buffer.byteLength(data) : data.length;
  console.log(`  ${name.padEnd(30)} ${String(bytes).padStart(7)} bytes`);
}

console.log(`build:icons -> ${OUT}`);

// The adaptive one. Transparent, because it is the variant that can choose.
emit("favicon.svg", faviconSvg());

// The tiles. Lavender mark on brand purple, because none of these can query.
// ICO sizes are the MEASURED contents of the shipped container, not a guess.
const ICO_SIZES = [16, 32, 48];
emit(
  "favicon.ico",
  ico(
    ICO_SIZES.map((size) => ({
      size,
      // Small tiles get less padding: at 16px the silhouette needs the room,
      // and the tile is what gives it an edge in the first place. ICO_MARK
      // rather than DARK, for the measured reason recorded at its definition.
      data: png(square({ size, mark: ICO_MARK, tile: TILE, pad: 0.1 }), size),
    })),
  ),
);

emit("apple-touch-icon.png", png(square({ size: 180, mark: DARK, tile: TILE, pad: 0.14 }), 180));
emit("android-chrome-192x192.png", png(square({ size: 192, mark: DARK, tile: TILE, pad: 0.12 }), 192));
emit("android-chrome-512x512.png", png(square({ size: 512, mark: DARK, tile: TILE, pad: 0.12 }), 512));

// Maskable: the launcher may crop to a circle of 80% of the edge, so the ink
// must fit inside that circle, not merely inside an 80% square. For ink of
// aspect INK_W/INK_H the diagonal is what has to clear it, which is why the
// padding here is much larger than the android one and is NOT a style choice.
// 0.18 fits with only 8.3px of headroom on a 409.6px circle, which is 2% and
// too close to the edge of a spec launchers implement loosely. 0.19 buys 21px.
emit("maskable-icon-512x512.png", png(square({ size: 512, mark: DARK, tile: TILE, pad: 0.19 }), 512));

emit("og-image.png", png(ogCard(), 1200));
