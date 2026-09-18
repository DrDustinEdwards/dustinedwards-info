#!/usr/bin/env node
/**
 * Every image byte this site derives through the Images binding must be LOSSY, and the transform
 * ladder must be SHAPED like a transform ladder.
 *
 *   node scripts/check-image-weight.mjs [--base <origin>]
 *
 * THE DEFECT: the binding defaults to LOSSLESS and the route asked for no quality, so every rung
 * came back heavier than the object it resizes. FOUR ASSERTIONS, AND NONE CARRIES A NUMBER, a
 * tuned constant being a second owner of a value that belongs to the image:
 *
 *   1. Every rung is lossy, by CHUNK TYPE. The defect verbatim, and it needs no threshold.
 *   2. Bytes per delivered pixel never rises as delivered pixels rise, equality allowed.
 *   3. The narrowest rung is smaller than the origin, catching the original served unresized.
 *   4. Every STORED placeholder is lossy, from the index rather than the wire.
 *
 * RAW BYTES WAS THE FIRST RULING AND THE MEASUREMENT CHANGED IT: a rung can be bigger than the
 * origin because re-encoding costs more, and one past the source width is capped and becomes a
 * native-size re-encode. Bytes per pixel falls through both. DELIVERED DIMENSIONS, NEVER THE
 * REQUESTED WIDTH, read out of the body's own header, and equal-pixel rungs are not compared, or
 * the verdict would depend on sort stability. TWO FLOORS, the subjects being different queries.
 */

import { spawnSync } from "node:child_process";

import { ALL_WIDTHS } from "../app/lib/media/widths.mjs";
import { SITE_ORIGIN } from "../app/lib/seo.ts";

import { resolveD1Address } from "./lib/d1-address.mjs";

const DB_NAME = "dustinedwards";

