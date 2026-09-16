// Two assertions the cut has to survive.
//
// 1. Every merged-KEEP block is still in its sheet, matched by its FIRST
//    SENTENCE rather than its line number, because the line numbers moved.
// 2. The generator still classifies the same block CONTENT. The count may drop
//    where a duplicate copy became a pointer, and that is the dedup working
//    rather than guidance lost: the content survives at its first occurrence.
//    What must never happen is a distinct block leaving the set.
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets, commentBlocks, commentProse } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

const firstSentence = (prose) => {
  const line = prose.split("\n").find((l) => l.trim().length > 12) ?? "";
  return line.trim().replace(/\s+/g, " ").slice(0, 60);
};

// ---- 1. KEEP blocks survive ----
const beforeBlocks = new Map(); // "sheet:line" -> prose
for (const sheet of readSheets(REPO)) {
  const css = readFileSync(join(HERE, "before", basename(sheet)), "utf8");
  for (const { text, line } of commentBlocks(css)) beforeBlocks.set(`${sheet}:${line}`, commentProse(text));
}

const afterProse = new Map(); // sheet -> whole file text
for (const sheet of readSheets(REPO)) afterProse.set(sheet, readFileSync(join(REPO, sheet), "utf8"));

let checked = 0;
const lost = [];
for (const line of readFileSync(join(HERE, "comment-tags.merged.tsv"), "utf8").split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const [sheet, ln, , tag] = line.split("\t");
  if (tag !== "KEEP") continue;
  const prose = beforeBlocks.get(`${sheet}:${ln}`);
  if (!prose) { lost.push(`${sheet}:${ln} had no before copy`); continue; }
  const needle = firstSentence(prose);
  checked += 1;
  if (needle && !afterProse.get(sheet).replace(/\s+/g, " ").includes(needle.replace(/\s+/g, " "))) {
    lost.push(`${sheet}:${ln} "${needle}"`);
  }
}

console.log(`KEEP blocks asserted present by first sentence: ${checked}`);
console.log(lost.length === 0 ? "  all present" : `  MISSING ${lost.length}:`);
for (const l of lost) console.log(`    ${l}`);

// ---- 2. generator content set ----
const bodies = (dir) => {
  const set = new Set();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const text = readFileSync(join(dir, f), "utf8");
    for (const chunk of text.split(/\n---\n/).slice(1)) {
      const body = chunk.replace(/^\s*\*\*`[^`]+`\*\*\s*/, "").trim().replace(/\s+/g, " ");
      if (body) set.add(body);
    }
  }
  return set;
};

const before = bodies(join(HERE, "before/guidelines"));
const after = bodies(join(REPO, ".design-sync/guidelines"));
const dropped = [...before].filter((b) => !after.has(b));
const added = [...after].filter((b) => !before.has(b));

console.log("");
console.log(`generator blocks before: ${before.size}  after: ${after.size}`);
console.log(`content dropped: ${dropped.length}, content added: ${added.length}`);
for (const d of dropped) console.log(`  DROPPED: ${d.slice(0, 90)}`);
for (const a of added) console.log(`  ADDED:   ${a.slice(0, 90)}`);

if (lost.length || added.length) process.exitCode = 1;
