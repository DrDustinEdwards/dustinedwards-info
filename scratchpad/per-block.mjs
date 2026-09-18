// Bytes of comment left per block, wave 1 against wave 2's decided chunks.
//
// The ratio metrics mislead when the originals differ in size: a 5 KB header and a 900 byte
// header both compress to about the same floor, so the big one reports 8% and the small one
// 30% for identical editing. Bytes per surviving block does not have that problem, and it is
// the number to steer a re-cut by.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { WAVE1 } from "./code-wave1.mjs";
import { CHUNKS } from "./code-wave2.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");

function renderer(src) {
  const leadOf = (b) => {
    const ls = src.lastIndexOf("\n", b.start - 1) + 1;
    return src.slice(ls, b.start).match(/^[ \t]*/)[0];
  };
  return (b, repl) => {
    const lead = leadOf(b);
    const lines = repl.split("\n");
    if (b.kind === "line") return lines.map((l, i) => `${i === 0 ? "" : lead}//${l ? " " + l : ""}`).join("\n");
    const open = b.text.startsWith("/**") ? "/**" : "/*";
    if (lines.length === 1) return `${open} ${lines[0]} */`;
    return [open, ...lines.map((l) => `${lead} *${l ? " " + l : ""}`), `${lead} */`].join("\n");
  };
}

async function tally(files, decisionsDir, beforeDir, only) {
  const d = {};
  for (const n of readdirSync(join(HERE, decisionsDir)).filter((n) => n.endsWith(".mjs")).sort()) {
    if (only && n !== `${only}.mjs`) continue;
    Object.assign(d, (await import(pathToFileURL(join(HERE, decisionsDir, n)).href)).default);
  }
  let blocks = 0;
  let after = 0;
  let before = 0;
  for (const f of files) {
    const p = join(HERE, beforeDir, flat(f));
    if (!existsSync(p)) continue;
    const src = readFileSync(p, "utf8");
    const render = renderer(src);
    commentBlocks(src).forEach((b, id) => {
      const dec = d[`${f}#${id}`];
      if (only && !dec) return;
      const bb = Buffer.byteLength(b.text);
      const aa = dec && dec.length === 3 ? (dec[2] === null ? 0 : Buffer.byteLength(render({ ...b, id }, dec[2]))) : bb;
      blocks += 1;
      before += bb;
      after += aa;
    });
  }
  return { blocks, before, after };
}

const w1 = await tally(WAVE1, "code-decisions", "code-history-before", null);
console.log(`wave 1   ${w1.blocks} blocks, ${w1.before} -> ${w1.after}  (${Math.round(w1.after / w1.blocks)} bytes per block, ${((100 * w1.after) / w1.before).toFixed(1)}%)`);

for (const n of ["1", "2", "3", "4"]) {
  const files = [...new Set((Array.isArray(CHUNKS[n][0]) ? CHUNKS[n] : [CHUNKS[n]]).map((s) => s[0]))];
  const c = await tally(files, "code-decisions-wave2", "code-history-before-wave2", n);
  console.log(`chunk ${n}  ${c.blocks} blocks, ${c.before} -> ${c.after}  (${Math.round(c.after / c.blocks)} bytes per block, ${((100 * c.after) / c.before).toFixed(1)}%)`);
}
