// The tail pass's work list: every decision whose replacement is over a byte threshold, with the
// text as it stands and the tokens the rewrite must carry through.
//
// Reading the decisions file itself costs several times as much, because the file is mostly
// reasons and punctuation. This prints the prose and nothing else.
//
//   node scratchpad/worklist.mjs <chunk> [minBytes]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { CHUNKS, BEFORE, DECISIONS, flat } from "./wave.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const JSDOC_HEAD =
  /@(?:param|returns?|type|typedef|template|property|prop|callback|satisfies|import|enum|throws|see|deprecated|this|overload|extends|implements)\b(?:\s*\{[^\n]*\})?(?:\s+\[?[\w.$]+(?:=[^\]\s]*)?\]?)?/g;
const CITATION = /hard rules? ((?:\d+)(?:\s*(?:,|and)\s*\d+)*)/gi;
const heads = (t) => (t.match(JSDOC_HEAD) ?? []).map((h) => h.replace(/\s+/g, " ").trim());
const cites = (t) => [...t.matchAll(CITATION)].flatMap((m) => m[1].split(/[^\d]+/).filter(Boolean));

const chunk = process.argv[2];
const min = Number(process.argv[3] ?? 160);
const d = (await import(pathToFileURL(join(DECISIONS, `${chunk}.mjs`)).href)).default;
const spans = Array.isArray(CHUNKS[chunk][0]) ? CHUNKS[chunk] : [CHUNKS[chunk]];
const blocks = {};
for (const file of [...new Set(spans.map((s) => s[0]))]) {
  const src = readFileSync(join(BEFORE, flat(file)), "utf8");
  commentBlocks(src).forEach((b, id) => (blocks[`${file}#${id}`] = b));
}

let over = 0;
let total = 0;
for (const [k, v] of Object.entries(d)) {
  const b = Buffer.byteLength(v.length === 3 && typeof v[2] === "string" ? v[2] : "");
  total += b;
  if (b < min) continue;
  over += b;
  const src = blocks[k] ? blocks[k].text : "";
  const must = [...heads(src).map((h) => `HEAD ${h}`), ...cites(src).map((c) => `CITE ${c}`)];
  console.log(`\n=== ${k}  ${b}b  [${v[0]}] ${must.length ? must.join(" | ") : ""}`);
  console.log(v[2]);
}
console.log(`\n--- ${total} bytes of prose, ${over} in entries over ${min}b`);
