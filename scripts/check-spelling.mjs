/**
 * Gate: public copy and documents use American spelling (Dustin, 2026-09-22).
 *   npm run check:spelling
 * BOUNDARY: a fixed word list over comments, string literals that hold whitespace, JSX text and
 * prose files, in the files `spelling-scope.mjs` governs. It cannot see a British form missing from
 * the list, and it leaves identifiers alone by design, so a variable named `colour` passes.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { americanize, modeFor } from "./lib/american-spelling.mjs";
import { governed } from "./lib/spelling-scope.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWLIST = join(root, "scripts", "fixtures", "spelling-allowlist.json");

console.log("\ncheck:spelling\n");

/**
 * Quoted titles and proper names that must keep their spelling, by file and word.
 * @type {{ entries: Array<{ file: string, word: string, why: string }> }}
 */
const allowlist = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
const allowed = new Set(allowlist.entries.map((e) => `${e.file}\u0000${e.word}`));
const used = new Set();

const files = execSync("git ls-files", { cwd: root, encoding: "utf8" }).trim().split("\n");
let scanned = 0;
/** @type {string[]} */
const problems = [];
for (const file of files) {
  const mode = modeFor(file);
  if (!mode || !governed(file)) continue;
  scanned += 1;
  const src = readFileSync(join(root, file), "utf8");
  const { changed } = americanize(src, mode, { jsx: file.endsWith(".tsx") });
  for (const { british, american } of changed) {
    const key = `${file}\u0000${british}`;
    if (allowed.has(key)) {
      used.add(key);
      continue;
    }
    problems.push(`${file}: "${british}" is British; write "${american}"`);
  }
}

let failures = 0;
for (const p of problems) {
  failures += 1;
  console.log(`  FAIL  ${p}`);
}
// An allowlist entry nothing needs any more is a hole left open.
for (const e of allowlist.entries) {
  if (!used.has(`${e.file}\u0000${e.word}`)) {
    failures += 1;
    console.log(`  FAIL  allowlist entry ${e.file} "${e.word}" matches nothing; remove it`);
  }
}

const breach = assertFloor("check:spelling", "files", scanned, 561);
if (breach) {
  failures += 1;
  console.log(`  FAIL  this gate scanned what it claims\n        ${breach}`);
}

console.log(`  ${scanned} file(s) scanned, ${allowlist.entries.length} allowlisted form(s)`);
if (failures > 0) {
  console.log(`\n${failures} FAILED\n`);
  process.exit(1);
}
console.log("\ncheck:spelling ok\n");
