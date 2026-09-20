// Emit my blind tags as scratchpad/comment-tags.tsv.
//
// Per-block judgements come from decisions.mjs. The three structural classes
// are applied here rather than typed out 78 times, because each is a rule with
// its evidence rather than a per-block opinion:
//
//   later exact copy    -> POINTER at the first occurrence
//   reset.css one-liner -> CUT, vendored preflight annotation
//   split-sheet header  -> POINTER at app/app.css:1885, the canonical statement
//
// A per-block judgement in decisions.mjs always WINS over a structural class,
// so a copy that was read and judged on its merits keeps that tag.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DECISIONS } from "./decisions.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const rows = JSON.parse(readFileSync(join(HERE, "blocks.json"), "utf8"));

const firstSeen = new Map();
const out = [];
let structural = { copy: 0, reset: 0, header: 0 };

const SPLIT_HEADER = "THE ORDER OF THESE FILES IS THE CASCADE";

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const key = r.prose.trim();
  const priorIndex = firstSeen.has(key) ? firstSeen.get(key) : null;
  if (!firstSeen.has(key) && key) firstSeen.set(key, i);

  let tag, reason;
  if (DECISIONS[i]) {
    [tag, reason] = DECISIONS[i];
  } else if (priorIndex !== null) {
    tag = "POINTER";
    reason = `exact copy of ${rows[priorIndex].sheet}:${rows[priorIndex].line}`;
    structural.copy += 1;
  } else if (r.sheet.endsWith("reset.css")) {
    tag = "CUT";
    reason = "vendored preflight annotation, upstream browser-bug note";
    structural.reset += 1;
  } else if (r.prose.includes(SPLIT_HEADER)) {
    tag = "POINTER";
    reason = "split header, canonical statement is app/app.css:1885";
    structural.header += 1;
  } else {
    tag = "KEEP";
    reason = "UNREVIEWED, defaulted to KEEP";
  }
  out.push([r.sheet, r.line, r.bytes, tag, reason]);
}

const unreviewed = out.filter((o) => o[4].startsWith("UNREVIEWED"));
const counts = out.reduce((m, o) => ((m[o[3]] = (m[o[3]] ?? 0) + 1), m), {});

writeFileSync(
  join(HERE, "comment-tags.tsv"),
  "sheet\tline\tbytes\ttag\treason\n" + out.map((o) => o.join("\t")).join("\n") + "\n",
);

console.log(`blocks: ${out.length}`);
console.log(`judged per block: ${Object.keys(DECISIONS).length}`);
console.log(`structural: ${JSON.stringify(structural)}`);
console.log(`counts: ${JSON.stringify(counts)}`);
console.log(`UNREVIEWED (defaulted KEEP): ${unreviewed.length}`);
for (const u of unreviewed.slice(0, 20)) console.log(`  ${u[0]}:${u[1]} ${u[2]}b`);
