// Rewrite a chunk's decisions from a JSON table, whole entries rather than replacement prose.
//
// `retighten.mjs` edits the third element in place, which cannot change a tag, cannot delete a
// block and cannot reach an entry the tail pass never wrote. The tail pass needs all three, so
// this one regenerates the body of the decisions file from the imported module merged with the
// table, keeping the file's own header comment.
//
// Every changed entry is validated against the SOURCE block before anything is written, and the
// batch is all-or-nothing: citations, JSDoc tag heads, markers, the wrapped-citation trap, the
// column limit and trailing whitespace.
//
//   node scratchpad/recut.mjs <chunk> <edits.json>
//
// Table values: [tag, reason] keeps the block byte-identical, [tag, reason, text] rewrites it,
// null is shorthand for deleting the block and keeps the reason already on file.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { CHUNKS } from "./code-wave2.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TICK = String.fromCharCode(96);
const flat = (s) => s.replace(/\//g, "__");

const JSDOC_HEAD =
  /@(?:param|returns?|type|typedef|template|property|prop|callback|satisfies|import|enum|throws|see|deprecated|this|overload|extends|implements)\b(?:\s*\{[^\n]*\})?(?:\s+\[?[\w.$]+(?:=[^\]\s]*)?\]?)?/g;
const CITATION = /hard rules? ((?:\d+)(?:\s*(?:,|and)\s*\d+)*)/gi;
const DIRECTIVE = /oxlint-|eslint-|@ts-|#__PURE__|@vite-ignore|<reference|prettier-ignore|c8 ignore|istanbul/;
const MARKERS = ["JUSTIFIED SUBSTITUTION"];
const WIDE = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];

const heads = (t) => (t.match(JSDOC_HEAD) ?? []).map((h) => h.replace(/\s+/g, " ").trim()).sort().join("|");
const cites = (t) => [...t.matchAll(CITATION)].flatMap((m) => m[1].split(/[^\d]+/).filter(Boolean)).sort().join(",");

// More than one table may be named, later ones overriding earlier: a fix for a refused entry
// goes in its own file rather than being edited back into a table already written, which keeps
// the first table readable as what was intended and the second as what the validator forced.
const [chunk, ...editPaths] = process.argv.slice(2);
const decPath = join("scratchpad/code-decisions-wave2", `${chunk}.mjs`);
const abs = join(process.cwd(), decPath);
const current = (await import(pathToFileURL(abs).href)).default;
const edits = Object.assign({}, ...editPaths.map((p) => JSON.parse(readFileSync(p, "utf8"))));

// The chunk's blocks, with the lead the apply script measures the column limit against.
const spans = Array.isArray(CHUNKS[chunk][0]) ? CHUNKS[chunk] : [CHUNKS[chunk]];
const blocks = {};
for (const file of [...new Set(spans.map((s) => s[0]))]) {
  const src = readFileSync(join(HERE, "code-history-before-wave2", flat(file)), "utf8");
  commentBlocks(src).forEach((b, id) => {
    const ls = src.lastIndexOf("\n", b.start - 1) + 1;
    blocks[`${file}#${id}`] = { ...b, lead: src.slice(ls, b.start).match(/^[ \t]*/)[0] };
  });
}

