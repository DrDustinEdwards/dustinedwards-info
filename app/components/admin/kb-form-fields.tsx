import type { ReactNode } from "react";

import { Button } from "capsomer/react/button";

import { cellAnchor, fieldAnchor } from "~/kb/gap-labels.mjs";
import type { Choice, FormField, KbForm } from "~/kb/form.server";

/* The form editor's field inputs (kb-form.tsx): one input per field, the materials and equipment lists, and the reference picker. */

export type Values = Record<string, unknown>;
export type Material = Record<string, unknown> & { name?: string; reagent?: string };
export type EquipmentEntry = string | (Record<string, unknown> & { name?: string; equipment?: string });

const isGap = (value: unknown): value is string => typeof value === "string" && value.startsWith("MISSING:");
const reason = (value: unknown) => (isGap(value) ? value.replace(/^MISSING:\s*/, "") : null);
const shown = (value: unknown) => (value === undefined || value === null || isGap(value) ? "" : String(value));
export const UNITS = ["µl", "ml", "l", "mg", "g", "µg", "ng", "mM", "M", "%", "U", "tubes", "plates"];
export const DURATIONS = ["seconds", "minutes", "hours", "days"];

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
export function FieldInput({
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
export function ReferencePicker({ label, choices, empty, text, onChange }: { label: string; choices: Choice[]; empty: string; text: string; onChange: (text: string) => void }) {
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
