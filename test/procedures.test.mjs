/**
 * The procedure format (docs/PROCEDURES.md): marks.mjs reads the Cooklang marks and the conditions a
 * step states, parse.mjs reads a file into sections and steps, and validate.mjs judges it. check:protocols
 * and save_procedure share validate.mjs, so a rule tested here is the rule both apply.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { slug as githubSlug } from "github-slugger";

import { formatQuantity, parseQuantity, readConditions, segmentText, tokenize } from "../app/lib/procedures/marks.mjs";
import { allSteps, headingId, parseProcedure } from "../app/lib/procedures/parse.mjs";
import { validateProcedure } from "../app/lib/procedures/validate.mjs";

/** @param {string} slug @param {string} raw */
function check(slug, raw) {
  return validateProcedure(parseProcedure({ file: slug, raw }), { slug });
}

/** @param {string} raw */
function stepsOf(raw) {
  return allSteps(parseProcedure({ file: "t", raw }));
}

/** @param {string[]} errors @param {RegExp} pattern */
function assertError(errors, pattern) {
  assert.ok(errors.some((e) => pattern.test(e)), `expected an error matching ${pattern}, got ${JSON.stringify(errors)}`);
}

// ---------------------------------------------------------------- marks.mjs

test("a single-word mark ends at the word; a braced mark runs to its brace", () => {
  assert.deepEqual(tokenize("Add @salt."), [
    { type: "text", value: "Add " },
    { type: "material", name: "salt", display: "salt", quantity: null },
    { type: "text", value: "." },
  ]);
  const [, lysate] = tokenize("Add @high-titer lysate{5%ml} now");
  assert.equal(lysate?.type, "material");
  assert.equal(lysate?.type === "material" && lysate.name, "high-titer lysate");
  assert.equal(lysate?.type === "material" && lysate.quantity?.unit, "ml");
  const [, bowl] = tokenize("Use #mixing bowl{} and #skillet");
  assert.deepEqual(bowl, { type: "equipment", name: "mixing bowl", display: "mixing bowl" });
  assert.deepEqual(tokenize("Use #skillet").at(-1), { type: "equipment", name: "skillet", display: "skillet" });
});

test("the alias form keeps the material's name and shows the other words", () => {
  const [, zinc] = tokenize("Add @zinc chloride|2 M ZnCl2{20%µl}.");
  assert.equal(zinc?.type, "material");
  if (zinc?.type !== "material") return;
  assert.equal(zinc.name, "zinc chloride");
  assert.equal(zinc.display, "2 M ZnCl2");
  assert.equal(segmentText(zinc), "20 µl of 2 M ZnCl2");
});

test("a fixed amount is marked fixed, and a range reads its two ends", () => {
  const [, salt] = tokenize("Add @salt{=1%tsp}");
  assert.equal(salt?.type === "material" && salt.quantity?.fixed, true);
  assert.deepEqual(parseQuantity("30 to 60%minutes"), {
    raw: "30 to 60%minutes",
    amount: "30 to 60",
    unit: "minutes",
    fixed: false,
    min: 30,
    max: 60,
  });
  assert.equal(parseQuantity("1 1/2%cup")?.min, 1.5);
  assert.equal(parseQuantity(""), null);
});

test("a timer reads with or without a label", () => {
  const [, plain] = tokenize("Wait ~{10%minutes}.");
  assert.deepEqual(plain, {
    type: "timer",
    label: "",
    quantity: { raw: "10%minutes", amount: "10", unit: "minutes", fixed: false, min: 10, max: 10 },
  });
  const [, rise] = tokenize("Rest ~rise{1%hour}.");
  assert.equal(rise?.type === "timer" && rise.label, "rise");
  assert.equal(rise && segmentText(rise), "1 hour");
});

test("anchors, link targets, inline code and email addresses are not marks", () => {
  for (const text of [
    "See (#anchor) for more.",
    "See [the table](#troubleshooting).",
    "Run `x @foo{1%g} #bar{}` as written.",
    "Write to someone@example.com today.",
  ]) {
    assert.deepEqual(tokenize(text), [{ type: "text", value: text }], text);
  }
  const marks = tokenize("See [refs](#refs) then use #bowl").filter((s) => s.type !== "text");
  assert.deepEqual(marks, [{ type: "equipment", name: "bowl", display: "bowl" }]);
});

