// IS THERE A LEFTOVER BLANK LINE ON THE DRAFT SIDE? Asked of the SOURCE, not of the strip.
//
// `raw-strip.mjs` prints that 24 of the wave's files differ after `stripComments`, and the easy
// reading of "leftover empty lines from shortened own-line comments" is that the draft carries
// blank lines the cut left behind. It does not. The stripper replaces a line comment with a space
// and KEEPS the newline, so a `//` run that loses lines loses whitespace-only lines from its
// strip: the extra blank lines are in the ORIGINAL's strip, and the draft is the shorter side.
// This measures the source directly so the direction is read rather than inferred, and answers
// the only question that decides what to do about it: is there anything here to remove.
//
//   WAVE=4 node scratchpad/blank-lines.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "../scripts/lib/strip-comments.mjs";
import { FILES } from "./wave.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const show = (f) => execFileSync("git", ["-C", REPO, "show", `origin/main:${f}`], { encoding: "utf8", maxBuffer: 32e6 });

/** Lengths of each run of consecutive blank source lines, in order. */
function blankRuns(src) {
  const runs = [];
  let n = 0;
  for (const line of src.split("\n")) {
    if (line.trim() === "") n += 1;
    else if (n) {
      runs.push(n);
      n = 0;
    }
  }
  if (n) runs.push(n);
  return runs;
}

let more = 0;
let longer = 0;
let differing = 0;
for (const file of FILES) {
  const before = show(file);
  const after = readFileSync(join(REPO, file), "utf8");
  if (stripComments(before) === stripComments(after)) continue;
  differing += 1;
  const rb = blankRuns(before);
  const ra = blankRuns(after);
  const tb = rb.reduce((x, y) => x + y, 0);
  const ta = ra.reduce((x, y) => x + y, 0);
  const mb = Math.max(0, ...rb);
  const ma = Math.max(0, ...ra);
  if (ta > tb) more += 1;
  if (ma > mb) longer += 1;
  console.log(`${file}  blank lines ${tb} -> ${ta}  runs ${rb.length} -> ${ra.length}  longest ${mb} -> ${ma}`);
}
console.log(`\n${differing} file(s) differ under the raw strip`);
console.log(`draft carries MORE blank source lines than main: ${more}`);
console.log(`draft carries a LONGER blank run than main: ${longer}`);
console.log(more || longer ? "so there is something to remove" : "so there is nothing on the draft side to remove");
