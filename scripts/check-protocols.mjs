// Every procedure (content/procedures/, docs/PROCEDURES.md) and every procedure fixture compiles with no
// error, through the same code the operator API's save_procedure runs (app/lib/procedures/compile.mjs):
// a file this gate passes is a file the save tool accepts, and one it fails, the save tool refuses with
// the same words.
//
// A value nobody has yet is written in place as "MISSING: <why>". It passes and is printed below, so the
// list of what is waiting on Dustin is read off the files. A bare MISSING, or a required field left out,
// fails. Values are never filled to make this pass.

import { compileDirectory, PROCEDURE_FIXTURES_DIR, PROCEDURES_SOURCE_DIR } from "./lib/procedures.mjs";
import { createTally } from "./lib/tally.mjs";

const tally = createTally({ separator: ": " });
const { ok } = tally;

console.log("\ncheck:protocols\n");

const sources = await compileDirectory(PROCEDURES_SOURCE_DIR);
// Fixtures name photos that are not in the repository; their sizes are not measured.
const fixtures = await compileDirectory(PROCEDURE_FIXTURES_DIR, { measureImages: false });
ok(`${PROCEDURES_SOURCE_DIR} holds procedures`, sources.length > 0, "no procedure files");
ok(`${PROCEDURE_FIXTURES_DIR} holds the recipe and computational fixtures`, fixtures.length >= 2, "fixtures missing");

const paths = new Map();
for (const { file, compiled } of [...sources, ...fixtures]) {
  ok(`${file} compiles`, compiled.ok, compiled.errors.join("\n      "));
  if (compiled.ok) {
    const other = paths.get(compiled.record.path);
    ok(`${file} has its own path`, !other, `${compiled.record.path} is also ${other}`);
    paths.set(compiled.record.path, file);
  }
}
for (const { file, compiled } of fixtures) {
  if (compiled.ok) ok(`${file} is a draft`, compiled.record.draft, "a fixture is never published: set draft: true");
}
const profiles = new Set(fixtures.map((f) => (f.compiled.ok ? f.compiled.record.profile : null)));
ok("the fixtures cover the recipe and computational profiles", profiles.has("recipe") && profiles.has("computational"));

let recorded = 0;
for (const { file, compiled } of sources) {
  if (compiled.gaps.length === 0) continue;
  console.log(`\n  ${file}`);
  for (const gap of compiled.gaps) {
    recorded += 1;
    console.log(`    MISSING  ${gap.field}  (${gap.reason})`);
  }
}
console.log(`\n  ${sources.length} procedure(s), ${fixtures.length} fixture(s); ${recorded} value(s) recorded as missing.`);

/* 19 on 2026-09-30, measured by running the gate: two per procedure (five) and per fixture (two), two
   fixture drafts, two on the directories and one on the profiles. */
const MINIMUM_CHECKS = 19;
tally.floor("check:protocols", "checks", MINIMUM_CHECKS, "A procedure or fixture was skipped rather than failing.");

console.log(`\n${tally.checks} checks, ${tally.failures} failures\n`);
process.exit(tally.failures > 0 ? 1 : 0);
