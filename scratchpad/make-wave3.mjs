// Builds scratchpad/code-wave3.mjs: the file list largest-comment-first, and a chunk table
// balanced by COMMENT BYTES rather than by file count.
//
// Balanced by bytes because that is what a chunk costs to read and rewrite: wave 2's chunks were
// cut by file count and ran from 27 to 181 blocks, so one chunk was seven times another's work.
//
//   node scratchpad/make-wave3.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

const md = readFileSync(join(HERE, "code-history-waves-2-4.md"), "utf8");
const section = md.slice(md.indexOf("## WAVE 3:"), md.indexOf("## WAVE 4:") >= 0 ? md.indexOf("## WAVE 4:") : undefined);
const files = [...section.matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]);

const rows = files.map((file) => {
  const src = readFileSync(join(REPO, file), "utf8");
  const blocks = commentBlocks(src);
  const comment = blocks.reduce((n, b) => n + Buffer.byteLength(b.text), 0);
  return { file, bytes: Buffer.byteLength(src), comment, blocks: blocks.length };
});
rows.sort((a, b) => b.comment - a.comment);

const total = rows.reduce((n, r) => n + r.comment, 0);
const blocks = rows.reduce((n, r) => n + r.blocks, 0);

// One chunk per roughly equal slice of comment bytes. The target is what a single pass can hold:
// wave 2's readable chunks were the ones near 50 KB.
const TARGET = 50_000;
const chunks = {};
let n = 1;
let acc = 0;
let current = [];
for (const r of rows) {
  if (acc > 0 && acc + r.comment > TARGET) {
    chunks[String(n)] = current;
    n += 1;
    acc = 0;
    current = [];
  }
  current.push([r.file, 0, Math.max(0, r.blocks - 1)]);
  acc += r.comment;
}
if (current.length) chunks[String(n)] = current;

const lines = [
  "// Ruling 115, wave 3: workers/**/*.ts and app/**/*.ts, largest comment bytes first",
  `// (re-measured at fda6ef1: ${rows.length} files, ${rows.reduce((s, r) => s + r.bytes, 0)} bytes,`,
  `// ${total} comment, ${blocks} blocks).`,
  "export const WAVE3 = [",
  ...rows.map((r) => `  ${JSON.stringify(r.file)},`),
  "];",
  "",
  "// Chunks balanced by COMMENT BYTES, not by file count: a chunk's cost is what it holds to",
  "// read and rewrite, and wave 2's count-balanced chunks ran from 27 to 181 blocks.",
  "export const CHUNKS = {",
  ...Object.entries(chunks).map(
    ([k, spans]) => `  ${JSON.stringify(k)}: [\n${spans.map((s) => `    ${JSON.stringify(s)},`).join("\n")}\n  ],`,
  ),
  "};",
  "",
  "/** The share of comment bytes the wave aims to keep. Waves 1 and 2 both used this. */",
  "export const KEEP_SHARE = 0.19;",
  "",
];
writeFileSync(join(HERE, "code-wave3.mjs"), lines.join("\n"), "utf8");

console.log(`${rows.length} files, ${total} comment bytes, ${blocks} blocks, ${Object.keys(chunks).length} chunks`);
for (const [k, spans] of Object.entries(chunks)) {
  const c = spans.reduce((s, [f]) => s + rows.find((r) => r.file === f).comment, 0);
  const b = spans.reduce((s, [f]) => s + rows.find((r) => r.file === f).blocks, 0);
  console.log(`  chunk ${k}: ${spans.length} files, ${c} comment bytes, ${b} blocks`);
}
