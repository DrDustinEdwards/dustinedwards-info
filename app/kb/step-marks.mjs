// A step's words as the form editor shows them (docs/KNOWLEDGE-BASE.md): plain text, and each mark as a chip, as
// protocols.io shows a step's components. A chip keeps the exact text it was read from, so joining the pieces gives the
// step back byte for byte; an edited chip is written in the procedure format's own spelling (docs/PROCEDURES.md).
// Pure and small, so the browser can carry it.

import { markSpans, parseQuantity, TEMPERATURE } from "./procedures/marks.mjs";

/**
 * @typedef {{ kind: "text", raw: string }
 *   | { kind: "reagent", raw: string, name: string, shown: string, amount: string, unit: string, fixed: boolean, braced: boolean }
 *   | { kind: "equipment", raw: string, name: string, shown: string, braced: boolean }
 *   | { kind: "timer", raw: string, label: string, amount: string, unit: string }
 *   | { kind: "temperature", raw: string, low: string, high: string }} Piece
 */

/** A temperature's numbers from its words: "37 °C", "55 to 60 °C". @param {string} raw */
function readTemperature(raw) {
  const m = /^(-?\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*(-?\d+(?:\.\d+)?))?\s*°C$/.exec(raw);
  return { low: m?.[1] ?? "", high: m?.[2] ?? "" };
}

/** The temperatures in a stretch of plain words, as pieces. @param {string} text @returns {Piece[]} */
function splitTemperatures(text) {
  /** @type {Piece[]} */
  const out = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(TEMPERATURE.source, "g"))) {
    if (m.index > last) out.push({ kind: "text", raw: text.slice(last, m.index) });
    out.push({ kind: "temperature", raw: m[0], ...readTemperature(m[0]) });
    last = m.index + m[0].length;
  }
  if (text.length > last) out.push({ kind: "text", raw: text.slice(last) });
  return out;
}

/**
 * A step's text as pieces: its words, and a chip for each mark and each temperature. pieces.map(p => p.raw).join("") is
 * the text.
 *
 * @param {string} text
 * @returns {Piece[]}
 */
export function stepPieces(text) {
  /** @type {Piece[]} */
  const out = [];
  let last = 0;
  for (const span of markSpans(text)) {
    if (span.start > last) out.push(...splitTemperatures(text.slice(last, span.start)));
    const raw = text.slice(span.start, span.end);
    const q = parseQuantity(span.braces ?? "");
    if (span.sign === "~") out.push({ kind: "timer", raw, label: span.name, amount: q?.amount ?? "", unit: q?.unit ?? "" });
    else if (span.sign === "@") out.push({ kind: "reagent", raw, name: span.name, shown: span.shown, amount: q?.amount ?? "", unit: q?.unit ?? "", fixed: q?.fixed ?? false, braced: span.braces !== null });
    else out.push({ kind: "equipment", raw, name: span.name, shown: span.shown, braced: span.braces !== null });
    last = span.end;
  }
  if (text.length > last) out.push(...splitTemperatures(text.slice(last)));
  return out;
}

/**
 * A chip written in the procedure format's spelling: `@name|shown{=amount%unit}`, `#name{}`, `~label{amount%unit}`,
 * `55 to 60 °C`.
 *
 * @param {Piece} piece
 * @returns {string}
 */
export function writePiece(piece) {
  const quantity = (/** @type {string} */ amount, /** @type {string} */ unit, fixed = false) =>
    amount.trim() ? `${fixed ? "=" : ""}${amount.trim()}${unit.trim() ? `%${unit.trim()}` : ""}` : "";
  // A one-word mark written without braces (`#microcentrifuge`) stays that way while it still is one word.
  const single = (/** @type {{ name: string, shown: string, braced: boolean }} */ p) => !p.braced && !p.shown.trim() && /^[^\s{}|]+$/.test(p.name.trim());
  switch (piece.kind) {
    case "text":
      return piece.raw;
    case "reagent":
      if (single(piece) && !piece.amount.trim()) return `@${piece.name.trim()}`;
      return `@${piece.name.trim()}${piece.shown.trim() ? `|${piece.shown.trim()}` : ""}{${quantity(piece.amount, piece.unit, piece.fixed)}}`;
    case "equipment":
      if (single(piece)) return `#${piece.name.trim()}`;
      return `#${piece.name.trim()}${piece.shown.trim() ? `|${piece.shown.trim()}` : ""}{}`;
    case "timer":
      return `~${piece.label.trim()}{${quantity(piece.amount, piece.unit)}}`;
    case "temperature":
      return piece.high.trim() ? `${piece.low.trim()} to ${piece.high.trim()} °C` : `${piece.low.trim()} °C`;
  }
}

/**
 * What a chip says on the page, in words: "20 µl zinc chloride", "microcentrifuge tubes", "5 minutes", "55 to 60 °C".
 *
 * @param {Piece} piece
 */
export function pieceLabel(piece) {
  const amount = (/** @type {string} */ a, /** @type {string} */ u) => [a.trim(), u.trim()].filter(Boolean).join(" ");
  switch (piece.kind) {
    case "text":
      return piece.raw;
    case "reagent":
      return [amount(piece.amount, piece.unit), piece.shown || piece.name].filter(Boolean).join(" ");
    case "equipment":
      return piece.shown || piece.name;
    case "timer":
      return [piece.label, amount(piece.amount, piece.unit)].filter(Boolean).join(": ") || "timer";
    case "temperature":
      return piece.raw;
  }
}

/** What each kind of chip is called, for its button's name and its popover's title. */
export const PIECE_NAMES = Object.freeze({ reagent: "Reagent", equipment: "Equipment", timer: "Timer", temperature: "Temperature" });