const problems = [];
const merged = { ...current };
for (const [key, value] of Object.entries(edits)) {
  const b = blocks[key];
  if (!b) {
    problems.push(`${key}: not a block in this chunk`);
    continue;
  }
  let next = value;
  // A bare string is the tail pass's common case: the tag and the reason already on file are
  // right and only the prose is too long. Retyping them is transcription with a chance of drift.
  if (typeof next === "string") {
    const old = current[key];
    if (!old) {
      problems.push(`${key}: prose-only edit needs an entry already on file`);
      continue;
    }
    next = [old[0], old[1], next];
  }
  if (next === null) {
    const old = current[key];
    if (!old) {
      problems.push(`${key}: delete shorthand needs an entry already on file`);
      continue;
    }
    next = ["HISTORY", old[1], null];
  }
  if (!Array.isArray(next) || next.length < 2 || next.length > 3) {
    problems.push(`${key}: value must be [tag, reason, text?] or null`);
    continue;
  }
  const [tag, reason, repl] = next;
  if (!["WHY", "CONTRACT", "NUMBER", "HISTORY"].includes(tag)) problems.push(`${key}: bad tag ${tag}`);
  if (typeof reason !== "string" || reason.length < 3) problems.push(`${key}: reason missing`);
  if (tag === "HISTORY" && repl !== null) problems.push(`${key}: only null deletes, and only HISTORY deletes`);
  if (repl === null && tag !== "HISTORY") problems.push(`${key}: only HISTORY deletes`);
  const after = repl === undefined ? b.text : repl === null ? "" : repl;
  if (heads(b.text) !== heads(after)) problems.push(`${key}: JSDoc heads ${heads(b.text) || "none"} -> ${heads(after) || "none"}`);
  if (cites(b.text) !== cites(after)) problems.push(`${key}: citations ${cites(b.text) || "none"} -> ${cites(after) || "none"}`);
  for (const m of MARKERS) if (b.text.includes(m) && !after.includes(m)) problems.push(`${key}: marker "${m}" lost`);
  if (DIRECTIVE.test(b.text) && repl !== undefined) problems.push(`${key}: tool directive; keep it byte-identical`);
  if (typeof repl === "string") {
    if (WIDE.some((c) => repl.includes(c))) problems.push(`${key}: wide dash`);
    if (repl.includes("*/")) problems.push(`${key}: closes the comment`);
    if (!b.ownLine && b.kind === "line" && repl.includes("\n")) problems.push(`${key}: trailing // comment must stay one line`);
    if (/\bhard\s*\n\s*rules?\s+\d+/i.test(repl)) problems.push(`${key}: citation wrapped across a line break`);
    if (repl.trim() === "") problems.push(`${key}: empty; use null`);
    for (const l of repl.split("\n")) {
      if (b.lead.length + 3 + l.length > 110) problems.push(`${key}: over 110 columns: ${l.slice(0, 40)}...`);
      if (/\s$/.test(l)) problems.push(`${key}: trailing whitespace`);
    }
  }
  merged[key] = next;
}

if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`${problems.length} problems; wrote nothing`);
  process.exit(1);
}

const lit = (s) => TICK + s.split("\\").join("\\\\").split(TICK).join("\\" + TICK).split("${").join("\\${") + TICK;
const body = Object.entries(merged)
  .map(([k, v]) => {
    if (v.length === 2) return `  ${JSON.stringify(k)}: [${JSON.stringify(v[0])}, ${JSON.stringify(v[1])}],`;
    if (v[2] === null) return `  ${JSON.stringify(k)}: [${JSON.stringify(v[0])}, ${JSON.stringify(v[1])}, null],`;
    const one = !v[2].includes("\n") && v[2].length < 60;
    if (one) return `  ${JSON.stringify(k)}: [${JSON.stringify(v[0])}, ${JSON.stringify(v[1])}, ${lit(v[2])}],`;
    return [`  ${JSON.stringify(k)}: [`, `    ${JSON.stringify(v[0])},`, `    ${JSON.stringify(v[1])},`, `    ${lit(v[2])},`, `  ],`].join("\n");
  })
  .join("\n");

const src = readFileSync(decPath, "utf8");
const at = src.indexOf("export default {");
if (at < 0) throw new Error("no export default");
writeFileSync(decPath, `${src.slice(0, at)}export default {\n${body}\n};\n`, "utf8");

const after = (await import(pathToFileURL(abs).href + `?v=${Date.now()}`)).default;
const kept = Object.values(after).reduce((n, v) => n + (v.length === 3 && typeof v[2] === "string" ? Buffer.byteLength(v[2]) : 0), 0);
console.log(`chunk ${chunk}: ${Object.keys(edits).length} edits, ${Object.keys(after).length} decisions, ${kept} bytes of replacement prose`);
