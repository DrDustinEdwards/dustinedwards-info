/**
 * The phage lab calculators at /research/tools: titer, serial dilution and webbed plate. One pure module,
 * imported by the server-rendered calculator (app/components/phage-tool.tsx), which renders the worked
 * example with script off, and by the browser module that recomputes on input (app/enhance/tools.ts).
 * test/phage-tools.test.mjs holds it against hand arithmetic and the numbers on the FAQ and the
 * isolation protocol, and holds each page's worked example to what this module prints.
 *
 * Every lab default here names the page that states it (`source`), and the page shows that source.
 * Volumes are in µl and titers in pfu/ml throughout, as on the FAQ.
 */

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

/** @typedef {{ text: string, sup?: false } | { text: string, sup: true }} TextPart */

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
  fullPlate: { href: `${PROTOCOL}#full-plate-titer`, label: "Phage Isolation and Purification Protocol: full plate titer" },
  spot: { href: `${PROTOCOL}#spot-titer`, label: "Phage Isolation and Purification Protocol: spot titer" },
  tenfold: { href: FAQ, label: "Lab Calculations and Common Questions: 10-fold serial dilution" },
  volumeLimit: { href: `${PROTOCOL}#the-bracketing-shortcut`, label: "Phage Isolation and Purification Protocol: volume limit" },
  yields: { href: `${PROTOCOL}#yields`, label: "Phage Isolation and Purification Protocol: yields" },
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

/* ---------------------------------------------------------------- numbers */

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
 * A line split into plain runs and superscripts, so both renderers show `10^6` as 10 with a raised 6
 * and neither parses markup.
 *
 * @param {string} line
 * @returns {TextPart[]}
 */
export function textParts(line) {
  /** @type {TextPart[]} */
  const parts = [];
  let last = 0;
  for (const match of line.matchAll(/10\^(-?\d+)/g)) {
    const at = match.index ?? 0;
    parts.push({ text: `${line.slice(last, at)}10` });
    parts.push({ text: (match[1] ?? "").replace("-", "−"), sup: true });
    last = at + match[0].length;
  }
  parts.push({ text: line.slice(last) });
  return parts.filter((part) => part.text !== "");
}

/**
 * A value the arithmetic guarantees, checked anyway: an index past the end is a bug here, not input.
 *
 * @template T
 * @param {T | undefined} value
 * @returns {T}
 */
