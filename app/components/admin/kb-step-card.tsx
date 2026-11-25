/** One step of a protocol as an editable card (kb-form-steps.tsx lists them). */
import { useRef, useState } from "react";
import { Button } from "capsomer/react/button";
import { RepeaterField } from "capsomer/react/repeater-field";
import { StepText } from "~/components/admin/kb-step-text";
import type { FormStep } from "~/kb/form.mjs";
import type { Choice, KbForm } from "~/kb/form.server";
import { plural } from "@drdustinedwards/site-helpers/text";
import { DURATIONS, ReferencePicker, UNITS } from "~/components/admin/kb-form-fields";
import { isGap } from "~/kb/procedures/gap.mjs";

type Flag = { kind: string; text: string; indent: string };
/** A note under a step, with its place among the step's lines (-1 for one just added). */
type FlagRow = { flag: Flag; at: number };

/** The things a step card can insert, from the protocol's own lists and the lab registry. */
export type Inserts = {
  reagents: Choice[];
  equipment: Choice[];
  primers: Choice[];
  strains: Choice[];
  /** The names a chip can take: the protocol's reagents and equipment as it lists them. */
  names: { reagent: string[]; equipment: string[] };
  references: KbForm["references"];
};

/** A step's words, what can be put into them, then its notes; Capsomer's SortableList draws its number and its moves. */
export function StepCard({
  step,
  label,
  anchor,
  flags,
  inserts,
  onChange,
  onInsert,
}: {
  step: FormStep;
  label: string;
  anchor: string;
  flags: readonly string[];
  inserts: Inserts;
  onChange: (step: FormStep) => void;
  onInsert: (
    kind: "reagent" | "equipment" | "primer" | "strain",
    value: string,
    amount?: string,
  ) => string | null;
}) {
  const caret = useRef<number | null>(null);
  const [amount, setAmount] = useState({ value: "", unit: "µl" });
  const [duration, setDuration] = useState({ value: "", unit: "minutes" });
  const [temperature, setTemperature] = useState("");
  const add = (words: string) => {
    if (!words) return;
    const at = Math.min(caret.current ?? step.text.length, step.text.length);
    const before = step.text.slice(0, at);
    const after = step.text.slice(at);
    const pad = before && !before.endsWith(" ") ? " " : "";
    onChange({
      ...step,
      text: `${before}${pad}${words}${after && !after.startsWith(" ") ? " " : ""}${after}`,
    });
    caret.current = before.length + pad.length + words.length;
  };
  const pick =
    (kind: "reagent" | "equipment" | "primer" | "strain") =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      e.target.value = "";
      if (!value) return;
      const words = onInsert(
        kind,
        value,
        kind === "reagent" && amount.value ? `${amount.value}%${amount.unit}` : undefined,
      );
      if (words) add(words);
    };
  const flagRows = step.lines.flatMap((line, at): FlagRow[] =>
    "kind" in line ? [{ flag: line as Flag, at }] : [],
  );
  const rawLines = step.lines
    .filter((line) => "raw" in line)
    .map((line) => (line as { raw: string }).raw);
  return (
    <div id={anchor} className="kb-step">
      <p className="cap-field-label" id={`${anchor}-label`}>
        What to do
      </p>
      <StepText
        id={`${anchor}-text`}
        label={`${label}: what to do`}
        text={step.text}
        names={inserts.names}
        caretRef={caret}
        onChange={(next) => onChange({ ...step, text: next })}
      />

      <details className="kb-insert">
        <summary>
          Insert into this step: a reagent, equipment, a primer, a strain, a timer or a temperature
        </summary>
        <div className="kb-inserts" role="group" aria-label={`${label}: insert`}>
          <label className="kb-cell kb-cell-sm">
            <span className="cap-field-label">Amount</span>
            <input
              className="cap-input"
              inputMode="decimal"
              value={amount.value}
              onChange={(e) => setAmount({ ...amount, value: e.target.value })}
            />
          </label>
          <label className="kb-cell kb-cell-sm">
            <span className="cap-field-label">Unit</span>
            <select
              className="cap-input"
              value={amount.unit}
              onChange={(e) => setAmount({ ...amount, unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label className="kb-cell">
            <span className="cap-field-label">Insert a reagent</span>
            <select className="cap-input" defaultValue="" onChange={pick("reagent")}>
              <option value="">Choose a reagent</option>
              {inserts.reagents.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="kb-cell">
            <span className="cap-field-label">Insert equipment</span>
            <select className="cap-input" defaultValue="" onChange={pick("equipment")}>
              <option value="">Choose equipment</option>
              {inserts.equipment.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="kb-cell">
            <span className="cap-field-label">Insert a primer</span>
            <select className="cap-input" defaultValue="" onChange={pick("primer")}>
              <option value="">Choose a primer</option>
              {inserts.primers.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="kb-cell">
            <span className="cap-field-label">Insert a strain</span>
            <select className="cap-input" defaultValue="" onChange={pick("strain")}>
              <option value="">Choose a strain</option>
              {inserts.strains.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="kb-cell kb-cell-pair">
            <label className="kb-cell kb-cell-sm">
              <span className="cap-field-label">Duration</span>
              <input
                className="cap-input"
                inputMode="decimal"
                value={duration.value}
                onChange={(e) => setDuration({ ...duration, value: e.target.value })}
              />
            </label>
            <select
              className="cap-input"
              aria-label="Duration unit"
              value={duration.unit}
              onChange={(e) => setDuration({ ...duration, unit: e.target.value })}
            >
              {DURATIONS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              disabledReason={duration.value ? undefined : "Type a duration first."}
              onClick={() => add(`~{${duration.value}%${duration.unit}}`)}
            >
              Insert timer
            </Button>
          </div>
          <div className="kb-cell kb-cell-pair">
            <label className="kb-cell kb-cell-sm">
              <span className="cap-field-label">Temperature, °C</span>
              <input
                className="cap-input"
                inputMode="decimal"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabledReason={temperature ? undefined : "Type a temperature first."}
              onClick={() => add(`${temperature} °C`)}
            >
              Insert temperature
            </Button>
          </div>
        </div>
      </details>

      <RepeaterField<FlagRow>
        legend="Notes"
        rows={flagRows}
        onChange={(next) => {
          // The other lines (commands, wrapped words) stay where they were; a new note goes last.
          const kept = new Set(next.map((r) => r.at));
          onChange({
            ...step,
            lines: [
              ...step.lines.filter((l, j) => !("kind" in l) || kept.has(j)),
              ...next.filter((r) => r.at < 0).map((r) => r.flag),
            ],
          });
        }}
        newRow={() => ({ flag: { kind: "CRITICAL", text: "", indent: "   " }, at: -1 })}
        rowLabel={(i) => `${label} note ${i + 1}`}
        addLabel="Add a note"
      >
        {({ flag, at }) => {
          const setFlag = (next: Flag) =>
            onChange({ ...step, lines: step.lines.map((l, j) => (j === at ? next : l)) });
          return (
            <>
              <select
                className="cap-input kb-flag-kind"
                aria-label={`${label}: note kind`}
                value={flag.kind}
                onChange={(e) => {
                  // A note that names something starts empty, to be picked; words carry over between the other kinds.
                  const named = (k: string) => k === "TROUBLESHOOTING" || k === "CALC";
                  const text = named(e.target.value) || named(flag.kind) ? "" : flag.text;
                  setFlag({ ...flag, kind: e.target.value, text });
                }}
              >
                {flags.map((f) => (
                  <option key={f} value={f}>
                    {f.charAt(0) + f.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              {flag.kind === "TROUBLESHOOTING" || flag.kind === "CALC" ? (
                <ReferencePicker
                  label={`${label}: ${flag.kind === "CALC" ? "calculator" : "troubleshooting row"}`}
                  choices={
                    flag.kind === "CALC"
                      ? inserts.references.calculators
                      : inserts.references.troubleshooting
                  }
                  empty={
                    flag.kind === "CALC"
                      ? "Choose a calculator"
                      : "Choose a row of the troubleshooting table"
                  }
                  text={flag.text}
                  onChange={(next) => setFlag({ ...flag, text: next })}
                />
              ) : (
                // A note that still says MISSING is marked invalid, so a Needs info link to its step lands on it.
                <input
                  className="cap-input"
                  aria-label={`${label}: ${flag.kind.toLowerCase()} note`}
                  aria-invalid={isGap(flag.text) || undefined}
                  value={flag.text}
                  onChange={(e) => setFlag({ ...flag, text: e.target.value })}
                />
              )}
            </>
          );
        }}
      </RepeaterField>
      {rawLines.length > 0 ? (
        <details className="kb-raw-lines">
          <summary>
            {plural(rawLines.length, "more line", "more lines")} under this step, as written
          </summary>
          <pre>
            <code>{rawLines.join("\n")}</code>
          </pre>
        </details>
      ) : null}
    </div>
  );
}
