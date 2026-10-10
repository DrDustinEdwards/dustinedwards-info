import { useEffect, useId, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";

import { Button } from "capsomer/react/button";

import { PIECE_NAMES, pieceLabel, stepPieces, writePiece, type Piece } from "~/kb/step-marks.mjs";

/*
 * A step's words with its marks as chips (docs/KNOWLEDGE-BASE.md), as protocols.io shows a step's components: typing is
 * plain text, and each reagent, piece of equipment, timer and temperature is one chip that is edited in a small popover
 * and deleted as one unit. Under the chips the step stays the text the file holds: a chip carries the exact text it was
 * read from, so a step nobody touched is written back byte for byte, and an edited chip is written in the format's own
 * spelling (step-marks.mjs). Marks typed by hand become chips when the text loses focus.
 */

const DURATIONS = ["seconds", "minutes", "hours", "days"];
const UNITS = ["µl", "ml", "l", "mg", "g", "µg", "ng", "mM", "M", "%", "U", "tubes", "plates"];

type Chip = Exclude<Piece, { kind: "text" }>;

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The step as the editor's markup: its words as text, each mark a chip that carries the text it was read from. */
export function chipHtml(text: string) {
  return stepPieces(text)
    .map((piece) => {
      if (piece.kind === "text") return escape(piece.raw);
      const label = pieceLabel(piece);
      return `<span class="kb-chip" data-kind="${piece.kind}" data-raw="${escape(piece.raw)}" contenteditable="false" role="button" tabindex="0" aria-label="${escape(`${PIECE_NAMES[piece.kind]}: ${label}`)}">${escape(label)}</span>`;
    })
    .join("");
}

/** The text a stretch of the editor's markup stands for: its words, and each chip's own text. */
function textOf(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) out += child.textContent ?? "";
    else if (child instanceof HTMLElement) out += child.dataset.raw ?? (child.tagName === "BR" ? "" : textOf(child));
  });
  // A step is one line; a browser's non-breaking space for a typed trailing space is a space.
  return out.replace(/ /g, " ").replace(/\n/g, " ");
}

/** Where in the text a point in the editor falls. */
function offsetAt(root: HTMLElement, end: (range: Range) => void) {
  const range = document.createRange();
  range.setStart(root, 0);
  end(range);
  return textOf(range.cloneContents()).length;
}

