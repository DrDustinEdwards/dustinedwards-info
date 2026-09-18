// One-shot: replace "section marker; kept byte-identical" keeps with a rewrite to the bare
// label, which is what wave 1 did with rule-padded separators (80 bytes of dashes to 7).
// Usage: node scratchpad/cut-markers.mjs <decisions-file> <file-key>
import { readFileSync, writeFileSync } from "node:fs";
import { commentBlocks } from "./code-blocks.mjs";

const [decisionsPath, fileKey] = process.argv.slice(2);
const flat = (s) => s.replace(/\//g, "__");
const src = readFileSync(`scratchpad/code-history-before-wave2/${flat(fileKey)}`, "utf8");

const labels = new Map();
commentBlocks(src).forEach((b, id) => {
  if (!/-{6}/.test(b.text)) return;
  // Strip the comment markers and the run of dashes on either side, keep the label verbatim.
  const label = b.text
    .replace(/^\/\*+/, "")
    .replace(/\*\/$/, "")
    .replace(/-{2,}/g, "")
    .trim();
  if (label) labels.set(id, label);
});

let out = readFileSync(decisionsPath, "utf8");
let done = 0;
for (const [id, label] of labels) {
  const needle = `  "${fileKey}#${id}": ["CONTRACT", "section marker; kept byte-identical"],`;
  if (!out.includes(needle)) {
    console.log(`MISS ${id} (${label})`);
    continue;
  }
  const tick = String.fromCharCode(96);
  out = out.replace(
    needle,
    `  "${fileKey}#${id}": ["CONTRACT", "section marker, rule padding cut", ${tick}${label}${tick}],`,
  );
  done += 1;
}
writeFileSync(decisionsPath, out, "utf8");
console.log(`${fileKey}: rewrote ${done} of ${labels.size} markers`);
