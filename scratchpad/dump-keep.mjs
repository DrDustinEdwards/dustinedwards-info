// Print KEEP blocks for rewriting. Usage: node dump-keep.mjs <sheet-substring>...
// [G] marks a block the guidelines generator classifies: its rewrite must keep
// at least 120 bytes of prose and the keyword that classified it.
// [I] marks a comment that trails a declaration and must stay one line.
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks, commentProse } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const inventory = JSON.parse(readFileSync(join(HERE, "keep-inventory.json"), "utf8"));
const wanted = process.argv.slice(2);

const classified = new Set();
const dir = join(HERE, "before", "guidelines");
const lineToKey = new Map();
for (const b of inventory) lineToKey.set(`${b.sheet}:${b.line}`, `${b.sheet}#${b.ordinal}`);
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".md")) continue;
  for (const m of readFileSync(join(dir, f), "utf8").matchAll(/\*\*`([^`]+:\d+)`\*\*/g)) {
    const k = lineToKey.get(m[1]);
    if (k) classified.add(k);
  }
}

for (const b of inventory) {
  if (wanted.length && !wanted.some((w) => b.sheet.endsWith(w))) continue;
  const key = `${b.sheet}#${b.ordinal}`;
  const src = readFileSync(join(HERE, "before", basename(b.sheet)), "utf8");
  const start = src.indexOf(b.text);
  const lineStart = src.lastIndexOf("\n", start - 1) + 1;
  const inline = src.slice(lineStart, start).trim() !== "";
  const flags = `${classified.has(key) ? "[G]" : ""}${inline ? "[I]" : ""}`;
  console.log(`=== ${key} ${b.text.length}b ${flags}`);
  console.log(commentProse(b.text));
  console.log("");
}
