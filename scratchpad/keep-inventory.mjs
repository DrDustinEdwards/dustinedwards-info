// Identify every KEEP block in the CURRENT sheets.
//
// The merged TSV's line numbers describe the pre-audit sheets at fec78c9, so
// they cannot be used against today's files. KEEP blocks were left byte-for-byte
// untouched by the audit, so a current block is a KEEP block exactly when its
// text equals a KEEP block's text at fec78c9. Anything else in the sheets is a
// pointer line, a `@kind` annotation, or was removed by PR #38.
//
// Writes scratchpad/keep-inventory.json: one entry per current KEEP block, with
// its sheet, its ORDINAL among all comment blocks in that sheet, and its text.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets, commentBlocks } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const PRE = "fec78c9";

const tsv = readFileSync(join(HERE, "comment-tags.merged.tsv"), "utf8").split(/\r?\n/).slice(1);
const keepBySheet = new Map();
for (const row of tsv) {
  if (!row.trim()) continue;
  const [sheet, line, , tag] = row.split("\t");
  if (tag !== "KEEP") continue;
  if (!keepBySheet.has(sheet)) keepBySheet.set(sheet, new Set());
  keepBySheet.get(sheet).add(Number(line));
}

const keepTexts = new Map(); // sheet -> Map(text -> count)
let tsvKeep = 0;
for (const [sheet, lines] of keepBySheet) {
  let pre;
  try {
    pre = execFileSync("git", ["show", `${PRE}:${sheet}`], { cwd: REPO, encoding: "utf8" });
  } catch {
    continue;
  }
  const m = new Map();
  for (const { text, line } of commentBlocks(pre)) {
    if (!lines.has(line)) continue;
    tsvKeep += 1;
    m.set(text, (m.get(text) ?? 0) + 1);
  }
  keepTexts.set(sheet, m);
}

const inventory = [];
const other = { pointer: 0, kind: 0, unmatched: [] };
for (const sheet of readSheets(REPO)) {
  const css = readFileSync(join(REPO, sheet), "utf8");
  const avail = new Map(keepTexts.get(sheet) ?? []);
  commentBlocks(css).forEach(({ text, line }, ordinal) => {
    const n = avail.get(text) ?? 0;
    if (n > 0) {
      avail.set(text, n - 1);
      inventory.push({ sheet, ordinal, line, text });
    } else if (/^\/\*\s*See /.test(text)) other.pointer += 1;
    else if (/@kind other/.test(text)) other.kind += 1;
    else other.unmatched.push(`${sheet}:${line} ${text.slice(0, 60).replace(/\s+/g, " ")}`);
  });
}

writeFileSync(join(HERE, "keep-inventory.json"), JSON.stringify(inventory, null, 1));
console.log(`KEEP blocks in the TSV, found at ${PRE}: ${tsvKeep}`);
console.log(`KEEP blocks present in today's sheets: ${inventory.length}`);
console.log(`other blocks: ${other.pointer} pointer lines, ${other.kind} @kind annotations, ${other.unmatched.length} unmatched`);
for (const u of other.unmatched) console.log(`  UNMATCHED ${u}`);
const bytes = inventory.reduce((n, b) => n + b.text.length, 0);
console.log(`KEEP comment bytes today: ${bytes}`);
