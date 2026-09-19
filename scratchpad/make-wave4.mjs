// Builds scratchpad/code-wave4.mjs: the file list largest-comment-first, and a chunk table
// balanced by COMMENT BYTES rather than by file count, the same way wave 3 was built.
//
// Measured from DISK at the wave's own base, never from the plan document's figures: the plan
// counted at cdb4300 and PR #43 has edited playground.tsx since, so a carried number would
// describe a tree that no longer exists.
//
//   node scratchpad/make-wave4.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

const md = readFileSync(join(HERE, "code-history-waves-2-4.md"), "utf8");
const start = md.indexOf("## WAVE 4:");
if (start < 0) throw new Error("no WAVE 4 section in code-history-waves-2-4.md");
const next = md.indexOf("\n## ", start + 1);
const section = next >= 0 ? md.slice(start, next) : md.slice(start);
const files = [...section.matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]);
if (files.length === 0) throw new Error("WAVE 4 section listed no files");

const rows = files.map((file) => {
  const src = readFileSync(join(REPO, file), "utf8");
  const blocks = commentBlocks(src);
  const comment = blocks.reduce((n, b) => n + Buffer.byteLength(b.text), 0);
  return { file, bytes: Buffer.byteLength(src), comment, blocks: blocks.length };
});
rows.sort((a, b) => b.comment - a.comment);

const total = rows.reduce((n, r) => n + r.comment, 0);
const blocks = rows.reduce((n, r) => n + r.blocks, 0);

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
  "// Ruling 115, wave 4: app/**/*.tsx, largest comment bytes first",
  `// (re-measured at e3fc98a: ${rows.length} files, ${rows.reduce((s, r) => s + r.bytes, 0)} bytes,`,
  `// ${total} comment, ${blocks} blocks).`,
  "export const WAVE4 = [",
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
  "/**",
  " * The share of comment bytes this wave aims to keep, back to the waves 1 and 2 target.",
  " *",
  " * Wave 3 raised it to 0.4 because runtime .ts files carry the prohibitions and the boundary",
  " * statements. These are .tsx: markup with a render underneath it, carrying far fewer of",
  " * either, which is the case wave 3's own module already wrote down for this wave.",
  " */",
  "export const KEEP_SHARE = 0.19;",
  "",
  "/** What this wave covers and where it was measured, for the history document's header. */",
  'export const BASE = "e3fc98a";',
  `export const SCOPE = "the ${rows.length} files under app/ ending in .tsx";`,
  "",
];
writeFileSync(join(HERE, "code-wave4.mjs"), lines.join("\n"), "utf8");

console.log(`${rows.length} files, ${total} comment bytes, ${blocks} blocks, ${Object.keys(chunks).length} chunks`);
for (const [k, spans] of Object.entries(chunks)) {
  const c = spans.reduce((s, [f]) => s + rows.find((r) => r.file === f).comment, 0);
  const b = spans.reduce((s, [f]) => s + rows.find((r) => r.file === f).blocks, 0);
  console.log(`  chunk ${k}: ${spans.length} files, ${c} comment bytes, ${b} blocks`);
}