test("formatQuantity scales amounts and ranges, and leaves fixed amounts alone", () => {
  const q = (/** @type {string} */ s) => /** @type {NonNullable<ReturnType<typeof parseQuantity>>} */ (parseQuantity(s));
  assert.equal(formatQuantity(q("250%g")), "250 g");
  assert.equal(formatQuantity(q("250%g"), 2), "500 g");
  assert.equal(formatQuantity(q("=1%tsp"), 3), "1 tsp");
  assert.equal(formatQuantity(q("30 to 60%minutes"), 0.5), "15 to 30 minutes");
  assert.equal(formatQuantity(q("1.25 to 5%µl")), "1.25 to 5 µl");
  assert.equal(formatQuantity(q("1/2%cup"), 2), "1 cup");
  assert.equal(formatQuantity(q("5000%ml"), 2), "10,000 ml");
  assert.equal(formatQuantity(q("1%tbsp"), 1 / 3), "0.333 tbsp");
  assert.equal(formatQuantity(q("a pinch"), 2), "a pinch");
});

test("readConditions reads temperatures, including below zero and ranges", () => {
  const { temperatures } = readConditions("Hold at -80 °C, then 55 to 60 °C, then 55-60 °C, then 37 °C.");
  assert.deepEqual(
    temperatures.map(({ min, max }) => [min, max]),
    [
      [-80, -80],
      [55, 60],
      [55, 60],
      [37, 37],
    ],
  );
});

test("readConditions reads spins in rpm and in x g, including a range", () => {
  const { spins } = readConditions("Spin at 10,000 rpm, then at 10,000 to 15,000 x g, then 12,000 x g.");
  assert.deepEqual(
    spins.map(({ speed, unit }) => [speed, unit]),
    [
      ["10,000", "rpm"],
      ["10,000 to 15,000", "x g"],
      ["12,000", "x g"],
    ],
  );
});

// ---------------------------------------------------------------- parse.mjs

const BODY = `---
profile: protocol
---

The intro.

## Part A: collect the phage and open the capsids

Prose before the list.

1. First step.
2. Second step.
   > WHY: **Why this?** The first line.
   > The second line.
   > CRITICAL: Do it fast.
   > SPIN: 12,000 x g

Prose after the list.

## Part B {#custom-id}

3. Third step continues the numbering.

## Rescue

1. A separate method restarts at 1.
   ![A pellet at the bottom of a tube.](/media/pellet.jpg)
   \`\`\`bash
   echo hi
   \`\`\`
   \`\`\`output
   hi
   \`\`\`

## Notes

Only prose here.
`;

test("the body reads as an intro and sections, each a run of prose and step lists", () => {
  const p = parseProcedure({ file: "t", raw: BODY });
  assert.deepEqual(p.problems, []);
  assert.equal(p.intro, "The intro.");
  assert.deepEqual(
    p.sections.map((s) => [s.id, s.blocks.map((b) => b.type).join(" ")]),
    [
      ["part-a-collect-the-phage-and-open-the-capsids", "prose steps prose"],
      ["custom-id", "steps"],
      ["rescue", "steps"],
      ["notes", "prose"],
    ],
  );
  const [a] = p.sections;
  assert.equal(a?.blocks[0]?.type === "prose" && a.blocks[0].markdown, "Prose before the list.");
  assert.equal(a?.blocks[2]?.type === "prose" && a.blocks[2].markdown, "Prose after the list.");
});

test("step numbers are the ones written: a list continues or restarts at 1", () => {
  assert.deepEqual(stepsOf(BODY).map((s) => s.number), [1, 2, 3, 1]);
});

test("a step's flags are read, and a quoted line continues the flag above it", () => {
  const step = stepsOf(BODY)[1];
  assert.deepEqual(step?.flags.why, ["**Why this?** The first line.\nThe second line."]);
  assert.deepEqual(step?.flags.critical, ["Do it fast."]);
  assert.deepEqual(step?.flags.spin, ["12,000 x g"]);
  assert.equal(step?.source, "Second step.");
});

test("a fenced block under a step is a command, and an output block after it is its output", () => {
  const step = stepsOf(BODY)[3];
  assert.deepEqual(step?.commands, [{ lang: "bash", code: "echo hi", output: "hi" }]);
  assert.deepEqual(step?.photos, [{ alt: "A pellet at the bottom of a tube.", src: "/media/pellet.jpg" }]);
  assert.equal(step?.source, "A separate method restarts at 1.");
});

test("a quoted line under a step that follows no flag is a problem", () => {
  const p = parseProcedure({ file: "t", raw: "## A\n\n1. Step.\n   > not a flag\n" });
  assertError(p.problems, /quoted line that follows no flag/);
});

