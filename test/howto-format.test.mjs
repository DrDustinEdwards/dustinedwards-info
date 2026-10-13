import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { compileProcedure } from "../app/kb/procedures/compile.mjs";
import { parseProcedure } from "../app/kb/procedures/parse.mjs";
import { procedureMarkdown } from "../app/kb/procedures/render.mjs";
import { sentenceCount, validateProcedure } from "../app/kb/procedures/validate.mjs";
import * as pipeline from "../app/lib/content/pipeline.mjs";
import { registryHost } from "../scripts/lib/registry.mjs";

/* A software how-to's format (docs/KNOWLEDGE-BASE.md, step 10): tutorial or how-to (S1), a tutorial's questions, objectives
 * and key points (S2), commands per platform (S4), and challenges with their solutions (S5). */

const tutorial = readFileSync(new URL("fixtures/procedures/tutorial-fixture.md", import.meta.url), "utf8");
const howto = readFileSync(new URL("fixtures/procedures/computational-fixture.md", import.meta.url), "utf8");

/** @param {string} slug @param {string} raw */
const errorsOf = (slug, raw) => validateProcedure(parseProcedure({ file: slug, raw }), { slug }).errors;

/** @param {string[]} errors @param {RegExp} pattern */
function assertError(errors, pattern) {
  assert.ok(errors.some((e) => pattern.test(e)), `expected an error matching ${pattern}, got ${JSON.stringify(errors)}`);
}

await test("a how-to says whether it is a tutorial or a how-to, and only a how-to says it", () => {
  assertError(errorsOf("computational-fixture", howto.replace("type: how-to\n", "")), /type is required for a computational/);
  assertError(errorsOf("computational-fixture", howto.replace("type: how-to", "type: reference")), /type is "reference"; it is one of tutorial, how-to/);
  const protocol = readFileSync("content/procedures/phage-isolation.md", "utf8");
  assertError(errorsOf("phage-isolation", protocol.replace(/^course: .*$/m, (l) => `${l}\ntype: tutorial`)), /type belongs to the computational profile/);
  assertError(errorsOf("phage-isolation", protocol.replace(/^course: .*$/m, (l) => `${l}\nobjectives:\n  - one`)), /objectives belongs to the computational profile/);
});

await test("a how-to keeps a WHY to three sentences and links the rest; a tutorial may explain at length", () => {
  assert.equal(sentenceCount("**Why count headers?** Every record starts with >."), 2);
  assert.equal(sentenceCount("Use `a.b.c`, e.g. this one. Version 2.8.2 is fine."), 2);
  const long = "   > WHY: One. Two. Three. Four.\n";
  const withLong = howto.replace("   > TROUBLESHOOTING: zero-reads\n", `   > TROUBLESHOOTING: zero-reads\n${long}`);
  assertError(errorsOf("computational-fixture", withLong), /WHY runs to 4 sentences; a how-to keeps a reason to 3 at most, so put the rest on a page and link it under explanation/);
  assert.deepEqual(errorsOf("computational-fixture", withLong.replace("One. Two. Three. Four.", "One. Two. Three.")), []);
  assert.deepEqual(errorsOf("tutorial-fixture", tutorial.replace("   > WHY: Every", `${long}   > WHY: Every`)), []);
});

await test("a tutorial states its objectives and its time; questions and key points are lists of lines", () => {
  assertError(errorsOf("tutorial-fixture", tutorial.replace(/objectives:\n(  - .*\n)+/, "")), /objectives is required for a computational/);
  assertError(errorsOf("tutorial-fixture", tutorial.replace("time:\n  total: 20 minutes\n", "")), /a tutorial states its time: time.total/);
  assertError(errorsOf("tutorial-fixture", tutorial.replace(/questions:\n(  - .*\n)+/, "questions: What is it?\n")), /questions must be a list of lines/);
  assertError(errorsOf("tutorial-fixture", tutorial.replace("    url: https://en.wikipedia.org/wiki/FASTA_format", "    url: en.wikipedia.org/wiki/FASTA_format")), /explanation\[The FASTA format\].url is a page on this site/);
});

await test("a challenge belongs to a tutorial and carries its solution; a solution answers a challenge", () => {
  const challenge = "   > CHALLENGE: Count again.\n   > SOLUTION: 3.\n";
  assertError(errorsOf("computational-fixture", howto.replace("   > TROUBLESHOOTING: zero-reads\n", `   > TROUBLESHOOTING: zero-reads\n${challenge}`)), /CHALLENGE belongs to a tutorial/);
  assertError(errorsOf("tutorial-fixture", tutorial.replace(/   > SOLUTION: .*\n/, "")), /each CHALLENGE needs its SOLUTION after it/);
  assertError(errorsOf("tutorial-fixture", tutorial.replace("   > WHY: Every", "   > SOLUTION: early.\n   > WHY: Every")), /has a SOLUTION with no CHALLENGE before it to answer/);
});

await test("a fenced block may name its platform: a known one, once a step, and never alone", () => {
  const steps = parseProcedure({ file: "t", raw: tutorial }).sections[0]?.blocks[0];
  assert.ok(steps?.type === "steps");
  assert.deepEqual(steps.steps[1]?.commands.map((c) => [c.platform, c.output]), [["linux", "3"], ["macos", "3"], ["windows", "3"]]);
  assertError(errorsOf("tutorial-fixture", tutorial.replace("powershell platform=windows\n   (Select", "powershell platform=dos\n   (Select")), /platform=dos is not a platform \(linux, macos, windows\)/);
  assertError(errorsOf("tutorial-fixture", tutorial.replace("powershell platform=windows\n   (Select", "powershell platform=linux\n   (Select")), /two blocks for platform=linux/);
  assertError(errorsOf("tutorial-fixture", tutorial.replace("powershell platform=windows\n   (Select", "powershell shell=pwsh\n   (Select")), /"shell=", and platform= is the only attribute/);
  const lone = howto.replace("   ```bash\n   grep -c", "   ```bash platform=linux\n   grep -c");
  assertError(errorsOf("computational-fixture", lone), /a block names one platform alone/);
});

await test("the twin carries every platform's command, the challenge and its solution, and the tutorial's overview", async () => {
  const compiled = await compileProcedure({ slug: "tutorial-fixture", raw: tutorial, pipeline, registry: registryHost() });
  assert.ok(compiled.ok, compiled.ok ? "" : compiled.errors.join("; "));
  const { record } = compiled;
  assert.equal(record.howtoType, "tutorial");
  assert.equal(record.objectives.length, 2);
  assert.deepEqual(record.explanation, [{ title: "The FASTA format", url: "https://en.wikipedia.org/wiki/FASTA_format" }]);
  const md = procedureMarkdown(record, parseProcedure({ file: "tutorial-fixture", raw: tutorial }));
  assert.match(md, /^- Type: Tutorial$/m);
  assert.match(md, /## Questions\n\n- What is in a FASTA file\?/);
  assert.match(md, /## Objectives\n\n- Write a small FASTA file/);
  for (const name of ["Linux", "macOS", "Windows"]) assert.match(md, new RegExp(`^   ${name}:$`, "m"));
  assert.match(md, /\(Select-String -Pattern '\^>' -Path reads\.fasta\)\.Count/);
  assert.match(md, /> Challenge: Add a fourth read/);
  assert.match(md, /> Solution: The count is 4/);
  assert.match(md, /## Key points\n\n- Every FASTA record starts/);
  assert.match(md, /## Explanation\n\n- \[The FASTA format\]\(https:\/\/en\.wikipedia\.org\/wiki\/FASTA_format\)/);
});
