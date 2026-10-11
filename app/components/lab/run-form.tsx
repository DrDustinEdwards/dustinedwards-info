// The form a lab member records a run with, and the correction of one: the protocol, the day, the outcome, a note and
// the lots it used. Plain fields, so it works with no script.

import { Form } from "react-router";
import { Button } from "capsomer/react/button";
import { Field } from "capsomer/react/field";

type Option = { value: string; label: string };

export function RunForm({
  procedures,
  lots,
  lotRows,
  replaces,
  defaults,
}: {
  procedures: Array<{ slug: string; title: string }>;
  lots: Option[];
  lotRows: number;
  /** The run this one corrects, if it is a correction. */
  replaces?: number;
  defaults?: { procedure?: string; run_on?: string; outcome?: string; note?: string | null; lots?: Array<{ lot_id: number; amount_used: number | null; emptied: number }> };
}) {
  return (
    <Form method="post" action={replaces ? `/lab/runs/${replaces}` : "/lab/runs"} className="lab-form">
      <div className="lab-fields">
        <Field label="Protocol" required>
          <select className="cap-input" name="procedure" required defaultValue={defaults?.procedure ?? ""}>
            <option value="" disabled>
              Choose a protocol
            </option>
            {procedures.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Day" help="Blank means today">
          <input className="cap-input" type="date" name="run_on" defaultValue={defaults?.run_on ?? ""} />
        </Field>
        <Field label="Outcome">
          <select className="cap-input" name="outcome" defaultValue={defaults?.outcome ?? "completed"}>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </Field>
      </div>
      <Field label="Note">
        <textarea className="cap-input" name="note" rows={3} defaultValue={defaults?.note ?? ""} />
      </Field>
      <fieldset className="lab-form">
        <legend className="cap-field-label">Lots used</legend>
        <p className="cap-field-help">
          {replaces
            ? "A correction records the lots for the trace and takes nothing from them; put a lot's amount right on its own page."
            : "The amount comes off the lot, in the lot's own unit. A lot first used here is marked opened."}
        </p>
        {Array.from({ length: lotRows }, (_, i) => {
          const d = defaults?.lots?.[i];
          return (
            <div className="lab-fields" key={i}>
              <Field label={`Lot ${i + 1}`}>
                <select className="cap-input" name={`lot-${i}`} defaultValue={d ? String(d.lot_id) : ""}>
                  <option value="">None</option>
                  {lots.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Amount used, lot ${i + 1}`}>
                <input className="cap-input" name={`amount-${i}`} inputMode="decimal" defaultValue={d?.amount_used ?? ""} />
              </Field>
              <label className="cap-check">
                <input type="checkbox" name={`emptied-${i}`} value="yes" defaultChecked={d?.emptied === 1} /> Emptied it
              </label>
            </div>
          );
        })}
      </fieldset>
      <div>
        <Button type="submit" variant="primary">
          {replaces ? `Record the correction of run ${replaces}` : "Record run"}
        </Button>
      </div>
    </Form>
  );
}
