import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { WAVE1 } from "./code-wave1.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");
const BEFORE = join(HERE, "code-history-before");
if (!existsSync(BEFORE)) { console.log("no wave 1 before/ dir on disk (gitignored); using committed sources"); }
const d = {};
for (const n of readdirSync(join(HERE, "code-decisions")).filter(n=>n.endsWith(".mjs")).sort())
  Object.assign(d, (await import(pathToFileURL(join(HERE, "code-decisions", n)).href)).default);
let big=0, ba=0, tail=0, ta=0;
for (const f of WAVE1) {
  const p = join(BEFORE, flat(f));
  if (!existsSync(p)) continue;
  const src = readFileSync(p, "utf8");
  const leadOf = (b) => { const ls = src.lastIndexOf("\n", b.start-1)+1; return src.slice(ls, b.start).match(/^[ \t]*/)[0]; };
  const render = (b,r) => { const lead=leadOf(b), lines=r.split("\n");
    if (b.kind==="line") return lines.map((l,i)=>`${i===0?"":lead}//${l?" "+l:""}`).join("\n");
    const open=b.text.startsWith("/**")?"/**":"/*";
    if (lines.length===1) return `${open} ${lines[0]} */`;
    return [open,...lines.map(l=>`${lead} *${l?" "+l:""}`),`${lead} */`].join("\n"); };
  commentBlocks(src).forEach((b,id) => {
    const dec = d[`${f}#${id}`];
    const before = Buffer.byteLength(b.text);
    const after = dec && dec.length===3 ? (dec[2]===null?0:Buffer.byteLength(render({...b,id},dec[2]))) : before;
    if (before >= 600) { big+=before; ba+=after; } else { tail+=before; ta+=after; }
  });
}
if (big+tail === 0) { console.log("wave 1 snapshot unavailable"); process.exit(0); }
console.log(`WAVE 1 big(>=600b) ${big} -> ${ba} (${((100*ba)/big).toFixed(0)}%)   share of comment ${((100*big)/(big+tail)).toFixed(0)}%`);
console.log(`WAVE 1 tail(<600b) ${tail} -> ${ta} (${((100*ta)/tail).toFixed(0)}%)`);
console.log(`WAVE 1 total ${big+tail} -> ${ba+ta} (${((100*(ba+ta))/(big+tail)).toFixed(1)}%)`);
