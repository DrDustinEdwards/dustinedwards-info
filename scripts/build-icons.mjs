/**
 * Renders the icon suite from the ratified mark geometry.
 *
 *   node scripts/build-icons.mjs --out <dir>
 *
 * BOUNDARY: a GENERATOR, not a gate. It asserts nothing about what is already on disk, and
 * nothing in this repo sees the SHAPE of a rendered raster, so an icon whose mark is clipped,
 * mirrored or drawn in the wrong purple passes every assertion here.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The ratified dark-mode purple, transcribed from the spec. Its light twin is not a separate
 * constant: since the SVG favicon became a tile, every use of that hex here is the TILE.
 */
const DARK = "#B7A5E0";
/** The chrome tile. --surface-chrome light, which is brand. */
const TILE = "#4F2D7F";

/**
 * The mark hex for the FAVICON tiles only. The tile was adopted partly because it gives the
 * silhouette an edge at the smallest size; it does, and it also HALVED the mark's contrast. So the
 * small tiles take the muted chrome token and the LARGE tiles keep lavender, the ratified mark
 * variant, the silhouette not being contrast-limited at that size. A legibility exception at the
 * sizes that need it, not a second identity.
 */
const ICO_MARK = "#EDE8F5";

/**
 * The eight paths in the spec's paint order, VERBATIM. The five purple ones carry a placeholder
 * the caller substitutes; the warm three are constant and are written as literals.
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
 * The mark's INK bounding box, derived from the CONSTRUCTION rather than the path control points,
 * because the extremes are on ARCS and a control-point box would crop the ring.
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
 * favicon.svg, a TILE like everything else, superseding the media-query version. WHAT WAS WRONG
 * WITH IT: the embedded query keyed on the OPERATING SYSTEM's color scheme while the thing it
 * tried to survive is the TAB STRIP's, set by the browser theme, which no media query can see. A
 * tile has no such dependency, and an SVG favicon renders small, so it takes the small-size
 * treatment, from the same padding helper as the rasters.
 */
function faviconSvg() {
  return `${square({ size: 512, mark: ICO_MARK, tile: TILE, pad: 0.1 })}\n`;
}

/** @param {string} svg @param {number} size */
function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}

/**
 * An ICO is a CONTAINER. This writes the same structure the shipped file already uses, measured
 * before anything was regenerated.
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
    dir.writeUInt16LE(1, o + 4); // color planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

/* output */

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
emit("dustin-edwards-favicon.svg", faviconSvg());

// The tiles. Lavender mark on brand purple, because none of these can query.
// ICO sizes are the MEASURED contents of the shipped container, not a guess.
const ICO_SIZES = [16, 32, 48];
emit(
  "favicon.ico",
  ico(
    ICO_SIZES.map((size) => ({
      size,
      // Small tiles get less padding: at the smallest size the silhouette needs the room.
      data: png(square({ size, mark: ICO_MARK, tile: TILE, pad: 0.1 }), size),
    })),
  ),
);

emit("dustin-edwards-apple-touch-icon.png", png(square({ size: 180, mark: DARK, tile: TILE, pad: 0.14 }), 180));
emit("dustin-edwards-android-chrome-192x192.png", png(square({ size: 192, mark: DARK, tile: TILE, pad: 0.12 }), 192));
emit("dustin-edwards-android-chrome-512x512.png", png(square({ size: 512, mark: DARK, tile: TILE, pad: 0.12 }), 512));

// Maskable: the launcher may crop to a CIRCLE, so for ink of this aspect the DIAGONAL has to
// clear it, which is why the padding is much larger and is NOT a style choice. The tighter
// candidate left too little headroom for a spec launchers implement loosely.
emit("dustin-edwards-maskable-icon-512x512.png", png(square({ size: 512, mark: DARK, tile: TILE, pad: 0.19 }), 512));

emit("dustin-edwards-og-image.png", png(ogCard(), 1200));

/*
 * REGENERATE THE ASSET MANIFEST, everything above writing into `public/` and the manifest being
 * derived from exactly that directory: this script has no npm alias, is run by hand, and is the
 * only generator that adds NEW files. ONLY WHEN WRITING TO `public/`: elsewhere this is rendering
 * for inspection. The media index still cannot be rebuilt from here, needing the Worker's binding.
 */
if (OUT === join(ROOT, "public")) {
  // cwd pinned to the repo root: the manifest builder resolves relative to the working directory.
  const manifest = spawnSync(process.execPath, [join(ROOT, "scripts", "build-assets.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  process.stdout.write(manifest.stdout ?? "");
  if (manifest.status !== 0) {
    process.stderr.write(manifest.stderr ?? "");
    throw new Error("build:assets failed after icons changed");
  }
  console.log(
    "\n  NOTE: the icon assets were rewritten, so the media index is now stale and\n" +
      "        the health check's media-index-drift reports it until it is rebuilt.\n" +
      '        Press "Rebuild media index" on /admin/media.\n',
  );
} else {
  console.log("\n  NOTE: --out is not public/, so the asset manifest was left alone.\n");
}
