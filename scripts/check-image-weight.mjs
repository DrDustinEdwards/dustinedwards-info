#!/usr/bin/env node
/**
 * Every image byte this site derives through the Images binding must be LOSSY,
 * and the transform ladder must be SHAPED like a transform ladder.
 *
 * ## The defect this was written for
 *
 * Measured 2026-09-01 on the first content object ever put in the bucket. A
 * 188,876 byte lossy WebP origin came back from every rung as LOSSLESS WebP,
 * because `.output()` in `app/routes/media.$.ts` carried no `quality` and the
 * Images binding defaults to lossless. The 640px rung was 404,020 bytes, the
 * 1024px 944,030, the 1408px 979,922: every rung heavier than the object it
 * resizes, which inverts the whole purpose of `srcset` and bills a
 * transformation for the privilege. The fix is `WEBP_QUALITY`, which lives in
 * `app/lib/media/encoding.mjs` since the second call site was found.
 *
 * ## THE FOUR ASSERTIONS, AND WHY NONE OF THEM CARRIES A NUMBER
 *
 *   1. **Every rung is lossy.** Chunk type `VP8`, never `VP8L`. This is the
 *      defect verbatim and it needs no threshold.
 *   2. **Bytes per delivered pixel never rises as delivered pixels rise.**
 *      Equality allowed. A bigger rendering that costs MORE per pixel than a
 *      smaller one is broken encoding whatever the absolute numbers are.
 *   3. **The narrowest rung is smaller than the origin.** Catches the gross
 *      case of serving the original unresized under a width parameter.
 *   4. **Every STORED placeholder is lossy**, decoded from the data URI in the
 *      `placeholder` column. Added 2026-09-06 when the same missing `quality`
 *      was found at its second call site, in the rebuild rather than the
 *      route, where nothing was watching it at all.
 *
 * A tuned constant here would be a second owner of a value that belongs to the
 * image, and would need re-tuning every time an asset was re-encoded.
 *
 * ## THE SUBJECT IS WIDER THAN THE ROUTE, AND ASSERTION 4 IS WHY
 *
 * One to three read what the transform route SERVES. Four reads what the
 * rebuild STORED, over every tier rather than over R2 alone, because the
 * function that derives a placeholder runs over static files in the same loop.
 * Both halves are the same defect: the Images binding emits lossless WebP when
 * no `quality` is given, and the constant that says otherwise now lives in
 * `app/lib/media/encoding.mjs` because there turned out to be two callers.
 *
 * ## ASSERTION 2 WAS RULED AS RAW BYTES FIRST, AND THE MEASUREMENT CHANGED IT
 *
 * The original ruling was "every rung smaller than the origin", then "bytes are
 * non-decreasing with width". Both fire on CORRECT output, and this is the
 * table that showed it, taken after the quality fix shipped:
 *
 *     rung      bytes    delivered   pixels    bytes/px
 *     origin   188,876   1080x810    874,800    0.2159
 *     w=160      8,500   160x120      19,200    0.4427
 *     w=320     28,446   320x240      76,800    0.3704
 *     w=640     91,488   640x480     307,200    0.2978
 *     w=1024   205,344   1024x768    786,432    0.2611
 *     w=1408   198,908   1080x810    874,800    0.2274
 *
 * Two things in that table break a raw-byte rule and neither is a defect.
 * `w=1024` and `w=1408` are BIGGER than the origin, because re-encoding at
 * quality 85 costs more than a source that was compressed harder than 85. And
 * `w=1408` is SMALLER than `w=1024` while being a larger image, because 1408
 * exceeds the source width, so the rung is capped and becomes a native-size
 * re-encode with no resampling, which reproduces an already-compressed source
 * very cheaply.
 *
 * Bytes per pixel falls monotonically down that whole column, which is what
 * healthy encoding looks like, and it was 6.1x the origin's rate when the
 * output was lossless. So it is the measure that separates the two cases
 * without a threshold.
 *
 * ## DELIVERED DIMENSIONS, NEVER THE REQUESTED WIDTH
 *
 * Read out of the response body's own header. `w=1408` against a 1080-wide
 * source delivers 1080, so a ladder ordered by REQUESTED width would compare
 * two rungs that are the same size and call the result an inversion.
 *
 * **Rungs with EQUAL delivered pixels are not compared at all.** The origin and
 * `w=1408` above are both 874,800 pixels, and their sort order relative to each
 * other would otherwise decide the verdict, which is a gate whose answer
 * depends on sort stability. The assertion is about what happens AS PIXELS
 * RISE; where they do not rise there is nothing to assert.
 *
 * ## The floors, one per subject
 *
 * A sweep that examined nothing prints what a clean sweep prints, so this FAILS
 * when it examined zero lossy-origin rows and reports what it found and skipped
 * either way.
 *
 * TWO floors rather than one, because the two subjects are selected by
 * different queries over different rows: a bucket full of gradeable ladders
 * satisfies the first while the `placeholder` column is empty, and an index
 * full of placeholders satisfies the second with no R2 image in it. One floor
 * covering both would be satisfied by either.
 *
 * Usage:
 *   node scripts/check-image-weight.mjs
 *   node scripts/check-image-weight.mjs --base http://localhost:8787
 */

