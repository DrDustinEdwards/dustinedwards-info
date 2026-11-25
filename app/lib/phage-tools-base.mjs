/** The calculators' shared part: where each lab default comes from, and reading and writing the numbers (see phage-tools.mjs). */

/** @typedef {{ href: string, label: string }} Source */

/**
 * @typedef {object} ToolField
 * @property {string} name the query parameter and the input's name
 * @property {string} label
 * @property {string} [unit]
 * @property {string} value the value the page opens with
 * @property {string} [hint]
 * @property {Source} [source] set when `value` is a lab default rather than the worked example's number
 */

/**
 * @typedef {object} ToolSection
 * @property {string} heading
 * @property {string[]} steps the arithmetic, one line each, in the order it is done
 * @property {string} [result] the answer, set apart from the steps
 * @property {string[]} [notes] cautions from the lab's pages, shown after the steps
 */

/** @typedef {{ ok: true, sections: ToolSection[] } | { ok: false, error: string }} ToolResult */

const FAQ = "/teaching/virus-isolation/faq";
const PROTOCOL = "/research/protocols/phage-isolation";

/** @type {Record<string, Source>} */
export const SOURCES = {
  fullPlate: {
    href: `${PROTOCOL}#full-plate-titer`,
    label: "Phage Isolation and Purification Protocol: full plate titer",
  },
  spot: {
    href: `${PROTOCOL}#spot-titer`,
    label: "Phage Isolation and Purification Protocol: spot titer",
  },
  tenfold: { href: FAQ, label: "Lab Calculations and Common Questions: 10-fold serial dilution" },
  volumeLimit: {
    href: `${PROTOCOL}#the-bracketing-shortcut`,
    label: "Phage Isolation and Purification Protocol: volume limit",
  },
  yields: {
    href: `${PROTOCOL}#yields`,
    label: "Phage Isolation and Purification Protocol: yields",
  },
};

/** The lab's numbers, each with its page. Nothing here is a value no page states. */
export const LAB = {
  /** Full plate titer: 10 µl of each dilution with 250 µl host. */
  ulPlated: 10,
  /** Spot titer: the Guide's Protocol 6.4, 3 µl spots, as the lab runs it. */
  ulSpot: 3,
  /** A 10-fold step: 10 µl phage + 90 µl phage buffer. */
  transferUl: 10,
  /** No more lysate than 10% of the 250 µl of host, or the cells lyse. */
  maxLysateUl: 25,
  /** Each plate flooded with 8 ml of phage buffer returns about 5 to 7 ml. */
  floodMl: 8,
  yieldLowMl: 5,
  yieldHighMl: 7,
  /** Plan about 6 webbed plates for 10 ml to archive plus 10 ml for DNA extraction. */
  plates: 6,
};

/**
 * A number as the bench writes it: `1.1e10`, `1.1 x 10^10`, `1.1×10^10`, `11,100` or `10^-3`.
 * Returns NaN for anything else, including an empty field, so the caller names the field.
 *
 * @param {unknown} raw
 */
export function parseNumber(raw) {
  const text = String(raw ?? "")
    .trim()
    .replace(/[\s,]/g, "")
    .replace(/[×xX*]/g, "x")
    .replace(/−/g, "-");
  if (text === "") return Number.NaN;
  const sci = /^([+-]?\d*\.?\d+)x10\^([+-]?\d+)$/.exec(text);
  if (sci) return Number(sci[1]) * 10 ** Number(sci[2]);
  const power = /^10\^([+-]?\d+)$/.exec(text);
  if (power) return 10 ** Number(power[1]);
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return Number.NaN;
  return Number(text);
}

/** @param {number} value @param {number} digits */
function roundSig(value, digits) {
  if (value === 0 || !Number.isFinite(value)) return value;
  return Number(value.toPrecision(digits));
}

/** Trailing zeros off a fixed-point string: 1.50 to 1.5, 2.00 to 2. @param {string} text */
function trim(text) {
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}

/**
 * Three significant figures, never more than the value has. Plain with thousands separators from 0.01
 * up to a million, and `a x 10^n` outside that, the way the FAQ writes titers.
 *
 * @param {number} value
 */
export function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  const rounded = roundSig(value, 3);
  const abs = Math.abs(rounded);
  if (abs >= 0.01 && abs < 1e6) {
    const [whole = "", fraction] = trim(String(rounded)).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fraction ? `${grouped}.${fraction}` : grouped;
  }
  return formatScientific(rounded);
}

/** Always `a x 10^n`, three significant figures: 1.11 x 10^10, 1 x 10^-3. @param {number} value */
export function formatScientific(value) {
  if (value === 0) return "0";
  const [mantissa = "", exponent] = roundSig(value, 3).toExponential(2).split("e");
  return `${trim(mantissa)} x 10^${Number(exponent)}`;
}

/** `10^-6`, and `undiluted` for 10^0. @param {number} n */
export function formatDilution(n) {
  return n === 0 ? "undiluted" : `10^-${n}`;
}

/**
 * A value the arithmetic guarantees, checked anyway: an index past the end is a bug here, not input.
 *
 * @template T
 * @param {T | undefined} value
 * @returns {T}
 */
export function must(value) {
  if (value === undefined) throw new Error("phage-tools: a planned step is missing.");
  return value;
}

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
/** @param {number} n */
export function count(n) {
  return WORDS[n] ?? String(n);
}
