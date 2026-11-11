// Run mode (docs/PROCEDURES.md "Run mode") is Capsomer's checklist run: what a bench run is, how its timers count,
// what the Markdown record says and how a stored run is read back, all in capsomer/behavior/checklist-run-model
// (extracted from this file). What stays here is the site's own: the JSON download as a Bioschemas LabProcess.

import { thing } from "@drdustinedwards/site-helpers/schema";
import { runRecord, when } from "capsomer/behavior/checklist-run-model";

import { SITE_ORIGIN } from "../../lib/site-origin.mjs";

/** The Bioschemas profile a run's download follows (docs/KNOWLEDGE-BASE.md, P4). */
const LAB_PROCESS_PROFILE = "https://bioschemas.org/profiles/LabProcess/0.1-DRAFT";

/**
 * The saved record as a plain object: what a download is, and what survives the browser. Capsomer's run record (only
 * what the person entered or did, with the procedure's own identity so the record says which version it followed),
 * with the checklist named `procedure`.
 *
 * It is also a Bioschemas LabProcess (P4): runs are private, so this download is the only place one is written. The
 * protocol it executes is named by the `@id` the procedure's page gives its LabProtocol, and its version.
 *
 * A step's `key` is unique in the procedure (its section and its number: numbering restarts in a section that starts
 * its own list), `number` is the one the page prints.
 *
 * @param {import("capsomer/behavior/checklist-run-model").Run} run
 * @param {import("capsomer/behavior/checklist-run-model").StepInfo[]} steps
 * @param {string} [origin] the site the run was made on
 */
export function labRunRecord(run, steps, origin = SITE_ORIGIN) {
  // A run made on a frozen version's page carries its /v/ address; the protocol's identity is its plain page.
  const page = run.path.replace(/\/v\/[^/]+$/, "");
  const { checklist, ...record } = runRecord(run, steps, "dustinedwards.info run");
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
    record: record.record,
    format: record.format,
    procedure: checklist,
    scale: record.scale,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    note: record.note,
    steps: record.steps,
  };
}
