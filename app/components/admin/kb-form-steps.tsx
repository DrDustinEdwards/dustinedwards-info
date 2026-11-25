import { focusTarget } from "capsomer/behavior/error-summary";
import { Button } from "capsomer/react/button";
import { Panel } from "capsomer/react/panel";
import { SortableList, useRows } from "capsomer/react/sortable-list";
import type { FormBlock, FormBody, FormStep } from "~/kb/form.mjs";
import { stepAnchor } from "~/kb/gap-labels.mjs";
import { StepCard, type Inserts } from "~/components/admin/kb-step-card";

/* The form editor's method (kb-form.tsx): the step cards in their sections, and the body editor that orders them. */

/**
 * Scrolls to where a gap is filled in and puts the cursor there (Capsomer's focusTarget): the input itself, or in a step
 * card or a list the control marked invalid, the note or cell that still says MISSING. Without script the link is a
 * plain #anchor.
 */
export function goTo(e: React.MouseEvent | null, anchor: string) {
  const target = document.getElementById(anchor);
  if (!target) return;
  e?.preventDefault();
  target.scrollIntoView({ block: "center" });
  focusTarget(target).focus({ preventScroll: true });
  if (e) history.replaceState(null, "", `#${anchor}`);
}

/** A step's name in what the list says and on its buttons: its first words, so a move names the step that moved. */
function stepName(step: FormStep) {
  const words = step.text
    .replace(/[~@#]?\{[^}]*\}/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
  return words ? `"${words}"` : "the new step";
}

function StepList({
  block,
  sectionTitle,
  flags,
  inserts,
  onChange,
  onInsert,
}: {
  block: Extract<FormBlock, { type: "steps" }>;
  sectionTitle: string;
  flags: readonly string[];
  inserts: Inserts;
  onChange: (block: Extract<FormBlock, { type: "steps" }>) => void;
  onInsert: (
    kind: "reagent" | "equipment" | "primer" | "strain",
    value: string,
    amount?: string,
  ) => string | null;
}) {
  const rows = useRows(block.steps, (steps) => onChange({ ...block, steps }));
  return (
    <SortableList
      {...rows}
      className="kb-steps"
      layout="stack"
      altKeys
      start={block.start}
      aria-label={`Steps in ${sectionTitle || "this section"}`}
      getLabel={(row) => stepName(row.value)}
      renderHead={(row, state) => (
        <span className="kb-step-number">Step {block.start + state.index}</span>
      )}
      renderItem={(row, state) => {
        const number = block.start + state.index;
        return (
          <StepCard
            step={row.value}
            label={`Step ${number}`}
            anchor={stepAnchor(sectionTitle, number)}
            flags={flags}
            inserts={inserts}
            onInsert={onInsert}
            onChange={(next) =>
              onChange({
                ...block,
                steps: block.steps.map((s, j) => (j === row.index ? next : s)),
              })
            }
          />
        );
      }}
    />
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
  onInsert: (
    kind: "reagent" | "equipment" | "primer" | "strain",
    value: string,
    amount?: string,
  ) => string | null;
}) {
  const setSection = (i: number, next: FormBody["sections"][number]) =>
    onChange({ ...body, sections: body.sections.map((s, j) => (j === i ? next : s)) });
  return (
    <>
      <Panel title="Introduction">
        <div className="cap-field">
          <label className="cap-field-label" htmlFor="kb-intro">
            What this is, where it came from, who it is for
          </label>
          <textarea
            id="kb-intro"
            className="cap-input"
            rows={6}
            value={body.intro}
            onChange={(e) => onChange({ ...body, intro: e.target.value })}
          />
        </div>
      </Panel>
      {body.sections.map((section, i) => (
        <Panel key={i} title={section.heading || "New section"}>
          <div className="cap-field">
            <label className="cap-field-label" htmlFor={`kb-section-${i}`}>
              Section heading
            </label>
            <input
              id={`kb-section-${i}`}
              className="cap-input"
              value={section.heading}
              onChange={(e) => setSection(i, { ...section, heading: e.target.value })}
            />
          </div>
          {section.blocks.map((block, b) =>
            block.type === "prose" ? (
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
                    onChange={(e) =>
                      setSection(i, {
                        ...section,
                        blocks: section.blocks.map((x, k) =>
                          k === b ? { type: "prose", text: e.target.value } : x,
                        ),
                      })
                    }
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
                onChange={(next) =>
                  setSection(i, {
                    ...section,
                    blocks: section.blocks.map((x, k) => (k === b ? next : x)),
                  })
                }
              />
            ),
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const last = [...section.blocks].reverse().find((x) => x.type === "steps") as
                | Extract<FormBlock, { type: "steps" }>
                | undefined;
              const step: FormStep = { number: 0, text: "", lines: [], blanksBefore: 0 };
              if (last)
                setSection(i, {
                  ...section,
                  blocks: section.blocks.map((x) =>
                    x === last ? { ...last, steps: [...last.steps, step] } : x,
                  ),
                });
              else
                setSection(i, {
                  ...section,
                  blocks: [
                    ...section.blocks,
                    { type: "prose", text: "" },
                    { type: "steps", start: 1, steps: [step] },
                  ],
                });
            }}
          >
            Add a step to {section.heading || "this section"}
          </Button>
        </Panel>
      ))}
      <Button
        type="button"
        onClick={() =>
          onChange({
            ...body,
            sections: [
              ...body.sections,
              { heading: "New section", blocks: [{ type: "prose", text: "" }] },
            ],
          })
        }
      >
        Add a section
      </Button>
    </>
  );
}
