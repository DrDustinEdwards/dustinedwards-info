import test from "node:test";
import assert from "node:assert/strict";

import {
  finishRun,
  newRun,
  setNote,
  setRunNote,
  toggleDone,
} from "capsomer/behavior/checklist-run-model";

import { labRunRecord } from "../app/kb/procedures/run.mjs";

/* The site's own half of run mode (app/kb/procedures/run.mjs): the JSON download as a Bioschemas LabProcess. The run
 * itself (timers, steps, the Markdown record, parseRun) is Capsomer's checklist-run-model and is tested there. */

const T0 = Date.UTC(2026, 9, 3, 15, 0, 0);
const procedure = {
  path: "/research/protocols/phage-dna-extraction",
  version: "3",
  title: "Phage DNA Extraction Protocol",
  scale: 5,
};
// Numbering restarts in a section that starts its own list, so a step is found by its key, not its number: the
// second "step 1" here is a different step from the first.
const STEPS = [
  {
    key: "part-a.1",
    number: 1,
    section: "Part A",
    text: "Add 20 µl ZnCl2 to each tube. Incubate for 5 minutes.",
  },
  {
    key: "part-a.2",
    number: 2,
    section: "Part A",
    text: "Spin 1 minute.\n   Remove the supernatant.",
  },
  { key: "part-b.1", number: 1, section: "Part B", text: "Dry the pellet." },
];
await test("the record is Capsomer's run record, named for this site, with the checklist named procedure", () => {
  let run = newRun(procedure, T0);
  run = toggleDone(run, "part-a.1", T0 + 60_000);
  run = setNote(run, "part-a.2", "centrifuge 2 was out");
  run = finishRun(run, T0 + 3_600_000);
  const rec = labRunRecord(run, STEPS);
  assert.equal(rec.record, "dustinedwards.info run");
  assert.equal(rec.format, 1);
  assert.deepEqual(rec.procedure, { path: procedure.path, title: procedure.title, version: "3" });
  assert.equal("checklist" in rec, false);
  assert.equal(rec.finishedAt, "2026-10-03T16:00:00.000Z");
  assert.deepEqual(
    rec.steps.map((s) => [s.step, s.section, s.done, s.note]),
    [
      [1, "Part A", true, ""],
      [2, "Part A", false, "centrifuge 2 was out"],
      [1, "Part B", false, ""],
    ],
    "the second step 1 is its own step",
  );
});

await test("the JSON record is a Bioschemas LabProcess that executes the procedure's LabProtocol, at the version run", () => {
  let run = newRun(procedure, T0);
  run = setRunNote(run, "second prep of the day");
  const going = labRunRecord(run, STEPS, "https://example.com");
  assert.equal(going["@type"], "LabProcess");
  assert.deepEqual(going["http://purl.org/dc/terms/conformsTo"], {
    "@id": "https://bioschemas.org/profiles/LabProcess/0.1-DRAFT",
  });
  assert.equal(going.name, "Run of Phage DNA Extraction Protocol");
  assert.deepEqual(going.executesLabProtocol, {
    "@type": "LabProtocol",
    "@id": "https://example.com/research/protocols/phage-dna-extraction#procedure",
    name: "Phage DNA Extraction Protocol",
    url: "https://example.com/research/protocols/phage-dna-extraction",
    version: "3",
  });
  assert.equal(going.startTime, "2026-10-03T15:00:00.000Z");
  assert.equal("endTime" in going, false, "a run still going has no end");
  assert.equal(going.description, "second prep of the day");
  assert.deepEqual(going.parameterValue, [{ "@type": "PropertyValue", name: "Scale", value: 5 }]);
  // A run on a frozen version's page executes the same protocol, at that version's address.
  const frozen = labRunRecord(
    finishRun(newRun({ ...procedure, path: `${procedure.path}/v/3` }, T0), T0 + 1000),
    STEPS,
    "https://example.com",
  );
  assert.equal(
    frozen.executesLabProtocol["@id"],
    "https://example.com/research/protocols/phage-dna-extraction#procedure",
  );
  assert.equal(
    frozen.executesLabProtocol.url,
    "https://example.com/research/protocols/phage-dna-extraction/v/3",
  );
  assert.equal(frozen.endTime, "2026-10-03T15:00:01.000Z");
});
