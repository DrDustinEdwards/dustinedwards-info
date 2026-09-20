import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2], chunk = process.argv[3];
const flat = (s) => s.replace(/\//g, "__");
const src = readFileSync(join(HERE, "code-history-before-wave2", flat(file)), "utf8");
const blocks = commentBlocks(src).map((b, id) => ({ ...b, id }));
const d = (await import(pathToFileURL(join(HERE, "code-decisions-wave2", `${chunk}.mjs`)).href)).default;
const prose = (t) => t.startsWith("//") ? t.split("\n").map(l=>l.replace(/^\s*\/\/ ?/,"")).join("\n")
  : t.replace(/^\/\*\*?/,"").replace(/\*\/$/,"").split("\n").map(l=>l.replace(/^\s*\* ?/,"")).join("\n").trim();
for (const id of process.argv.slice(4).map(Number)) {
  const b = blocks[id], dec = d[`${file}#${id}`];
  const p = prose(b.text);
  console.log(`\n##### ${id}: ${p.split("\n").length} prose lines -> ${dec && dec[2] ? dec[2].split("\n").length : "KEPT"} lines`);
  console.log("--- BEFORE ---\n" + p);
  if (dec && dec[2]) console.log("--- AFTER ---\n" + dec[2]);
}
