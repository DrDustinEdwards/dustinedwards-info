// The one intended code change in wave 1: admin.media._index.tsx's early return moves below
// the hooks, so check:slop's seven react-hooks/rules-of-hooks errors go. `prove` reports that
// file as DIFFERS by design; this prints WHAT differs, so the change can be read as a move
// rather than taken on trust.
//
//   node scratchpad/hooks-diff.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "../scripts/lib/strip-comments.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const FILE = "app/routes/admin.media._index.tsx";

const code = (src) =>
  stripComments(src)
    .split("\n")
    .filter((l) => l.trim() !== "");

const before = code(readFileSync(join(HERE, "code-history-before", FILE.replace(/\//g, "__")), "utf8"));
const after = code(readFileSync(join(REPO, FILE), "utf8"));

const bag = (lines) => {
  const m = new Map();
  for (const l of lines) m.set(l, (m.get(l) ?? 0) + 1);
  return m;
};
const b = bag(before);
const a = bag(after);
const only = (x, y) => {
  const out = [];
  for (const [line, n] of x) {
    const d = n - (y.get(line) ?? 0);
    for (let i = 0; i < d; i += 1) out.push(line);
  }
  return out;
};

const removed = only(b, a);
const added = only(a, b);
console.log(`${FILE}: ${before.length} code lines before, ${after.length} after`);
console.log(`lines present before and not after: ${removed.length}`);
for (const l of removed) console.log(`  - ${l}`);
console.log(`lines present after and not before: ${added.length}`);
for (const l of added) console.log(`  + ${l}`);
console.log(
  removed.length === 0 && added.length === 0
    ? "\nMULTISET IDENTICAL: every code line survives, so the change is a reordering and nothing else."
    : "\nNOT a pure reordering: the lines above are a real difference, read them.",
);

/*
 * A multiset comparison is BLIND TO ORDER by construction, which is the point here and is also
 * its limit: it proves no line was added, removed or edited, never that the new order is the
 * right one. That half is the diff, the typecheck, and check:slop's seven rules-of-hooks errors
 * going to zero. The control proves it can tell two things apart at all (hard rule 12).
 */
const mutated = after.slice();
mutated[mutated.length - 1] = `${mutated[mutated.length - 1]} /* control */`;
const control = only(bag(mutated), b).length > 0;
console.log(`control (one changed line) detected: ${control ? "yes" : "NO, the comparison is blind"}`);
if (!control) process.exit(1);
