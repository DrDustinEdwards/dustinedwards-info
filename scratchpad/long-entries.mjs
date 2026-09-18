// Which decisions still carry a multi-line replacement, worst first. Wave 1's surviving block
// is one line, so this is the work list for a re-cut.
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const chunk = process.argv[2];
const minLines = Number(process.argv[3] ?? 3);
const d = (await import(pathToFileURL(join(HERE, "code-decisions-wave2", `${chunk}.mjs`)).href)).default;

const rows = [];
for (const [k, v] of Object.entries(d)) {
  if (v.length !== 3 || typeof v[2] !== "string") continue;
  const lines = v[2].split("\n").length;
  if (lines >= minLines) rows.push({ k, lines, bytes: Buffer.byteLength(v[2]) });
}
rows.sort((a, b) => b.bytes - a.bytes);
let total = 0;
for (const r of rows) {
  total += r.bytes;
  console.log(`${r.lines}L\t${r.bytes}b\t${r.k}`);
}
console.log(`\n${rows.length} entries of ${minLines}+ lines, ${total} bytes of replacement prose`);
