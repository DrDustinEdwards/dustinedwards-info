#!/usr/bin/env node
/**
 * Every rung of a transform ladder must be SMALLER than the object it resizes.
 *
 * ## Why this gate exists
 *
 * `srcset` earns its complexity by sending fewer bytes to a smaller slot. A
 * ladder whose rungs are heavier than the original inverts that: the reader
 * downloads more, the browser picks worse, and every rung is a separately
 * billed transformation for the privilege. That is not a regression anyone
 * would notice by looking, because the page renders correctly either way.
 *
 * Measured 2026-09-01 on the first content image ever put in the bucket: a
 * 188,876 byte lossy WebP origin whose 640px rung answered 404,020 bytes, and
 * whose every rung was larger than the original. The cause was an omitted
 * `quality` on the Images binding's `.output()`, which makes it emit LOSSLESS
 * WebP. See `WEBP_QUALITY` in `app/routes/media.$.ts`.
 *
 * ## What it asserts, and what it deliberately does not
 *
 * For every R2 image row whose ORIGIN IS LOSSY, every width in `ALL_WIDTHS`
 * must come back smaller than the origin object.
 *
 * **Lossy origins only, and the restriction is the point rather than a
 * convenience.** Re-encoding a LOSSLESS source (a PNG screenshot, a VP8L WebP)
 * into WebP can legitimately grow or shrink depending on the image, so the
 * comparison would be a coin toss and a gate that fails at random gets
 * disabled. A lossy origin has already paid the compression cost, so a resize
 * to fewer pixels that comes back BIGGER is unambiguous.
 *
 * **NO BYTE COUNT IS WRITTEN DOWN HERE.** Every comparison is against the
 * origin fetched in the same run. A literal would rot the day anyone
 * re-encodes an asset, and would make this file a second owner of a number
 * that belongs to the object.
 *
 * ## The scope floor
 *
 * A sweep that examined nothing prints what a clean sweep prints. This gate
 * therefore FAILS when it examined zero lossy-origin rows, and reports the
 * rows it found and skipped with the reason for each, so "0 problems" can
 * always be told apart from "0 examined".
 *
 * Usage:
 *   node scripts/check-image-weight.mjs                  the deployed site
 *   node scripts/check-image-weight.mjs --base http://localhost:8787
 *   PUBLIC_ORIGIN=... node scripts/check-image-weight.mjs
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
 * The R2 image rows, read from the index rather than by listing the bucket.
 *
 * `wrangler r2 object` has no `list` verb, which is why every reconciliation in
 * this repo reads D1 for the key set. Trashed rows are excluded: the object
 * still exists and still serves, but the library has withdrawn it and nobody is
 * being asked to keep its ladder honest.
 */
function r2ImageRows() {
  /*
   * ONE COMMAND STRING, not an argv array, and the difference is not cosmetic.
   * With `shell: true` on Windows an array argument carrying spaces is split by
   * the shell before wrangler sees it, and the SQL arrives as twenty unknown
   * positional arguments. `check-media.mjs` passes a string for the same reason.
   */
  const result = spawnSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command ` +
      `"SELECT key, bytes, mime FROM media ` +
      `WHERE storage = 'r2' AND kind = 'image' AND trashed_at IS NULL ORDER BY key;"`,
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
 * Whether a buffer is a LOSSY raster, by reading the container rather than the
 * file extension or the stored mime.
 *
 * A WebP is a RIFF file whose image data lives in a `VP8 ` chunk when lossy and
 * a `VP8L` chunk when lossless; `VP8X` is an extended header that carries
 * neither and must be walked past to reach the one that decides. Reading the
 * mime column instead would answer `image/webp` for both and this gate would
 * examine the lossless ones it must skip.
 *
 * @param {Buffer} buf
 * @returns {{ codec: string, lossy: boolean | null }}
 */
function codecOf(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { codec: "jpeg", lossy: true };
  }
  if (buf.length >= 8 && buf.toString("ascii", 1, 4) === "PNG") {
    return { codec: "png", lossy: false };
  }
  if (buf.length >= 6 && buf.toString("ascii", 0, 3) === "GIF") {
    return { codec: "gif", lossy: false };
  }
  if (
    buf.length >= 16 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    let offset = 12;
    while (offset + 8 <= buf.length) {
      const fourcc = buf.toString("ascii", offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      if (fourcc === "VP8 ") return { codec: "webp/VP8", lossy: true };
      if (fourcc === "VP8L") return { codec: "webp/VP8L", lossy: false };
      // VP8X, ALPH, ANIM and friends carry no verdict. Chunks are padded to an
      // even length, which is the half a hand-rolled walker forgets.
      offset += 8 + size + (size % 2);
    }
    return { codec: "webp/unknown", lossy: null };
  }
  return { codec: "unknown", lossy: null };
}

/** @param {string} url */
async function fetchBytes(url) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf, thumb: res.headers.get("x-media-thumb") ?? "" };
}

