// Ruling 115, wave 1 (job_2cec82881996). One script, all modes reading the
// pristine files in scratchpad/code-history-before/ so every run starts from
// the same bytes.
//
//   snapshot         copy the ten files to code-history-before/
//   dump F A B       print blocks A..B of file F with ids, lines and context
//   check [N...]     validate decision files (all, or the named chunk numbers)
//   tags             write scratchpad/code-history-tags.tsv (commit 1)
//   apply            rewrite the files and write code-history-2026-09-wave1.md
//   prove            comment-stripped identity, preserved tokens, bytes
//
// Decisions live in scratchpad/code-decisions/*.mjs, each exporting
// { "<file>#<id>": [tag, reason, replacement] }. A string replacement is the
// new prose (lines joined by \n, no comment markers), null deletes the block,
// and a missing third entry keeps it byte-identical.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripComments } from "../scripts/lib/strip-comments.mjs";
import { commentBlocks } from "./code-blocks.mjs";
import { CHUNKS, KEEP_SHARE, WAVE1 } from "./code-wave1.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const BEFORE = join(HERE, "code-history-before");
const DECISIONS = join(HERE, "code-decisions");
const flat = (s) => s.replace(/\//g, "__");
const TAGS = ["WHY", "CONTRACT", "NUMBER", "HISTORY"];

// Tokens a machine reads inside a comment. Each must survive a rewrite.
const JSDOC_HEAD = /@(?:param|returns?|type|typedef|template|property|prop|callback|satisfies|import|enum|throws|see|deprecated|this|overload|extends|implements)\b(?:\s*\{[^\n]*\})?(?:\s+\[?[\w.$]+(?:=[^\]\s]*)?\]?)?/g;
const CITATION = /hard rules? ((?:\d+)(?:\s*(?:,|and)\s*\d+)*)/gi;
const DIRECTIVE = /oxlint-|eslint-|@ts-|#__PURE__|@vite-ignore|<reference|prettier-ignore|c8 ignore|istanbul/;
const MARKERS = ["JUSTIFIED SUBSTITUTION"];
const WIDE_DASHES = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];

