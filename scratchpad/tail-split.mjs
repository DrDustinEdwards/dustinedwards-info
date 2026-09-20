import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");
const jobs = [["scripts/check-policy.mjs","1"],["scripts/check-headers.mjs","2"],["scripts/check-page-payload.mjs","3"],["scripts/check-publications.mjs","4"]];
console.log("chunk\tbig(>=600b) before->after\ttail(<600b) before->after");
for (const [file, chunk] of jobs) {
  const src = readFileSync(join(HERE, "code-history-before-wave2", flat(file)), "utf8");
  const blocks = commentBlocks(src).map((b, id) => ({ ...b, id }));
  const d = (await import(pathToFileURL(join(HERE, "code-decisions-wave2", `${chunk}.mjs`)).href)).default;
  const leadOf = (b) => { const ls = src.lastIndexOf("\n", b.start - 1) + 1; return src.slice(ls, b.start).match(/^[ \t]*/)[0]; };
  const render = (b, r) => { const lead = leadOf(b), lines = r.split("\n");
    if (b.kind === "line") return lines.map((l,i)=>`${i===0?"":lead}//${l?" "+l:""}`).join("\n");
    const open = b.text.startsWith("/**") ? "/**" : "/*";
    if (lines.length === 1) return `${open} ${lines[0]} */`;
    return [open, ...lines.map(l=>`${lead} *${l?" "+l:""}`), `${lead} */`].join("\n"); };
  let bb=0, ba=0, tb=0, ta=0;
  for (const b of blocks) {
    const dec = d[`${file}#${b.id}`];
    const before = Buffer.byteLength(b.text);
    const after = dec && dec.length === 3 ? (dec[2] === null ? 0 : Buffer.byteLength(render(b, dec[2]))) : before;
    if (before >= 600) { bb += before; ba += after; } else { tb += before; ta += after; }
  }
  console.log(`${chunk}\t${bb} -> ${ba} (${((100*ba)/bb).toFixed(0)}%)\t\t${tb} -> ${ta} (${((100*ta)/tb).toFixed(0)}%)`);
}