/** @param {string} flag */
function argOf(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const BASE = (argOf("--base") ?? process.env.PUBLIC_ORIGIN ?? SITE_ORIGIN).replace(/\/+$/, "");

/**
 * One read against the media index: `wrangler r2 object` has no `list` verb, which is why every
 * reconciliation here reads D1 for the key set. ONE COMMAND STRING, not an argv array: with
 * `shell: true` the SQL arrives as a pile of positional arguments.
 *
 * @param {string} sql a SELECT, inlined so the repo's own hook can read it
 */
function mediaRows(sql) {
  const result = spawnSync(
    `npx wrangler d1 execute ${resolveD1Address(DB_NAME, "--remote")} --remote --json --command "${sql}"`,
    { encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024 },
  );
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const match = out.match(/\[[\s\S]*\]/);
  if (result.status !== 0 || !match) {
    console.error(out.slice(0, 2000));
    throw new Error("could not read the media table");
  }
  return JSON.parse(match[0])[0].results;
}

/**
 * The R2 image rows whose ladder is graded.
 *
 * Trashed rows are excluded: the object still serves, but the library has
 * withdrawn it and nobody is being asked to keep its ladder honest.
 */
function r2ImageRows() {
  return mediaRows(
    "SELECT key, bytes, mime FROM media " +
      "WHERE storage = 'r2' AND kind = 'image' AND trashed_at IS NULL ORDER BY key;",
  );
}

/**
 * EVERY STORED PLACEHOLDER, whatever tier produced it: the deriving function runs over R2 objects
 * and static files in one rebuild, so a defect reaches both tiers and a query looking at one would
 * report the other clean.
 */
function placeholderRows() {
  return mediaRows(
    "SELECT key, storage, placeholder FROM media " +
      "WHERE placeholder IS NOT NULL AND placeholder != '' AND trashed_at IS NULL ORDER BY key;",
  );
}

/**
 * What a raster buffer IS, read from the container rather than a mime column: a WebP's image data
 * lives in a different chunk when lossy, and an extended header carries neither. The stored mime
 * answers the same string for both, which is the distinction assertion 1 exists to make.
 *
 * @param {Buffer} buf
 * @returns {{ codec: string, lossy: boolean | null, width: number | null, height: number | null }}
 */
export function codecOf(buf) {
  const unknown = { codec: "unknown", lossy: null, width: null, height: null };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { codec: "jpeg", lossy: true, width: null, height: null };
  }
  if (buf.length >= 8 && buf.toString("ascii", 1, 4) === "PNG") {
    return { codec: "png", lossy: false, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 6 && buf.toString("ascii", 0, 3) === "GIF") {
    return { codec: "gif", lossy: false, width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (
    buf.length < 16 ||
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return unknown;
  }

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const fourcc = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (fourcc === "VP8 " && body + 10 <= buf.length) {
      return {
        codec: "webp/VP8",
        lossy: true,
        width: buf.readUInt16LE(body + 6) & 0x3fff,
        height: buf.readUInt16LE(body + 8) & 0x3fff,
      };
    }
    if (fourcc === "VP8L" && body + 5 <= buf.length) {
      const bits = buf.readUInt32LE(body + 1);
      return {
        codec: "webp/VP8L",
        lossy: false,
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    // VP8X, ALPH, ANIM and friends carry no verdict. Chunks pad to an even
    // length, which is the half a hand-rolled walker forgets.
    offset = body + size + (size % 2);
  }
  return { codec: "webp/unknown", lossy: null, width: null, height: null };
}

/**
 * THE THREE ASSERTIONS, as a PURE function over an already-fetched ladder.
 *
 * Pure so the replay can run it over the real pre-fix bytes with no network and
 * no deploy, which is what makes rule 12's "replay the defect" possible for a
 * gate whose subject is a live route.
 *
 * @param {string} key
 * @param {{ bytes: number, pixels: number, codec: string, lossy: boolean | null }} origin
 * @param {Array<{ label: string, bytes: number, pixels: number, codec: string, lossy: boolean | null }>} rungs
 * @returns {string[]} problems
 */
export function ladderProblems(key, origin, rungs) {
  /** @type {string[]} */
  const problems = [];

  // 1. EVERY RUNG IS LOSSY.
  for (const rung of rungs) {
    if (rung.lossy !== true) {
      problems.push(
        `${key} ${rung.label}: came back ${rung.codec}, not a lossy encoding. ` +
          `The Images binding returns lossless WebP when no quality is set, and a ` +
          `lossless rung costs several times what the source did.`,
      );
    }
  }

  // 2. BYTES PER DELIVERED PIXEL NEVER RISES AS DELIVERED PIXELS RISE.
  const measurable = [{ label: "origin", ...origin }, ...rungs].filter(
    (entry) => entry.pixels > 0 && entry.bytes > 0,
  );
  measurable.sort((a, b) => a.pixels - b.pixels);
  for (let i = 1; i < measurable.length; i += 1) {
    const smaller = measurable[i - 1];
    const larger = measurable[i];
    // Equal pixel counts are not a rise, so there is nothing to assert between
    // them, and comparing them would make the verdict depend on sort order.
    if (larger.pixels === smaller.pixels) continue;
    const smallerRate = smaller.bytes / smaller.pixels;
    const largerRate = larger.bytes / larger.pixels;
    if (largerRate > smallerRate) {
      problems.push(
        `${key}: ${larger.label} costs ${largerRate.toFixed(4)} bytes/pixel over ` +
          `${larger.pixels} pixels while the smaller ${smaller.label} costs ` +
          `${smallerRate.toFixed(4)} over ${smaller.pixels}. A larger rendering ` +
          `must not cost MORE per pixel than a smaller one.`,
      );
    }
  }

  // 3. THE NARROWEST RUNG IS SMALLER THAN THE ORIGIN.
  const narrowest = rungs.reduce(
    (/** @type {typeof rungs[number] | null} */ best, rung) =>
      best === null || rung.pixels < best.pixels ? rung : best,
    null,
  );
  if (narrowest && narrowest.bytes >= origin.bytes) {
    problems.push(
      `${key} ${narrowest.label}: the NARROWEST rung is ${narrowest.bytes} bytes ` +
        `against an origin of ${origin.bytes}. The smallest rendering must be ` +
        `smaller than the object it resizes; this looks like the original served ` +
        `unresized.`,
    );
  }

  return problems;
}

/**
 * THE FOURTH ASSERTION, over a STORED placeholder rather than a served rung. TWO ARTIFACTS SATISFY
 * THIS ONE FUNCTION, the D1 column and the asset manifest's map, because a second copy is how the
 * two would disagree about the defect they were both written for. THE DEFECT: the same missing
 * quality in the rebuild rather than the route, where nothing was watching. PURE, so the replay
 * can feed it a placeholder read out of the live index BEFORE the fix: a gate whose red case can
 * only be produced by breaking production is a gate nobody proves. NO THRESHOLD: the assertion is
 * the CHUNK TYPE, and the prefix too, or a wrong column decodes to garbage.
 *
 * @param {string} key
 * @param {string} placeholder the stored data URI
 * @returns {string[]} problems
 */
export function placeholderProblems(key, placeholder) {
  /** @type {string[]} */
  const problems = [];
  const prefix = "data:image/webp;base64,";

  if (!placeholder.startsWith(prefix)) {
    problems.push(
      `${key}: the stored placeholder does not begin ${prefix}. It is ` +
        `${JSON.stringify(placeholder.slice(0, 40))}, which is not a WebP data URI.`,
    );
    return problems;
  }

  const buf = Buffer.from(placeholder.slice(prefix.length), "base64");
  const info = codecOf(buf);
  if (info.lossy !== true) {
    problems.push(
      `${key}: the stored placeholder is ${info.codec}, not a lossy encoding. ` +
        `Both encoders that write one, the Images binding and sharp, return ` +
        `lossless WebP when no quality is set, and a lossless LQIP costs several ` +
        `times what a lossy one does in a value whose whole purpose is to be ` +
        `small enough to inline. Check WEBP_QUALITY reached the call.`,
    );
  }
  return problems;
}

/** @param {string} url */
async function fetchImage(url) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const info = codecOf(buf);
  return {
    status: res.status,
    bytes: buf.length,
    pixels: (info.width ?? 0) * (info.height ?? 0),
    codec: info.codec,
    lossy: info.lossy,
    width: info.width,
    height: info.height,
    thumb: res.headers.get("x-media-thumb") ?? "",
  };
}

async function main() {
  console.log(`\ncheck:image-weight ladder shape over ${BASE}\n`);

  const rows = r2ImageRows();
  console.log(`  ${rows.length} R2 image row(s) in the index`);

  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const skipped = [];
  let examined = 0;
  let comparisons = 0;

  for (const row of rows) {
    const originUrl = `${BASE}/media/${row.key}`;
    const origin = await fetchImage(originUrl);
    if (origin.status !== 200) {
      problems.push(`${row.key}: the origin object answered ${origin.status}`);
      continue;
    }
    if (origin.lossy !== true) {
      // A LOSSLESS ORIGIN IS SKIPPED, and the restriction is the point: a PNG re-encoded to WebP can
      // legitimately grow or shrink, and a gate that fails at random gets turned off.
      skipped.push(`${row.key} (${origin.codec}, not a lossy origin)`);
      continue;
    }

    examined += 1;
    console.log(
      `  ${row.key} origin ${origin.bytes} bytes, ${origin.width}x${origin.height} (${origin.codec})`,
    );

    /** @type {Array<{ label: string, bytes: number, pixels: number, codec: string, lossy: boolean | null }>} */
    const rungs = [];
    for (const width of ALL_WIDTHS) {
      const rung = await fetchImage(`${originUrl}?w=${width}`);
      comparisons += 1;
      if (rung.status !== 200) {
        problems.push(`${row.key} w=${width}: answered ${rung.status}`);
        continue;
      }
      console.log(
        `    w=${String(width).padEnd(5)} ${String(rung.bytes).padStart(9)} bytes  ` +
          `${`${rung.width}x${rung.height}`.padEnd(11)} ${String(rung.pixels).padStart(8)} px  ` +
          `${(rung.bytes / (rung.pixels || 1)).toFixed(4)} b/px  ${rung.codec}`,
      );
      rungs.push({
        label: `w=${width}`,
        bytes: rung.bytes,
        pixels: rung.pixels,
        codec: rung.codec,
        lossy: rung.lossy,
      });
    }

    problems.push(
      ...ladderProblems(
        row.key,
        { bytes: origin.bytes, pixels: origin.pixels, codec: origin.codec, lossy: origin.lossy },
        rungs,
      ),
    );
  }

  if (skipped.length > 0) {
    console.log(`\n  skipped ${skipped.length}:`);
    for (const s of skipped) console.log(`    ${s}`);
  }
  console.log(`\n  examined ${examined} lossy-origin row(s), ${comparisons} rung fetch(es)`);

  /*
   * THE FLOOR: zero examined rows and zero problems produce the same output, and nobody was
   * watching the thing this measures.
   */
  if (examined === 0) {
    problems.push(
      `examined ZERO lossy-origin R2 images, so every assertion above passed ` +
        `vacuously. ${rows.length} R2 image row(s) found, ${skipped.length} skipped.`,
    );
  }
  if (comparisons === 0) {
    problems.push("fetched ZERO rungs, so no width was checked at all");
  }

  /*
   * 4. EVERY STORED PLACEHOLDER IS LOSSY, read out of the index rather than off the wire: a
   * placeholder is a column, inlined into whatever renders it.
   */
  const stored = placeholderRows();
  console.log(`\n  ${stored.length} stored placeholder(s) in the index`);
  let placeholders = 0;
  let placeholderBytes = 0;
  for (const row of stored) {
    placeholders += 1;
    placeholderBytes += String(row.placeholder).length;
    problems.push(...placeholderProblems(row.key, String(row.placeholder)));
  }
  if (placeholders > 0) {
    console.log(
      `  ${placeholders} examined, ${Math.round(placeholderBytes / placeholders)} bytes ` +
        `mean as stored`,
    );
  }

  /*
   * ITS OWN FLOOR: a full bucket satisfies the ladder query while this one examines nothing, and an
   * empty column and a clean column print the same line.
   */
  if (placeholders === 0) {
    problems.push(
      `examined ZERO stored placeholders, so assertion 4 passed vacuously. ` +
        `Either nothing in the index carries one, which means the rebuild has ` +
        `stopped deriving them, or the query no longer matches the column.`,
    );
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`\n  FAIL  ${p}`);
    console.error("");
    process.exit(1);
  }

  console.log(
    `\ncheck:image-weight ok. ${examined} lossy origin(s): every rung lossy, ` +
      `bytes per pixel never rising with size, narrowest rung under the origin. ` +
      `${placeholders} stored placeholder(s), every one lossy.\n`,
  );
}

// Importable for the replay without running the sweep.
if (process.argv[1] && process.argv[1].endsWith("check-image-weight.mjs")) {
  main().catch((error) => {
    console.error(`\ncheck:image-weight failed: ${error.message}`);
    process.exit(1);
  });
}