function must(value) {
  if (value === undefined) throw new Error("phage-tools: a planned step is missing.");
  return value;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** @param {number} n */
function count(n) {
  return WORDS[n] ?? String(n);
}

/* ---------------------------------------------------------------- titer */

/**
 * titer (pfu/ml) = plaques counted / µl plated x 1,000 µl/ml x dilution factor, the FAQ's formula.
 * A spot titer is the same with the spot volume.
 *
 * @param {{ plaques: number, volumeUl: number, dilutionExponent: number }} input
 */
export function titer({ plaques, volumeUl, dilutionExponent }) {
  const perUl = plaques / volumeUl;
  const perMlDiluted = perUl * 1000;
  const pfuPerMl = perMlDiluted * 10 ** dilutionExponent;
  return { perUl, perMlDiluted, pfuPerMl };
}

/** @param {Record<string, string | undefined>} values @returns {ToolResult} */
function runTiter(values) {
  const plaques = parseNumber(values.plaques);
  const volumeUl = parseNumber(values.volume);
  const rawN = parseNumber(values.dilution);
  if (!Number.isFinite(plaques) || plaques < 0 || !Number.isInteger(plaques)) {
    return { ok: false, error: "Enter the plaques counted as a whole number, 0 or more." };
  }
  if (!Number.isFinite(volumeUl) || volumeUl <= 0) {
    return { ok: false, error: "Enter the volume plated or spotted, in µl, greater than 0." };
  }
  // A dilution is never more than 1, so 6 and -6 both mean 10^-6.
  const n = Math.abs(rawN);
  if (!Number.isFinite(rawN) || !Number.isInteger(n) || n > 20) {
    return { ok: false, error: "Enter the dilution's exponent as a whole number from 0 to 20: 6 for 10^-6, 0 if undiluted." };
  }
  const { perUl, perMlDiluted, pfuPerMl } = titer({ plaques, volumeUl, dilutionExponent: n });
  const of = n === 0 ? "in the undiluted lysate" : `in the ${formatDilution(n)} dilution`;
  const steps = [
    `Plaques per µl: ${formatNumber(plaques)} / ${formatNumber(volumeUl)} µl = ${formatNumber(perUl)} pfu/µl.`,
    `Per ml: ${formatNumber(perUl)} x 1,000 = ${formatNumber(perMlDiluted)} pfu/ml ${of}.`,
  ];
  if (n > 0) {
    steps.push(`Undo the dilution: ${formatNumber(perMlDiluted)} x 10^${n} = ${formatScientific(pfuPerMl)} pfu/ml.`);
  }
  /** @type {string[]} */
  const notes = [];
  if (plaques === 0) {
    notes.push("No plaques: the titer is below what this plate can measure. Count a less dilute plate.");
  } else {
    const log = Math.log10(perUl);
    const exponent = Math.floor(log + 3 + n + 1e-9);
    steps.push(
      `Check the exponent: log10(${formatNumber(perUl)}) + 3 + ${n} = ${log.toFixed(2)} + 3 + ${n} = ${(log + 3 + n).toFixed(2)}, so the titer is in the 10^${exponent} range.`,
    );
  }
  return {
    ok: true,
    sections: [{ heading: "Titer", steps, result: `${formatScientific(pfuPerMl)} pfu/ml`, notes }],
  };
}

/* ---------------------------------------------------------------- dilution */

/**
 * @typedef {object} DilutionStep
 * @property {number} tube 1-based
 * @property {number} transferUl from the tube before (tube 1 takes from the lysate)
 * @property {number} bufferUl
 * @property {number} fold this step's own dilution
 * @property {number} cumulativeFold from the lysate to this tube
 * @property {number} pfuPerMl in this tube
 */

/**
 * The tubes that take a lysate from `startPfuPerMl` down to `targetPfuPerMl`: as many 10-fold steps as
 * fit (transfer + 9 x transfer of buffer), then one smaller step for whatever is left over when the
 * total is not a power of ten. Volumes are rounded to 0.1 µl and the tube concentrations are computed
 * from the rounded volumes, so they are what the tubes will hold. When `neededUl` is set, the last tube
 * holds at least that much, and each tube before it at least what the next one takes.
 *
 * @param {{ startPfuPerMl: number, targetPfuPerMl: number, transferUl?: number, neededUl?: number }} input
 */
export function planDilution({ startPfuPerMl, targetPfuPerMl, transferUl = LAB.transferUl, neededUl = 0 }) {
  const totalFold = startPfuPerMl / targetPfuPerMl;
  const tenfold = Math.floor(Math.log10(totalFold) + 1e-9);
  const remainder = totalFold / 10 ** tenfold;
  /** @type {number[]} */
  const folds = Array.from({ length: tenfold }, () => 10);
  // A remainder within 1% of 1 is a power of ten that floating point missed by a hair.
  if (remainder > 1.01) folds.push(remainder);

  const round = (/** @type {number} */ v) => Math.round(v * 10) / 10;
  // From the last tube back: each tube must hold what the next one takes, and the last what is needed.
  /** @type {number[]} */
  const totals = Array.from({ length: folds.length }, () => 0);
  // Filled from the end, so each tube's total is known before the tube that supplies it.
  let required = neededUl;
  for (let i = folds.length - 1; i >= 0; i -= 1) {
    const fold = must(folds[i]);
    // Never a volume under 1 µl: a 1.05-fold step at 10 µl would need 0.5 µl of buffer.
    const smallest = Math.max(fold, fold / (fold - 1));
    const total = Math.max(transferUl * fold, smallest, required);
    totals[i] = total;
    required = total / fold;
  }

  /** @type {DilutionStep[]} */
  const steps = [];
  let cumulativeFold = 1;
  folds.forEach((fold, i) => {
    const total = must(totals[i]);
    const transfer = round(total / fold);
    const buffer = round(total - total / fold);
    const actualFold = (transfer + buffer) / transfer;
    cumulativeFold *= actualFold;
    steps.push({
      tube: i + 1,
      transferUl: transfer,
      bufferUl: buffer,
      fold: actualFold,
      cumulativeFold,
      pfuPerMl: startPfuPerMl / cumulativeFold,
    });
  });
  return { totalFold, tenfold, remainder, steps, finalPfuPerMl: startPfuPerMl / cumulativeFold };
}

/** @param {DilutionStep} step @param {number} tenfoldCount */
function stepLine(step, tenfoldCount) {
  const from = step.tube === 1 ? "lysate" : `tube ${step.tube - 1}`;
  const label = step.tube <= tenfoldCount ? formatDilution(step.tube) : `1/${formatNumber(step.cumulativeFold)}`;
  return `Tube ${step.tube}: ${formatNumber(step.transferUl)} µl ${from} + ${formatNumber(step.bufferUl)} µl phage buffer = ${label}, ${formatScientific(step.pfuPerMl)} pfu/ml.`;
}

/**
 * The steps shared by the dilution and webbed-plate calculators: the fold, how it splits, the tubes.
 *
 * @param {ReturnType<typeof planDilution>} plan
 * @param {number} startPfuPerMl
 * @param {number} targetPfuPerMl
 */
function planLines(plan, startPfuPerMl, targetPfuPerMl) {
  const lines = [
    `Total dilution: ${formatScientific(startPfuPerMl)} / ${formatScientific(targetPfuPerMl)} = ${formatNumber(plan.totalFold)}-fold.`,
  ];
  const split =
    plan.steps.length === plan.tenfold
      ? `That is 10^${plan.tenfold}: ${count(plan.tenfold)} 10-fold steps.`
      : plan.tenfold === 0
        ? `That is less than 10-fold: one ${formatNumber(plan.remainder)}-fold step.`
        : `That is 10^${plan.tenfold} x ${formatNumber(plan.remainder)}: ${count(plan.tenfold)} 10-fold ${plan.tenfold === 1 ? "step" : "steps"}, then one ${formatNumber(plan.remainder)}-fold step.`;
  lines.push(split);
  for (const step of plan.steps) lines.push(stepLine(step, plan.tenfold));
  return lines;
}

/** @param {Record<string, string | undefined>} values @returns {ToolResult} */
function runDilution(values) {
  const start = parseNumber(values.start);
  const target = parseNumber(values.target);
  const transfer = parseNumber(values.transfer);
  const needed = values.needed === undefined || String(values.needed).trim() === "" ? 0 : parseNumber(values.needed);
  if (!Number.isFinite(start) || start <= 0) return { ok: false, error: "Enter the starting titer in pfu/ml, greater than 0." };
  if (!Number.isFinite(target) || target <= 0) return { ok: false, error: "Enter the target concentration in pfu/ml, greater than 0." };
  if (target >= start) return { ok: false, error: "The target is not below the starting titer, so there is nothing to dilute." };
  if (start / target > 1e20) return { ok: false, error: "That is more than 20 10-fold steps. Check the exponents." };
  if (!Number.isFinite(transfer) || transfer <= 0) return { ok: false, error: "Enter the volume carried into each tube, in µl, greater than 0." };
  if (!Number.isFinite(needed) || needed < 0) return { ok: false, error: "Enter the volume needed from the last tube in µl, or leave it empty." };
  const plan = planDilution({ startPfuPerMl: start, targetPfuPerMl: target, transferUl: transfer, neededUl: needed });
  const steps = planLines(plan, start, target);
  const last = must(plan.steps.at(-1));
  const lastVolume = last.transferUl + last.bufferUl;
  if (needed > 0) steps.push(`The last tube holds ${formatNumber(lastVolume)} µl, enough for the ${formatNumber(needed)} µl needed.`);
  /** @type {string[]} */
  const notes = [];
  if (plan.steps.some((step) => step.transferUl < 1 || step.bufferUl < 1)) {
    notes.push("A volume is under 1 µl. Raise the volume carried into each tube so every volume can be pipetted.");
  }
  return {
    ok: true,
    sections: [
      {
        heading: "Dilution series",
        steps,
        result: `${plan.steps.length} ${plan.steps.length === 1 ? "tube" : "tubes"}, ending at ${formatScientific(plan.finalPfuPerMl)} pfu/ml`,
        notes,
      },
    ],
  };
}

/* ---------------------------------------------------------------- webbed plate */

/**
 * µl of lysate per plate = pfu wanted per plate / titer (pfu/ml) x 1,000 µl/ml, the FAQ's formula.
 *
 * @param {{ titerPfuPerMl: number, pfuPerPlate: number }} input
 */
export function lysatePerPlate({ titerPfuPerMl, pfuPerPlate }) {
  return (pfuPerPlate / titerPfuPerMl) * 1000;
}

/**
 * Lysate back from flooding: plates x the lab's 5 to 7 ml per plate.
 *
 * @param {{ plates: number, lowMl?: number, highMl?: number }} input
 */
export function floodYield({ plates, lowMl = LAB.yieldLowMl, highMl = LAB.yieldHighMl }) {
  return { lowMl: plates * lowMl, highMl: plates * highMl };
}

/**
 * Plates to flood for a lysate volume: ml wanted / 5 to 7 ml per plate, rounded up. Fewest plates at
 * the high yield, most at the low one.
 *
 * @param {{ mlWanted: number, lowMl?: number, highMl?: number }} input
 */
export function platesForLysate({ mlWanted, lowMl = LAB.yieldLowMl, highMl = LAB.yieldHighMl }) {
  return { fewest: Math.ceil(mlWanted / highMl - 1e-9), most: Math.ceil(mlWanted / lowMl - 1e-9) };
}

/** @param {Record<string, string | undefined>} values @returns {ToolResult} */
function runWebbedPlate(values) {
  const titerValue = parseNumber(values.titer);
  const pfu = parseNumber(values.pfu);
  const volume = parseNumber(values.volume);
  const plates = parseNumber(values.plates);
  if (!Number.isFinite(titerValue) || titerValue <= 0) return { ok: false, error: "Enter the lysate's titer in pfu/ml, greater than 0." };
  if (!Number.isFinite(pfu) || pfu <= 0) return { ok: false, error: "Enter the pfu wanted on each plate, greater than 0." };
  if (!Number.isFinite(volume) || volume <= 0) return { ok: false, error: "Enter the volume plated on each plate, in µl, greater than 0." };
  if (!Number.isFinite(plates) || plates < 1 || !Number.isInteger(plates) || plates > 100) {
    return { ok: false, error: "Enter the number of plates as a whole number from 1 to 100." };
  }
  const lysateUl = lysatePerPlate({ titerPfuPerMl: titerValue, pfuPerPlate: pfu });
  const neededUl = plates * volume;
  const plate = [
    `Lysate per plate: ${formatNumber(pfu)} / ${formatScientific(titerValue)} pfu/ml x 1,000 µl/ml = ${formatNumber(lysateUl)} µl.`,
  ];
  /** @type {string[]} */
  const notes = [];
  let result;
  const targetPfuPerMl = (pfu / volume) * 1000;
  if (targetPfuPerMl >= titerValue) {
    plate.push(`That is more than ${formatNumber(volume)} µl, so plate undiluted lysate: ${formatNumber(lysateUl)} µl on each plate, ${formatNumber(lysateUl * plates)} µl for ${plates} plates.`);
    result = `${formatNumber(lysateUl)} µl of undiluted lysate per plate`;
    if (lysateUl > LAB.maxLysateUl) {
      notes.push(`${formatNumber(lysateUl)} µl is over the lab's limit of ${LAB.maxLysateUl} µl on 250 µl of host (10% of the cell volume), which lyses the cells. Plate ${LAB.maxLysateUl} µl, or use a lysate with a higher titer.`);
    }
  } else {
    plate.push(`To plate that in ${formatNumber(volume)} µl, the tube must hold ${formatNumber(pfu)} pfu / ${formatNumber(volume)} µl x 1,000 = ${formatScientific(targetPfuPerMl)} pfu/ml.`);
    const plan = planDilution({ startPfuPerMl: titerValue, targetPfuPerMl, transferUl: LAB.transferUl, neededUl });
    plate.push(...planLines(plan, titerValue, targetPfuPerMl));
    plate.push(`Enough of the last tube: ${plates} plates x ${formatNumber(volume)} µl = ${formatNumber(neededUl)} µl.`);
    const last = must(plan.steps.at(-1));
    result = `${formatNumber(volume)} µl of tube ${last.tube} (${formatNumber(volume * (last.pfuPerMl / 1000))} pfu) on each of ${plates} plates`;
  }
  const { lowMl, highMl } = floodYield({ plates });
  const flood = [
    `Flooded with ${LAB.floodMl} ml of phage buffer each, a plate returns about ${LAB.yieldLowMl} to ${LAB.yieldHighMl} ml.`,
    `${plates} plates x ${LAB.yieldLowMl} to ${LAB.yieldHighMl} ml = ${formatNumber(lowMl)} to ${formatNumber(highMl)} ml of lysate.`,
  ];
  return {
    ok: true,
    sections: [
      { heading: "Webbed plates", steps: plate, result, notes },
      {
        heading: "Lysate from flooding",
        steps: flood,
        result: `About ${formatNumber(lowMl)} to ${formatNumber(highMl)} ml`,
        notes: ["Dry or aged plates return less; one returned only 3.5 ml of an 8 ml flood."],
      },
    ],
  };
}

/** @param {Record<string, string | undefined>} values @returns {ToolResult} */
function runFlood(values) {
  const ml = parseNumber(values.ml);
  if (!Number.isFinite(ml) || ml <= 0 || ml > 10000) return { ok: false, error: "Enter the lysate wanted in ml, greater than 0." };
  const { fewest, most } = platesForLysate({ mlWanted: ml });
  const range = fewest === most ? `${most}` : `${fewest} to ${most}`;
  return {
    ok: true,
    sections: [
      {
        heading: "Plates to flood",
        steps: [
          `At ${LAB.yieldHighMl} ml per plate: ${formatNumber(ml)} / ${LAB.yieldHighMl} = ${formatNumber(ml / LAB.yieldHighMl)}, so ${fewest} ${fewest === 1 ? "plate" : "plates"}.`,
          `At ${LAB.yieldLowMl} ml per plate: ${formatNumber(ml)} / ${LAB.yieldLowMl} = ${formatNumber(ml / LAB.yieldLowMl)}, so ${most} ${most === 1 ? "plate" : "plates"}.`,
        ],
        result: `${range} webbed plates`,
        notes: ["Pour a plate or two more than this: some plates do not web or yield less."],
      },
    ],
  };
}

/* ---------------------------------------------------------------- registry */

/**
 * @typedef {object} ToolDefinition
 * @property {string} path the page it is on
 * @property {string} title the form's accessible name
 * @property {ToolField[]} fields
 * @property {(values: Record<string, string | undefined>) => ToolResult} run
 */

/** @type {Record<string, ToolDefinition>} */
export const TOOLS = {
  titer: {
    path: "/research/tools/titer",
    title: "Titer calculator",
    fields: [
      { name: "plaques", label: "Plaques counted", value: "111", hint: "On one plate, or in one spot." },
      {
        name: "volume",
        label: "Volume plated or spotted",
        unit: "µl",
        value: String(LAB.ulPlated),
        hint: `The lab plates ${LAB.ulPlated} µl for a full plate titer and spots ${LAB.ulSpot} µl for a spot titer; enter 10 for a 10 µl spot.`,
        source: SOURCES.fullPlate,
      },
      { name: "dilution", label: "Dilution, 10 to the minus", value: "6", hint: "6 for the 10^-6 tube, 0 if undiluted." },
    ],
    run: runTiter,
  },
  dilution: {
    path: "/research/tools/dilution",
    title: "Serial dilution planner",
    fields: [
      { name: "start", label: "Starting titer", unit: "pfu/ml", value: "1.11e10", hint: "1.11e10 or 1.11 x 10^10." },
      { name: "target", label: "Target concentration", unit: "pfu/ml", value: "1.11e6" },
      {
        name: "transfer",
        label: "Volume carried into each tube",
        unit: "µl",
        value: String(LAB.transferUl),
        hint: "Each 10-fold tube gets 9 times this of phage buffer: 10 µl + 90 µl.",
        source: SOURCES.tenfold,
      },
      { name: "needed", label: "Volume needed from the last tube (optional)", unit: "µl", value: "", hint: "Plates x µl per plate. Earlier tubes are scaled up to supply it." },
    ],
    run: runDilution,
  },
  "webbed-plate": {
    path: "/research/tools/webbed-plate",
    title: "Webbed plate calculator",
    fields: [
      { name: "titer", label: "Lysate titer", unit: "pfu/ml", value: "1.11e10", hint: "1.11e10 or 1.11 x 10^10." },
      { name: "pfu", label: "pfu wanted per plate", value: "11100", hint: "What webs depends on plaque size; see the notes below." },
      { name: "volume", label: "Volume plated per plate", unit: "µl", value: String(LAB.ulPlated), source: SOURCES.fullPlate },
      { name: "plates", label: "Plates to pour", value: String(LAB.plates), source: SOURCES.yields },
    ],
    run: runWebbedPlate,
  },
  flood: {
    path: "/research/tools/webbed-plate",
    title: "Plates for a lysate volume",
    fields: [{ name: "ml", label: "Lysate wanted", unit: "ml", value: "20", hint: "10 ml to archive plus 10 ml for DNA extraction is 20 ml." }],
    run: runFlood,
  },
};

/** The calculators on a page, in page order. @param {string} path */
export function toolsOnPage(path) {
  return Object.keys(TOOLS).filter((id) => TOOLS[id]?.path === path);
}

/**
 * A tool's values: the query string's where it has them, the field's opening value where not.
 *
 * @param {string} id
 * @param {URLSearchParams} [params]
 * @returns {Record<string, string>}
 */
export function toolValues(id, params) {
  const tool = TOOLS[id];
  if (!tool) throw new Error(`No calculator named ${id}.`);
  /** @type {Record<string, string>} */
  const values = {};
  for (const field of tool.fields) {
    const given = params?.get(field.name);
    values[field.name] = given === null || given === undefined ? field.value : given.slice(0, 40);
  }
  return values;
}

/** @param {string} id @param {Record<string, string | undefined>} values @returns {ToolResult} */
export function runTool(id, values) {
  const tool = TOOLS[id];
  if (!tool) throw new Error(`No calculator named ${id}.`);
  return tool.run(values);
}

/* ---------------------------------------------------------------- view */

/**
 * @typedef {{ tag: "div" | "h3" | "ol" | "li" | "p" | "strong" | "sup", className?: string, children: Array<ViewNode | string> }} ViewNode
 */

/** @param {string} line @returns {Array<ViewNode | string>} */
function lineNodes(line) {
  return textParts(line).map((part) => (part.sup ? { tag: "sup", children: [part.text] } : part.text));
}

/**
 * What a result looks like, as plain nodes, so the server component and the browser module build the
 * same markup from one description and neither parses HTML. `summary` is the one line per section the
 * status region announces; `detail` is the worked steps under it.
 *
 * @param {ToolResult} result
 * @returns {{ summary: Array<ViewNode | string>, detail: ViewNode[] }}
 */
export function resultView(result) {
  if (!result.ok) {
    return { summary: [{ tag: "p", className: "phage-tool-error", children: [result.error] }], detail: [] };
  }
  const summary = result.sections
    .filter((section) => section.result)
    .map((section) => ({
      tag: /** @type {const} */ ("p"),
      className: "phage-tool-answer",
      children: [`${section.heading}: `, { tag: /** @type {const} */ ("strong"), children: lineNodes(section.result ?? "") }],
    }));
  const detail = result.sections.map((section) => ({
    tag: /** @type {const} */ ("div"),
    className: "phage-tool-section",
    children: [
      { tag: /** @type {const} */ ("h3"), children: [section.heading] },
      {
        tag: /** @type {const} */ ("ol"),
        className: "phage-tool-steps",
        children: section.steps.map((step) => ({ tag: /** @type {const} */ ("li"), children: lineNodes(step) })),
      },
      ...(section.notes ?? []).map((note) => ({
        tag: /** @type {const} */ ("p"),
        className: "phage-tool-note",
        children: lineNodes(note),
      })),
    ],
  }));
  return { summary, detail };
}
