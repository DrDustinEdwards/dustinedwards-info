import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { WAVE2 } from "./code-wave2.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");
const DONE = new Set(WAVE2.slice(0, 4));
let big = 0, tail = 0, bigDone = 0, tailDone = 0;
for (const f of WAVE2) {
  for (const b of commentBlocks(readFileSync(join(HERE, "code-history-before-wave2", flat(f)), "utf8"))) {
    const n = Buffer.byteLength(b.text);
    if (DONE.has(f)) { if (n >= 600) bigDone += n; else tailDone += n; }
    else if (n >= 600) big += n; else tail += n;
  }
}
const total = big + tail + bigDone + tailDone;
console.log(`wave 2 comment ${total}`);
console.log(`  chunks 1-4: big ${bigDone}, tail ${tailDone} (big share ${((100*bigDone)/(bigDone+tailDone)).toFixed(0)}%)`);
console.log(`  remaining:  big ${big}, tail ${tail} (big share ${((100*big)/(big+tail)).toFixed(0)}%)`);
// Achieved so far, and the floor if the rest matches the best rates seen.
const keptSoFar = 22434 + 24459 + 24224 + 22753;
for (const [bigRate, tailRate, label] of [[0.45, 0.80, "at chunk 1's big-block rate and the observed tail"], [0.38, 0.70, "at chunk 1's rates exactly, both halves"]]) {
  const rest = big * bigRate + tail * tailRate;
  const waveKept = keptSoFar + rest;
  console.log(`${label}: remaining -> ${Math.round(rest)}, wave -> ${Math.round(waveKept)} = ${((100*waveKept)/total).toFixed(1)}% of comment`);
}
console.log(`\n19% budget is ${Math.round(total * 0.19)} bytes of comment.`);
