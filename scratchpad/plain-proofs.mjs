// The five proofs for the plain-comments rewrite, run against
// scratchpad/before/ (the sheets at 5b8007e) and the working tree.
//
//   1. the generator classifies the same blocks, by sheet and ordinal
//   2. every numeric token in a KEEP block survives, and none is invented
//   3. every prohibition modal survives, with a shared subject word
//   4. CSS outside comments is byte-identical, per sheet
//   5. bytes before and after, per sheet and total
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheets, commentBlocks, commentProse } from "../scripts/lib/design-sheets.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const BEFORE = join(HERE, "before");
const inventory = JSON.parse(readFileSync(join(HERE, "keep-inventory.json"), "utf8"));
const keepKeys = new Set(inventory.map((b) => `${b.sheet}#${b.ordinal}`));
const sheets = readSheets(REPO);
let failed = false;
const fail = (msg) => { failed = true; console.log(`  FAIL ${msg}`); };

const beforeText = (s) => readFileSync(join(BEFORE, basename(s)), "utf8");
const afterText = (s) => readFileSync(join(REPO, s), "utf8");

// ---------- 1. generator classification by sheet and ordinal ----------
const classified = (guidelinesDir, textOf) => {
  const lineToOrdinal = new Map();
  for (const s of sheets) {
    commentBlocks(textOf(s)).forEach(({ line }, i) => lineToOrdinal.set(`${s}:${line}`, `${s}#${i}`));
  }
  const set = new Set();
  for (const f of readdirSync(guidelinesDir)) {
    if (!f.endsWith(".md")) continue;
    for (const m of readFileSync(join(guidelinesDir, f), "utf8").matchAll(/\*\*`([^`]+:\d+)`\*\*/g)) {
      const k = lineToOrdinal.get(m[1]);
      if (!k) fail(`generator stamp ${m[1]} matches no comment block`);
      else set.add(k);
    }
  }
  return set;
};
const c0 = classified(join(BEFORE, "guidelines"), beforeText);
const c1 = classified(join(REPO, ".design-sync/guidelines"), afterText);
const lost = [...c0].filter((k) => !c1.has(k));
const gained = [...c1].filter((k) => !c0.has(k));
console.log(`1. classified before ${c0.size}, after ${c1.size}, lost ${lost.length}, gained ${gained.length}`);
for (const k of lost) fail(`no longer classified: ${k}`);
for (const k of gained) fail(`newly classified: ${k}`);

// ---------- 2 and 3, per KEEP block ----------
const TOKEN = /#[0-9a-f]{3,8}\b|\d{4}-\d{2}-\d{2}|\(\d,\s*\d,\s*\d\)|\d+(?:\.\d+)?:1\b|\d+(?:\.\d+)?(?:px|rem|em|ms|dvh|vw|KB|MB|%|x\b)?|\b\d+(?:\.\d+)?\b/gi;
const tokens = (t) => new Set((t.match(TOKEN) ?? []).map((x) => x.toLowerCase().replace(/\s+/g, "")));
const MODALS = ["never", "do not", "must", "not"];
const sentencesWith = (t, modal) =>
  t.replace(/\s+/g, " ").split(/(?<=[.!?:])\s+/).filter((s) => new RegExp(`\\b${modal}\\b`, "i").test(s));
const words = (s) => new Set((s.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? []));

let changed = 0, numberDiffs = 0, modalChecked = 0, modalKept = 0;
const removedNumbers = [];
const addedNumbers = [];
for (const s of sheets) {
  const b = commentBlocks(beforeText(s));
  const a = commentBlocks(afterText(s));
  if (b.length !== a.length) { fail(`${s}: block count ${b.length} -> ${a.length}`); continue; }
  for (let i = 0; i < b.length; i++) {
    const key = `${s}#${i}`;
    if (!keepKeys.has(key)) {
      if (b[i].text !== a[i].text) fail(`${key} is not a KEEP block and changed`);
      continue;
    }
    if (b[i].text === a[i].text) continue;
    changed += 1;
    const pb = commentProse(b[i].text), pa = commentProse(a[i].text);
    const tb = tokens(pb), ta = tokens(pa);
    for (const t of tb) if (!ta.has(t)) { numberDiffs++; removedNumbers.push(`${key} lost ${t}`); }
    for (const t of ta) if (!tb.has(t)) { numberDiffs++; addedNumbers.push(`${key} added ${t}`); }
    for (const modal of MODALS) {
      const before = sentencesWith(pb, modal);
      if (before.length === 0) continue;
      modalChecked += 1;
      const after = sentencesWith(pa, modal);
      const bw = new Set(before.flatMap((x) => [...words(x)]));
      const shared = after.some((x) => [...words(x)].some((w) => bw.has(w)));
      if (after.length > 0 && shared) modalKept += 1;
      else fail(`${key}: "${modal}" lost or lost its subject`);
    }
  }
}
console.log(`2. KEEP blocks rewritten: ${changed}; numeric token differences: ${numberDiffs}`);
for (const r of removedNumbers) console.log(`  LOST  ${r}`);
for (const r of addedNumbers) console.log(`  ADDED ${r}`);
if (numberDiffs) failed = true;
console.log(`3. prohibition modals checked: ${modalChecked}, kept with a shared subject word: ${modalKept}`);

// ---------- 4. CSS outside comments ----------
const strip = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.trimEnd()).filter((l) => l.trim()).join("\n");
let identical = 0;
for (const s of sheets) {
  if (strip(beforeText(s)) === strip(afterText(s))) identical++;
  else fail(`${s}: CSS outside comments changed`);
}
console.log(`4. sheets whose CSS is identical outside comments: ${identical} of ${sheets.length}`);
// The same regex as stripCssComments in .design-sync/build-inputs.mjs (not
// exported), compared byte for byte with no whitespace normalisation.
const stripExact = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
let exact = 0;
for (const s of sheets) {
  if (stripExact(beforeText(s)) === stripExact(afterText(s))) exact++;
  else fail(`${s}: stripCssComments output differs byte-wise`);
}
console.log(`4b. sheets byte-identical after stripCssComments: ${exact} of ${sheets.length}`);

// ---------- 5. bytes ----------
let tb = 0, ta = 0;
const rows = [];
for (const s of sheets) {
  const x = Buffer.byteLength(beforeText(s)), y = Buffer.byteLength(afterText(s));
  tb += x; ta += y;
  rows.push([s.replace("app/styles/", "").replace("app/", ""), x, y]);
}
console.log("5. bytes per sheet");
for (const [s, x, y] of rows.sort((p, q) => (q[1] - q[2]) - (p[1] - p[2]))) {
  console.log(`   ${s.padEnd(26)} ${String(x).padStart(7)} ${String(y).padStart(7)} ${String(x - y).padStart(7)}`);
}
console.log(`   TOTAL ${tb} -> ${ta}, saved ${tb - ta} (${(((tb - ta) / tb) * 100).toFixed(1)}%)`);

console.log(failed ? "\nPROOFS FAILED" : "\nALL PROOFS PASS");
if (failed) process.exitCode = 1;
