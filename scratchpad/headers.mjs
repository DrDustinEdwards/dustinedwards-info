// Every file header decision as it stands, with the tokens a rewrite must carry through.
//
// The header pass is one judgement applied 93 times, so it needs the headers side by side
// rather than a chunk at a time: worklist.mjs answers "what is long in this chunk" and this
// answers "what does every header say".
//
//   node scratchpad/headers.mjs [from] [count]
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { WAVE2 } from "./code-wave2.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");
const JSDOC_HEAD =
  /@(?:param|returns?|type|typedef|template|property|prop|callback|satisfies|import|enum|throws|see|deprecated|this|overload|extends|implements)\b(?:\s*\{[^\n]*\})?(?:\s+\[?[\w.$]+(?:=[^\]\s]*)?\]?)?/g;
const CITATION = /hard rules? ((?:\d+)(?:\s*(?:,|and)\s*\d+)*)/gi;
const heads = (t) => (t.match(JSDOC_HEAD) ?? []).map((h) => h.replace(/\s+/g, " ").trim());
const cites = (t) => [...t.matchAll(CITATION)].flatMap((m) => m[1].split(/[^\d]+/).filter(Boolean));

const d = {};
for (const n of readdirSync(join(HERE, "code-decisions-wave2")).filter((x) => x.endsWith(".mjs")).sort()) {
  Object.assign(d, (await import(pathToFileURL(join(HERE, "code-decisions-wave2", n)).href)).default);
}

const from = Number(process.argv[2] ?? 0);
const count = Number(process.argv[3] ?? 999);
const keys = WAVE2.map((f) => `${f}#0`).filter((k) => d[k]?.length === 3 && typeof d[k][2] === "string");
let total = 0;
for (const key of keys.slice(from, from + count)) {
  const file = key.slice(0, -2);
  const src = readFileSync(join(HERE, "code-history-before-wave2", flat(file)), "utf8");
  const block = commentBlocks(src)[0];
  const must = [...heads(block.text).map((h) => `HEAD ${h}`), ...cites(block.text).map((c) => `CITE ${c}`)];
  const bytes = Buffer.byteLength(d[key][2]);
  total += bytes;
  console.log(`\n=== ${key}  ${bytes}b${must.length ? `  ${must.join(" | ")}` : ""}`);
  console.log(d[key][2]);
}
console.log(`\n--- ${keys.length} headers total, ${total} bytes in this slice`);
