// The inline marks a procedure step carries, in Cooklang's syntax (https://cooklang.org/docs/spec/):
// `@material{20%µl}`, `#equipment{}`, `~{10%minutes}`, plus the cooklang-rs alias form
// `@material|shown words{20%µl}` and its fixed-amount form `{=20%µl}`. The official parser
// (@cooklang/cooklang) is a pre-1.0 WASM build whose model is recipes only, so the site reads the marks
// itself and keeps Cooklang's spelling, so a file stays readable by Cooklang tools.
//
// Temperatures and spin speeds are read from the words, not marked, so a step stays the sentence a
// person wrote: "Incubate at 55 to 60 °C" is both.

/** A mark starts at the start of the text or after whitespace, so `(#refs)` and `a@b.c` are text. */
const MARK_START = /[@#~]/g;

/** A multi-word name runs to its `{`; it cannot cross another mark, a brace or a line. */
const BRACED = /^([@#])([^@#~{}\n]{1,160}?)\{([^{}\n]*)\}/u;
const SINGLE = /^([@#])([\p{L}\p{N}_-]+)/u;
const TIMER = /^~([^@#~{}\n]{0,60}?)\{([^{}\n]*)\}/u;

/**
 * Stretches of the text where a mark is never read: inline code, a link's target, an autolink.
 *
 * @param {string} text
 * @returns {Array<[number, number]>}
 */
function protectedRanges(text) {
  /** @type {Array<[number, number]>} */
  const ranges = [];
  for (const pattern of [/`[^`\n]*`/g, /\]\([^)\n]*\)/g, /<[a-z]+:[^>\n]*>/gi]) {
    for (const match of text.matchAll(pattern)) ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

/**
 * A number as written: "20", "1.25", "10,000", "1/2", "1 1/2".
 *
 * @param {string} raw
 * @returns {number | null}
 */
export function parseNumber(raw) {
  const s = raw.trim().replaceAll(",", "");
  let m = /^(\d+) (\d+)\/(\d+)$/.exec(s);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = /^(\d+)\/(\d+)$/.exec(s);
  if (m) return Number(m[1]) / Number(m[2]);
  return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
}

/**
 * The inside of a mark's braces: `20%µl`, `=20%µl`, `1.25 to 5%µl`, `2`, or empty.
 *
 * @param {string} inner
 * @returns {{ raw: string, amount: string, unit: string, fixed: boolean, min: number | null, max: number | null } | null}
 */
export function parseQuantity(inner) {
  let body = inner.trim();
  if (!body) return null;
  const fixed = body.startsWith("=");
  if (fixed) body = body.slice(1).trim();
  const at = body.indexOf("%");
  const amount = (at < 0 ? body : body.slice(0, at)).trim();
  const unit = at < 0 ? "" : body.slice(at + 1).trim();
  const range = /^(.+?)\s*(?:-|to)\s*(.+)$/.exec(amount);
  const min = parseNumber(range ? range[1] ?? "" : amount);
  const max = range ? parseNumber(range[2] ?? "") : min;
  return { raw: inner, amount, unit, fixed, min, max: min === null ? null : max };
}

/**
 * @typedef {{ type: "text", value: string }} TextSegment
 * @typedef {ReturnType<typeof parseQuantity>} Quantity
 * @typedef {{ type: "material", name: string, display: string, quantity: Quantity }} MaterialSegment
 * @typedef {{ type: "equipment", name: string, display: string }} EquipmentSegment
 * @typedef {{ type: "timer", label: string, quantity: Quantity }} TimerSegment
 * @typedef {TextSegment | MaterialSegment | EquipmentSegment | TimerSegment} Segment
 */

/**
 * Where each mark sits in the text, with the parts it was written with: the one reading of the marks, which tokenize turns
 * into words and the admin editor turns into chips (app/kb/step-marks.mjs), so the two can never split a step differently.
 *
 * @param {string} text
 * @returns {Array<{ start: number, end: number, sign: "@" | "#" | "~", name: string, shown: string, braces: string | null }>}
 */
export function markSpans(text) {
  const ranges = protectedRanges(text);
  const inRange = (/** @type {number} */ i) => ranges.some(([a, b]) => i >= a && i < b);
  /** @type {Array<{ start: number, end: number, sign: "@" | "#" | "~", name: string, shown: string, braces: string | null }>} */
  const out = [];
  let last = 0;
  for (const hit of text.matchAll(MARK_START)) {
    const i = hit.index;
    if (i < last || inRange(i)) continue;
    const before = i === 0 ? "" : (text[i - 1] ?? "");
    if (before && !/\s/.test(before)) continue;
    const rest = text.slice(i);
    if (rest[0] === "~") {
      const m = TIMER.exec(rest);
      if (!m) continue;
      out.push({ start: i, end: i + m[0].length, sign: "~", name: (m[1] ?? "").trim(), shown: "", braces: m[2] ?? "" });
      last = i + m[0].length;
      continue;
    }
    const m = BRACED.exec(rest) ?? SINGLE.exec(rest);
    if (!m) continue;
    const [name, shown] = (m[2] ?? "").split("|").map((part) => part.trim());
    out.push({ start: i, end: i + m[0].length, sign: /** @type {"@" | "#"} */ (m[1]), name: name ?? "", shown: shown ?? "", braces: m[3] === undefined ? null : m[3] });
    last = i + m[0].length;
  }
  return out;
}

/**
 * The text split into words and marks.
 *
 * @param {string} text
 * @returns {Segment[]}
 */
export function tokenize(text) {
  /** @type {Segment[]} */
  const out = [];
  let last = 0;
  for (const span of markSpans(text)) {
    if (span.start > last) out.push({ type: "text", value: text.slice(last, span.start) });
    if (span.sign === "~") out.push({ type: "timer", label: span.name, quantity: parseQuantity(span.braces ?? "") });
    else if (span.sign === "@") {
      out.push({ type: "material", name: span.name, display: span.shown || span.name, quantity: span.braces === null ? null : parseQuantity(span.braces) });
    } else out.push({ type: "equipment", name: span.name, display: span.shown || span.name });
    last = span.end;
  }
  if (text.length > last) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/**
 * A number printed the way the file would write it: no trailing zeros, thousands with commas.
 *
 * @param {number} n
 */
export function formatNumber(n) {
  const rounded = Math.round(n * 1000) / 1000;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

/**
 * A quantity as words, scaled by `factor` unless it is fixed or not a number.
 *
 * @param {NonNullable<Quantity>} q
 * @param {number} [factor]
 */
export function formatQuantity(q, factor = 1) {
  let amount = q.amount;
  if (factor !== 1 && !q.fixed && q.min !== null) {
    amount =
      q.max !== null && q.max !== q.min
        ? `${formatNumber(q.min * factor)} to ${formatNumber(q.max * factor)}`
        : formatNumber(q.min * factor);
  }
  return q.unit ? `${amount} ${q.unit}` : amount;
}

/**
 * The words a segment stands for on the page.
 *
 * @param {Segment} segment
 * @param {number} [factor]
 */
export function segmentText(segment, factor = 1) {
  switch (segment.type) {
    case "text":
      return segment.value;
    case "material":
      return segment.quantity ? `${formatQuantity(segment.quantity, factor)} of ${segment.display}` : segment.display;
    case "equipment":
      return segment.display;
    case "timer":
      return segment.quantity ? formatQuantity(segment.quantity) : segment.label;
  }
}

/** "37 °C", "55 to 60 °C", "-80 °C", "55-60 °C". Exported for the editor, which shows each as a chip. */
export const TEMPERATURE = /(-?\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*(-?\d+(?:\.\d+)?))?\s*°C/g;
/** "10,000 rpm", "12,000 x g", "10,000 to 15,000 x g". */
const SPIN = /(?<![\d.,])(\d[\d,]*(?:\s*to\s*\d[\d,]*)?)\s*(rpm|x g)\b/g;

/**
 * The temperatures and spins a step's words state.
 *
 * @param {string} text the step with its marks already turned into words
 */
export function readConditions(text) {
  const temperatures = [...text.matchAll(TEMPERATURE)].map((m) => ({
    min: Number(m[1]),
    max: m[2] === undefined ? Number(m[1]) : Number(m[2]),
    text: m[0],
  }));
  const spins = [...text.matchAll(SPIN)].map((m) => ({
    speed: (m[1] ?? "").trim(),
    unit: m[2] === "rpm" ? "rpm" : "x g",
    text: m[0],
  }));
  return { temperatures, spins };
}