import { spawnSync } from "node:child_process";

import { ALL_WIDTHS } from "../app/lib/media/widths.mjs";
import { SITE_ORIGIN } from "../app/lib/seo.ts";

const DB_NAME = "dustinedwards";

/** @param {string} flag */
function argOf(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const BASE = (argOf("--base") ?? process.env.PUBLIC_ORIGIN ?? SITE_ORIGIN).replace(/\/+$/, "");

/**
 * One read against the media index.
 *
 * `wrangler r2 object` has no `list` verb, which is why every reconciliation in
 * this repo reads D1 for the key set.
 *
 * ONE COMMAND STRING, not an argv array. With `shell: true` on Windows an array
 * argument carrying spaces is split by the shell before wrangler sees it, and
 * the SQL arrives as twenty unknown positional arguments.
 *
 * @param {string} sql a SELECT, inlined so the repo's own hook can read it
 */
function mediaRows(sql) {
  const result = spawnSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command "${sql}"`,
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
 * EVERY STORED PLACEHOLDER, whatever tier produced it.
 *
 * Deliberately NOT narrowed to `storage = 'r2'` the way the ladder query is,
 * and the width is the assertion rather than a convenience: `placeholderFor`
 * runs over R2 objects and over static files from the asset manifest in the
 * same rebuild, so a defect in it reaches both tiers at once. A query that
 * looked at one would report the other clean without examining it, which is
 * FAILURES.md's "a fix in N-1 of N sites is not a fix" reproduced inside the
 * gate written to catch it.
 */
function placeholderRows() {
  return mediaRows(
    "SELECT key, storage, placeholder FROM media " +
      "WHERE placeholder IS NOT NULL AND placeholder != '' AND trashed_at IS NULL ORDER BY key;",
  );
}

/**
 * What a raster buffer IS, read from the container rather than from a mime
 * column or a file extension.
 *
 * A WebP is a RIFF file whose image data lives in a `VP8 ` chunk when lossy and
 * a `VP8L` chunk when lossless; `VP8X` is an extended header carrying neither,
 * and must be walked past to reach the chunk that decides. Reading the stored
 * mime instead would answer `image/webp` for both, which is precisely the
 * distinction assertion 1 exists to make.
 *
 * Dimensions come from the same parse, because the delivered size is what
 * assertion 2 orders by and it is not the requested width.
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
 * THE FOURTH ASSERTION, over a STORED placeholder rather than a served rung.
 *
 * TWO ARTIFACTS SATISFY THIS ONE FUNCTION: the `placeholder` column in D1,
 * swept below, and the `placeholders` map in `content/generated/assets.json`,
 * which `check:content` checks by importing this. One statement of what a
 * placeholder IS. A second copy over there is how the two would come to
 * disagree about the defect they were both written for.
 *
 * ## The defect this was written for
 *
 * `placeholderFor` in `app/lib/media/rebuild.server.ts` called the Images
 * binding with no `quality`, exactly as the transform route did before
 * 2026-09-01, so every LQIP in the index is a LOSSLESS VP8L data URI. The
 * column exists to hold something small enough to inline in a document, and
 * lossless is roughly three times the bytes of the lossy encoding of the same
 * twenty pixel wide image. The ladder fix landed at one of the two call sites
 * and this is the other.
 *
 * ## Why a pure function
 *
 * Same reason `ladderProblems` is one: the replay feeds it a placeholder read
 * out of the live index BEFORE the fix, with no network and no deploy, and
 * watches it name the defect. A gate whose red case can only be produced by
 * breaking production is a gate nobody proves.
 *
 * ## No threshold, again
 *
 * The assertion is the CHUNK TYPE, `VP8` and never `VP8L`, decoded from the
 * base64 payload of the data URI. A byte ceiling would be a second owner of a
 * number that belongs to the image, and would need re-tuning every time the
 * placeholder width moved. The prefix is asserted too, because a row holding
 * something that is not a WebP data URI at all would otherwise decode to
 * garbage and be reported as an unknown codec rather than as a wrong column.
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
      // A LOSSLESS ORIGIN IS SKIPPED, and the restriction is the point. A PNG
      // re-encoded to WebP can legitimately grow or shrink, so every assertion
      // here would be a coin toss and a gate that fails at random gets turned
      // off. A lossy origin has already paid the compression cost.
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
   * THE FLOOR. Zero examined rows and zero problems produce the same output,
   * and the whole point of this gate is that nobody was watching the thing it
   * measures. An empty bucket, a changed storage tier, or a query that stopped
   * matching all report a clean sweep without it.
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
   * ---- 4. EVERY STORED PLACEHOLDER IS LOSSY. -------------------------------
   *
   * Read out of the index rather than off the wire, because a placeholder is
   * not served: it is a column, inlined into whatever renders it. The bytes
   * under test are therefore the STORED bytes and nothing else.
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
   * ITS OWN FLOOR, and it needs one for a reason the ladder's floor does not
   * cover: the ladder query and this one select different rows, so a full
   * bucket can satisfy the first while this one examines nothing. A rebuild
   * that stopped deriving placeholders entirely would empty this column, and
   * an empty column and a clean column print the same line.
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
