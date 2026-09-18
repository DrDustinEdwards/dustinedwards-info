import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];
const chunk = process.argv[3];
const flat = (s) => s.replace(/\//g, "__");
const src = readFileSync(join(HERE, "code-history-before-wave2", flat(file)), "utf8");
const blocks = commentBlocks(src).map((b, id) => ({ ...b, id }));
const mod = await import(pathToFileURL(join(HERE, "code-decisions-wave2", `${chunk}.mjs`)).href);
const d = mod.default;
const leadOf = (b) => { const ls = src.lastIndexOf("\n", b.start - 1) + 1; return src.slice(ls, b.start).match(/^[ \t]*/)[0]; };
function render(b, repl) {
  const lead = leadOf(b);
  const lines = repl.split("\n");
  if (b.kind === "line") return lines.map((l, i) => `${i === 0 ? "" : lead}//${l ? " " + l : ""}`).join("\n");
  const open = b.text.startsWith("/**") ? "/**" : "/*";
  if (lines.length === 1) return `${open} ${lines[0]} */`;
  return [open, ...lines.map((l) => `${lead} *${l ? " " + l : ""}`), `${lead} */`].join("\n");
}
const rows = [];
for (const b of blocks) {
  const dec = d[`${file}#${b.id}`];
  const before = Buffer.byteLength(b.text);
  let after = before, kind = dec ? (dec.length === 3 ? (dec[2] === null ? "delete" : "rewrite") : "keep") : "auto";
  if (dec && dec.length === 3) after = dec[2] === null ? 0 : Buffer.byteLength(render(b, dec[2]));
  rows.push({ id: b.id, before, after, saved: before - after, kind });
}
rows.sort((a, c) => c.before - a.before);
console.log("id\tbefore\tafter\tsaved\tkind");
for (const r of rows.slice(0, 30)) console.log(`${r.id}\t${r.before}\t${r.after}\t${r.saved}\t${r.kind}`);
const sum = (k, f) => rows.filter((r) => !k || r.kind === k).reduce((a, r) => a + f(r), 0);
console.log(`\nTOTAL before ${sum(null, r=>r.before)} after ${sum(null, r=>r.after)}`);
for (const k of ["auto","keep","rewrite","delete"]) console.log(`${k}: n=${rows.filter(r=>r.kind===k).length} before ${sum(k,r=>r.before)} after ${sum(k,r=>r.after)}`);
