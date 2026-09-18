// Of the blocks carrying no decision, how many the tooling classifies itself and how many are
// simply not decided yet. The first is a floor the tail pass cannot cut into; the second is work.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { WAVE2 } from "./code-wave2.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (s) => s.replace(/\//g, "__");
const JSDOC_HEAD =
  /@(?:param|returns?|type|typedef|template|property|prop|callback|satisfies|import|enum|throws|see|deprecated|this|overload|extends|implements)\b(?:\s*\{[^\n]*\})?(?:\s+\[?[\w.$]+(?:=[^\]\s]*)?\]?)?/g;
const DIRECTIVE = /oxlint-|eslint-|@ts-|#__PURE__|@vite-ignore|<reference|prettier-ignore|c8 ignore|istanbul/;
const heads = (t) => t.match(JSDOC_HEAD) ?? [];

function proseOf(text) {
  if (text.startsWith("//")) return text.split("\n").map((l) => l.replace(/^\s*\/\/ ?/, "")).join("\n");
  return text.replace(/^\/\*\*?/, "").replace(/\*\/$/, "").split("\n").map((l) => l.replace(/^\s*\* ?/, "")).join("\n").trim();
}

function automatic(b) {
  if (DIRECTIVE.test(b.text) && b.endLine - b.line < 3) return true;
  const stripped = proseOf(b.text).replace(JSDOC_HEAD, "").replace(/[\s{}()[\]<>.,|:;'"`*?=]/g, "");
  return heads(b.text).length > 0 && stripped.length === 0;
}

const d = {};
for (const n of readdirSync(join(HERE, "code-decisions-wave2")).filter((x) => x.endsWith(".mjs")).sort()) {
  Object.assign(d, (await import(pathToFileURL(join(HERE, "code-decisions-wave2", n)).href)).default);
}

let ca = 0;
let cb = 0;
let ua = 0;
let ub = 0;
for (const f of WAVE2) {
  const src = readFileSync(join(HERE, "code-history-before-wave2", flat(f)), "utf8");
  commentBlocks(src).forEach((b, id) => {
    if (d[`${f}#${id}`]) return;
    if (automatic(b)) {
      ca += 1;
      cb += Buffer.byteLength(b.text);
    } else {
      ua += 1;
      ub += Buffer.byteLength(b.text);
    }
  });
}
console.log(`classified ${ca} blocks ${cb}b | undecided ${ua} blocks ${ub}b`);
