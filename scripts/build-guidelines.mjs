/**
 * Extract the stylesheets' reasoning into guidance the canvas can read.
 *
 * ## THE DEFECT, ruling 109
 *
 * `build-inputs.mjs` runs `stripCssComments` over every sheet on the way to
 * the bundle, and its own comment claimed "the comments are worth keeping
 * where they were written and worthless in a bundle a design agent consumes,
 * so nothing is lost by dropping them here."
 *
 * That claim is falsified. `public-chrome.css` lines 91 to 92 carry "The
 * `:visited` and `:hover` selectors are (0,2,0) and outrank the base
 * pseudo-class rules deliberately. Do not 'simplify' them away." The redesign
 * simplified them away and shipped a wordmark that turned visited-plum on the
 * purple bar. The canvas never saw the warning, because the strip had already
 * removed it.
 *
 * The strip STAYS. It exists for its own measured reason: the converter's
 * validator greps `_ds_bundle.css` for `@import` without stripping comments,
 * and `app.css`'s prose about having removed `@import "tailwindcss"` failed
 * that gate twice. The repair is not to stop stripping; it is to stop
 * DISCARDING. This script is where the reasoning goes instead.
 *
 * ## IT IS NOT A GATE AND MAKES NO ASSERTION
 *
 * It is a build step. `check:design-sheets` owns whether the sheet list is
 * right; this reads that list and writes files. Output is gitignored, because
 * a committed copy would be a second owner of prose the stylesheets already
 * own (hard rule 17) and would drift the moment a comment was edited.
 *
 * ## WHAT IT DOES NOT SHIP
 *
 * Build-only narration. A block about the converter, a gate, a migration or a
 * lockfile tells a design agent nothing and spends the budget that the rules
 * it CAN break need. A block is dropped when it reads as build talk and
 * carries no design signal, never on the build needle alone.
 *
 * ## THE CAP IS HONEST RATHER THAN SILENT
 *
 * Each file is capped near 16 KB. Blocks are emitted strongest first, by how
 * many independent design needles they hit, and anything that does not fit is
 * NAMED on stdout with its source and line. A truncation nobody can see is the
 * same class of defect as a search over an empty scope.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets, commentBlocks, commentProse } from "./lib/design-sheets.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO, ".design-sync/guidelines");

/** Near 16 KB, per the job that commissioned this. */
const FILE_CAP_BYTES = 16 * 1024;

/** A block shorter than this is a section marker, not reasoning. */
const MINIMUM_PROSE_BYTES = 120;

/**
 * The four destinations, in priority order. A block lands in the FIRST file
 * whose needles it hits, so the order here decides where an overlapping block
 * goes: chrome before layout, because a bar rule that also mentions z-index is
 * a chrome rule first.
 */
const FILES = [
  {
    name: "chrome-and-bars.md",
    title: "Chrome, bars and the header",
    blurb:
      "The fixed bar, the wordmark, the footer, and the token family that paints them. " +
      "These are the rules the 2026-09 redesign broke by inventing a token instead of " +
      "reading one.",
    needles: [
      /\bon-chrome\b/i,
      /\bsurface-chrome\b/i,
      /\bmark-on-chrome\b/i,
      /\bsite-header\b/i,
      /\bsite-footer\b/i,
      /\bwordmark\b/i,
      /\bpinned bar\b/i,
      /\bborder-strong\b/i,
      /\boutrank\b/i,
      /\bspecificity\b/i,
      /\(0,\s*\d\s*,\s*\d\)/,
    ],
  },
  {
    name: "layout-and-z.md",
    title: "Layout, the track grid and layering",
    blurb:
      "How the page is measured and how things stack. `.tracks` is the redesign grid " +
      "and `.page` is the one it replaces; the two are not interchangeable.",
    needles: [
      /\bz-index\b/i,
      /--z-[a-z]/i,
      /\bstacking\b/i,
      /\.tracks\b/,
      /\bsite-inset\b/i,
      /\bgutter\b/i,
      /\bgrid-template\b/i,
      /\bfull-bleed\b/i,
      /\bmax-width\b/i,
    ],
  },
  {
    name: "type-and-scale.md",
    title: "Type, spacing and control dimensions",
    blurb:
      "The serif floor, the optical size steps, and the rule that control dimensions " +
      "are not spacing and do not sit on the spacing scale.",
    needles: [
      /\bserif\b/i,
      /\bfont-size\b/i,
      /\bfont-weight\b/i,
      /\bline-height\b/i,
      /\bfont-display\b/i,
      /\b@font-face\b/i,
      /\bcontrol-h\b/i,
      /\bhit target\b/i,
      /\btype scale\b/i,
      /\boptical size\b/i,
      /\bmeasure\b/i,
      /\brem\b/,
    ],
  },
  {
    name: "theme-and-contrast.md",
    title: "Themes and contrast",
    blurb:
      "Both themes are first class. A themed container owes both a background and a " +
      "text colour, and the contrast pairs here are measured rather than assumed.",
    needles: [
      /\bdata-theme\b/i,
      /\bprefers-color-scheme\b/i,
      /\bprefers-contrast\b/i,
      /\bcontrast\b/i,
      /\bcolor-mix\b/i,
      /\bAPCA\b/i,
      /\b\d+(?:\.\d+):1\b/,
      /\bWCAG\b/i,
    ],
  },
];

