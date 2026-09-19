// Every block of a chunk as id, bytes and prose, with one line of following code for context.
// The full `dump` mode prints three lines of context per block, which is what a first reading
// wants and what makes a 170-block chunk unreadable in one pass.
//
//   node scratchpad/dump-compact.mjs <chunk>
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { CHUNKS, BEFORE, flat } from "./wave.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const chunk = process.argv[2];
const spec = CHUNKS[chunk];
const spans = Array.isArray(spec[0]) ? spec : [spec];

const JSDOC = /@(?:param|returns?|type|typedef|template|property|prop|callback|satisfies|import|enum|throws|see|deprecated|this|overload|extends|implements)\b/;
const DIRECTIVE = /oxlint-|eslint-|@ts-|#__PURE__|@vite-ignore|<reference|prettier-ignore|c8 ignore|istanbul/;

const prose = (t) =>
  t.startsWith("//")
    ? t.split("\n").map((l) => l.replace(/^\s*\/\/ ?/, "")).join("\n")
    : t.replace(/^\/\*\*?/, "").replace(/\*\/$/, "").split("\n").map((l) => l.replace(/^\s*\* ?/, "")).join("\n").trim();

let total = 0;
for (const [file, from, to] of spans) {
  const src = readFileSync(join(BEFORE, flat(file)), "utf8");
  console.log(`\n@@@@@ ${file}`);
  commentBlocks(src).forEach((b, id) => {
    if (id < from || id > to) return;
    const p = prose(b.text);
    const n = Buffer.byteLength(b.text);
    total += n;
    // A block that is only a type annotation or a tool directive is classified by the tooling.
    const auto = (JSDOC.test(p) && p.replace(/@\w+[^\n]*/g, "").trim() === "") || DIRECTIVE.test(b.text);
    const next = src.slice(b.end).split("\n").slice(b.ownLine ? 1 : 0, b.ownLine ? 2 : 1).join("").trim();
    console.log(`\n#${id} ${n}b${auto ? " AUTO" : ""}${b.ownLine ? "" : " TRAILING"} >> ${next.slice(0, 90)}`);
    console.log(p);
  });
}
console.log(`\n@@@@@ chunk ${chunk}: ${total} comment bytes`);
