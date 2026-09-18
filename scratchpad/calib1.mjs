import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");
const d = {};
for (const n of readdirSync(join(HERE, "code-decisions")).filter(n=>n.endsWith(".mjs")).sort())
  Object.assign(d, (await import(pathToFileURL(join(HERE, "code-decisions", n)).href)).default);
const prose = (t) => t.startsWith("//") ? t.split("\n").map(l=>l.replace(/^\s*\/\/ ?/,"")).join("\n")
  : t.replace(/^\/\*\*?/,"").replace(/\*\/$/,"").split("\n").map(l=>l.replace(/^\s*\* ?/,"")).join("\n").trim();
const file = process.argv[2];
const minBytes = Number(process.argv[3] ?? 900);
const want = Number(process.argv[4] ?? 3);
const src = readFileSync(join(HERE, "code-history-before", flat(file)), "utf8");
let shown = 0;
commentBlocks(src).forEach((b, id) => {
  if (shown >= want) return;
  const dec = d[`${file}#${id}`];
  const n = Buffer.byteLength(b.text);
  if (n < minBytes || !dec || dec.length !== 3 || dec[2] === null) return;
  shown += 1;
  console.log(`\n##### ${file}#${id}  ${n}b -> ${Buffer.byteLength(dec[2])}b  (${((100*Buffer.byteLength(dec[2]))/n).toFixed(0)}%)`);
  console.log("--- BEFORE ---\n" + prose(b.text));
  console.log("--- AFTER ---\n" + dec[2]);
});
