/** The procedure page's troubleshooting table and cycling programs. */

import { html } from "~/components/procedure-materials";
import { cueStages, splitCyclingTables } from "~/kb/procedures/cycling.mjs";
import type { ProcedureRecord } from "~/kb/procedures/render.mjs";

export function TroubleshootingTable({ record }: { record: ProcedureRecord }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Troubleshooting">
      <table className="procedure-trouble">
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Problem</th>
            <th scope="col">Possible reason</th>
            <th scope="col">Solution</th>
          </tr>
        </thead>
        <tbody>
          {record.troubleshooting.map((row) => (
            <tr key={row.id} id={`trouble-${row.id}`}>
              <td>{row.step}</td>
              <td dangerouslySetInnerHTML={html(row.problem)} />
              <td dangerouslySetInnerHTML={html(row.reason)} />
              <td dangerouslySetInnerHTML={html(row.solution)} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Each section's blocks, with every cycling table in the prose marked for the program it prints, in page order
 * (cycling.mjs). The sheet keeps the tables: on paper at the bench a table is the compact form.
 */
export function proseWithPrograms(record: ProcedureRecord) {
  const programs = Array.isArray(record.cycling) ? record.cycling.length : 0;
  let next = 0;
  return record.sections.map((section) => ({
    section,
    blocks: section.blocks.map((block) => {
      if (block.type !== "prose") return { block, parts: [] };
      const split = splitCyclingTables(block.html, next, programs);
      next = split.next;
      return { block, parts: split.parts };
    }),
  }));
}

/**
 * A PCR program as a row of Apollo cue cards, one a stage, each with roll blocks under its strip (Capsomer's manual
 * theme). The blocks are drawn and hidden; the strip says the stage in words.
 */
export function CyclingProgram({ program }: { program: unknown }) {
  const stages = cueStages(program);
  const set =
    typeof (program as { set?: unknown })?.set === "string"
      ? (program as { set: string }).set
      : null;
  return (
    <ol
      className="procedure-program"
      aria-label={set ? `Cycling program: ${set}` : "Cycling program"}
    >
      {stages.map((stage, n) => (
        <li key={n} className="cap-cue">
          <p className="cap-cue-strip">
            <span>{set ?? "Cycling program"}</span>
            <span>
              Stage {n + 1} of {stages.length}
            </span>
          </p>
          <ol className="cap-roll" aria-hidden="true">
            {stages.map((_, k) => (
              <li key={k} data-state={k < n ? "done" : k === n ? "now" : "ahead"} />
            ))}
          </ol>
          <p className="cap-cue-title">{stage.title}</p>
          <ul className="cap-cue-lines">
            {stage.lines.map((l, k) => (
              <li key={k}>
                <span className="cap-cue-name">{l.name}</span>
                <span className="cap-cue-value">{l.value}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
