// Replace the third element of named decisions in place, keyed by block id.
//
// The old text is read back out of the module itself and matched verbatim in the file source,
// so a stale or mistyped needle fails loudly rather than writing nothing and reporting success.
// Every replacement is confirmed by count, and the file is re-imported at the end to prove it
// still parses before anything downstream reads it.
//
//   node scratchpad/retighten.mjs <decisions-file> <file-key> <edits.json>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { commentBlocks } from "./code-blocks.mjs";

const cites = (s) =>
  [...s.matchAll(/hard rules? ((?:\d+)(?:\s*(?:,|and)\s*\d+)*)/gi)]
    .flatMap((m) => m[1].split(/[^\d]+/).filter(Boolean))
    .sort()
    .join(",");

const [decisionsPath, fileKey, editsPath] = process.argv.slice(2);
const abs = join(process.cwd(), decisionsPath);
const before = (await import(pathToFileURL(abs).href)).default;
const edits = JSON.parse(readFileSync(editsPath, "utf8"));
const flat = (s) => s.replace(/\//g, "__");
const blocks = commentBlocks(
  readFileSync(join("scratchpad/code-history-before-wave2", flat(fileKey)), "utf8"),
).map((b) => b.text);

let src = readFileSync(decisionsPath, "utf8");
let done = 0;
const problems = [];
for (const [id, next] of Object.entries(edits)) {
  const key = `${fileKey}#${id}`;
  const dec = before[key];
  if (!dec) {
    problems.push(`${key}: no such decision`);
    continue;
  }
  if (dec.length !== 3 || typeof dec[2] !== "string") {
    problems.push(`${key}: not a string replacement`);
    continue;
  }
  const tick = String.fromCharCode(96);
  // The module hands back the EVALUATED string; the file holds its SOURCE form, where a
  // backtick and a `${` are escaped. Searching for the evaluated form finds nothing in any
  // entry that quotes an identifier, which is most of them, and the batch refuses rather than
  // reporting a clean run over the few that happen to contain neither.
  const escape = (s) => s.split("\\").join("\\\\").split(tick).join("\\" + tick).split("${").join("\\${");
  const old = tick + escape(dec[2]) + tick;
  const hits = src.split(old).length - 1;
  if (hits !== 1) {
    problems.push(`${key}: old text found ${hits} times, expected 1`);
    continue;
  }
  // A citation split across a line break resolves to nothing: the counter and check:invariants
  // section 15 both match on one line. Six instances in this wave, every one introduced by a
  // rewrite and every one caught only after the write. Catching it here costs one comparison.
  const wrapped = [...next.matchAll(/\bhard\s*\n\s*rules?\s+\d+/gi)];
  if (wrapped.length) {
    problems.push(`${key}: citation wrapped across a line break (${JSON.stringify(wrapped[0][0])})`);
    continue;
  }
  // And a citation DROPPED outright, which wrapping's guard cannot see: a reflow that deletes
  // the sentence carrying one leaves no wrapped text to catch.
  //
  // COMPARED AGAINST THE SOURCE BLOCK, never against the decision being replaced. The first
  // spelling compared new against current, which refuses a RESTORE: a decision that had already
  // lost a citation is the one case where the new text must differ from it. The source block is
  // the authority, and it is the same multiset the apply validator uses.
  if (blocks[id] === undefined) {
    problems.push(`${key}: no block ${id} in the snapshot`);
    continue;
  }
  if (cites(blocks[id]) !== cites(next)) {
    problems.push(`${key}: citations ${cites(blocks[id]) || "none"} in source, ${cites(next) || "none"} in replacement`);
    continue;
  }
  src = src.replace(old, tick + escape(next) + tick);
  done += 1;
}

if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`${problems.length} problems; wrote nothing`);
  process.exit(1);
}

writeFileSync(decisionsPath, src, "utf8");
const after = (await import(pathToFileURL(abs).href + `?v=${Date.now()}`)).default;
console.log(`${fileKey}: rewrote ${done} of ${Object.keys(edits).length}; module re-parses with ${Object.keys(after).length} decisions`);
