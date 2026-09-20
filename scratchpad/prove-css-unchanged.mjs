// Stronger than ten screenshots: if every sheet is byte-identical once comments
// are stripped and whitespace normalised, then no rule, selector, value or
// order changed, and no render can differ. This covers all 22 sheets rather
// than the ten the shot pairs would sample.
import { readFileSync, existsSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

const strip = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")
    .join("\n");

const before = JSON.parse(readFileSync(join(HERE, "before/bytes.json"), "utf8"));
let same = 0, differ = 0, beforeTotal = 0, afterTotal = 0;
const rows = [];

for (const sheet of readSheets(REPO)) {
  const b = join(HERE, "before", basename(sheet));
  if (!existsSync(b)) { console.error(`no before copy for ${sheet}`); process.exit(2); }
  const beforeCss = readFileSync(b, "utf8");
  const afterCss = readFileSync(join(REPO, sheet), "utf8");
  const ok = strip(beforeCss) === strip(afterCss);
  ok ? same++ : differ++;
  const bb = before[sheet];
  const ab = Buffer.byteLength(afterCss, "utf8");
  beforeTotal += bb;
  afterTotal += ab;
  rows.push([sheet, bb, ab, bb - ab, ok]);
}

console.log("sheet                                  before   after    saved  rules-identical");
for (const [s, bb, ab, d, ok] of rows.sort((a, b) => b[3] - a[3])) {
  console.log(
    `  ${s.replace("app/styles/", "").replace("app/", "").padEnd(26)} ${String(bb).padStart(7)} ${String(ab).padStart(7)} ${String(d).padStart(7)}  ${ok ? "yes" : "NO"}`,
  );
}
console.log("");
console.log(`TOTAL  ${beforeTotal} -> ${afterTotal}, saved ${beforeTotal - afterTotal} bytes (${(((beforeTotal - afterTotal) / beforeTotal) * 100).toFixed(1)}%)`);
console.log(`sheets whose rules are byte-identical after stripping comments: ${same} of ${same + differ}`);
if (differ > 0) process.exitCode = 1;
