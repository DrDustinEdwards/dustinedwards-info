import { Field } from "capsomer/react/field";
import { RepeaterField } from "capsomer/react/repeater-field";
import { FieldFromSpec, SchemaFields, type SpecRenderers } from "capsomer/react/schema-form";
import type { FieldSpec } from "capsomer/behavior/schema-form";

import { FIELD_PREFIX, cellAnchor } from "~/kb/gap-labels.mjs";
import type { Choice, FormField, KbForm } from "~/kb/form.server";

/* The form editor's fields (kb-form.tsx): Capsomer's fields from each field's spec, dei's own kinds (the materials and
   equipment lists, primers, strains, YAML) drawn by renderers, and the reference picker. */

export type Values = Record<string, unknown>;
export type Material = Record<string, unknown> & { name?: string; reagent?: string };
export type EquipmentEntry =
  | string
  | (Record<string, unknown> & { name?: string; equipment?: string });

export const isGap = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("MISSING:");
const reason = (value: unknown) => (isGap(value) ? value.replace(/^MISSING:\s*/, "") : null);
const shown = (value: unknown) =>
  value === undefined || value === null || isGap(value) ? "" : String(value);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const UNITS = [
  "µl",
  "ml",
  "l",
  "mg",
  "g",
  "µg",
  "ng",
  "mM",
  "M",
  "%",
  "U",
  "tubes",
  "plates",
];
export const DURATIONS = ["seconds", "minutes", "hours", "days"];

const NOT_APPLICABLE = "not applicable";
/** dei's own kinds, drawn by the renderers below, each across the whole row. */
const OWN_KINDS = new Set(["materials", "equipment", "primers", "strains", "yaml"]);

/** What an input shows: a gap is an empty input whose placeholder and help give its reason. */
function display(field: FormField, value: unknown): unknown {
  if (field.kind === "readonly") return field.yaml;
  if (field.kind === "checkbox" || OWN_KINDS.has(field.kind)) return value;
  if (field.kind === "date")
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  if (field.kind === "number") return typeof value === "number" ? value : undefined;
  return isGap(value) ? undefined : value;
}

/**
 * A value set from an input. An input left empty keeps the gap the field held, so a field nobody has an answer for yet
 * keeps its reason rather than becoming blank; a checkbox the file never had stays out of it when unticked.
 */
function fromInput(field: FormField, value: unknown, original: unknown): unknown {
  if (OWN_KINDS.has(field.kind)) return value;
  if (field.kind === "checkbox")
    return value === true ? true : original === undefined ? undefined : false;
  if (value !== undefined) return value;
  return isGap(original) ? original : undefined;
}

/** A field's spec as Capsomer draws it: a gap's reason is its help, as Needs info, and its placeholder. */
function specFor(field: FormField, original: unknown): FieldSpec {
  const { yaml: _yaml, gap, ...spec } = field;
  return {
    ...spec,
    help: gap
      ? `Needs info: ${gap}`
      : field.kind === "yaml"
        ? (field.help ?? "YAML, as in the file.")
        : field.help,
    placeholder: reason(original) ?? undefined,
    wide: OWN_KINDS.has(field.kind) || undefined,
  };
}