function ChipPopover({
  chip,
  names,
  style,
  onDone,
  onRemove,
  onCancel,
}: {
  chip: Chip;
  names: { reagent: string[]; equipment: string[] };
  style: React.CSSProperties;
  onDone: (chip: Chip) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Chip>(chip);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLInputElement>("input, select")?.focus();
  }, []);
  const set = (key: string, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }) as Chip);
  const text = (key: string, label: string, opts: { list?: string; mode?: "decimal" } = {}) => (
    <label className="kb-cell">
      <span className="cap-field-label">{label}</span>
      <input
        className="cap-input"
        list={opts.list}
        inputMode={opts.mode}
        value={String((draft as Record<string, unknown>)[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  const done = () => {
    const name = draft.kind === "reagent" || draft.kind === "equipment" ? draft.name : draft.kind === "temperature" ? draft.low : "ok";
    if (name.trim()) onDone(draft);
  };
  return (
    <div
      ref={box}
      className="kb-popover"
      role="dialog"
      aria-label={`Edit ${PIECE_NAMES[chip.kind].toLowerCase()}`}
      style={style}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        } else if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).type !== "checkbox") {
          e.preventDefault();
          done();
        }
      }}
    >
      <p className="kb-popover-title">{PIECE_NAMES[chip.kind]}</p>
      <div className="kb-popover-fields">
        {draft.kind === "reagent" ? (
          <>
            {text("name", "Reagent", { list: `${id}-reagents` })}
            <datalist id={`${id}-reagents`}>
              {names.reagent.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {text("shown", "Shown as (optional)")}
            {text("amount", "Amount", { mode: "decimal" })}
            {text("unit", "Unit", { list: `${id}-units` })}
            <datalist id={`${id}-units`}>
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <label className="kb-check">
              <input type="checkbox" checked={draft.fixed} onChange={(e) => set("fixed", e.target.checked)} /> Fixed: does not scale with the batch
            </label>
          </>
        ) : draft.kind === "equipment" ? (
          <>
            {text("name", "Equipment", { list: `${id}-equipment` })}
            <datalist id={`${id}-equipment`}>
              {names.equipment.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {text("shown", "Shown as (optional)")}
          </>
        ) : draft.kind === "timer" ? (
          <>
            {text("label", "Label (optional)")}
            {text("amount", "Duration", { mode: "decimal" })}
            <label className="kb-cell">
              <span className="cap-field-label">Unit</span>
              <select className="cap-input" value={draft.unit} onChange={(e) => set("unit", e.target.value)}>
                {[...new Set([...DURATIONS, draft.unit].filter(Boolean))].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            {text("low", "Temperature, °C", { mode: "decimal" })}
            {text("high", "Up to, °C (optional)", { mode: "decimal" })}
          </>
        )}
      </div>
      <div className="app-actions">
        <Button type="button" size="sm" variant="primary" onClick={done}>
          Done
        </Button>
        <Button type="button" size="sm" onClick={onRemove}>
          Remove from the step
        </Button>
        <Button type="button" size="sm" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * The step text editor. `caret` holds where in the text the cursor last was, so an insert from the card lands there.
 */
export function StepText({
  id,
  label,
  text,
  names,
  caret,
  onChange,
}: {
  id: string;
  label: string;
  text: string;
  names: { reagent: string[]; equipment: string[] };
  caret: MutableRefObject<number | null>;
  onChange: (text: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // What the editor's markup says now; the step's text from outside (an insert, a chip edit, a move) redraws it.
  const own = useRef(text);
  // One object for the editor's life: React writes the markup again whenever this object changes, which would wipe what
  // is being typed, so after the first paint only redraw() writes it.
  const [initial] = useState(() => ({ __html: chipHtml(text) }));
  const [open, setOpen] = useState<{ at: number; chip: Chip; top: number; left: number } | null>(null);
  const helpId = `${id}-help`;

  const redraw = (next: string) => {
    own.current = next;
    if (root.current) root.current.innerHTML = chipHtml(next);
  };
  useLayoutEffect(() => {
    if (text !== own.current) redraw(text);
  }, [text]);

  const changed = () => {
    if (!root.current) return;
    own.current = textOf(root.current);
    onChange(own.current);
  };

  const openChip = (el: HTMLElement) => {
    if (!root.current || !wrap.current) return;
    const at = offsetAt(root.current, (r) => r.setEndBefore(el));
    let start = 0;
    const chip = stepPieces(own.current).find((p) => {
      const hit = start === at && p.kind !== "text";
      start += p.raw.length;
      return hit;
    }) as Chip | undefined;
    if (!chip) return;
    const width = wrap.current.clientWidth;
    setOpen({ at, chip, top: el.offsetTop + el.offsetHeight + 6, left: Math.max(0, Math.min(el.offsetLeft, width - 304)) });
  };

  const replace = (at: number, length: number, words: string) => {
    const before = own.current.slice(0, at);
    const after = own.current.slice(at + length);
    // A chip removed from between two words leaves one space, not two.
    const next = words === "" && before.endsWith(" ") && after.startsWith(" ") ? `${before}${after.slice(1)}` : `${before}${words}${after}`;
    redraw(next);
    onChange(next);
  };

  const close = () => {
    setOpen(null);
    root.current?.focus();
  };

  return (
    <div className="kb-chiptext-wrap" ref={wrap}>
      <div
        ref={root}
        id={id}
        className="cap-input kb-chiptext"
        role="textbox"
        aria-label={label}
        aria-describedby={helpId}
        contentEditable
        spellCheck
        dangerouslySetInnerHTML={initial}
        onInput={changed}
        onBlur={(e) => {
          if (!root.current) return;
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && root.current.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            caret.current = offsetAt(root.current, (r) => r.setEnd(range.endContainer, range.endOffset));
          }
          // Marks typed by hand become chips once the text is left; a chip taking the focus is still the text.
          if (!root.current.contains(e.relatedTarget as Node | null) && !wrap.current?.querySelector(".kb-popover")?.contains(e.relatedTarget as Node | null)) {
            redraw(own.current);
          }
        }}
        onKeyDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains("kb-chip")) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openChip(target);
            } else if (e.key === "Backspace" || e.key === "Delete") {
              e.preventDefault();
              const at = offsetAt(root.current as HTMLElement, (r) => r.setEndBefore(target));
              replace(at, target.dataset.raw?.length ?? 0, "");
              root.current?.focus();
            }
            return;
          }
          // A step is one line.
          if (e.key === "Enter") e.preventDefault();
        }}
        onClick={(e) => {
          const chip = (e.target as HTMLElement).closest<HTMLElement>(".kb-chip");
          if (chip) openChip(chip);
        }}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " "));
        }}
      />
      <p id={helpId} className="cap-sr-only">
        Reagents, equipment, timers and temperatures are buttons in the text: press Enter on one to edit it, or Delete to remove it.
      </p>
      {open ? (
        <ChipPopover
          key={`${open.at}:${open.chip.raw}`}
          chip={open.chip}
          names={names}
          style={{ top: open.top, left: open.left }}
          onCancel={close}
          onRemove={() => {
            replace(open.at, open.chip.raw.length, "");
            close();
          }}
          onDone={(chip) => {
            const written = writePiece(chip);
            // A chip nobody changed keeps the text it was read from.
            if (JSON.stringify({ ...chip, raw: "" }) !== JSON.stringify({ ...open.chip, raw: "" })) replace(open.at, open.chip.raw.length, written);
            close();
          }}
        />
      ) : null}
    </div>
  );
}