async function main() {
  console.log(`\ncheck:image-weight every rung smaller than its origin (${BASE})\n`);

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
    const origin = await fetchBytes(originUrl);
    if (origin.status !== 200) {
      problems.push(`${row.key}: the origin object answered ${origin.status} at ${originUrl}`);
      continue;
    }
    const { codec, lossy } = codecOf(origin.buf);
    if (lossy !== true) {
      skipped.push(`${row.key} (${codec}, not a lossy origin)`);
      continue;
    }

    examined += 1;
    const originBytes = origin.buf.length;
    console.log(`  ${row.key} origin ${originBytes} bytes (${codec})`);

    for (const width of ALL_WIDTHS) {
      const url = `${originUrl}?w=${width}`;
      const rung = await fetchBytes(url);
      comparisons += 1;
      if (rung.status !== 200) {
        problems.push(`${row.key} w=${width}: answered ${rung.status}`);
        continue;
      }
      const rungCodec = codecOf(rung.buf);
      const ratio = (rung.buf.length / originBytes).toFixed(2);
      const verdict = rung.buf.length < originBytes ? "ok" : "LARGER THAN ORIGIN";
      console.log(
        `    w=${String(width).padEnd(5)} ${String(rung.buf.length).padStart(9)} bytes  ` +
          `${ratio.padStart(5)}x  ${rungCodec.codec.padEnd(12)} ${verdict}`,
      );
      if (rung.buf.length >= originBytes) {
        problems.push(
          `${row.key} w=${width}: ${rung.buf.length} bytes against an origin of ` +
            `${originBytes} (${ratio}x, ${rungCodec.codec}). A rung must be smaller ` +
            `than the object it resizes.`,
        );
      }
    }
  }

  if (skipped.length > 0) {
    console.log(`\n  skipped ${skipped.length}:`);
    for (const s of skipped) console.log(`    ${s}`);
  }

  console.log(
    `\n  examined ${examined} lossy-origin row(s), ${comparisons} rung comparison(s)`,
  );

  /*
   * THE FLOOR. Zero examined rows and zero problems are the same output, and
   * the whole point of this gate is that nobody was watching the thing it
   * measures. An empty bucket, a changed storage tier or a query that stopped
   * matching all report a clean sweep without it.
   */
  if (examined === 0) {
    problems.push(
      `examined ZERO lossy-origin R2 images, so every assertion above passed ` +
        `vacuously. ${rows.length} R2 image row(s) were found and ${skipped.length} ` +
        `skipped as not-lossy.`,
    );
  }
  if (comparisons === 0) {
    problems.push("made ZERO rung comparisons, so no width was checked at all");
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`\n  FAIL  ${p}`);
    console.error("");
    process.exit(1);
  }

  console.log(
    `\ncheck:image-weight ok. every rung of ${examined} lossy origin(s) came back ` +
      `smaller than its object.\n`,
  );
}

main().catch((error) => {
  console.error(`\ncheck:image-weight failed: ${error.message}`);
  process.exit(1);
});
