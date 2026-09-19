// recut.mjs across every chunk at once: the second tightening pass is one judgement applied to
// every decided block, and splitting it by chunk would mean nineteen tables whose only reason to
// be separate is the file they land in. The key says which decisions file owns it, so the tool
// can work that out rather than the author.
//
//   node scratchpad/recut-all.mjs <edits.json> [<more.json> ...]
//
// Same table format and the same guards as recut.mjs, all-or-nothing across every file touched.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";
import { FILES, BEFORE, DECISIONS, flat } from "./wave.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = DECISIONS;
const TICK = String.fromCharCode(96);

const JSDOC_HEAD =
  /@(?:param|returns?|type|typedef|template|property|prop|callback|satisfies|import|enum|throws|see|deprecated|this|overload|extends|implements)\b(?:\s*\{[^\n]*\})?(?:\s+\[?[\w.$]+(?:=[^\]\s]*)?\]?)?/g;
const CITATION = /hard rules? ((?:\d+)(?:\s*(?:,|and)\s*\d+)*)/gi;
const DIRECTIVE = /oxlint-|eslint-|@ts-|#__PURE__|@vite-ignore|<reference|prettier-ignore|c8 ignore|istanbul/;
const MARKERS = ["JUSTIFIED SUBSTITUTION"];
const WIDE = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];
const heads = (t) => (t.match(JSDOC_HEAD) ?? []).map((h) => h.replace(/\s+/g, " ").trim()).sort().join("|");
// FLATTENED, so a citation an inherited line break split still counts as the rule it names.
// Counting the raw text makes repairing that wrap read as an INVENTED citation, which refuses the
// one edit the wrap needs. liveCites is the other half: the replacement's own citations must all
// be on one line, so nothing re-wraps one.
const flatProse = (t) =>
  t
    .split("\n")
    .map((l) => l.replace(/^\s*(?:\/\/|\*\/|\/\*\*?|\*)\s?/, ""))
    .join(" ");
const cites = (t) => [...flatProse(t).matchAll(CITATION)].flatMap((m) => m[1].split(/[^\d]+/).filter(Boolean)).sort().join(",");
const liveCites = (t) => [...t.matchAll(CITATION)].flatMap((m) => m[1].split(/[^\d]+/).filter(Boolean)).length;

const names = readdirSync(DIR).filter((n) => n.endsWith(".mjs")).sort();
const owner = {};
const loaded = {};
for (const n of names) {
  const mod = (await import(pathToFileURL(join(DIR, n)).href)).default;
  loaded[n] = mod;
  for (const k of Object.keys(mod)) owner[k] = n;
}

const blocks = {};
for (const file of FILES) {
  const src = readFileSync(join(BEFORE, flat(file)), "utf8");
  commentBlocks(src).forEach((b, id) => {
    const ls = src.lastIndexOf("\n", b.start - 1) + 1;
    blocks[`${file}#${id}`] = { ...b, lead: src.slice(ls, b.start).match(/^[ \t]*/)[0] };
  });
}

const edits = Object.assign({}, ...process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, "utf8"))));
const problems = [];
const touched = new Set();
for (const [key, value] of Object.entries(edits)) {
  const b = blocks[key];
  const file = owner[key];
  if (!b || !file) {
    problems.push(`${key}: ${b ? "no decision on file" : "not a block in this wave"}`);
    continue;
  }
  const old = loaded[file][key];
  let next = value;
  if (typeof next === "string") next = [old[0], old[1], next];
  if (next === null) next = ["HISTORY", old[1], null];
  const [tag, reason, repl] = next;
  if (!["WHY", "CONTRACT", "NUMBER", "HISTORY"].includes(tag)) problems.push(`${key}: bad tag ${tag}`);
  if (typeof reason !== "string" || reason.length < 3) problems.push(`${key}: reason missing`);
  if ((tag === "HISTORY") !== (repl === null)) problems.push(`${key}: only HISTORY deletes, and HISTORY always deletes`);
  const after = repl === undefined ? b.text : repl === null ? "" : repl;
  if (heads(b.text) !== heads(after)) problems.push(`${key}: JSDoc heads ${heads(b.text) || "none"} -> ${heads(after) || "none"}`);
  if (cites(b.text) !== cites(after)) problems.push(`${key}: citations ${cites(b.text) || "none"} -> ${cites(after) || "none"}`);
  for (const m of MARKERS) if (b.text.includes(m) && !after.includes(m)) problems.push(`${key}: marker "${m}" lost`);
  if (DIRECTIVE.test(b.text) && repl !== undefined) problems.push(`${key}: tool directive; keep it byte-identical`);
  if (typeof repl === "string") {
    if (WIDE.some((c) => repl.includes(c))) problems.push(`${key}: wide dash`);
    if (repl.includes("*/")) problems.push(`${key}: closes the comment`);
    if (!b.ownLine && b.kind === "line" && repl.includes("\n")) problems.push(`${key}: trailing // comment must stay one line`);
    if (liveCites(repl) !== cites(repl).split(",").filter(Boolean).length) {
      problems.push(`${key}: citation split by a line break, so it resolves to nothing`);
    }
    if (repl.trim() === "") problems.push(`${key}: empty; use null`);
    for (const l of repl.split("\n")) {
      if (b.lead.length + 3 + l.length > 110) problems.push(`${key}: over 110 columns: ${l.slice(0, 40)}...`);
      if (/\s$/.test(l)) problems.push(`${key}: trailing whitespace`);
    }
  }
  loaded[file][key] = next;
  touched.add(file);
}

if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`${problems.length} problems; wrote nothing`);
  process.exit(1);
}

const lit = (s) => TICK + s.split("\\").join("\\\\").split(TICK).join("\\" + TICK).split("${").join("\\${") + TICK;
for (const name of touched) {
  const body = Object.entries(loaded[name])
    .map(([k, v]) => {
      if (v.length === 2) return `  ${JSON.stringify(k)}: [${JSON.stringify(v[0])}, ${JSON.stringify(v[1])}],`;
      if (v[2] === null) return `  ${JSON.stringify(k)}: [${JSON.stringify(v[0])}, ${JSON.stringify(v[1])}, null],`;
      if (!v[2].includes("\n") && v[2].length < 60) return `  ${JSON.stringify(k)}: [${JSON.stringify(v[0])}, ${JSON.stringify(v[1])}, ${lit(v[2])}],`;
      return [`  ${JSON.stringify(k)}: [`, `    ${JSON.stringify(v[0])},`, `    ${JSON.stringify(v[1])},`, `    ${lit(v[2])},`, `  ],`].join("\n");
    })
    .join("\n");
  const path = join(DIR, name);
  const src = readFileSync(path, "utf8");
  const at = src.indexOf("export default {");
  writeFileSync(path, `${src.slice(0, at)}export default {\n${body}\n};\n`, "utf8");
  await import(pathToFileURL(path).href + `?v=${Date.now()}`);
}
console.log(`${Object.keys(edits).length} edits across ${touched.size} files; every one re-parses`);
