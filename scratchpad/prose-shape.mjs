// Where the surviving prose bytes sit after the tail pass: the file headers, the JSDoc lines a
// rewrite may not touch, and everything else. The three want different treatment, so a single
// bytes-per-block average cannot say whether another pass is worth running.
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const d = {};
for (const n of readdirSync(join(HERE, "code-decisions-wave2")).filter((x) => x.endsWith(".mjs")).sort()) {
  Object.assign(d, (await import(pathToFileURL(join(HERE, "code-decisions-wave2", n)).href)).default);
}

const tally = { header: [0, 0], jsdoc: [0, 0], body: [0, 0] };
const rows = [];
for (const [k, v] of Object.entries(d)) {
  if (v.length !== 3 || typeof v[2] !== "string") continue;
  const isHeader = k.endsWith("#0");
  let jsdoc = 0;
  let body = 0;
  let inTag = false;
  for (const line of v[2].split("\n")) {
    if (/^\s*@\w/.test(line)) inTag = true;
    else if (inTag && /^\s*[}\]]|^\s{2,}\S/.test(line)) void 0;
    else if (line.trim() === "") void 0;
    else inTag = false;
    (inTag ? (jsdoc += line.length + 1) : (body += line.length + 1));
  }
  tally.jsdoc[0] += 1;
  tally.jsdoc[1] += jsdoc;
  const slot = isHeader ? "header" : "body";
  tally[slot][0] += 1;
  tally[slot][1] += body;
  rows.push({ k, n: Buffer.byteLength(v[2]), isHeader });
}

console.log(`headers ${tally.header[0]} blocks, ${tally.header[1]}b of prose (${Math.round(tally.header[1] / Math.max(1, tally.header[0]))} each)`);
console.log(`bodies  ${tally.body[0]} blocks, ${tally.body[1]}b of prose (${Math.round(tally.body[1] / Math.max(1, tally.body[0]))} each)`);
console.log(`jsdoc lines inside all of them: ${tally.jsdoc[1]}b`);
rows.sort((a, b) => b.n - a.n);
console.log("\nheaviest:");
for (const r of rows.slice(0, 25)) console.log(`  ${r.n}b\t${r.k}`);
