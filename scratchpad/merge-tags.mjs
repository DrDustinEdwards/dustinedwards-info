// Merge my blind tags with Grok's, conservatively.
//
//   CUT      only if BOTH readers said CUT
//   POINTER  if both said POINTER, or one said POINTER and the other CUT
//   KEEP     everything else
//
// The asymmetry is the point: one reader's CUT is never enough. A block only
// leaves the codebase when two readers who could not see each other's work
// both judged it slop.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** @param {string} text @param {boolean} hasHeader */
function parse(text, hasHeader) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows = hasHeader ? lines.slice(1) : lines;
  const map = new Map();
  for (const line of rows) {
    const [sheet, lineNo, bytes, tag, ...rest] = line.split("\t");
    map.set(`${sheet}:${lineNo}`, { sheet, line: Number(lineNo), bytes: Number(bytes), tag, reason: rest.join(" ") });
  }
  return map;
}

const mine = parse(readFileSync(join(HERE, "comment-tags.tsv"), "utf8"), true);
const grok = parse(readFileSync(join(HERE, "comment-tags.grok.tsv"), "utf8"), false);

console.log(`mine ${mine.size} rows, grok ${grok.size} rows`);

const onlyMine = [...mine.keys()].filter((k) => !grok.has(k));
const onlyGrok = [...grok.keys()].filter((k) => !mine.has(k));
console.log(`keys only in mine: ${onlyMine.length}${onlyMine.length ? " -> " + onlyMine.slice(0, 5).join(", ") : ""}`);
console.log(`keys only in grok: ${onlyGrok.length}${onlyGrok.length ? " -> " + onlyGrok.slice(0, 5).join(", ") : ""}`);

const TAGS = ["KEEP", "POINTER", "CUT"];
const matrix = Object.fromEntries(TAGS.map((a) => [a, Object.fromEntries(TAGS.map((b) => [b, 0]))]));

const merged = [];
let rescued = 0;

for (const [key, m] of mine) {
  const g = grok.get(key);
  const gTag = g ? g.tag : "KEEP"; // a block the second reader never saw is not agreed slop
  matrix[m.tag][gTag] = (matrix[m.tag][gTag] ?? 0) + 1;

  let tag, reason;
  if (m.tag === "CUT" && gTag === "CUT") {
    tag = "CUT";
    reason = `both: ${m.reason}`;
  } else if (
    (m.tag === "POINTER" && gTag === "POINTER") ||
    (m.tag === "POINTER" && gTag === "CUT") ||
    (m.tag === "CUT" && gTag === "POINTER")
  ) {
    tag = "POINTER";
    reason = m.tag === "POINTER" ? m.reason : (g?.reason ?? m.reason);
  } else {
    tag = "KEEP";
    reason = m.tag === "KEEP" ? m.reason : `rescued: one reader said ${m.tag === "CUT" ? "CUT" : m.tag}`;
  }

  // Rescued: exactly one reader wanted it gone and the merge kept it.
  if (tag === "KEEP" && (m.tag === "CUT" || gTag === "CUT")) rescued += 1;

  merged.push([m.sheet, m.line, m.bytes, tag, reason]);
}

merged.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);

writeFileSync(
  join(HERE, "comment-tags.merged.tsv"),
  "sheet\tline\tbytes\ttag\treason\n" + merged.map((r) => r.join("\t")).join("\n") + "\n",
);

const counts = merged.reduce((m, r) => ((m[r[3]] = (m[r[3]] ?? 0) + 1), m), {});

console.log("");
console.log("AGREEMENT MATRIX  (rows = mine, columns = grok)");
console.log("            KEEP  POINTER   CUT");
for (const a of TAGS) {
  console.log(
    `  ${a.padEnd(8)} ${String(matrix[a].KEEP).padStart(5)} ${String(matrix[a].POINTER).padStart(8)} ${String(matrix[a].CUT).padStart(5)}`,
  );
}

const agreed = TAGS.reduce((n, t) => n + matrix[t][t], 0);
console.log("");
console.log(`exact agreement: ${agreed} of ${merged.size ?? merged.length} (${((agreed / merged.length) * 100).toFixed(1)}%)`);
console.log(`merged counts: ${JSON.stringify(counts)}`);
console.log(`RESCUED from a single reader's CUT: ${rescued}`);

const cutBytes = merged.filter((r) => r[3] === "CUT").reduce((n, r) => n + r[2], 0);
const pointerBytes = merged.filter((r) => r[3] === "POINTER").reduce((n, r) => n + r[2], 0);
console.log(`bytes tagged CUT: ${cutBytes}  POINTER: ${pointerBytes}`);
