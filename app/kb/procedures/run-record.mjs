// The JSON a finished run downloads (docs/PROCEDURES.md "Run mode"): Capsomer's checklist-run keeps the run and its model
// (capsomer/behavior/checklist-run-model); this is the site's own record format, which is also a Bioschemas LabProcess
// (P4). Runs are private, so this download is the only place one is written. The protocol it executes is named by the
// `@id` the procedure's page gives its LabProtocol, and its version.

import { RUN_VERSION, when } from "capsomer/behavior/checklist-run-model";
import { thing } from "@drdustinedwards/site-helpers/schema";

import { SITE_ORIGIN } from "../../lib/site-origin.mjs";

const LAB_PROCESS_PROFILE = "https://bioschemas.org/profiles/LabProcess/0.1-DRAFT";

/**
 * @param {import("capsomer/behavior/checklist-run-model").Run} run
 * @param {import("capsomer/behavior/checklist-run-model").StepInfo[]} steps
 * @param {string} [origin] the site the run was made on
 */
export function labProcessRecord(run, steps, origin = SITE_ORIGIN) {
  // A run made on a frozen version's page carries its /v/ address; the protocol's identity is its plain page.
  const page = run.path.replace(/\/v\/[^/]+$/, "");
  // The LabProcess node is Prelum's `thing`; the record's own fields follow it as they are, since a null scale or an empty
  // note is part of the saved record's format (RUN_VERSION), not a missing fact.
  return {
    ...thing("LabProcess", {
      "http://purl.org/dc/terms/conformsTo": { "@id": LAB_PROCESS_PROFILE },
      name: `Run of ${run.title}`,
      executesLabProtocol: {
        "@type": "LabProtocol",
        "@id": `${origin}${page}#procedure`,
        name: run.title,
        url: `${origin}${run.path}`,
        ...(run.version ? { version: run.version } : {}),
      },
      startTime: when(run.startedAt),
      ...(run.finishedAt !== null ? { endTime: when(run.finishedAt) } : {}),
      ...(run.note.trim() ? { description: run.note.trim() } : {}),
      ...(run.scale !== null
        ? { parameterValue: [{ "@type": "PropertyValue", name: "Scale", value: run.scale }] }
        : {}),
    }),
    record: "dustinedwards.info run",
    format: RUN_VERSION,
    procedure: { path: run.path, title: run.title, version: run.version },
    scale: run.scale,
    startedAt: when(run.startedAt),
    finishedAt: when(run.finishedAt),
    note: run.note,
    steps: steps.map((s) => {
      const st = run.steps[String(s.key ?? s.number)] ?? { done: false, doneAt: null, note: "" };
      return {
        step: s.number,
        section: s.section ?? "",
        text: s.text,
        done: st.done,
        doneAt: when(st.doneAt),
        note: st.note,
      };
    }),
  };
}
