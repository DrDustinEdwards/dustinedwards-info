/** Titer and serial-dilution calculators (see phage-tools.mjs). */

import {
  LAB,
  count,
  formatDilution,
  formatNumber,
  formatScientific,
  must,
  parseNumber,
} from "./phage-tools-base.mjs";

/** @typedef {import("./phage-tools-base.mjs").ToolResult} ToolResult */

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

/**
 * A plaque count, the volume plated and the dilution's exponent, read and checked. Shared by the titer
 * calculator and the EOP-from-counts calculator, so both refuse the same inputs in the same words.
 * `where` names the plate in the message ("" for one plate, " on the test host" for EOP).
 *
 * @param {unknown} rawPlaques @param {unknown} rawVolume @param {unknown} rawDilution @param {string} [where]
 * @returns {{ ok: true, plaques: number, volumeUl: number, n: number } | { ok: false, error: string }}
 */
export function readCount(rawPlaques, rawVolume, rawDilution, where = "") {
  const plaques = parseNumber(rawPlaques);
  const volumeUl = parseNumber(rawVolume);
  const rawN = parseNumber(rawDilution);
  if (!Number.isFinite(plaques) || plaques < 0 || !Number.isInteger(plaques)) {
    return { ok: false, error: `Enter the plaques counted${where} as a whole number, 0 or more.` };
  }
  if (!Number.isFinite(volumeUl) || volumeUl <= 0) {
    return {
      ok: false,
      error: `Enter the volume plated or spotted${where}, in µl, greater than 0.`,
    };
  }
  // A dilution is never more than 1, so 6 and -6 both mean 10^-6.
  const n = Math.abs(rawN);
  if (!Number.isFinite(rawN) || !Number.isInteger(n) || n > 20) {
    return {
      ok: false,
      error: `Enter the dilution's exponent${where} as a whole number from 0 to 20: 6 for 10^-6, 0 if undiluted.`,
    };
  }
  return { ok: true, plaques, volumeUl, n };
}

/** @param {Record<string, string | undefined>} values @returns {ToolResult} */
export function runTiter(values) {
  const read = readCount(values.plaques, values.volume, values.dilution);
  if (!read.ok) return read;
  const { plaques, volumeUl, n } = read;
  const { perUl, perMlDiluted, pfuPerMl } = titer({ plaques, volumeUl, dilutionExponent: n });
  const of = n === 0 ? "in the undiluted lysate" : `in the ${formatDilution(n)} dilution`;
  const steps = [
    `Plaques per µl: ${formatNumber(plaques)} / ${formatNumber(volumeUl)} µl = ${formatNumber(perUl)} pfu/µl.`,
    `Per ml: ${formatNumber(perUl)} x 1,000 = ${formatNumber(perMlDiluted)} pfu/ml ${of}.`,
  ];
  if (n > 0) {
    steps.push(
      `Undo the dilution: ${formatNumber(perMlDiluted)} x 10^${n} = ${formatScientific(pfuPerMl)} pfu/ml.`,
    );
  }
  /** @type {string[]} */
  const notes = [];
  if (plaques === 0) {
    notes.push(
      "No plaques: the titer is below what this plate can measure. Count a less dilute plate.",
    );
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
export function planDilution({
  startPfuPerMl,
  targetPfuPerMl,
  transferUl = LAB.transferUl,
  neededUl = 0,
}) {
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
  const label =
    step.tube <= tenfoldCount
      ? formatDilution(step.tube)
      : `1/${formatNumber(step.cumulativeFold)}`;
  return `Tube ${step.tube}: ${formatNumber(step.transferUl)} µl ${from} + ${formatNumber(step.bufferUl)} µl phage buffer = ${label}, ${formatScientific(step.pfuPerMl)} pfu/ml.`;
}

/**
 * The steps shared by the dilution and webbed-plate calculators: the fold, how it splits, the tubes.
 *
 * @param {ReturnType<typeof planDilution>} plan
 * @param {number} startPfuPerMl
 * @param {number} targetPfuPerMl
 */
export function planLines(plan, startPfuPerMl, targetPfuPerMl) {
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
export function runDilution(values) {
  const start = parseNumber(values.start);
  const target = parseNumber(values.target);
  const transfer = parseNumber(values.transfer);
  const needed =
    values.needed === undefined || String(values.needed).trim() === ""
      ? 0
      : parseNumber(values.needed);
  if (!Number.isFinite(start) || start <= 0)
    return { ok: false, error: "Enter the starting titer in pfu/ml, greater than 0." };
  if (!Number.isFinite(target) || target <= 0)
    return { ok: false, error: "Enter the target concentration in pfu/ml, greater than 0." };
  if (target * 1.01 >= start)
    return {
      ok: false,
      error: "The target is not below the starting titer, so there is nothing to dilute.",
    };
  if (start / target > 1e20)
    return { ok: false, error: "That is more than 20 10-fold steps. Check the exponents." };
  if (!Number.isFinite(transfer) || transfer <= 0)
    return { ok: false, error: "Enter the volume carried into each tube, in µl, greater than 0." };
  if (!Number.isFinite(needed) || needed < 0)
    return {
      ok: false,
      error: "Enter the volume needed from the last tube in µl, or leave it empty.",
    };
  const plan = planDilution({
    startPfuPerMl: start,
    targetPfuPerMl: target,
    transferUl: transfer,
    neededUl: needed,
  });
  const steps = planLines(plan, start, target);
  const last = must(plan.steps.at(-1));
  const lastVolume = last.transferUl + last.bufferUl;
  if (needed > 0)
    steps.push(
      `The last tube holds ${formatNumber(lastVolume)} µl, enough for the ${formatNumber(needed)} µl needed.`,
    );
  /** @type {string[]} */
  const notes = [];
  if (plan.steps.some((step) => step.transferUl < 1 || step.bufferUl < 1)) {
    notes.push(
      "A volume is under 1 µl. Raise the volume carried into each tube so every volume can be pipetted.",
    );
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
