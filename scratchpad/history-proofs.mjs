// Ruling 115, commit 3 proofs. Compares scratchpad/history-before/ (9b769c8)
// with the working tree.
//
//   node scratchpad/history-proofs.mjs css       rules unchanged in all 32 sheets
//   node scratchpad/history-proofs.mjs modals    every prohibition's modal survives
//   node scratchpad/history-proofs.mjs bytes     per-sheet bytes and comment share
//   node scratchpad/history-proofs.mjs guide <before.json> <after.json>
//        generator blocks accounted for; the two files are lists of
//        {sheet, line} read out of .design-sync/guidelines by `guide-list`
//   node scratchpad/history-proofs.mjs guide-list <out.json>
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { commentBlocks, commentProse } from "../scripts/lib/design-sheets.mjs";
import { trackedSheets, GENERATED } from "./history-blocks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const BEFORE = join(HERE, "history-before");
const flat = (s) => s.replace(/\//g, "__");
const before = (s) => readFileSync(join(BEFORE, flat(s)), "utf8");
const after = (s) => readFileSync(join(REPO, s), "utf8");
// The regex stripCssComments uses in .design-sync/build-inputs.mjs.
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const mode = process.argv[2];

async function decisions() {
  const d = {};
  for (let i = 1; i <= 6; i++) Object.assign(d, (await import(`./history-decisions-${i}.mjs`)).default);
  return d;
}

/** Blocks at 9b769c8 with the ids history-blocks.mjs assigns. */
function beforeBlocks() {
  const out = [];
  for (const sheet of trackedSheets()) {
    if (sheet === GENERATED) continue;
    commentBlocks(before(sheet)).forEach(({ text, line }, pos) => out.push({ id: out.length, sheet, pos, line, text }));
  }
  return out;
}

if (mode === "css") {
  // Raw strip first. A deleted comment that sat alone on its line takes the
  // line with it, so the raw comparison can differ only by whitespace-only
  // lines; the second comparison drops those and must be exact.
  const noBlank = (s) => s.split("\n").filter((l) => l.trim() !== "").join("\n");
  let raw = 0, normal = 0;
  const bad = [];
  for (const sheet of trackedSheets()) {
    const b = strip(before(sheet)), a = strip(after(sheet));
    if (b === a) raw++;
    if (noBlank(b) === noBlank(a)) normal++;
    else bad.push(sheet);
  }
  const n = trackedSheets().length;
  console.log(`raw strip identical: ${raw} of ${n}`);
  console.log(`strip plus whitespace-only lines dropped, identical: ${normal} of ${n}`);
  if (bad.length) console.log(`DIFFER: ${bad.join(", ")}`);
  process.exitCode = normal === n ? 0 : 1;
} else if (mode === "modals") {
  const d = await decisions();
  const MODALS = [/\bnever\b/i, /\bdo not\b|\bdon't\b/i, /\bmust\b/i, /\bnot\b/i];
  let cases = 0;
  const lost = [];
  for (const b of beforeBlocks()) {
    const dec = d[b.id];
    if (!dec || dec[2] === null) continue; // unchanged, or HISTORY (listed in the history file)
    const was = commentProse(b.text), now = dec[2];
    for (const rx of MODALS) {
      if (!rx.test(was)) continue;
      cases++;
      if (!rx.test(now)) lost.push(`${b.sheet}:${b.line} ${rx.source}`);
    }
  }
  console.log(`(block, modal) cases in rewritten blocks: ${cases}; modal absent after: ${lost.length}`);
  for (const l of lost) console.log(`  ${l}`);
} else if (mode === "bytes") {
  let tb = 0, ta = 0, cb = 0, ca = 0;
  const rows = [];
  for (const sheet of trackedSheets()) {
    const B = before(sheet), A = after(sheet);
    const bb = Buffer.byteLength(B), ab = Buffer.byteLength(A);
    const bc = bb - Buffer.byteLength(strip(B)), ac = ab - Buffer.byteLength(strip(A));
    tb += bb; ta += ab; cb += bc; ca += ac;
    rows.push([sheet.replace("app/styles/", "").replace("app/", ""), bb, ab, (100 * bc / bb).toFixed(1), (100 * ac / ab).toFixed(1)]);
  }
  console.log("sheet                          before    after  comment% before  after");
  for (const r of rows.sort((x, y) => y[1] - x[1])) {
    console.log(`  ${r[0].padEnd(28)} ${String(r[1]).padStart(7)} ${String(r[2]).padStart(8)}  ${r[3].padStart(13)}%  ${r[4].padStart(5)}%`);
  }
  console.log(`TOTAL ${tb} -> ${ta} bytes; comment ${cb} -> ${ca}; share ${(100 * cb / tb).toFixed(1)}% -> ${(100 * ca / ta).toFixed(1)}%`);
} else if (mode === "guide-list") {
  const dir = join(REPO, ".design-sync/guidelines");
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "singletons.md")) {
    for (const m of readFileSync(join(dir, f), "utf8").matchAll(/^\*\*`([^`:]+):(\d+)`\*\*$/gm)) {
      out.push({ file: f, sheet: m[1], line: Number(m[2]) });
    }
  }
  if (out.length === 0) throw new Error("no generator blocks found; the parse is wrong, not the tree");
  writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
  console.log(`${out.length} generator blocks listed`);
} else if (mode === "guide") {
  const d = await decisions();
  const was = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const now = JSON.parse(readFileSync(process.argv[4], "utf8"));
  const blocks = beforeBlocks();
  // A block's position among the blocks that survive in its sheet.
  const afterPos = new Map();
  const bySheet = new Map();
  for (const b of blocks) {
    if (d[b.id] && d[b.id][2] === null) continue;
    const k = bySheet.get(b.sheet) ?? 0;
    afterPos.set(b.id, k);
    bySheet.set(b.sheet, k + 1);
  }
  const lineOfAfter = new Map();
  for (const sheet of new Set(blocks.map((b) => b.sheet))) {
    commentBlocks(after(sheet)).forEach(({ line }, pos) => lineOfAfter.set(`${sheet}#${pos}`, line));
  }
  const nowKeys = new Set(now.map((g) => `${g.sheet}:${g.line}`));
  let kept = 0;
  const vanished = [], history = [];
  for (const g of was) {
    const b = blocks.find((x) => x.sheet === g.sheet && x.line === g.line);
    if (!b) throw new Error(`generator cited ${g.sheet}:${g.line}, which is no block start at 9b769c8`);
    if (d[b.id] && d[b.id][2] === null) { history.push(`${g.sheet}:${g.line}`); continue; }
    const line = lineOfAfter.get(`${g.sheet}#${afterPos.get(b.id)}`);
    if (nowKeys.has(`${g.sheet}:${line}`)) kept++;
    else vanished.push(`${g.sheet}:${g.line} (now line ${line})`);
  }
  console.log(`generator blocks before ${was.length}, after ${now.length}`);
  console.log(`kept ${kept}, removed as HISTORY ${history.length}, vanished ${vanished.length}`);
  for (const v of vanished) console.log(`  VANISHED ${v}`);
  for (const h of history) console.log(`  history ${h}`);
  const wasKeys = new Set(was.map((g) => {
    const b = blocks.find((x) => x.sheet === g.sheet && x.line === g.line);
    return `${g.sheet}:${lineOfAfter.get(`${g.sheet}#${afterPos.get(b.id)}`)}`;
  }));
  const gained = now.filter((g) => !wasKeys.has(`${g.sheet}:${g.line}`));
  console.log(`gained ${gained.length}`);
  for (const g of gained) console.log(`  gained ${g.sheet}:${g.line}`);
  process.exitCode = vanished.length ? 1 : 0;
} else {
  console.error("usage: history-proofs.mjs css|modals|bytes|guide-list|guide");
  process.exit(2);
}
