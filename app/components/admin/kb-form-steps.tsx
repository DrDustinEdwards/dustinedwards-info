import { useRef, useState } from "react";

import { Button } from "capsomer/react/button";
import { Panel } from "capsomer/react/panel";

import { StepText } from "~/components/admin/kb-step-text";
import type { FormBlock, FormBody, FormStep } from "~/kb/form.mjs";
import { stepAnchor } from "~/kb/gap-labels.mjs";
import type { Choice, KbForm } from "~/kb/form.server";
import { DURATIONS, ReferencePicker, UNITS, plural } from "~/components/admin/kb-form-fields";

/* The form editor's method (kb-form.tsx): the step cards in their sections, and the body editor that orders them. */

/**
 * Scrolls to where a gap is filled in and puts the cursor there: the input itself, or in a step card the note that still
 * says MISSING. Without script the link is a plain #anchor.
 */
export function goTo(e: React.MouseEvent | null, anchor: string) {
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
export type Inserts = {
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

export function BodyEditor({
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
