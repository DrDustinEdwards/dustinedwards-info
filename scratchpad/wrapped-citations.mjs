// A citation that wraps a line is a DEAD POINTER: the counter in code-history-apply.mjs and
// check:invariants section 15 both match "hard rule N" on one line, so "hard" at the end of a
// comment line and "rule 10" at the start of the next resolves to nothing and is bound to no
// heading. Found while rewriting chunk 2, where the original carried one and the rewrite's
// one-line version read as an ADDED citation.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { commentBlocks } from "./code-blocks.mjs";

const files = execFileSync("git", ["ls-files", "app", "workers", "scripts", "test"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.(mjs|ts|tsx)$/.test(f));

const LIVE = /hard rules? (?:\d+)/i;
let live = 0;
const wrapped = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const b of commentBlocks(src)) {
    live += (b.text.match(/hard rules? (?:\d+)/gi) ?? []).length;
    // The prose with comment markers and line breaks flattened: a citation the flat text has
    // and the raw text does not is one a line break split.
    const flat = b.text
      .split("\n")
      .map((l) => l.replace(/^\s*(?:\/\/|\*|\/\*\*?)\s?/, ""))
      .join(" ");
    const flatHits = (flat.match(/hard rules? (?:\d+)/gi) ?? []).length;
    const rawHits = (b.text.match(/hard rules? (?:\d+)/gi) ?? []).length;
    if (flatHits > rawHits) wrapped.push(`${f}:${b.line} (+${flatHits - rawHits})`);
  }
}
console.log(`citations that resolve: ${live}`);
console.log(`citations split by a line break, so dead: ${wrapped.length}`);
for (const w of wrapped) console.log(`  ${w}`);