function MaterialCells({
  listKey,
  row,
  set,
  reagents,
  solutions,
}: {
  listKey: string;
  row: Material;
  set: (patch: Partial<Material>) => void;
  reagents: Choice[];
  solutions: Choice[];
}) {
  const change = (key: string, typed: string) =>
    set({ [key]: typed !== "" ? typed : isGap(row[key]) ? row[key] : undefined });
  // A gap cell is marked invalid, so a Needs info link into the list lands on it.
  const cell = (key: string, label: string) => (
    <Field label={label} id={row.name ? cellAnchor(listKey, String(row.name), key) : undefined}>
      {(props) => (
        <input
          {...props}
          className="cap-input"
          value={shown(row[key])}
          placeholder={reason(row[key]) ?? ""}
          aria-invalid={isGap(row[key]) || undefined}
          onChange={(e) => change(key, e.target.value)}
        />
      )}
    </Field>
  );
  return (
    <>
      {cell("name", "Name")}
      <Field label="Registry reagent">
        <select
          className="cap-input"
          value={String(row.reagent ?? "")}
          onChange={(e) => change("reagent", e.target.value)}
        >
          <option value="">None</option>
          {reagents.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      {cell("amount", "Amount")}
      {cell("final", "Final")}
      {solutions.length > 0 || row.solution ? (
        <Field label="Made as">
          <select
            className="cap-input"
            value={String(row.solution ?? "")}
            onChange={(e) => change("solution", e.target.value)}
          >
            <option value="">Not a solution made in the lab</option>
            {solutions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {row.solution && !solutions.some((o) => o.value === row.solution) ? (
              <option value={String(row.solution)}>A solution not in the solutions list</option>
            ) : null}
          </select>
        </Field>
      ) : null}
    </>
  );
}

const asObject = (row: EquipmentEntry) => (typeof row === "string" ? { name: row } : row);

/** dei's own kinds. `original` is each field's value in the file, for the gap an emptied list keeps. */
function kbRenderers(
  form: KbForm,
  yaml: Record<string, string>,
  onYaml: (key: string, text: string) => void,
  original: Values,
): SpecRenderers {
  const gapOr = (key: string) => (isGap(original[key]) ? original[key] : undefined);
  return {
    yaml: ({ spec, id }) => {
      const text = yaml[spec.key] ?? "";
      return (
        <Field label={spec.label} help={spec.help}>
          <textarea
            id={id}
            className="cap-input kb-yaml"
            spellCheck={false}
            rows={Math.min(12, Math.max(2, text.split("\n").length))}
            value={text}
            onChange={(e) => onYaml(spec.key, e.target.value)}
          />
        </Field>
      );
    },
    primers: ({ spec, value, onChange }) => (
      <FieldFromSpec
        idPrefix={FIELD_PREFIX}
        spec={{ ...spec, kind: "multi", options: form.registry.primer }}
        value={list(value).map((p) => String((p as { primer?: string }).primer))}
        onChange={(next) =>
          onChange?.(
            Array.isArray(next)
              ? next.map((primer) => ({ primer }))
              : typeof original[spec.key] === "string"
                ? original[spec.key]
                : undefined,
          )
        }
      />
    ),
    // Not applicable is the first choice; while it is ticked, the strains are not offered.
    strains: ({ spec, value, onChange }) => {
      const notApplicable = value === NOT_APPLICABLE;
      return (
        <FieldFromSpec
          idPrefix={FIELD_PREFIX}
          spec={{
            ...spec,
            kind: "multi",
            options: [
              { value: NOT_APPLICABLE, label: "Not applicable" },
              ...(notApplicable ? [] : form.registry.strain),
            ],
          }}
          value={
            notApplicable
              ? [NOT_APPLICABLE]
              : list(value).map((s) => String((s as { strain?: string }).strain))
          }
          onChange={(next) => {
            const picked = Array.isArray(next) ? next.map(String) : [];
            if (!notApplicable && picked.includes(NOT_APPLICABLE))
              return onChange?.(NOT_APPLICABLE);
            const strains = picked.filter((v) => v !== NOT_APPLICABLE);
            onChange?.(strains.length ? strains.map((strain) => ({ strain })) : gapOr(spec.key));
          }}
        />
      );
    },
    materials: ({ spec, id, value, onChange }) => (
      <div id={id}>
        <RepeaterField<Material>
          legend={spec.label}
          help={spec.help}
          rows={list(value) as Material[]}
          onChange={(rows) => onChange?.(rows)}
          newRow={() => ({ name: "" })}
          rowLabel={(i, row) => shown(row.name) || `${spec.label} row ${i + 1}`}
          addLabel="Add a reagent"
        >
          {(row, api) => (
            <MaterialCells
              listKey={spec.key}
              row={row}
              set={api.set}
              reagents={form.registry.reagent}
              solutions={form.references.solutions}
            />
          )}
        </RepeaterField>
      </div>
    ),
    equipment: ({ spec, id, value, onChange }) => {
      const rows = list(value) as EquipmentEntry[];
      const set = (i: number, key: string, typed: string) =>
        onChange?.(
          rows.map((row, j) =>
            j === i ? { ...asObject(row), [key]: typed === "" ? undefined : typed } : row,
          ),
        );
      return (
        <div id={id}>
          <RepeaterField<EquipmentEntry>
            legend={spec.label}
            help={spec.help}
            rows={rows}
            onChange={(next) => onChange?.(next)}
            newRow={() => ({ name: "" })}
            rowLabel={(i, row) => shown(asObject(row).name) || `${spec.label} row ${i + 1}`}
            addLabel="Add equipment"
          >
            {(row, api) => {
              const r = asObject(row);
              return (
                <>
                  <Field label="Name">
                    <input
                      className="cap-input"
                      value={shown(r.name)}
                      onChange={(e) => set(api.index, "name", e.target.value)}
                    />
                  </Field>
                  <Field label="Registry item">
                    <select
                      className="cap-input"
                      value={String(r.equipment ?? "")}
                      onChange={(e) => set(api.index, "equipment", e.target.value)}
                    >
                      <option value="">None</option>
                      {form.registry.equipment.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              );
            }}
          </RepeaterField>
        </div>
      );
    },
  };
}

/** Fields in the form's grid, each by its kind, with the ids Needs info links land on (fieldAnchor). */
export function KbFields({
  fields,
  values,
  original,
  yaml,
  form,
  onValue,
  onYaml,
}: {
  fields: FormField[];
  values: Values;
  original: Values;
  yaml: Record<string, string>;
  form: KbForm;
  onValue: (key: string, value: unknown) => void;
  onYaml: (key: string, text: string) => void;
}) {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  return (
    <SchemaFields
      idPrefix={FIELD_PREFIX}
      specs={fields.map((f) => specFor(f, original[f.key]))}
      values={Object.fromEntries(fields.map((f) => [f.key, display(f, values[f.key])]))}
      onChange={(key, value) => {
        const field = byKey.get(key);
        if (field) onValue(key, fromInput(field, value, original[key]));
      }}
      renderers={kbRenderers(form, yaml, onYaml, original)}
    />
  );
}

/**
 * A note that names something (a troubleshooting row, a calculator) is picked by name. A calculator's preset values
 * after its id are kept as written.
 */
export function ReferencePicker({
  label,
  choices,
  empty,
  text,
  onChange,
}: {
  label: string;
  choices: Choice[];
  empty: string;
  text: string;
  onChange: (text: string) => void;
}) {
  const [first = "", ...rest] = text.trim().split(/\s+/).filter(Boolean);
  const id = first.includes("=") ? "" : first;
  const extra = first.includes("=") ? [first, ...rest] : rest;
  return (
    <select
      className="cap-input"
      aria-label={label}
      value={id}
      onChange={(e) => onChange([e.target.value, ...extra].filter(Boolean).join(" "))}
    >
      <option value="">{empty}</option>
      {choices.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {id && !choices.some((o) => o.value === id) ? (
        <option value={id}>Not found; pick one from the list</option>
      ) : null}
    </select>
  );
}
