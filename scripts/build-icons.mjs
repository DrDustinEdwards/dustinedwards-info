import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

import { buildAssetManifest } from "./build-assets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_BIN = join(ROOT, "node_modules/@drdustinedwards/site-helpers/bin/icons.mjs");

const DARK = "#B7A5E0";
const TILE = "#4F2D7F";

/**
 * The icon tile's mark: lavender halved the small sizes' contrast, so the tile takes the muted chrome
 * token and only the OG card keeps lavender.
 */
const ICO_MARK = "#EDE8F5";

/** The spec's eight paths in paint order, verbatim. */
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
 * Derived from the construction, not the control points: the extremes are on arcs, and a
 * control-point box would crop the ring.
 */
const INK = { x0: 79.7, y0: 16.91, x1: 309.3, y1: 341.7 };
const INK_W = INK.x1 - INK.x0;
const INK_H = INK.y1 - INK.y0;
const INK_CX = (INK.x0 + INK.x1) / 2;
const INK_CY = (INK.y0 + INK.y1) / 2;

/**
 * @param {object} o
 * @param {number} o.size        canvas edge, px
 * @param {string} o.mark        the hex the five purple paths take
 * @param {string|null} o.tile   background fill, or null for transparent
 * @param {number} o.pad         fraction of the edge left clear on each side
 */
function square({ size, mark, tile, pad }) {
  // Fit by the LONGER ink dimension, so the padding is a guarantee on both axes.
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

function ogCard() {
  const width = 1200;
  const height = 630;
  const k = (height * (1 - 2 * 0.14)) / INK_H;
  const body = PATHS.map(
    ([fill, d]) => `<path fill="${fill === BRAND ? DARK : fill}" d="${d}"/>`,
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${TILE}"/>` +
    `<g transform="translate(${width / 2} ${height / 2}) scale(${k}) translate(${-INK_CX} ${-INK_CY})">${body}</g>` +
    `</svg>`
  );
}

/**
 * A tile, not a media query: a query sees the OS color scheme, while the tab strip's is set by the
 * browser theme.
 */
function faviconSvg() {
  return `${square({ size: 512, mark: ICO_MARK, tile: TILE, pad: 0.1 })}\n`;
}

/** @param {string} svg @param {number} size */
function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}

const outArg = process.argv.indexOf("--out");
if (outArg !== -1 && !process.argv[outArg + 1]) {
  console.error("build:icons: --out needs a directory");
  process.exit(2);
}
const PUBLIC = join(ROOT, "public");
const OUT = outArg === -1 ? PUBLIC : resolve(process.argv[outArg + 1]);
// Resolved and compared as paths: `--out public` or `--out ./public` wrote into public/ while the
// string compare below said otherwise and skipped the manifest rebuild.
const samePath = (/** @type {string} */ a, /** @type {string} */ b) =>
  process.platform === "win32" ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);
mkdirSync(OUT, { recursive: true });

/** @param {string} name @param {Buffer|string} data */
function emit(name, data) {
  writeFileSync(join(OUT, name), data);
  const bytes = typeof data === "string" ? Buffer.byteLength(data) : data.length;
  console.log(`  ${name.padEnd(30)} ${String(bytes).padStart(7)} bytes`);
}

console.log(`build:icons -> ${OUT}`);

// The tile Prelum's prelum-icons draws every icon file from, at its shared paths.
emit("icon.svg", faviconSvg());
execFileSync(process.execPath, [ICONS_BIN, "--svg", join(OUT, "icon.svg"), "--background", TILE, "--out", OUT], { stdio: "inherit" });

emit("dustin-edwards-og-image.png", png(ogCard(), 1200));

// This is the only generator that adds new files to `public/`, so it regenerates the asset manifest.
if (samePath(OUT, PUBLIC)) {
  try {
    await buildAssetManifest();
  } catch (error) {
    throw new Error(
      `build:assets failed after icons changed. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  console.log(
    "\n  NOTE: the icon assets were rewritten, so the media index is now stale and\n" +
      "        the health check's media-index-drift reports it until it is rebuilt.\n" +
      '        Press "Rebuild media index" on /admin/media.\n',
  );
} else {
  console.log("\n  NOTE: --out is not public/, so the asset manifest was left alone.\n");
}
