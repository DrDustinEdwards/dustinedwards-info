// A test that asserts nothing cannot fail, so it proves nothing and counts as coverage. This reads every test file under
// test/ and fails on a `test(...)` or `it(...)` whose body calls no assertion (scripts/lib/test-assertions.mjs says what
// counts). The scanner is held to cases of its own first, so a scanner gone blind fails here and not silently.

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";
import { testsWithoutAssertions } from "./lib/test-assertions.mjs";
import { createTally } from "./lib/tally.mjs";
import { walkFiles } from "./lib/walk-files.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tally = createTally({ print: false });
const { eq } = tally;

/* The scanner on text it must flag and text it must pass. */
const names = (/** @type {string} */ source) => testsWithoutAssertions(source).map((found) => found.name);
eq("scanner: a test that only calls the code is flagged", names(`test("bare", () => { run(1); });`), ["bare"]);
eq("scanner: node:test assert is an assertion", names(`test("a", () => { assert.equal(run(1), 2); });`), []);
eq("scanner: vitest expect is an assertion", names(`it("a", async () => { expect(await run(1)).toBe(2); });`), []);
eq("scanner: a rejects is an assertion", names(`test("a", async () => { await assert.rejects(run(1)); });`), []);
eq("scanner: a same-file helper that asserts counts", names(`function same(a) { assert.equal(a, 1); }\ntest("a", () => { same(run(1)); });`), []);
eq("scanner: a same-file helper that does not assert does not", names(`function noop(a) { return a; }\ntest("a", () => { noop(run(1)); });`), ["a"]);
eq("scanner: a quote, a paren and a regex in a body do not end it early", names(`test("a", () => { const x = "\\")"; const r = /[")]/; run(r, x); });`), ["a"]);
eq("scanner: an assertion after a template literal with a brace is still seen", names("test(\"a\", () => { const s = `${ {a: 1}.a }`; assert.ok(s); });"), []);

const files = walkFiles(join(root, "test")).filter((file) => /\.test\.(mjs|ts)$/.test(file));
let scanned = 0;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  scanned += (source.match(/(?<![\w.$])(?:test|it)\s*\(/g) ?? []).length;
  for (const found of testsWithoutAssertions(source)) {
    tally.fail(`${relative(root, file).replaceAll("\\", "/")}:${found.line} "${found.name}" calls no assertion, so it cannot fail`);
  }
}

/* Measured by running this gate (2026-10-06: 219 files, 1934 test calls), and it moves with the suite: slack is the defect. */
const floorBreach = assertFloor("check:test-assertions", "test calls scanned", scanned, 1930);
if (floorBreach) tally.fail(floorBreach);

if (tally.failures > 0) {
  console.error(`check:test-assertions FAILED, ${tally.failures} problem(s):\n`);
  for (const failure of tally.failed) console.error(`  ${failure}\n`);
  process.exit(1);
}
console.log(`check:test-assertions ok. ${scanned} test calls in ${files.length} files, every one asserts.`);
