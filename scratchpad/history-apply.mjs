// Ruling 115. One script, three modes, all reading the pristine sheets in
// scratchpad/history-before/ so every run starts from the same bytes.
//
//   node scratchpad/history-apply.mjs snapshot  copy the 31 hand-written sheets to history-before/
//   node scratchpad/history-apply.mjs tags      write scratchpad/history-tags.tsv (commit 1)
//   node scratchpad/history-apply.mjs apply     rewrite the sheets and write sheet-history-2026-09.md (commit 3)
//
// Decisions live in history-decisions-{1..6}.mjs. A block with no decision is
// kept byte-identical, except the pointer comments whose line numbers had
// already gone stale, which get a pointer that names no line.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks, commentProse } from "../scripts/lib/design-sheets.mjs";
import { trackedSheets, GENERATED } from "./history-blocks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const BEFORE = join(HERE, "history-before");
const flat = (s) => s.replace(/\//g, "__");

const mode = process.argv[2];
const sheets = trackedSheets().filter((s) => s !== GENERATED);

if (mode === "snapshot") {
  mkdirSync(BEFORE, { recursive: true });
  for (const s of trackedSheets()) copyFileSync(join(REPO, s), join(BEFORE, flat(s)));
  console.log(`snapshot: ${trackedSheets().length} sheets into scratchpad/history-before/`);
  process.exit(0);
}

if (!existsSync(BEFORE)) {
  console.error("no scratchpad/history-before/; run snapshot first");
  process.exit(2);
}

const decisions = {};
for (let i = 1; i <= 6; i++) {
  const mod = await import(`./history-decisions-${i}.mjs`);
  for (const [id, d] of Object.entries(mod.default)) {
    if (id in decisions) throw new Error(`block ${id} decided twice`);
    decisions[id] = d;
  }
}

// Every block, in the same order and with the same ids as history-blocks.mjs.
const blocks = [];
for (const sheet of sheets) {
  const css = readFileSync(join(BEFORE, flat(sheet)), "utf8");
  for (const { text, line } of commentBlocks(css)) {
    const index = css.split("\n").slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
    const at = css.indexOf(text, index);
    blocks.push({ id: blocks.length, sheet, line, text, at, prose: commentProse(text) });
  }
}
if (blocks.length !== 700) throw new Error(`expected 700 blocks, found ${blocks.length}`);
for (const id of Object.keys(decisions)) {
  if (!blocks[Number(id)]) throw new Error(`decision for missing block ${id}`);
}

function decide(b) {
  const d = decisions[b.id];
  if (d) {
    const [tag, reason, text] = d;
    if (!["WHY", "NUMBER", "HISTORY"].includes(tag)) throw new Error(`block ${b.id}: bad tag ${tag}`);
    if (tag === "HISTORY" && text !== null) throw new Error(`block ${b.id}: HISTORY must delete`);
    if (tag !== "HISTORY" && text === null) throw new Error(`block ${b.id}: only HISTORY deletes`);
    return { tag, reason, repl: text };
  }
  const p = b.prose;
  const exact = p.match(/^See exact copy of app\/app\.css:\d+$/);
  if (exact) return { tag: "WHY", reason: "pointer; its line number was stale, so it now names the block instead", repl: "As in the light block." };
  const named = p.match(/^See dark copy of the (.+) note at app\/app\.css:\d+$/);
  if (named) return { tag: "WHY", reason: "pointer; its line number was stale, so it now names the block instead", repl: `${named[1][0].toUpperCase()}${named[1].slice(1)}: as in the light block.` };
  if (/^See the reason is stated at app\/app\.css:\d+$/.test(p)) {
    return { tag: "WHY", reason: "pointer; its line number was stale, so it now names the block instead", repl: "Chrome: as in the dark block above." };
  }
  if (/^@kind /.test(p)) return { tag: "WHY", reason: "sync annotation read by build-inputs.mjs; kept", repl: undefined };
  const lines = b.text.split("\n").length;
  if (lines > 3) throw new Error(`block ${b.id} (${b.sheet}:${b.line}) is ${lines} lines and has no decision`);
  return { tag: "WHY", reason: "at most three lines; kept as written", repl: undefined };
}

for (const b of blocks) Object.assign(b, decide(b));

if (mode === "tags") {
  const rows = ["sheet\tline\tbytes\ttag\treason"];
  for (const b of blocks) rows.push([b.sheet, b.line, Buffer.byteLength(b.text), b.tag, b.reason].join("\t"));
  writeFileSync(join(HERE, "history-tags.tsv"), rows.join("\n") + "\n");
  const count = (t) => blocks.filter((b) => b.tag === t).length;
  const changed = blocks.filter((b) => b.repl !== undefined).length;
  console.log(`tags: ${blocks.length} blocks, WHY ${count("WHY")}, NUMBER ${count("NUMBER")}, HISTORY ${count("HISTORY")}; ${changed} to change`);
  process.exit(0);
}

if (mode !== "apply") {
  console.error("usage: history-apply.mjs snapshot|tags|apply");
  process.exit(2);
}

/** Wrap replacement prose in the comment style the original used. */
function render(b, css) {
  const lineStart = css.lastIndexOf("\n", b.at - 1) + 1;
  const lead = css.slice(lineStart, b.at).match(/^\s*/)[0];
  const lines = b.repl.split("\n");
  if (lines.length === 1) return `/* ${lines[0]} */`;
  const cont = /\n\s*\*(?!\/)/.test(b.text) ? `${lead} * ` : `${lead}   `;
  return [`/* ${lines[0]}`, ...lines.slice(1).map((l) => `${cont}${l}`)].join("\n") + " */";
}

const history = [
  "# Sheet history, 2026-09",
  "",
  "Extracted from the stylesheets by job_327e4af58a67 under ruling 115, from",
  "9b769c8. Every block the job deleted or shortened is here VERBATIM, with the",
  "sheet and line it had at 9b769c8, its tag, and why it moved. The sheets keep",
  "only the short why; this is where the measurements and the story went.",
  "",
];

for (const sheet of sheets) {
  let css = readFileSync(join(BEFORE, flat(sheet)), "utf8");
  const mine = blocks.filter((b) => b.sheet === sheet && b.repl !== undefined);
  // Edit from the end so earlier offsets stay valid.
  for (const b of [...mine].sort((x, y) => y.at - x.at)) {
    const original = b;
    if (css.slice(b.at, b.at + original.text.length) !== original.text) {
      throw new Error(`block ${b.id}: offset drifted`);
    }
    if (b.repl === null) {
      // Remove the whole line when the comment is alone on it.
      const lineStart = css.lastIndexOf("\n", b.at - 1) + 1;
      let lineEnd = css.indexOf("\n", b.at + original.text.length);
      if (lineEnd === -1) lineEnd = css.length;
      const before = css.slice(lineStart, b.at);
      const after = css.slice(b.at + original.text.length, lineEnd);
      if (before.trim() === "" && after.trim() === "") {
        css = css.slice(0, lineStart) + css.slice(Math.min(lineEnd + 1, css.length));
      } else {
        css = css.slice(0, b.at) + css.slice(b.at + original.text.length);
      }
    } else {
      css = css.slice(0, b.at) + render(b, css) + css.slice(b.at + original.text.length);
    }
  }
  writeFileSync(join(REPO, sheet), css);
  if (mine.length === 0) continue;
  history.push(`## ${sheet}`, "");
  for (const b of mine.sort((x, y) => x.at - y.at)) {
    if (b.reason.startsWith("pointer;")) continue;
    history.push(
      `### ${sheet}:${b.line} (${b.tag}${b.repl === null ? ", deleted" : ", shortened"})`,
      "",
      b.reason + ".",
      "",
      "```css",
      b.text,
      "```",
      "",
    );
  }
}

writeFileSync(join(HERE, "sheet-history-2026-09.md"), history.join("\n"));
const changed = blocks.filter((b) => b.repl !== undefined);
console.log(
  `apply: ${changed.filter((b) => b.repl === null).length} deleted, ${changed.filter((b) => b.repl !== null).length} rewritten, ` +
    `history file ${Buffer.byteLength(history.join("\n"))} bytes`,
);