const jsdocHeads = (t) => (t.match(JSDOC_HEAD) ?? []).map((h) => h.replace(/\s+/g, " ").trim());
const citations = (t) => [...t.matchAll(CITATION)].flatMap((m) => m[1].split(/[^\d]+/).filter(Boolean)).sort();
const sameMultiset = (a, b) => {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/** Comment prose with markers and leading stars removed. */
function prose(text) {
  if (text.startsWith("//")) return text.split("\n").map((l) => l.replace(/^\s*\/\/ ?/, "")).join("\n");
  const inner = text.replace(/^\/\*\*?/, "").replace(/\*\/$/, "");
  return inner.split("\n").map((l) => l.replace(/^\s*\* ?/, "")).join("\n").trim();
}

function loadBlocks() {
  const all = [];
  for (const file of WAVE1) {
    const src = readFileSync(join(BEFORE, flat(file)), "utf8");
    commentBlocks(src).forEach((b, id) => all.push({ ...b, file, id, key: `${file}#${id}`, src }));
  }
  return all;
}

/** A block the tooling classifies itself: nothing but machine-read content. */
function automatic(b) {
  const p = prose(b.text);
  if (DIRECTIVE.test(b.text) && b.endLine - b.line < 3) return { tag: "CONTRACT", reason: "tool directive; kept" };
  const stripped = p.replace(JSDOC_HEAD, "").replace(/[\s{}()[\]<>.,|:;'"`*?=]/g, "");
  if (jsdocHeads(b.text).length > 0 && stripped.length === 0) return { tag: "CONTRACT", reason: "type annotation only; kept" };
  return null;
}

async function loadDecisions(only) {
  const out = {};
  const origin = {};
  if (!existsSync(DECISIONS)) return { out, origin };
  for (const name of readdirSync(DECISIONS).filter((n) => n.endsWith(".mjs")).sort()) {
    if (only && !only.some((n) => name === `${n}.mjs`)) continue;
    const mod = await import(pathToFileURL(join(DECISIONS, name)).href);
    for (const [k, v] of Object.entries(mod.default)) {
      if (k in out) throw new Error(`${k} decided twice (${origin[k]} and ${name})`);
      out[k] = v;
      origin[k] = name;
    }
  }
  return { out, origin };
}

function leadOf(b) {
  const ls = b.src.lastIndexOf("\n", b.start - 1) + 1;
  return b.src.slice(ls, b.start).match(/^[ \t]*/)[0];
}

/** Every rule a decision must satisfy. Returns a list of problems. */
function validate(b, d) {
  const problems = [];
  const where = `${b.key} (${b.file}:${b.line})`;
  if (!Array.isArray(d) || d.length < 2 || d.length > 3) return [`${where}: decision must be [tag, reason, replacement?]`];
  const [tag, reason, repl] = d;
  if (!TAGS.includes(tag)) problems.push(`${where}: bad tag ${tag}`);
  if (typeof reason !== "string" || reason.length < 3) problems.push(`${where}: reason missing`);
  if (d.length === 3 && repl !== null && typeof repl !== "string") problems.push(`${where}: replacement must be a string or null`);
  if (tag === "HISTORY" && typeof repl === "string") problems.push(`${where}: a HISTORY block is deleted (null); if something must stay, tag it by what stays`);
  if (tag === "HISTORY" && repl === undefined) problems.push(`${where}: a HISTORY block is deleted (null)`);
  if (repl === null && tag !== "HISTORY") problems.push(`${where}: only HISTORY deletes`);
  if (repl === null && /\{\s*$/.test(b.src.slice(0, b.start)) && /^\s*\}/.test(b.src.slice(b.end))) {
    problems.push(`${where}: a JSX comment cannot be deleted (it would leave {}); shorten it and tag it by what stays`);
  }
  const after = repl === undefined ? b.text : repl === null ? "" : repl;
  if (typeof after === "string") {
    const hb = jsdocHeads(b.text);
    const ha = jsdocHeads(after);
    if (!sameMultiset(hb, ha)) problems.push(`${where}: JSDoc tag heads changed; before ${JSON.stringify(hb)} after ${JSON.stringify(ha)}`);
    if (!sameMultiset(citations(b.text), citations(after))) problems.push(`${where}: hard rule citations changed (${citations(b.text)} -> ${citations(after)})`);
    for (const m of MARKERS) if (b.text.includes(m) && !after.includes(m)) problems.push(`${where}: marker "${m}" lost`);
    if (DIRECTIVE.test(b.text) && repl !== undefined) problems.push(`${where}: carries a tool directive; keep it byte-identical`);
    if (typeof repl === "string") {
      if (WIDE_DASHES.some((c) => repl.includes(c))) problems.push(`${where}: wide dash in replacement`);
      if (repl.includes("*/")) problems.push(`${where}: replacement closes the comment`);
      if (!b.ownLine && b.kind === "line" && repl.includes("\n")) problems.push(`${where}: trailing // comment must stay one line`);
      const lead = leadOf(b);
      for (const l of repl.split("\n")) {
        if (lead.length + 3 + l.length > 110) problems.push(`${where}: line over 110 columns: ${l.slice(0, 40)}...`);
        if (/\s$/.test(l)) problems.push(`${where}: trailing whitespace`);
      }
      if (repl.trim() === "") problems.push(`${where}: empty replacement; use HISTORY + null`);
    }
  }
  return problems;
}

/** Wrap replacement prose in the comment style the original used. */
function render(b, repl) {
  const lead = leadOf(b);
  const lines = repl.split("\n");
  if (b.kind === "line") return lines.map((l, i) => `${i === 0 ? "" : lead}//${l ? " " + l : ""}`).join("\n");
  const open = b.text.startsWith("/**") ? "/**" : "/*";
  if (lines.length === 1) return `${open} ${lines[0]} */`;
  return [open, ...lines.map((l) => `${lead} *${l ? " " + l : ""}`), `${lead} */`].join("\n");
}

function decide(b, decisions) {
  const d = decisions[b.key];
  if (d) return { tag: d[0], reason: d[1], repl: d[2] };
  const auto = automatic(b);
  if (auto) return { ...auto, repl: undefined };
  return null;
}

/** The code with comments stripped, whitespace-only lines and trailing blanks dropped. */
function codeOnly(src) {
  return stripComments(src)
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .filter((l) => l.trim() !== "")
    .join("\n");
}

const mode = process.argv[2];

if (mode === "snapshot") {
  mkdirSync(BEFORE, { recursive: true });
  for (const f of WAVE1) copyFileSync(join(REPO, f), join(BEFORE, flat(f)));
  console.log(`snapshot: ${WAVE1.length} files into scratchpad/code-history-before/`);
  process.exit(0);
}
if (!existsSync(BEFORE)) {
  console.error("no scratchpad/code-history-before/; run snapshot first");
  process.exit(2);
}

const blocks = loadBlocks();

if (mode === "dump") {
  const [file, from, to] = [process.argv[3], Number(process.argv[4]), Number(process.argv[5])];
  if (!WAVE1.includes(file)) {
    console.error(`not a wave 1 file: ${file}`);
    process.exit(2);
  }
  for (const b of blocks.filter((x) => x.file === file && x.id >= from && x.id <= to)) {
    const auto = automatic(b);
    const after = b.src.slice(b.end).split("\n").slice(b.ownLine ? 1 : 0, b.ownLine ? 4 : 1).join("\n");
    const before = b.ownLine ? "" : b.src.slice(b.src.lastIndexOf("\n", b.start - 1) + 1, b.start);
    console.log(`\n===== ${b.key}  L${b.line}-${b.endLine}  ${Buffer.byteLength(b.text)}b  ${b.kind}${b.ownLine ? "" : " TRAILING"}${auto ? `  AUTO(${auto.reason})` : ""}`);
    if (before) console.log(`[code before, same line] ${before}`);
    console.log(b.text);
    console.log(`----- code after:\n${after}`);
  }
  process.exit(0);
}

if (mode === "check") {
  const only = process.argv.slice(3);
  const { out } = await loadDecisions(only.length ? only : null);
  const problems = [];
  for (const k of Object.keys(out)) if (!blocks.some((b) => b.key === k)) problems.push(`${k}: no such block`);
  for (const b of blocks) if (out[b.key]) problems.push(...validate(b, out[b.key]));
  const scopes = only.length ? only.map((n) => CHUNKS[n]) : null;
  if (scopes && scopes.some((s) => !s)) problems.push(`unknown chunk in ${only.join(" ")}`);
  const inScope = (b) => !scopes || scopes.some((s) => s && b.file === s[0] && b.id >= s[1] && b.id <= s[2]);
  for (const k of Object.keys(out)) {
    const b = blocks.find((x) => x.key === k);
    if (b && !inScope(b)) problems.push(`${k}: outside chunk ${only.join(" ")}`);
  }
  const scoped = blocks.filter(inScope);
  const missing = scoped.filter((b) => !decide(b, out));
  if (missing.length) problems.push(`${missing.length} blocks undecided, first: ${missing.slice(0, 8).map((b) => b.key).join(", ")}`);
  let before = 0;
  let after = 0;
  for (const b of scoped) {
    before += Buffer.byteLength(b.text);
    const d = decide(b, out);
    const repl = d ? d.repl : undefined;
    after += repl === undefined ? Buffer.byteLength(b.text) : repl === null ? 0 : Buffer.byteLength(render(b, repl));
  }
  console.log(
    `bytes: ${scoped.length} blocks, comment ${before} -> ${after} (${((100 * after) / before).toFixed(1)}%); ` +
      `budget ${Math.round(before * KEEP_SHARE)} (${Math.round(KEEP_SHARE * 100)}%)`,
  );
  for (const p of problems) console.log(p);
  console.log(`check: ${Object.keys(out).length} decisions, ${problems.length} problems`);
  process.exit(problems.length ? 1 : 0);
}

const { out: decisions } = await loadDecisions(null);
const problems = [];
for (const b of blocks) {
  const d = decide(b, decisions);
  // PARTIAL=1 is for testing the pipeline on some chunks: undecided blocks are kept.
  if (!d && process.env.PARTIAL === "1") Object.assign(b, { tag: "UNDECIDED", reason: "not decided", repl: undefined });
  else if (!d) problems.push(`${b.key}: undecided`);
  else {
    Object.assign(b, d);
    if (decisions[b.key]) problems.push(...validate(b, decisions[b.key]));
  }
}
for (const k of Object.keys(decisions)) if (!blocks.some((b) => b.key === k)) problems.push(`${k}: no such block`);
if (problems.length && mode !== "prove") {
  for (const p of problems.slice(0, 40)) console.error(p);
  console.error(`${problems.length} problems; refusing ${mode}`);
  process.exit(1);
}

if (mode === "tags") {
  const rows = ["file\tline\tbytes\ttag\taction\treason"];
  for (const b of blocks) {
    const action = b.repl === undefined ? "keep" : b.repl === null ? "delete" : "rewrite";
    rows.push([b.file, b.line, Buffer.byteLength(b.text), b.tag, action, b.reason.replace(/[\t\n]/g, " ")].join("\t"));
  }
  writeFileSync(join(HERE, "code-history-tags.tsv"), rows.join("\n") + "\n");
  const count = (t) => blocks.filter((b) => b.tag === t).length;
  const act = (a) =>
    blocks.filter((b) => (a === "keep" ? b.repl === undefined : a === "delete" ? b.repl === null : typeof b.repl === "string")).length;
  console.log(
    `tags: ${blocks.length} blocks; WHY ${count("WHY")}, CONTRACT ${count("CONTRACT")}, NUMBER ${count("NUMBER")}, HISTORY ${count("HISTORY")}; ` +
      `keep ${act("keep")}, rewrite ${act("rewrite")}, delete ${act("delete")}`,
  );
  process.exit(0);
}

if (mode === "apply") {
  const history = [
    "# Code comment history, 2026-09, wave 1",
    "",
    "Extracted by job_2cec82881996 under ruling 115, from cdb4300. Every comment",
    "block the job deleted or shortened in the ten heaviest code files is here",
    "VERBATIM, with the file and line it had at cdb4300, its tag, and why it moved.",
    "The files keep only the short why and the contract; this is where the",
    "measurements, dates and the story went.",
    "",
  ];
  for (const file of WAVE1) {
    let src = readFileSync(join(BEFORE, flat(file)), "utf8");
    const mine = blocks.filter((b) => b.file === file && b.repl !== undefined);
    for (const b of [...mine].sort((x, y) => y.start - x.start)) {
      if (src.slice(b.start, b.end) !== b.text) throw new Error(`${b.key}: offset drifted`);
      if (b.repl === null) {
        const ls = src.lastIndexOf("\n", b.start - 1) + 1;
        let le = src.indexOf("\n", b.end);
        le = le === -1 ? src.length : le + 1;
        if (b.ownLine && /^[ \t]*$/.test(src.slice(b.end, le - 1))) {
          // The comment had its line(s) to itself: remove them, newline included.
          src = src.slice(0, ls) + src.slice(le);
        } else {
          const ws = src.slice(0, b.start).match(/[ \t]*$/)[0].length;
          src = src.slice(0, b.start - (b.ownLine ? 0 : ws)) + src.slice(b.end);
        }
      } else {
        src = src.slice(0, b.start) + render(b, b.repl) + src.slice(b.end);
      }
    }
    writeFileSync(join(REPO, file), src);
    if (mine.length === 0) continue;
    history.push(`## ${file}`, "");
    for (const b of mine.sort((x, y) => x.start - y.start)) {
      const fence = b.text.includes("```") ? "````" : "```";
      history.push(
        `### ${file}:${b.line} (${b.tag}, ${b.repl === null ? "deleted" : "shortened"})`,
        "",
        b.reason.endsWith(".") ? b.reason : b.reason + ".",
        "",
        fence + (file.endsWith(".tsx") ? "tsx" : file.endsWith(".ts") ? "ts" : "js"),
        b.text,
        fence,
        "",
      );
    }
  }
  writeFileSync(join(HERE, "code-history-2026-09-wave1.md"), history.join("\n"));
  const changed = blocks.filter((b) => b.repl !== undefined);
  console.log(
    `apply: ${changed.filter((b) => b.repl === null).length} deleted, ${changed.filter((b) => typeof b.repl === "string").length} rewritten; ` +
      `history file ${Buffer.byteLength(history.join("\n"))} bytes`,
  );
  process.exit(0);
}

if (mode === "prove") {
  for (const p of problems.slice(0, 40)) console.error(p);
  let failures = problems.length;
  const rows = [];
  let tb = 0;
  let tc = 0;
  let ta = 0;
  let tac = 0;
  for (const file of WAVE1) {
    const before = readFileSync(join(BEFORE, flat(file)), "utf8");
    const after = readFileSync(join(REPO, file), "utf8");
    const same = codeOnly(before) === codeOnly(after);
    // The comparison must be able to tell two things apart (hard rule 12):
    // change one character of code and it has to disagree.
    const spans = commentBlocks(before);
    let at = 0;
    for (const s of spans) {
      if (/[A-Za-z]/.test(before.slice(at, s.start))) break;
      at = s.end;
    }
    const k = at + before.slice(at).search(/[A-Za-z]/);
    const mutated = before.slice(0, k) + (before[k] === "Q" ? "R" : "Q") + before.slice(k + 1);
    const discriminates = codeOnly(mutated) !== codeOnly(before);
    const cb = spans.reduce((a, b) => a + Buffer.byteLength(b.text), 0);
    const afterBlocks = commentBlocks(after);
    const ca = afterBlocks.reduce((a, b) => a + Buffer.byteLength(b.text), 0);
    const citeB = spans.flatMap((b) => citations(b.text)).length;
    const citeA = afterBlocks.flatMap((b) => citations(b.text)).length;
    const markB = MARKERS.map((m) => before.split(m).length - 1).join();
    const markA = MARKERS.map((m) => after.split(m).length - 1).join();
    const headsB = spans.flatMap((b) => jsdocHeads(b.text));
    const headsA = afterBlocks.flatMap((b) => jsdocHeads(b.text));
    const ok = same && discriminates && citeB === citeA && markB === markA && sameMultiset(headsB, headsA);
    if (!ok) failures += 1;
    const bb = Buffer.byteLength(before);
    const ab = Buffer.byteLength(after);
    tb += bb;
    tc += cb;
    ta += ab;
    tac += ca;
    rows.push(
      `| ${file} | ${same ? "identical" : "DIFFERS"} | ${discriminates ? "yes" : "NO"} | ${citeB} / ${citeA} | ${headsB.length} / ${headsA.length} | ${markB} / ${markA} | ${bb} | ${ab} | ${((100 * cb) / bb).toFixed(1)}% | ${((100 * ca) / ab).toFixed(1)}% |`,
    );
  }
  console.log("| file | code only | control differs | citations | JSDoc heads | markers | bytes before | bytes after | comment before | comment after |");
  console.log("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of rows) console.log(r);
  console.log(`| **wave 1** | | | | | | ${tb} | ${ta} | ${((100 * tc) / tb).toFixed(1)}% | ${((100 * tac) / ta).toFixed(1)}% |`);
  console.log(`\ncomment bytes ${tc} -> ${tac}; prove: ${failures ? `${failures} FAILURES` : "all files pass"}`);
  process.exit(failures ? 1 : 0);
}

console.error("usage: code-history-apply.mjs snapshot|dump F A B|check [N...]|tags|apply|prove");
process.exit(2);
