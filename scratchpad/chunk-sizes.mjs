import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { CHUNKS } from "./code-wave2.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");
const cache = new Map();
const blocksOf = (f) => {
  if (!cache.has(f)) cache.set(f, commentBlocks(readFileSync(join(HERE, "code-history-before-wave2", flat(f)), "utf8")));
  return cache.get(f);
};
console.log("chunk\tblocks\tbytes\tmean\t<=200b share of bytes");
let smallBytes = 0, allBytes = 0, smallN = 0, allN = 0;
for (const [n, spec] of Object.entries(CHUNKS)) {
  const spans = Array.isArray(spec[0]) ? spec : [spec];
  let bytes = 0, count = 0, small = 0;
  for (const [file, from, to] of spans) {
    blocksOf(file).forEach((b, id) => {
      if (id < from || id > to) return;
      const n = Buffer.byteLength(b.text);
      bytes += n; count += 1;
      if (n <= 200) small += n;
    });
  }
  if (Number(n) > 3) { smallBytes += small; allBytes += bytes; smallN += count; }
  allN += count;
  console.log(`${n}\t${count}\t${bytes}\t${Math.round(bytes / count)}\t${((100 * small) / bytes).toFixed(1)}%`);
}
console.log(`\nchunks 4-19: ${smallN} blocks, ${allBytes} bytes, ${((100 * smallBytes) / allBytes).toFixed(1)}% of bytes in blocks of 200b or less`);
