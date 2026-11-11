import { start } from "capsomer/behavior/checklist-run";

import { labProcessRecord } from "../kb/procedures/run-record.mjs";

// An island (devkit ./islands): each <template data-island="run"> on the page calls this, and the first one runs it.
let started = false;

export default function startRun(): void {
  if (started) return;
  started = true;
  /*
   * Run mode (docs/PROCEDURES.md): a procedure page, worked at the bench, is Capsomer's checklist-run. The page is complete
   * as served; this adds, for a person who starts a run, a checklist over the steps it already has. The run lives in this
   * browser only, under the key saved runs already use. The server stays the one place amounts are computed: a new scale
   * is fetched as the page at that scale and the [data-run-swap] regions are swapped in.
   *
   * What stays the site's: which markup is the steps (below) and the JSON download, a Bioschemas LabProcess
   * (kb/procedures/run-record.mjs).
   */
  const root = document.querySelector<HTMLElement>(".procedure[data-run-path]");
  if (!root) throw new Error("run: this page has no .procedure[data-run-path] to run");
  start(root, {
    noun: "procedure",
    storageKey: `dustinedwards.run:${root.dataset.runPath ?? ""}`,
    steps: "li.procedure-step[data-step]",
    stepText: ".procedure-step-text",
    startSlot: ".procedure-links",
    scaleForm: "form.procedure-scale",
    markdownLabel: "Protocol",
    recordName: "dustinedwards.info run",
    toRecord: (run, steps, origin) => labProcessRecord(run, steps, origin),
  });
}
