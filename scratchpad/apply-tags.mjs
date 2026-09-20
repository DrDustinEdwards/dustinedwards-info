// Apply comment-tags.merged.tsv to the sheets.
//
//   CUT      the block and its own line(s) go
//   POINTER  the block is replaced by ONE line naming where the content lives
//   KEEP     untouched
//
// Blocks are rewritten from the END of each file backwards, because removing
// one moves every line number after it. The TSV's line numbers are read against
// the file as it is on disk right now, so this must run on an unmodified tree.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets, commentBlocks } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

const tags = new Map();
for (const line of readFileSync(join(HERE, "comment-tags.merged.tsv"), "utf8").split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const [sheet, ln, bytes, tag, ...rest] = line.split("\t");
  tags.set(`${sheet}:${ln}`, { tag, bytes: Number(bytes), reason: rest.join(" ") });
}

let cut = 0, pointer = 0, kept = 0, missing = 0;
const perSheet = {};

for (const sheet of readSheets(REPO)) {
  const abs = join(REPO, sheet);
  let css = readFileSync(abs, "utf8");
  const blocks = commentBlocks(css);

  // Re-derive each block's absolute offset, then work backwards.
  const rx = /\/\*[\s\S]*?\*\//g;
  const found = [];
  let m;
  while ((m = rx.exec(css)) !== null) {
    found.push({ start: m.index, end: m.index + m[0].length, line: css.slice(0, m.index).split("\n").length });
  }
  if (found.length !== blocks.length) throw new Error(`${sheet}: block scan disagreed`);

  let sheetCut = 0, sheetPointer = 0;

  for (let i = found.length - 1; i >= 0; i--) {
    const f = found[i];
    const entry = tags.get(`${sheet}:${f.line}`);
    if (!entry) { missing += 1; continue; }
    if (entry.tag === "KEEP") { kept += 1; continue; }

    // Take the whole line when the comment is alone on it, so no blank line is
    // left behind; otherwise take just the comment span.
    let start = f.start;
    let end = f.end;
    const lineStart = css.lastIndexOf("\n", start - 1) + 1;
    const beforeOnLine = css.slice(lineStart, start);
    const afterEnd = css.slice(end, css.indexOf("\n", end) === -1 ? end : css.indexOf("\n", end));
    const aloneOnLine = beforeOnLine.trim() === "" && afterEnd.trim() === "";

    if (entry.tag === "CUT") {
      if (aloneOnLine) {
        const nextNl = css.indexOf("\n", end);
        start = lineStart;
        end = nextNl === -1 ? css.length : nextNl + 1;
      }
      css = css.slice(0, start) + css.slice(end);
      sheetCut += 1;
      cut += 1;
    } else {
      const indent = beforeOnLine.match(/^\s*/)[0];
      const replacement = `${indent}/* See ${entry.reason.replace(/\s+/g, " ").trim()} */`;
      css = css.slice(0, aloneOnLine ? lineStart : start) + replacement + css.slice(end);
      sheetPointer += 1;
      pointer += 1;
    }
  }

  writeFileSync(abs, css);
  if (sheetCut || sheetPointer) perSheet[sheet] = { cut: sheetCut, pointer: sheetPointer };
}

console.log(`applied: ${cut} CUT, ${pointer} POINTER, ${kept} KEEP untouched, ${missing} unmatched`);
if (missing) {
  console.error("UNMATCHED BLOCKS: the TSV line numbers do not describe this tree. Refusing to trust the result.");
  process.exitCode = 1;
}
for (const [s, v] of Object.entries(perSheet)) console.log(`  ${s.padEnd(36)} cut ${v.cut}, pointer ${v.pointer}`);
