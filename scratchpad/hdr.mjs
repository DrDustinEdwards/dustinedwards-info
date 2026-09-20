import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "code-decisions-wave2");
const d = {};
for (const n of readdirSync(DIR).filter((x) => x.endsWith(".mjs")).sort()) {
  Object.assign(d, (await import(pathToFileURL(join(DIR, n)).href)).default);
}
const rows = [];
for (const [k, v] of Object.entries(d)) {
  if (v.length !== 3 || typeof v[2] !== "string") continue;
  const n = Buffer.byteLength(v[2]);
  if (k.endsWith("#0") && n >= 700) rows.push([n, k]);
}
rows.sort((a, b) => b[0] - a[0]);
let t = 0;
for (const [n, k] of rows) { t += n; console.log(`${n}\t${k}`); }
console.log(`\n${rows.length} headers over 700b, ${t} bytes`);
