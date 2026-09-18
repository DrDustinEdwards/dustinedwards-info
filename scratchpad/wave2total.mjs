import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { WAVE2 } from "./code-wave2.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");
let n = 0, b = 0;
for (const f of WAVE2) {
  const src = readFileSync(join(HERE, "code-history-before-wave2", flat(f)), "utf8");
  for (const x of commentBlocks(src)) { n += 1; b += Buffer.byteLength(x.text); }
}
console.log(`wave 2: ${WAVE2.length} files, ${n} blocks, ${b} comment bytes; 20% = ${Math.round(b*0.2)}; at 76 b/block = ${n*76}`);
