// The RAW comment-stripped comparison, with no whitespace normalisation, and WHERE it differs.
//
// `prove` drops whitespace-only lines before comparing, and its own docblock says why: the
// tokenizer replaces a comment with A SPACE, so a `//` run that loses a line loses a
// whitespace-only line from the strip. That is a real limit and it is also a claim, and a claim
// nobody re-measures is the thing this whole job is about. This prints the raw verdict per file
// and the first differing line pair, so the cause of every mismatch is read rather than assumed.
//
//   node scratchpad/raw-strip.mjs [file]
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "../scripts/lib/strip-comments.mjs";
import { FILES } from "./wave.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const only = process.argv[2];

/** A wave-2 file as `main` has it. The snapshot dir is the same bytes and this re-reads git. */
const fromMain = (file) => execFileSync("git", ["show", `main:${file}`], { cwd: REPO, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

let differ = 0;
const causes = new Map();
for (const file of FILES) {
  if (only && file !== only) continue;
  const before = stripComments(fromMain(file)).split("\n");
  const after = stripComments(readFileSync(join(REPO, file), "utf8")).split("\n");
  if (before.join("\n") === after.join("\n")) continue;
  differ += 1;

  // The first index where they diverge, and what each side has there.
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i += 1;
  const b = before[i] ?? "<end>";
  const a = after[i] ?? "<end>";
  const cause =
    b.trim() === "" && a.trim() !== ""
      ? "blank line in BEFORE, content in AFTER"
      : a.trim() === "" && b.trim() !== ""
        ? "blank line in AFTER, content in BEFORE"
        : "content differs";
  causes.set(cause, (causes.get(cause) ?? 0) + 1);
  if (only || differ <= 3) {
    console.log(`\n${file}: lines ${before.length} -> ${after.length}, first difference at ${i}`);
    console.log(`  before[${i}] ${JSON.stringify(b)}`);
    console.log(`  after [${i}] ${JSON.stringify(a)}`);
    console.log(`  context before: ${JSON.stringify(before.slice(Math.max(0, i - 2), i + 2))}`);
    console.log(`  context after : ${JSON.stringify(after.slice(Math.max(0, i - 2), i + 2))}`);
  }
}
console.log(`\nraw strip: ${differ} of ${only ? 1 : FILES.length} files differ`);
for (const [cause, n] of causes) console.log(`  ${n}  ${cause}`);