/**
 * Build talk. Present on its own, a block is dropped; present alongside a
 * design needle, the design needle wins, because a comment often explains a
 * design rule BY naming the gate that holds it.
 */
const BUILD_NEEDLES = [
  /\bcheck:[a-z-]+/i,
  /\bconverter\b/i,
  /\besbuild\b/i,
  /\bvite\b/i,
  /\btailwindcss\b/i,
  /\blockfile\b/i,
  /\bmigration\b/i,
  /\bnpm run\b/i,
  /\bwrangler\b/i,
  /\bbundle\b/i,
];

/** @param {string} prose @param {RegExp[]} needles */
function hits(prose, needles) {
  let n = 0;
  for (const rx of needles) if (rx.test(prose)) n += 1;
  return n;
}

function main() {
  const sheets = readSheets(REPO);

  /** @type {{ sheet: string, line: number, prose: string, score: number, file: string | null }[]} */
  const all = [];

  for (const sheet of sheets) {
    const abs = join(REPO, sheet);
    if (!existsSync(abs)) continue;
    for (const { text, line } of commentBlocks(readFileSync(abs, "utf8"))) {
      const prose = commentProse(text);
      if (prose.length < MINIMUM_PROSE_BYTES) continue;

      let file = null;
      let score = 0;
      for (const candidate of FILES) {
        const n = hits(prose, candidate.needles);
        if (n > 0) {
          file = candidate.name;
          score = n;
          break;
        }
      }
      if (file === null) continue;

      // Build talk with no design signal of its own is dropped. `score` is the
      // design signal, so the test is the build needle winning outright.
      const build = hits(prose, BUILD_NEEDLES);
      if (build > 0 && score < 2) continue;

      all.push({ sheet, line, prose, score, file });
    }
  }

  if (all.length === 0) {
    throw new Error(
      "no comment blocks classified. The sheets carry prose, so a zero here is a " +
        "broken parse rather than a clean tree.",
    );
  }

  // Rebuild the directory so a removed comment cannot survive as a stale file.
  // capsid/ is written by a different step and must not be swept away with it.
  if (existsSync(OUT_DIR)) {
    for (const entry of readdirSync(OUT_DIR)) {
      if (entry === "capsid") continue;
      rmSync(join(OUT_DIR, entry), { recursive: true, force: true });
    }
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 10);
  /** @type {string[]} */
  const dropped = [];
  const written = [];

  for (const spec of FILES) {
    const mine = all
      .filter((b) => b.file === spec.name)
      .sort((a, b) => b.score - a.score || a.sheet.localeCompare(b.sheet) || a.line - b.line);

    const header =
      `# ${spec.title}\n\n` +
      `${spec.blurb}\n\n` +
      `Generated by \`scripts/build-guidelines.mjs\` on ${stamp} from the stylesheets ` +
      `\`SHEETS\` names. Every block below is a comment lifted from the sheet it cites, ` +
      `unedited. The stylesheet is the owner: where this file and the sheet disagree, ` +
      `the sheet is right and this file is stale.\n`;

    let body = "";
    let emitted = 0;
    for (const b of mine) {
      const chunk = `\n---\n\n**\`${b.sheet}:${b.line}\`**\n\n${b.prose}\n`;
      if (header.length + body.length + chunk.length > FILE_CAP_BYTES) {
        dropped.push(`${spec.name}: ${b.sheet}:${b.line} (score ${b.score})`);
        continue;
      }
      body += chunk;
      emitted += 1;
    }

    const text = header + body;
    writeFileSync(join(OUT_DIR, spec.name), text);
    written.push({ name: spec.name, bytes: text.length, emitted, candidates: mine.length });
  }

  console.log(`sheets read      ${sheets.length}`);
  console.log(`blocks classified ${all.length}`);
  console.log("");
  console.log("file                     bytes   blocks  of candidates");
  for (const w of written) {
    console.log(
      `  ${w.name.padEnd(22)} ${String(w.bytes).padStart(6)} ${String(w.emitted).padStart(7)} ${String(w.candidates).padStart(14)}`,
    );
  }
  const total = written.reduce((n, w) => n + w.bytes, 0);
  console.log(`\ntotal ${(total / 1024).toFixed(1)} KB across ${written.length} files`);

  if (dropped.length > 0) {
    console.log(`\n${dropped.length} block(s) did not fit the ${FILE_CAP_BYTES} byte cap:`);
    for (const d of dropped) console.log(`  ${d}`);
  } else {
    console.log(`\nevery classified block fit the ${FILE_CAP_BYTES} byte cap`);
  }

  // The shortlist the seat confirms: which sheet each file drew from.
  console.log("\nprovenance, blocks per sheet per file:");
  for (const spec of FILES) {
    const bySheet = new Map();
    for (const b of all.filter((x) => x.file === spec.name)) {
      bySheet.set(b.sheet, (bySheet.get(b.sheet) ?? 0) + 1);
    }
    const parts = [...bySheet].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${basename(s)} ${n}`);
    console.log(`  ${spec.name.padEnd(22)} ${parts.join(", ") || "(none)"}`);
  }
}

try {
  main();
} catch (error) {
  console.error(
    `\nbuild-guidelines could not run: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