test("steps before the first heading are a problem", () => {
  const p = parseProcedure({ file: "t", raw: "1. Too early.\n\n## A\n\n1. Fine.\n" });
  assertError(p.problems, /before the first ## heading/);
});

test("headingId gives the id github-slugger gives the same words", () => {
  assert.equal(
    headingId("Part A: collect the phage and open the capsids"),
    "part-a-collect-the-phage-and-open-the-capsids",
  );
  for (const title of [
    "Coming from the old Baylor PDF",
    "Checking DNA quantity and quality",
    "Step 1 (optional)",
    "A - B",
    "Café & crème",
    "ZnCl2/TES, 5x",
    "It's “quoted”",
  ]) {
    assert.equal(headingId(title), githubSlug(title), title);
  }
});

test("headingId drops superscripts and vulgar fractions the way github-slugger does", () => {
  assert.equal(headingId("x² and ½"), githubSlug("x² and ½"));
});

// ---------------------------------------------------------------- validate.mjs

for (const [slug, path] of [
  ["recipe-fixture", "test/fixtures/procedures/recipe-fixture.md"],
  ["computational-fixture", "test/fixtures/procedures/computational-fixture.md"],
  ["phage-dna-extraction", "content/procedures/phage-dna-extraction.md"],
]) {
  test(`${path} validates with no errors`, () => {
    const { errors } = check(slug, readFileSync(path, "utf8"));
    assert.deepEqual(errors, []);
  });
}

test("the recipe fixture scales its amounts but not its fixed salt", () => {
  const steps = stepsOf(readFileSync("test/fixtures/procedures/recipe-fixture.md", "utf8"));
  const first = steps[0]?.segments.map((s) => segmentText(s, 2)).join("");
  assert.equal(first, "Whisk 500 g of flour, 1 tsp of salt and 2 tsp of yeast in a mixing bowl.");
  assert.equal(steps.flatMap((s) => s.photos).length, 1);
});

const PROTOCOL = `---
profile: protocol
method: [pcr]
path: /research/protocols/mini
title: Mini protocol
seo_title: Mini protocol
description: A small protocol for the tests.
version: "1"
updated: 2026-09-30
status: draft
last_run: 2026-09-01
host_strain: Test strain
biosafety: not applicable
scale: { count: 1, unit: tube }
based_on:
  - citation: Test source
    for: the method
materials:
  - name: buffer
    amount: 10 µl
equipment:
  - microcentrifuge
troubleshooting:
  - id: low-yield
    step: "1"
    problem: Low yield.
    reason: Too little buffer.
    solution: Add more.
expected_results: A result.
limitations: A limit.
references:
  - "Test reference."
---

## Method

1. Add @buffer{10%µl} to the tube. Incubate at 37 °C for ~{5%minutes}.
   > TROUBLESHOOTING: low-yield
`;

test("the small protocol the negative tests mutate is itself valid", () => {
  assert.deepEqual(check("mini", PROTOCOL), { errors: [], gaps: [] });
});

test("a bare MISSING is an error", () => {
  const { errors } = check("mini", PROTOCOL.replace('version: "1"', "version: MISSING"));
  assertError(errors, /^version is "MISSING": write MISSING: and the reason/);
});

test('"MISSING: reason" is a recorded gap, not an error', () => {
  const { errors, gaps } = check("mini", PROTOCOL.replace('version: "1"', 'version: "MISSING: not assigned yet"'));
  assert.deepEqual(errors, []);
  assert.deepEqual(gaps, [{ field: "version", reason: "not assigned yet" }]);
});

test("a required field left out is an error", () => {
  const { errors } = check("mini", PROTOCOL.replace("limitations: A limit.\n", ""));
  assertError(errors, /^limitations is required/);
});

test("the library's facets: method is required, and method, organism and course are ids from the closed lists", () => {
  assertError(check("mini", PROTOCOL.replace("method: [pcr]\n", "")).errors, /^method is required/);
  assertError(check("mini", PROTOCOL.replace("method: [pcr]", "method: [PCR]")).errors, /method "PCR" is not one of: pcr, plating/);
  assertError(check("mini", PROTOCOL.replace("method: [pcr]", "method: pcr")).errors, /method must be a list of ids/);
  assertError(check("mini", PROTOCOL.replace("method: [pcr]", "method: [pcr, pcr]")).errors, /method names one id twice/);
  const withOthers = PROTOCOL.replace("method: [pcr]\n", "method: [pcr, plating]\norganism: [smegmatis]\ncourse: [virus-isolation]\ntarget: [GAPDH]\n");
  assert.deepEqual(check("mini", withOthers), { errors: [], gaps: [] });
  assertError(check("mini", withOthers.replace("organism: [smegmatis]", "organism: [mouse]")).errors, /organism "mouse" is not one of: smegmatis, foliorum, avian/);
  assertError(check("mini", withOthers.replace("course: [virus-isolation]", "course: [chemistry]")).errors, /course "chemistry" is not one of/);
  assertError(check("mini", withOthers.replace("target: [GAPDH]", "target: [GAPDH, '']")).errors, /target must be a list of the genes, regions or samples/);
  assert.deepEqual(check("mini", withOthers.replace("organism: [smegmatis]", 'organism: "MISSING: not yet recorded"')).errors, [], "a recorded gap is allowed");
});

test("a protocol step that spins in rpm with no SPIN flag is an error", () => {
  const raw = `${PROTOCOL}2. Spin in the #microcentrifuge at 10,000 rpm for ~{1%minute}.\n`;
  assertError(check("mini", raw).errors, /step 2 spins with no g-force/);
  const flagged = `${raw}   > SPIN: MISSING: the rotor is not recorded\n`;
  assert.deepEqual(check("mini", flagged).errors, []);
});

test("an undeclared @material in a protocol is an error", () => {
  const raw = PROTOCOL.replace("@buffer{10%µl}", "@water{10%µl}");
  assertError(check("mini", raw).errors, /@water is not in materials/);
});

test("an undeclared #equipment in a protocol is an error", () => {
  const raw = `${PROTOCOL}2. Warm it in a #heat block{}.\n`;
  assertError(check("mini", raw).errors, /#heat block is not in equipment/);
});

test("biosafety that names a biosafety level is an error", () => {
  const raw = PROTOCOL.replace("biosafety: not applicable", "biosafety: { organism: Test organism, strain: BSL-2 }");
  assertError(check("mini", raw).errors, /biosafety names a biosafety level/);
});

test("a TROUBLESHOOTING flag naming an unknown row is an error", () => {
  const raw = PROTOCOL.replace("> TROUBLESHOOTING: low-yield", "> TROUBLESHOOTING: no-such-row");
  assertError(check("mini", raw).errors, /TROUBLESHOOTING names "no-such-row"/);
});

test("seo_title over 60 characters is an error", () => {
  const raw = PROTOCOL.replace("seo_title: Mini protocol", `seo_title: ${"x".repeat(61)}`);
  assertError(check("mini", raw).errors, /seo_title is 61 characters/);
});

test("a path that does not match the file's slug is an error", () => {
  assertError(check("other", PROTOCOL).errors, /a protocol named other\.md lives at \/research\/protocols\/other/);
});

test("step numbering that skips is an error", () => {
  const raw = `${PROTOCOL}3. Skipped a number.\n`;
  assertError(check("mini", raw).errors, /step 3 follows step 1/);
});

const COMPUTATIONAL = `---
profile: computational
method: [annotation]
path: /research/methods/mini
title: Mini method
seo_title: Mini method
description: A small computational method for the tests.
version: "1"
updated: 2026-09-30
environment: bash
prerequisites: []
materials:
  - name: grep
    kind: software
    version: "3.11"
based_on:
  - citation: Test source
    for: the method
expected_results: A count.
limitations: A limit.
references:
  - "Test reference."
---

## Method

1. Count with @grep.
   \`\`\`bash
   grep -c x file
   \`\`\`
   \`\`\`output
   1
   \`\`\`
`;

test("the small computational method the negative tests mutate is itself valid", () => {
  const raw = COMPUTATIONAL.replace("prerequisites: []", "prerequisites:\n  - a shell");
  assert.deepEqual(check("mini", raw).errors, []);
});

test("a computational command without its output is an error", () => {
  const raw = COMPUTATIONAL.replace("prerequisites: []", "prerequisites:\n  - a shell").replace(
    "   ```output\n   1\n   ```\n",
    "",
  );
  assertError(check("mini", raw).errors, /a command needs its expected output/);
});

test("computational software needs its version", () => {
  const raw = COMPUTATIONAL.replace("prerequisites: []", "prerequisites:\n  - a shell").replace('    version: "3.11"\n', "");
  assertError(check("mini", raw).errors, /materials\[grep\] is software and needs its version/);
});
