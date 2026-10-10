import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Form, Link, useNavigation } from "react-router";

import { Alert, Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { Panel } from "capsomer/react/panel";

import { PageHead } from "~/components/admin/page-head";
import { StepText } from "~/components/admin/kb-step-text";
import type { KbEditorActionData } from "~/components/admin/kb-file-editor";
import type { KbFile } from "~/kb/editor.server";
import type { FormBlock, FormBody, FormModel, FormStep } from "~/kb/form.mjs";
import { cellAnchor, fieldAnchor, stepAnchor } from "~/kb/gap-labels.mjs";
import type { Choice, FormField, KbForm } from "~/kb/form.server";

/*
 * The Knowledge Base's form editor (docs/KNOWLEDGE-BASE.md): every field its own input, the values nobody has yet at the
 * top as Needs info, and the method as step cards in their sections, reordered by dragging or with Move up and Move down
 * (Alt+Up and Alt+Down on a focused card), as WCAG 2.2's 2.5.7 asks of any drag. What it sends is the form's model; the
 * server writes the file from it (form.mjs) and runs the same Check and Save the raw editor does. The raw file stays one
 * link away, behind Advanced, which also works with no script.
 */

type Values = Record<string, unknown>;
type Material = Record<string, unknown> & { name?: string; reagent?: string };
type EquipmentEntry = string | (Record<string, unknown> & { name?: string; equipment?: string });

const isGap = (value: unknown): value is string => typeof value === "string" && value.startsWith("MISSING:");
const reason = (value: unknown) => (isGap(value) ? value.replace(/^MISSING:\s*/, "") : null);
const shown = (value: unknown) => (value === undefined || value === null || isGap(value) ? "" : String(value));
const UNITS = ["µl", "ml", "l", "mg", "g", "µg", "ng", "mM", "M", "%", "U", "tubes", "plates"];
const DURATIONS = ["seconds", "minutes", "hours", "days"];

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** An input's id from a field key, so a Needs info link lands on its input. */
const fieldId = fieldAnchor;

/**
 * A value set from an input: what was typed, or, for an input left empty, the gap the field held, so a field nobody has
 * an answer for yet keeps its reason rather than becoming blank.
 */
function fromInput(typed: string, original: unknown): unknown {
  if (typed !== "") return typed;
  return isGap(original) ? original : undefined;
}

function Field({ field, children, wide }: { field: FormField; children: ReactNode; wide?: boolean }) {
  const gap = field.gap;
  return (
    <div className={`cap-field kb-field${wide ? " kb-field-wide" : ""}${gap ? " kb-field-gap" : ""}`}>
      <label className="cap-field-label" htmlFor={fieldId(field.key)}>
        {field.label}
      </label>
      {children}
      {gap ? <p className="cap-field-help kb-gap-reason">Needs info: {gap}</p> : field.help ? <p className="cap-field-help">{field.help}</p> : null}
    </div>
  );
}

function Checks({ id, options, picked, onChange, label }: { id: string; options: Choice[]; picked: string[]; onChange: (next: string[]) => void; label: string }) {
  return (
    <fieldset className="kb-checks" id={id}>
      <legend className="cap-sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="kb-check">
          <input
            type="checkbox"
            checked={picked.includes(o.value)}
            onChange={(e) => onChange(e.target.checked ? [...picked, o.value] : picked.filter((v) => v !== o.value))}
          />{" "}
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

function MaterialsEditor({ id, rows, reagents, solutions, onChange }: { id: string; rows: Material[]; reagents: Choice[]; solutions: Choice[]; onChange: (rows: Material[]) => void }) {
  const set = (i: number, key: string, typed: string) =>
    onChange(rows.map((row, j) => (j === i ? { ...row, [key]: fromInput(typed, row[key]) } : row)));
  const cell = (row: Material, i: number, key: string, label: string) => (
    <label className="kb-cell">
      <span className="cap-field-label">{label}</span>
      <input
        id={row.name ? cellAnchor("materials", String(row.name), key) : undefined}
        className="cap-input"
        value={shown(row[key])}
        placeholder={reason(row[key]) ?? ""}
        aria-invalid={isGap(row[key]) || undefined}
        onChange={(e) => set(i, key, e.target.value)}
      />
    </label>
  );
  return (
    <div className="kb-rows" id={id}>
      {rows.map((row, i) => (
        <div className="kb-row" key={i}>
          {cell(row, i, "name", "Name")}
          <label className="kb-cell">
            <span className="cap-field-label">Registry reagent</span>
            <select className="cap-input" value={String(row.reagent ?? "")} onChange={(e) => set(i, "reagent", e.target.value)}>
              <option value="">None</option>
              {reagents.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {cell(row, i, "amount", "Amount")}
          {cell(row, i, "final", "Final")}
          {solutions.length > 0 || row.solution ? (
            <label className="kb-cell">
              <span className="cap-field-label">Made as</span>
              <select className="cap-input" value={String(row.solution ?? "")} onChange={(e) => set(i, "solution", e.target.value)}>
                <option value="">Not a solution made in the lab</option>
                {solutions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                {row.solution && !solutions.some((o) => o.value === row.solution) ? <option value={String(row.solution)}>A solution not in the solutions list</option> : null}
              </select>
            </label>
          ) : null}
          <Button type="button" variant="quiet" size="sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${shown(row.name) || "this row"}`}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" onClick={() => onChange([...rows, { name: "" }])}>
        Add a reagent
      </Button>
    </div>
  );
}

function EquipmentEditor({ id, rows, items, onChange }: { id: string; rows: EquipmentEntry[]; items: Choice[]; onChange: (rows: EquipmentEntry[]) => void }) {
  const asObject = (row: EquipmentEntry) => (typeof row === "string" ? { name: row } : row);
  const set = (i: number, key: string, typed: string) =>
    onChange(rows.map((row, j) => (j === i ? { ...asObject(row), [key]: typed === "" ? undefined : typed } : row)));
  return (
    <div className="kb-rows" id={id}>
      {rows.map((row, i) => {
        const r = asObject(row);
        return (
          <div className="kb-row" key={i}>
            <label className="kb-cell">
              <span className="cap-field-label">Name</span>
              <input className="cap-input" value={shown(r.name)} onChange={(e) => set(i, "name", e.target.value)} />
            </label>
            <label className="kb-cell">
              <span className="cap-field-label">Registry item</span>
              <select className="cap-input" value={String(r.equipment ?? "")} onChange={(e) => set(i, "equipment", e.target.value)}>
                <option value="">None</option>
                {items.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="quiet" size="sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${shown(r.name) || "this row"}`}>
              Remove
            </Button>
          </div>
        );
      })}
      <Button type="button" size="sm" onClick={() => onChange([...rows, { name: "" }])}>
        Add equipment
      </Button>
    </div>
  );
}

/** One field's input, by its kind. */
function FieldInput({
  field,
  value,
  original,
  yaml,
  form,
  onValue,
  onYaml,
}: {
  field: FormField;
  value: unknown;
  original: unknown;
  yaml: string;
  form: KbForm;
  onValue: (value: unknown) => void;
  onYaml: (text: string) => void;
}) {
  const id = fieldId(field.key);
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  switch (field.kind) {
    case "readonly":
      return (
        <Field field={field}>
          <p id={id} className="kb-readonly">
            <code>{field.yaml || "none"}</code>
          </p>
        </Field>
      );
    case "text":
      return (
        <Field field={field}>
          <input id={id} className="cap-input" value={shown(value)} placeholder={reason(original) ?? ""} onChange={(e) => onValue(fromInput(e.target.value, original))} />
        </Field>
      );
    case "textarea":
      return (
        <Field field={field} wide>
          <textarea id={id} className="cap-input" rows={3} value={shown(value)} onChange={(e) => onValue(fromInput(e.target.value, original))} />
        </Field>
      );
    case "lines":
      return (
        <Field field={field} wide>
          <textarea
            id={id}
            className="cap-input"
            rows={3}
            value={isGap(value) ? "" : list(value).join("\n")}
            onChange={(e) => {
              const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean);
              onValue(lines.length ? lines : isGap(original) ? original : undefined);
            }}
          />
        </Field>
      );
    case "date":
      return (
        <Field field={field}>
          <input id={id} type="date" className="cap-input" value={/^\d{4}-\d{2}-\d{2}$/.test(shown(value)) ? shown(value) : ""} onChange={(e) => onValue(fromInput(e.target.value, original))} />
        </Field>
      );
    case "number":
      return (
        <Field field={field}>
          <input
            id={id}
            type="number"
            min={0}
            className="cap-input"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onValue(e.target.value === "" ? (isGap(original) ? original : undefined) : Number(e.target.value))}
          />
        </Field>
      );
    case "checkbox":
      return (
        <div className="cap-field kb-field">
          <label className="kb-check" htmlFor={id}>
            <input id={id} type="checkbox" checked={value === true} onChange={(e) => onValue(e.target.checked ? true : original === undefined ? undefined : false)} /> {field.label}
          </label>
        </div>
      );
    case "select":
      return (
        <Field field={field}>
          <select id={id} className="cap-input" value={isGap(value) ? "" : shown(value)} onChange={(e) => onValue(fromInput(e.target.value, original))}>
            <option value="">Choose one</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      );
    case "choice":
      return (
        <Field field={field}>
          <div id={id} role="radiogroup" aria-label={field.label} className="kb-checks">
            {(field.options ?? []).map((o) => (
              <label key={o.value} className="kb-check">
                <input type="radio" name={`choice-${field.key}`} checked={value === o.value} onChange={() => onValue(o.value)} /> {o.label}
              </label>
            ))}
          </div>
        </Field>
      );
    case "multi":
      return (
        <Field field={field} wide>
          <Checks id={id} label={field.label} options={field.options ?? []} picked={list(value).map(String)} onChange={(next) => onValue(next.length ? next : isGap(original) ? original : undefined)} />
        </Field>
      );
    case "primers":
      return (
        <Field field={field} wide>
          <Checks
            id={id}
            label={field.label}
            options={form.registry.primer}
            picked={list(value).map((p) => String((p as { primer?: string }).primer))}
            onChange={(next) => onValue(next.length ? next.map((primer) => ({ primer })) : typeof original === "string" ? original : undefined)}
          />
        </Field>
      );
    case "strains": {
      const notApplicable = value === "not applicable";
      return (
        <Field field={field} wide>
          <label className="kb-check">
            <input type="checkbox" checked={notApplicable} onChange={(e) => onValue(e.target.checked ? "not applicable" : isGap(original) ? original : undefined)} /> Not applicable
          </label>
          {notApplicable ? null : (
            <Checks
              id={id}
              label={field.label}
              options={form.registry.strain}
              picked={list(value).map((s) => String((s as { strain?: string }).strain))}
              onChange={(next) => onValue(next.length ? next.map((strain) => ({ strain })) : isGap(original) ? original : undefined)}
            />
          )}
        </Field>
      );
    }
    case "materials":
      return (
        <Field field={field} wide>
          <MaterialsEditor id={id} rows={list(value) as Material[]} reagents={form.registry.reagent} solutions={form.references.solutions} onChange={(rows) => onValue(rows)} />
        </Field>
      );
    case "equipment":
      return (
        <Field field={field} wide>
          <EquipmentEditor id={id} rows={list(value) as EquipmentEntry[]} items={form.registry.equipment} onChange={(rows) => onValue(rows)} />
        </Field>
      );
    default:
      return (
        <Field field={{ ...field, help: field.help ?? "YAML, as in the file." }} wide>
          <textarea id={id} className="cap-input kb-yaml" rows={Math.min(12, Math.max(2, yaml.split("\n").length))} value={yaml} onChange={(e) => onYaml(e.target.value)} />
        </Field>
      );
  }
}

/**
 * A note that names something (a troubleshooting row, a calculator) is picked by name. A calculator's preset values
 * after its id are kept as written.
 */
function ReferencePicker({ label, choices, empty, text, onChange }: { label: string; choices: Choice[]; empty: string; text: string; onChange: (text: string) => void }) {
  const [first = "", ...rest] = text.trim().split(/\s+/).filter(Boolean);
  const id = first.includes("=") ? "" : first;
  const extra = first.includes("=") ? [first, ...rest] : rest;
  return (
    <select className="cap-input" aria-label={label} value={id} onChange={(e) => onChange([e.target.value, ...extra].filter(Boolean).join(" "))}>
      <option value="">{empty}</option>
      {choices.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {id && !choices.some((o) => o.value === id) ? <option value={id}>Not found; pick one from the list</option> : null}
    </select>
  );
}

/**
 * Scrolls to where a gap is filled in and puts the cursor there: the input itself, or in a step card the note that still
 * says MISSING. Without script the link is a plain #anchor.
 */
function goTo(e: React.MouseEvent | null, anchor: string) {
  const target = document.getElementById(anchor);
  if (!target) return;
  e?.preventDefault();
  target.scrollIntoView({ block: "center" });
  const inputs = [...target.querySelectorAll<HTMLInputElement>("input")];
  const field = target.matches("input, select, textarea") ? target : (inputs.find((i) => i.value.startsWith("MISSING:")) ?? target.querySelector<HTMLElement>("input, select, textarea"));
  (field ?? target).focus({ preventScroll: true });
  if (e) history.replaceState(null, "", `#${anchor}`);
}

/** The things a step card can insert, from the protocol's own lists and the lab registry. */
type Inserts = {
  reagents: Choice[];
  equipment: Choice[];
  primers: Choice[];
  strains: Choice[];
  /** The names a chip can take: the protocol's reagents and equipment as it lists them. */
  names: { reagent: string[]; equipment: string[] };
  references: KbForm["references"];
};

function StepCard({
  step,
  index,
  count,
  number,
  anchor,
  flags,
  inserts,
  onChange,
  onMove,
  onRemove,
  onInsert,
  dragProps,
}: {
  step: FormStep;
  index: number;
  count: number;
  number: number;
  anchor: string;
  flags: readonly string[];
  inserts: Inserts;
  onChange: (step: FormStep) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onInsert: (kind: "reagent" | "equipment" | "primer" | "strain", value: string, amount?: string) => string | null;
  dragProps: React.HTMLAttributes<HTMLLIElement>;
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
    onChange({ ...step, text: `${before}${pad}${words}${after && !after.startsWith(" ") ? " " : ""}${after}` });
    caret.current = before.length + pad.length + words.length;
  };
  const pick = (kind: "reagent" | "equipment" | "primer" | "strain") => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    e.target.value = "";
    if (!value) return;
    const words = onInsert(kind, value, kind === "reagent" && amount.value ? `${amount.value}%${amount.unit}` : undefined);
    if (words) add(words);
  };
  const flagLines = step.lines.flatMap((line, i) => ("kind" in line ? [{ line, i }] : []));
  const rawLines = step.lines.filter((line) => "raw" in line).map((line) => (line as { raw: string }).raw);
  const label = `Step ${number}`;
  return (
    <li
      id={anchor}
      className="kb-step"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        onMove(e.key === "ArrowUp" ? index - 1 : index + 1);
      }}
      {...dragProps}
    >
      <div className="kb-step-head">
        <span className="kb-drag" aria-hidden="true" title="Drag to reorder">
          ⠿
        </span>
        <span className="kb-step-number">{label}</span>
        <div className="app-actions" role="toolbar" aria-label={`${label}: move or remove`}>
          {/* Native buttons, so the first step's Move up and the last step's Move down are simply off, with no reason to read. */}
          <button type="button" className="cap-btn" data-variant="quiet" data-size="sm" aria-keyshortcuts="Alt+ArrowUp" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Move ${label.toLowerCase()} up`}>
            Move up
          </button>
          <button type="button" className="cap-btn" data-variant="quiet" data-size="sm" aria-keyshortcuts="Alt+ArrowDown" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`Move ${label.toLowerCase()} down`}>
            Move down
          </button>
          <Button type="button" size="sm" variant="quiet" onClick={onRemove} aria-label={`Remove ${label.toLowerCase()}`}>
            Remove
          </Button>
        </div>
      </div>
      <p className="cap-field-label" id={`${anchor}-label`}>
        What to do
      </p>
      <StepText id={`${anchor}-text`} label={`${label}: what to do`} text={step.text} names={inserts.names} caret={caret} onChange={(next) => onChange({ ...step, text: next })} />

      <details className="kb-insert">
        <summary>Insert into this step: a reagent, equipment, a primer, a strain, a timer or a temperature</summary>
      <div className="kb-inserts" role="group" aria-label={`${label}: insert`}>
        <label className="kb-cell kb-cell-sm">
          <span className="cap-field-label">Amount</span>
          <input className="cap-input" inputMode="decimal" value={amount.value} onChange={(e) => setAmount({ ...amount, value: e.target.value })} />
        </label>
        <label className="kb-cell kb-cell-sm">
          <span className="cap-field-label">Unit</span>
          <select className="cap-input" value={amount.unit} onChange={(e) => setAmount({ ...amount, unit: e.target.value })}>
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
            <input className="cap-input" inputMode="decimal" value={duration.value} onChange={(e) => setDuration({ ...duration, value: e.target.value })} />
          </label>
          <select className="cap-input" aria-label="Duration unit" value={duration.unit} onChange={(e) => setDuration({ ...duration, unit: e.target.value })}>
            {DURATIONS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <Button type="button" size="sm" disabledReason={duration.value ? undefined : "Type a duration first."} onClick={() => add(`~{${duration.value}%${duration.unit}}`)}>
            Insert timer
          </Button>
        </div>
        <div className="kb-cell kb-cell-pair">
          <label className="kb-cell kb-cell-sm">
            <span className="cap-field-label">Temperature, °C</span>
            <input className="cap-input" inputMode="decimal" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </label>
          <Button type="button" size="sm" disabledReason={temperature ? undefined : "Type a temperature first."} onClick={() => add(`${temperature} °C`)}>
            Insert temperature
          </Button>
        </div>
      </div>
      </details>

      {flagLines.map(({ line, i }) => {
        const flag = line as { kind: string; text: string; indent: string };
        return (
          <div className="kb-flag" key={i} data-flag={flag.kind}>
            <select
              className="cap-input"
              aria-label={`${label}: note kind`}
              value={flag.kind}
              onChange={(e) => {
                // A note that names something starts empty, to be picked; words carry over between the other kinds.
                const named = (k: string) => k === "TROUBLESHOOTING" || k === "CALC";
                const text = named(e.target.value) || named(flag.kind) ? "" : flag.text;
                onChange({ ...step, lines: step.lines.map((l, j) => (j === i ? { ...flag, kind: e.target.value, text } : l)) });
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
                choices={flag.kind === "CALC" ? inserts.references.calculators : inserts.references.troubleshooting}
                empty={flag.kind === "CALC" ? "Choose a calculator" : "Choose a row of the troubleshooting table"}
                text={flag.text}
                onChange={(next) => onChange({ ...step, lines: step.lines.map((l, j) => (j === i ? { ...flag, text: next } : l)) })}
              />
            ) : (
              <input
                className="cap-input"
                aria-label={`${label}: ${flag.kind.toLowerCase()} note`}
                value={flag.text}
                onChange={(e) => onChange({ ...step, lines: step.lines.map((l, j) => (j === i ? { ...flag, text: e.target.value } : l)) })}
              />
            )}
            <Button type="button" size="sm" variant="quiet" onClick={() => onChange({ ...step, lines: step.lines.filter((_, j) => j !== i) })} aria-label={`Remove this ${flag.kind.toLowerCase()} note`}>
              Remove
            </Button>
          </div>
        );
      })}
      <Button type="button" size="sm" onClick={() => onChange({ ...step, lines: [...step.lines, { kind: "CRITICAL", text: "", indent: "   " }] })}>
        Add a note
      </Button>
      {rawLines.length > 0 ? (
        <details className="kb-raw-lines">
          <summary>{plural(rawLines.length, "more line", "more lines")} under this step, as written</summary>
          <pre>
            <code>{rawLines.join("\n")}</code>
          </pre>
          <p className="cap-field-help">Commands, output and wrapped notes are kept as written; edit them under Advanced.</p>
        </details>
      ) : null}
    </li>
  );
}

function StepList({
  block,
  sectionTitle,
  flags,
  inserts,
  onChange,
  onInsert,
  announce,
}: {
  block: Extract<FormBlock, { type: "steps" }>;
  sectionTitle: string;
  flags: readonly string[];
  inserts: Inserts;
  onChange: (block: Extract<FormBlock, { type: "steps" }>) => void;
  onInsert: (kind: "reagent" | "equipment" | "primer" | "strain", value: string, amount?: string) => string | null;
  announce: (text: string) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= block.steps.length || from === to) return;
    const steps = [...block.steps];
    const [moved] = steps.splice(from, 1);
    if (!moved) return;
    steps.splice(to, 0, moved);
    onChange({ ...block, steps });
    announce(`Moved to step ${block.start + to} of ${block.start + steps.length - 1}, in ${sectionTitle}.`);
    // Focus stays on the step that moved, so it can be moved again and its new place is read out.
    requestAnimationFrame(() => list.current?.querySelectorAll<HTMLLIElement>(":scope > li")[to]?.focus());
  };
  return (
    <ol className="kb-steps" ref={list} start={block.start}>
      {block.steps.map((step, i) => (
        <StepCard
          key={i}
          step={step}
          index={i}
          count={block.steps.length}
          number={block.start + i}
          anchor={stepAnchor(sectionTitle, block.start + i)}
          flags={flags}
          inserts={inserts}
          onChange={(next) => onChange({ ...block, steps: block.steps.map((s, j) => (j === i ? next : s)) })}
          onMove={(to) => move(i, to)}
          onRemove={() => onChange({ ...block, steps: block.steps.filter((_, j) => j !== i) })}
          onInsert={onInsert}
          dragProps={{
            draggable: true,
            onDragStart: (e) => {
              setDragging(i);
              e.dataTransfer.effectAllowed = "move";
            },
            onDragOver: (e) => {
              if (dragging !== null) e.preventDefault();
            },
            onDrop: (e) => {
              e.preventDefault();
              if (dragging !== null) move(dragging, i);
              setDragging(null);
            },
            onDragEnd: () => setDragging(null),
            className: `kb-step${dragging === i ? " kb-step-dragging" : ""}`,
          }}
        />
      ))}
    </ol>
  );
}

function BodyEditor({
  body,
  flags,
  inserts,
  onChange,
  onInsert,
}: {
  body: FormBody;
  flags: readonly string[];
  inserts: Inserts;
  onChange: (body: FormBody) => void;
  onInsert: (kind: "reagent" | "equipment" | "primer" | "strain", value: string, amount?: string) => string | null;
}) {
  const [said, setSaid] = useState("");
  const setSection = (i: number, next: FormBody["sections"][number]) => onChange({ ...body, sections: body.sections.map((s, j) => (j === i ? next : s)) });
  return (
    <>
      <div aria-live="polite" className="cap-sr-only">
        {said}
      </div>
      <Panel title="Introduction">
        <div className="cap-field">
          <label className="cap-field-label" htmlFor="kb-intro">
            What this is, where it came from, who it is for
          </label>
          <textarea id="kb-intro" className="cap-input" rows={6} value={body.intro} onChange={(e) => onChange({ ...body, intro: e.target.value })} />
        </div>
      </Panel>
      {body.sections.map((section, i) => (
        <Panel key={i} title={section.heading || "New section"}>
          <div className="cap-field">
            <label className="cap-field-label" htmlFor={`kb-section-${i}`}>
              Section heading
            </label>
            <input id={`kb-section-${i}`} className="cap-input" value={section.heading} onChange={(e) => setSection(i, { ...section, heading: e.target.value })} />
          </div>
          {section.blocks.map((block, b) =>
            block.type === "prose" ? (
              // Blank lines between blocks are kept in the file and not shown as an empty box.
              block.text.trim() === "" ? null : (
              <div className="cap-field" key={b}>
                <label className="cap-field-label" htmlFor={`kb-prose-${i}-${b}`}>
                  Text
                </label>
                <textarea
                  id={`kb-prose-${i}-${b}`}
                  className="cap-input"
                  rows={Math.min(10, Math.max(2, block.text.split("\n").length))}
                  value={block.text}
                  onChange={(e) => setSection(i, { ...section, blocks: section.blocks.map((x, k) => (k === b ? { type: "prose", text: e.target.value } : x)) })}
                />
              </div>
              )
            ) : (
              <StepList
                key={b}
                block={block}
                sectionTitle={section.heading}
                flags={flags}
                inserts={inserts}
                onInsert={onInsert}
                announce={setSaid}
                onChange={(next) => setSection(i, { ...section, blocks: section.blocks.map((x, k) => (k === b ? next : x)) })}
              />
            ),
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const last = [...section.blocks].reverse().find((x) => x.type === "steps") as Extract<FormBlock, { type: "steps" }> | undefined;
              const step: FormStep = { number: 0, text: "", lines: [], blanksBefore: 0 };
              if (last) setSection(i, { ...section, blocks: section.blocks.map((x) => (x === last ? { ...last, steps: [...last.steps, step] } : x)) });
              else setSection(i, { ...section, blocks: [...section.blocks, { type: "prose", text: "" }, { type: "steps", start: 1, steps: [step] }] });
            }}
          >
            Add a step to {section.heading || "this section"}
          </Button>
        </Panel>
      ))}
      <Button type="button" onClick={() => onChange({ ...body, sections: [...body.sections, { heading: "New section", blocks: [{ type: "prose", text: "" }] }] })}>
        Add a section
      </Button>
    </>
  );
}

type PreviewResult = { html: string; styles: string[] } | { errors: string[] } | { error: string };

const PREVIEW_DELAY_MS = 900;
/** The width at which the preview sits beside the form; below it, the preview is a tab. Matches app/admin.css. */
const SIDE_BY_SIDE = "(min-width: 72rem)";

/**
 * The entry the form describes, rendered as its public page by the server a beat after the form stops changing. A
 * sequence number keeps a slow answer from landing over a newer one.
 */
function useEntryPreview(slug: string | null, original: string, model: string, active: boolean) {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (!slug || !active) return;
    const mine = (seq.current += 1);
    setBusy(true);
    const timer = window.setTimeout(async () => {
      const body = new FormData();
      body.set("original", original);
      body.set("model", model);
      try {
        const response = await fetch(`/admin/kb/preview/${slug}`, { method: "POST", body });
        const json = (await response.json().catch(() => null)) as PreviewResult | null;
        if (mine !== seq.current) return;
        setResult(json ?? { error: `The preview request failed with HTTP ${response.status}.` });
      } catch (error) {
        if (mine === seq.current) setResult({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [slug, original, model, active]);
  return { result, busy };
}

/**
 * The public page in a sandboxed frame: no script runs in it, and it links the public page's own stylesheets, so it
 * looks as the page will. A frame, because the page's styles are the public site's and the admin's are its own.
 */
function PreviewPane({ result, busy, publicHref }: { result: PreviewResult | null; busy: boolean; publicHref: string | null }) {
  const [doc, setDoc] = useState("");
  useEffect(() => {
    if (!result || !("html" in result)) return;
    const styles = result.styles.map((href) => `<link rel="stylesheet" href="${new URL(href, window.location.href).href}">`).join("");
    const theme = document.documentElement.getAttribute("data-theme");
    setDoc(`<!doctype html><html lang="en"${theme ? ` data-theme="${theme}"` : ""}><head><meta charset="utf-8"><base target="_blank">${styles}</head><body>${result.html}</body></html>`);
  }, [result]);
  const failed = result && "errors" in result ? result.errors : result && "error" in result ? [result.error] : null;
  return (
    <Panel title="Preview" src={busy ? "Updating" : failed ? "Not drawn" : "As the page will look"} flush>
      {failed ? (
        <div className="kb-preview-note">
          <Alert tone="warn" title="The page cannot be drawn until these are fixed">
            <ul>
              {failed.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}
      {doc ? (
        <iframe className="kb-preview-frame" title={`Preview of the page${publicHref ? ` at ${publicHref}` : ""}`} sandbox="" srcDoc={doc} />
      ) : (
        <p className="kb-preview-note">{busy || !result ? "Drawing the page…" : null}</p>
      )}
    </Panel>
  );
}

/** What the form posts: the model, with each YAML field sent as its text for the server to read. */
function posted(model: FormModel, values: Values, yaml: Record<string, string>, fields: FormField[], body: FormBody | null) {
  const data: Values = { ...values };
  for (const f of fields) if (f.kind === "yaml" && f.key in yaml) data[f.key] = { $yaml: yaml[f.key] };
  return JSON.stringify({ ...model, data, body });
}

export function KbFormEditor({
  file,
  form,
  actionData,
  saved,
  created,
}: {
  file: KbFile;
  form: KbForm;
  actionData?: KbEditorActionData;
  saved?: { commit: string; unchanged: boolean } | null;
  created?: boolean;
}) {
  const navigation = useNavigation();
  const busy = navigation.state === "submitting" ? String(navigation.formData?.get("intent") ?? "") : "";
  // A Check or a refused Save hands the form back as it was sent, so nothing typed is lost.
  const start = useMemo(() => {
    const sent = actionData && "model" in actionData && actionData.model ? (JSON.parse(actionData.model) as FormModel) : null;
    return sent ?? form.model;
  }, [actionData, form.model]);
  const [values, setValues] = useState<Values>(() => {
    const v = { ...start.data };
    for (const f of form.fields) if (f.kind === "yaml" && v[f.key] && typeof v[f.key] === "object" && "$yaml" in (v[f.key] as object)) delete v[f.key];
    return v;
  });
  const [yaml, setYaml] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.kind !== "yaml") continue;
      const sent = start.data[f.key];
      out[f.key] = sent && typeof sent === "object" && "$yaml" in (sent as object) ? String((sent as { $yaml: string }).$yaml) : (f.yaml ?? "");
    }
    return out;
  });
  const [body, setBody] = useState<FormBody | null>(start.body);
  const [duplicating, setDuplicating] = useState(actionData?.intent === "duplicate");
  // A Needs info link from the Knowledge Base list opens the editor at the gap's field.
  useEffect(() => {
    if (window.location.hash.length > 1) goTo(null, decodeURIComponent(window.location.hash.slice(1)));
  }, []);

  const checked = actionData?.intent === "check" ? actionData : null;
  const errors = checked ? checked.errors : actionData?.intent === "save" ? (actionData.refused ?? []) : file.errors;
  const gaps = checked ? checked.gaps : file.gaps;
  const original = form.model.data;
  const gapFields = form.fields.filter((f) => f.gap && f.kind !== "readonly");
  const otherFields = form.fields.filter((f) => !f.gap);
  // Gaps inside a field (a reagent's amount, a cycling step), which the field's own input holds.
  const topKeys = new Set(form.fields.map((f) => f.key));
  const nested = gaps.filter((g) => !topKeys.has(g.field));

  const materials = (Array.isArray(values.materials) ? values.materials : []) as Material[];
  const equipment = (Array.isArray(values.equipment) ? values.equipment : []) as EquipmentEntry[];
  const nameOf = (list: Choice[], value: string) => list.find((o) => o.value === value)?.label.replace(/ \(draft\)$/, "") ?? value;
  const inserts: Inserts = {
    reagents: [
      ...materials.filter((m) => m.name).map((m) => ({ value: `m:${m.name}`, label: String(m.name) })),
      ...form.registry.reagent.filter((r) => !materials.some((m) => m.reagent === r.value)).map((r) => ({ value: `r:${r.value}`, label: `${r.label} (from the registry)` })),
    ],
    equipment: [
      ...equipment.map((e) => (typeof e === "string" ? e : String(e.name ?? ""))).filter(Boolean).map((name) => ({ value: `m:${name}`, label: name })),
      ...form.registry.equipment.filter((r) => !equipment.some((e) => typeof e === "object" && e.equipment === r.value)).map((r) => ({ value: `r:${r.value}`, label: `${r.label} (from the registry)` })),
    ],
    primers: form.registry.primer,
    strains: form.registry.strain,
    names: {
      reagent: materials.map((m) => String(m.name ?? "")).filter(Boolean),
      equipment: equipment.map((e) => (typeof e === "string" ? e : String(e.name ?? ""))).filter(Boolean),
    },
    references: form.references,
  };

  /** An insert from a step card: a material or equipment the protocol does not list yet is added to its list, so the mark resolves. */
  const onInsert = (kind: "reagent" | "equipment" | "primer" | "strain", value: string, amount?: string): string | null => {
    if (kind === "reagent") {
      let name = value.slice(2);
      if (value.startsWith("r:")) {
        name = nameOf(form.registry.reagent, value.slice(2));
        setValues((v) => ({ ...v, materials: [...((Array.isArray(v.materials) ? v.materials : []) as Material[]), { name, reagent: value.slice(2) }] }));
      }
      return `@${name}{${amount ?? ""}}`;
    }
    if (kind === "equipment") {
      let name = value.slice(2);
      if (value.startsWith("r:")) {
        name = nameOf(form.registry.equipment, value.slice(2));
        setValues((v) => ({ ...v, equipment: [...((Array.isArray(v.equipment) ? v.equipment : []) as EquipmentEntry[]), { name, equipment: value.slice(2) }] }));
      }
      return `#${name}{}`;
    }
    if (kind === "primer") {
      setValues((v) => {
        const list = (Array.isArray(v.primers) ? v.primers : []) as Array<{ primer: string }>;
        return list.some((p) => p.primer === value) ? v : { ...v, primers: [...list, { primer: value }] };
      });
      return nameOf(form.registry.primer, value);
    }
    setValues((v) => {
      const list = (Array.isArray(v.host_strain) ? v.host_strain : []) as Array<{ strain: string }>;
      return list.some((s) => s.strain === value) ? v : { ...v, host_strain: [...list, { strain: value }] };
    });
    return nameOf(form.registry.strain, value);
  };

  const input = (f: FormField) => (
    <FieldInput
      key={f.key}
      field={f}
      value={values[f.key]}
      original={original[f.key]}
      yaml={yaml[f.key] ?? ""}
      form={form}
      onValue={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
      onYaml={(t) => setYaml((cur) => ({ ...cur, [f.key]: t }))}
    />
  );
  const isEntry = file.target.type === "entry";
  const modelJson = posted(form.model, values, yaml, form.fields, body);
  // The preview is drawn while it can be seen: beside the form on a wide screen, or on the phone when its tab is open.
  const [pane, setPane] = useState<"form" | "preview">("form");
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(SIDE_BY_SIDE);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const preview = useEntryPreview(file.target.type === "entry" ? file.target.slug : null, file.raw, modelJson, wide || pane === "preview");

  return (
    <div className="app-page">
      <PageHead
        crumbs={[
          { label: "Knowledge Base", href: "/admin/kb" },
          { label: file.group, href: file.listHref },
        ]}
        title={file.title}
        lead={
          <>
            <code>{file.file}</code>
            {file.publicHref ? (
              <>
                {" "}
                <Link to={file.publicHref} reloadDocument>
                  View the page
                </Link>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {isEntry ? (
              <Button type="button" onClick={() => setDuplicating(!duplicating)} aria-expanded={duplicating} aria-controls="kb-duplicate">
                Duplicate
              </Button>
            ) : null}
            <Link to="?view=file" className="cap-btn" data-variant="quiet">
              Advanced: edit the file
            </Link>
          </>
        }
      />

      {created ? <Banner tone="ok">A new draft, copied from the protocol named under Copied from. Nothing about it is public until you publish it.</Banner> : null}
      {saved ? (
        <Banner tone="ok">
          {saved.unchanged ? "Nothing to commit: the file was already this. Its page was brought up to date." : `Saved as commit ${saved.commit}. The page shows it on the next visit.`}
        </Banner>
      ) : null}

      {isEntry && duplicating ? (
        <Panel title="Duplicate as a new draft" description="A copy with its own title and address, recording that it came from this one. Its version, history and Start-here place are left behind.">
          <Form method="post" id="kb-duplicate" className="app-filters">
            <input type="hidden" name="intent" value="duplicate" />
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="kb-dup-title">
                New title
              </label>
              <input id="kb-dup-title" name="title" className="cap-input" required defaultValue={`${file.title} (variant)`} />
            </div>
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="kb-dup-slug">
                File name (optional)
              </label>
              <input id="kb-dup-slug" name="slug" className="cap-input" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="made from the title" />
            </div>
            <Button type="submit" variant="primary" pending={busy === "duplicate"}>
              Make the copy
            </Button>
          </Form>
          {actionData?.intent === "duplicate" ? (
            <Alert tone="crit" title="Not copied">
              <ul>
                {actionData.refused.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </Panel>
      ) : null}

      {isEntry ? (
        <div className="kb-pane-tabs" role="tablist" aria-label="Form or preview">
          <button type="button" role="tab" id="kb-tab-form" aria-controls="kb-pane-form" aria-selected={pane === "form"} className="cap-btn" data-variant={pane === "form" ? "primary" : "quiet"} onClick={() => setPane("form")}>
            Edit
          </button>
          <button type="button" role="tab" id="kb-tab-preview" aria-controls="kb-pane-preview" aria-selected={pane === "preview"} className="cap-btn" data-variant={pane === "preview" ? "primary" : "quiet"} onClick={() => setPane("preview")}>
            Preview
          </button>
        </div>
      ) : null}

      <div className={isEntry ? "kb-layout" : undefined} data-pane={pane}>
      <Form method="post" className="kb-editor-form kb-pane-form" id="kb-pane-form" role={isEntry && !wide ? "tabpanel" : undefined} aria-labelledby={isEntry && !wide ? "kb-tab-form" : undefined}>
        <input type="hidden" name="sha" value={file.sha} />
        <input type="hidden" name="original" value={file.raw} />
        <input type="hidden" name="model" value={modelJson} />

        {gapFields.length > 0 || nested.length > 0 ? (
          <Panel title="Needs info" count={gapFields.length + nested.length} description="Values nobody has yet. Fill one in here and it is saved with the rest; leave it empty and it keeps its reason.">
            <div className="kb-fields">{gapFields.map(input)}</div>
            {nested.length > 0 ? (
              <ul className="kb-nested-gaps">
                {nested.map((g) => (
                  <li key={`${g.field}#${g.reason}`}>
                    <a href={`#${g.anchor}`} onClick={(e) => goTo(e, g.anchor)}>
                      {g.label}
                    </a>
                    : {g.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        ) : null}

        <Panel title="Details">
          <div className="kb-fields">{otherFields.map(input)}</div>
        </Panel>

        {body ? <BodyEditor body={body} flags={form.flags} inserts={inserts} onChange={setBody} onInsert={onInsert} /> : null}

        <div className="kb-savebar">
          <div className="app-actions">
            <Button type="submit" name="intent" value="check" pending={busy === "check"}>
              Check
            </Button>
            <Button type="submit" name="intent" value="save" variant="primary" pending={busy === "save"}>
              Save
            </Button>
          </div>
          <div role="status">{checked?.ok ? <Banner tone="ok">Passes every check. Nothing was saved.</Banner> : null}</div>
          {actionData?.intent === "save" && actionData.conflict ? (
            <Alert tone="crit" title="Not saved">
              {actionData.conflict}
            </Alert>
          ) : null}
          {errors.length > 0 ? (
            <Alert tone="crit" title={`${plural(errors.length, "check fails", "checks fail")}`}>
              <ul>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </div>
      </Form>
      {isEntry ? (
        <aside className="kb-pane-preview" id="kb-pane-preview" role={wide ? undefined : "tabpanel"} aria-labelledby={wide ? undefined : "kb-tab-preview"} aria-label={wide ? "Preview" : undefined}>
          <PreviewPane result={preview.result} busy={preview.busy} publicHref={file.publicHref} />
        </aside>
      ) : null}
      </div>
    </div>
  );
}
