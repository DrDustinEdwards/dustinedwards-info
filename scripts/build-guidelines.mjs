/**
 * Extract the stylesheets' reasoning into guidance the canvas can read.
 *
 * THE DEFECT: the bundle strips CSS comments on the way to the design canvas, and one of the
 * stripped comments was a warning not to simplify a deliberately specific selector. The redesign
 * simplified it away and shipped a wordmark in the wrong colour, because the canvas never saw it.
 *
 * THE STRIP STAYS: it exists for its own measured reason, the converter's validator greping the
 * bundle for `@import` without stripping comments, which a stylesheet's prose about a removed
 * `@import` failed twice. The repair is not to stop stripping, it is to stop DISCARDING, and this
 * is where the reasoning goes instead.
 *
 * IT IS NOT A GATE AND MAKES NO ASSERTION. Output is gitignored, a committed copy being a second
 * owner of prose the stylesheets already own (hard rule 17).
 *
 * WHAT IT DOES NOT SHIP: build-only narration, which tells a design agent nothing and spends the
 * budget the rules it CAN break need. A block is dropped when it reads as build talk and carries
 * no design signal, never on the build needle alone.
 *
 * THE CAP IS HONEST RATHER THAN SILENT: blocks are emitted strongest first and anything that does
 * not fit is NAMED with its source and line, a truncation nobody can see being the same class of
 * defect as a search over an empty scope.
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
 * The four destinations, in priority order: a block lands in the FIRST file whose needles it
 * hits, so this order decides where an overlapping block goes.
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
 * Build talk. Present on its own a block is dropped; present alongside a design needle the design
 * needle wins, because a comment often explains a design rule BY naming the gate that holds it.
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

/**
 * The page singletons: real parts of the site the sync cannot ship as components, described so
 * the canvas at least knows what they ARE. They are excluded from the component sync because
 * nothing there is composable, which is true about INSTANTIATION and says nothing about
 * visibility. The component-to-sheet mapping is HAND-WRITTEN, because nothing in the repo declares
 * it: a sheet does not name the component it styles.
 */
const SINGLETONS = [
  { name: "site-header", component: "app/components/site-header.tsx", sheets: ["app/styles/public-chrome.css", "app/styles/chrome-nav.css"] },
  // The footer's sheet, not the chrome one: it was renamed and moved sheets, so mapping it there
  // would have sent the canvas the HEADER's tokens as the footer's.
  { name: "site-footer", component: "app/components/shell-footer.tsx", sheets: ["app/styles/shell.css"] },
  { name: "theme-toggle", component: "app/components/theme-toggle.tsx", sheets: ["app/styles/public-chrome.css"] },
  { name: "search-trigger", component: "app/components/search-trigger.tsx", sheets: ["app/styles/search-trigger.css", "app/styles/palette-dialog.css"] },
];

/**
 * HAND-WRITTEN: the rulings that bind the singletons cannot be derived from the source, the code
 * carrying a ruling's effect rather than its authority.
 */
const SINGLETON_PREAMBLE = `These four are real parts of every public page and are NOT in the component
library, because none of them can be instantiated by a design agent: they are
page singletons, and two of them exist only to inject the nonced enhancement
bundles the no-hydration law requires.

They are described here anyway. Not being able to compose the header is a
different thing from not being allowed to know what it is, and a redesign that
did not know produced a header with invented tokens, a wordmark that turned
visited-coloured, and a search control that did not work.

**The header is not open for redesign.** It is restored byte-identical to a
specific commit on Dustin's order, and two standing design rulings are SUSPENDED
for it rather than satisfied by it. Nothing about it changes without that
suspension being lifted.

**The header has no width breakpoints.** It is \`flex-wrap: wrap\` on both the
header and the nav, the only media query touching it is \`print\`, and it WRAPS
onto a second line rather than overflowing. The
thresholds below are measured values from the component's own comment, dated in
the source; they are properties of the current link labels, so a longer word
moves them and they are re-measured rather than reasoned from.

Everything under "from the source" below is extracted from the files named. The
source is the owner: where this file and the component disagree, the component
is right.
`;

/**
 * A module's leading doc comment: the reasoning a component carries about itself, which the
 * stylesheet extractor never sees because it reads only CSS.
 *
 * @param {string} source
 */
function leadingDocComment(source) {
  const m = source.match(/\/\*\*[\s\S]*?\*\//);
  return m ? commentProse(m[0]) : "";
}

/**
 * Literal className values, which are the vocabulary the canvas composes with.
 *
 * @param {string} source
 */
function classNames(source) {
  const out = new Set();
  for (const m of source.matchAll(/className="([^"{}]+)"/g)) {
    for (const cls of m[1].split(/\s+/)) if (cls) out.add(cls);
  }
  return [...out].sort();
}

/**
 * Every custom property a sheet READS, which is what the singleton consumes.
 *
 * @param {string} css
 */
function tokensRead(css) {
  const out = new Set();
  for (const m of css.matchAll(/var\((--[a-z0-9-]+)/gi)) out.add(m[1]);
  return [...out].sort();
}

/** @param {string} outDir */
function writeSingletons(outDir) {
  let body =
    `# The page singletons\n\n${SINGLETON_PREAMBLE}\n` +
    `Generated by \`scripts/build-guidelines.mjs\`. The preamble above and the\n` +
    `component-to-sheet mapping are hand-written; everything below is extracted.\n`;

  for (const s of SINGLETONS) {
    const abs = join(REPO, s.component);
    if (!existsSync(abs)) continue;
    const source = readFileSync(abs, "utf8");

    const tokens = new Set();
    for (const sheet of s.sheets) {
      const sheetAbs = join(REPO, sheet);
      if (existsSync(sheetAbs)) for (const t of tokensRead(readFileSync(sheetAbs, "utf8"))) tokens.add(t);
    }

    const classes = classNames(source);
    const doc = leadingDocComment(source);

    body += `\n---\n\n## ${s.name}\n\n`;
    body += `\`${s.component}\`, styled by ${s.sheets.map((x) => `\`${x}\``).join(" and ")}.\n`;
    body += `\n### Class names, from the source\n\n`;
    body += classes.length ? classes.map((c) => `- \`${c}\``).join("\n") + "\n" : "(none as literals)\n";
    body += `\n### Tokens its sheets read, from the source\n\n`;
    body += tokens.size ? `${[...tokens].sort().map((t) => `\`${t}\``).join(", ")}\n` : "(none)\n";
    if (doc) body += `\n### What the component says about itself, from the source\n\n${doc}\n`;
  }

  writeFileSync(join(outDir, "singletons.md"), body);
  return body.length;
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

  const singletonBytes = writeSingletons(OUT_DIR);
  written.push({ name: "singletons.md", bytes: singletonBytes, emitted: SINGLETONS.length, candidates: SINGLETONS.length });

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
