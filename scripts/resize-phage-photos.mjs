/**
 * Resizes the Phage Hunters group photos for the public page.
 *
 * Reads edwards-tarleton-phage-hunters-<year>.jpg from the directory given as
 * argv[2], resizes each to 1080px wide preserving aspect ratio, and writes
 * public/phage-hunters/<year>.webp at quality 82.
 *
 * No cropping: these are group photos and faces must not be cut. Aspect ratios
 * differ across years, so each output's real dimensions are printed for pasting
 * into app/data/phage-hunters.ts.
 *
 *   node scripts/resize-phage-photos.mjs <source-dir>
 */
import { readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const WIDTH = 1080;
const QUALITY = 82;
const SOURCE_PATTERN = /^edwards-tarleton-phage-hunters-(\d{4})\.jpg$/i;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "phage-hunters");

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error("Usage: node scripts/resize-phage-photos.mjs <source-dir>");
  process.exit(1);
}

const entries = await readdir(sourceDir);
const sources = entries
  .map((name) => ({ name, year: name.match(SOURCE_PATTERN)?.[1] }))
  .filter((s) => s.year)
  .sort((a, b) => Number(a.year) - Number(b.year));

if (sources.length === 0) {
  console.error(`No edwards-tarleton-phage-hunters-<year>.jpg files in ${sourceDir}`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

for (const { name, year } of sources) {
  const out = join(outDir, `${year}.webp`);
  // withoutEnlargement leaves a source narrower than 1080px at its own width,
  // so the printed dimensions are always the real ones.
  const info = await sharp(join(sourceDir, name))
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(out);

  console.log(`${year}.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

console.log(`\n${sources.length} photos written to public/phage-hunters/`);
