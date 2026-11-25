/** Lysate, flood yield, MOI and efficiency-of-plating calculators (see phage-tools.mjs). */

import { LAB, formatNumber, formatScientific, must, parseNumber } from "./phage-tools-base.mjs";
import { planDilution, planLines, readCount, titer } from "./phage-tools-dilution.mjs";

/** @typedef {import("./phage-tools-base.mjs").ToolResult} ToolResult */

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
export function runWebbedPlate(values) {
  const titerValue = parseNumber(values.titer);
  const pfu = parseNumber(values.pfu);
  const volume = parseNumber(values.volume);
  const plates = parseNumber(values.plates);
  if (!Number.isFinite(titerValue) || titerValue <= 0)
    return { ok: false, error: "Enter the lysate's titer in pfu/ml, greater than 0." };
  if (!Number.isFinite(pfu) || pfu <= 0)
    return { ok: false, error: "Enter the pfu wanted on each plate, greater than 0." };
  if (!Number.isFinite(volume) || volume <= 0)
    return { ok: false, error: "Enter the volume plated on each plate, in µl, greater than 0." };
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
  if (targetPfuPerMl * 1.01 >= titerValue) {
    plate.push(
      `That is more than ${formatNumber(volume)} µl, so plate undiluted lysate: ${formatNumber(lysateUl)} µl on each plate, ${formatNumber(lysateUl * plates)} µl for ${plates} plates.`,
    );
    result = `${formatNumber(lysateUl)} µl of undiluted lysate per plate`;
    if (lysateUl > LAB.maxLysateUl) {
      notes.push(
        `${formatNumber(lysateUl)} µl is over the lab's limit of ${LAB.maxLysateUl} µl on 250 µl of host (10% of the cell volume), which lyses the cells. Plate ${LAB.maxLysateUl} µl, or use a lysate with a higher titer.`,
      );
    }
  } else {
    plate.push(
      `To plate that in ${formatNumber(volume)} µl, the tube must hold ${formatNumber(pfu)} pfu / ${formatNumber(volume)} µl x 1,000 = ${formatScientific(targetPfuPerMl)} pfu/ml.`,
    );
    const plan = planDilution({
      startPfuPerMl: titerValue,
      targetPfuPerMl,
      transferUl: LAB.transferUl,
      neededUl,
    });
    plate.push(...planLines(plan, titerValue, targetPfuPerMl));
    plate.push(
      `Enough of the last tube: ${plates} plates x ${formatNumber(volume)} µl = ${formatNumber(neededUl)} µl.`,
    );
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
export function runFlood(values) {
  const ml = parseNumber(values.ml);
  if (!Number.isFinite(ml) || ml <= 0 || ml > 10000)
    return { ok: false, error: "Enter the lysate wanted in ml, over 0 and up to 10,000." };
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

/**
 * MOI = pfu added / cells, with pfu = titer (pfu/ml) x µl added / 1,000 µl/ml and cells = cells/ml x µl
 * of culture / 1,000 µl/ml. `infected` is the share of cells that receive at least one phage when phages
 * land at random (Poisson): 1 - exp(-MOI). The site gives no OD-to-cells conversion, so cells are counted.
 *
 * @param {{ titerPfuPerMl: number, phageUl: number, cellsPerMl: number, hostUl: number }} input
 */
export function moi({ titerPfuPerMl, phageUl, cellsPerMl, hostUl }) {
  const pfu = (titerPfuPerMl * phageUl) / 1000;
  const cells = (cellsPerMl * hostUl) / 1000;
  const ratio = pfu / cells;
  return { pfu, cells, moi: ratio, infected: -Math.expm1(-ratio) };
}

/** @param {Record<string, string | undefined>} values @returns {ToolResult} */
export function runMoi(values) {
  const titerValue = parseNumber(values.titer);
  const phageUl = parseNumber(values.phage);
  const cellsPerMl = parseNumber(values.cells);
  const hostUl = parseNumber(values.host);
  if (!Number.isFinite(titerValue) || titerValue <= 0)
    return { ok: false, error: "Enter the phage titer in pfu/ml, greater than 0." };
  if (!Number.isFinite(phageUl) || phageUl <= 0)
    return { ok: false, error: "Enter the volume of phage added, in µl, greater than 0." };
  if (!Number.isFinite(cellsPerMl) || cellsPerMl <= 0)
    return { ok: false, error: "Enter the host cells per ml, greater than 0." };
  if (!Number.isFinite(hostUl) || hostUl <= 0)
    return { ok: false, error: "Enter the volume of host culture, in µl, greater than 0." };
  const result = moi({ titerPfuPerMl: titerValue, phageUl, cellsPerMl, hostUl });
  return {
    ok: true,
    sections: [
      {
        heading: "MOI",
        steps: [
          `pfu added: ${formatScientific(titerValue)} pfu/ml x ${formatNumber(phageUl)} µl / 1,000 µl/ml = ${formatNumber(result.pfu)} pfu.`,
          `Cells: ${formatScientific(cellsPerMl)} cells/ml x ${formatNumber(hostUl)} µl / 1,000 µl/ml = ${formatNumber(result.cells)} cells.`,
          `MOI: ${formatNumber(result.pfu)} pfu / ${formatNumber(result.cells)} cells = ${formatNumber(result.moi)}.`,
          `Cells that get at least one phage: 1 - exp(-${formatNumber(result.moi)}) = ${formatNumber(result.infected)}, about ${formatNumber(result.infected * 100)}%.`,
        ],
        result: `${formatNumber(result.moi)} pfu per cell`,
        notes: [
          "The last step assumes phages meet cells at random and every pfu adsorbs. Slow or incomplete adsorption infects fewer cells than it says.",
        ],
      },
    ],
  };
}

/**
 * EOP = titer on the test host / titer on the reference host.
 *
 * @param {{ testPfuPerMl: number, referencePfuPerMl: number }} input
 */
export function eop({ testPfuPerMl, referencePfuPerMl }) {
  return testPfuPerMl / referencePfuPerMl;
}

/**
 * The EOP steps shared by both EOP calculators. `boundPfuPerMl`, when the test host had no plaques, is
 * the titer one plaque on that plate would have meant, so the note can say how low the EOP is.
 *
 * @param {number} test @param {number} reference @param {number} [boundPfuPerMl]
 */
function eopSection(test, reference, boundPfuPerMl) {
  const ratio = eop({ testPfuPerMl: test, referencePfuPerMl: reference });
  /** @type {string[]} */
  const notes = [];
  if (test === 0) {
    const bound =
      boundPfuPerMl === undefined
        ? ""
        : ` It is below ${formatNumber(eop({ testPfuPerMl: boundPfuPerMl, referencePfuPerMl: reference }))}, what one plaque on that plate would give.`;
    notes.push(
      `No plaques on the test host: the phage did not plate at this dilution, which is not the same as an EOP of exactly 0.${bound} Plate a less dilute sample to measure it.`,
    );
  }
  return {
    heading: "Efficiency of plating",
    steps: [
      `EOP: ${formatScientific(test)} pfu/ml on the test host / ${formatScientific(reference)} pfu/ml on the reference host = ${formatNumber(ratio)}.`,
      `As a percentage of the reference titer: ${formatNumber(ratio)} x 100 = ${formatNumber(ratio * 100)}%.`,
    ],
    result: `${formatNumber(ratio)} (${formatNumber(ratio * 100)}% of the reference titer)`,
    notes,
  };
}

/** @param {Record<string, string | undefined>} values @returns {ToolResult} */
export function runEop(values) {
  const test = parseNumber(values.test);
  const reference = parseNumber(values.reference);
  if (!Number.isFinite(test) || test < 0)
    return { ok: false, error: "Enter the titer on the test host in pfu/ml, 0 or more." };
  if (!Number.isFinite(reference) || reference <= 0)
    return { ok: false, error: "Enter the titer on the reference host in pfu/ml, greater than 0." };
  return { ok: true, sections: [eopSection(test, reference)] };
}

/** One host's titer line for the EOP-from-counts steps. @param {string} host @param {{ plaques: number, volumeUl: number, n: number }} count @param {number} pfuPerMl */
function countLine(host, { plaques, volumeUl, n }, pfuPerMl) {
  const undo = n === 0 ? "" : ` x 10^${n}`;
  return `Titer on the ${host}: ${formatNumber(plaques)} / ${formatNumber(volumeUl)} µl x 1,000${undo} = ${formatScientific(pfuPerMl)} pfu/ml.`;
}

/** @param {Record<string, string | undefined>} values @returns {ToolResult} */
export function runEopCounts(values) {
  const test = readCount(
    values.testPlaques,
    values.testVolume,
    values.testDilution,
    " on the test host",
  );
  if (!test.ok) return test;
  const reference = readCount(
    values.refPlaques,
    values.refVolume,
    values.refDilution,
    " on the reference host",
  );
  if (!reference.ok) return reference;
  if (reference.plaques === 0) {
    return {
      ok: false,
      error:
        "No plaques on the reference host, so there is no titer to divide by. Count a less dilute plate.",
    };
  }
  const testTiter = titer({
    plaques: test.plaques,
    volumeUl: test.volumeUl,
    dilutionExponent: test.n,
  }).pfuPerMl;
  const refTiter = titer({
    plaques: reference.plaques,
    volumeUl: reference.volumeUl,
    dilutionExponent: reference.n,
  }).pfuPerMl;
  const bound = titer({ plaques: 1, volumeUl: test.volumeUl, dilutionExponent: test.n }).pfuPerMl;
  const section = eopSection(testTiter, refTiter, bound);
  return {
    ok: true,
    sections: [
      {
        ...section,
        steps: [
          countLine("test host", test, testTiter),
          countLine("reference host", reference, refTiter),
          ...section.steps,
        ],
      },
    ],
  };
}

/**
 * Lysate for a run of plates: (pfu per plate x plates) / titer (pfu/ml) x 1,000 µl/ml, the webbed
 * plate formula for all the plates at once.
 *
 * @param {{ titerPfuPerMl: number, pfuPerPlate: number, plates: number }} input
 */
export function lysateForPlates({ titerPfuPerMl, pfuPerPlate, plates }) {
  const totalPfu = pfuPerPlate * plates;
  const totalUl = lysatePerPlate({ titerPfuPerMl, pfuPerPlate: totalPfu });
  return { totalPfu, totalUl, perPlateUl: totalUl / plates };
}

/** @param {Record<string, string | undefined>} values @returns {ToolResult} */
export function runLysateVolume(values) {
  const titerValue = parseNumber(values.titer);
  const pfu = parseNumber(values.pfu);
  const plates = parseNumber(values.plates);
  const volume = parseNumber(values.volume);
  if (!Number.isFinite(titerValue) || titerValue <= 0)
    return { ok: false, error: "Enter the lysate's titer in pfu/ml, greater than 0." };
  if (!Number.isFinite(pfu) || pfu <= 0)
    return { ok: false, error: "Enter the pfu wanted on each plate, greater than 0." };
  if (!Number.isFinite(plates) || plates < 1 || !Number.isInteger(plates) || plates > 100) {
    return { ok: false, error: "Enter the number of plates as a whole number from 1 to 100." };
  }
  if (!Number.isFinite(volume) || volume <= 0)
    return { ok: false, error: "Enter the volume plated on each plate, in µl, greater than 0." };
  const { totalPfu, totalUl, perPlateUl } = lysateForPlates({
    titerPfuPerMl: titerValue,
    pfuPerPlate: pfu,
    plates,
  });
  const steps = [
    `pfu for all plates: ${formatNumber(pfu)} x ${plates} = ${formatNumber(totalPfu)} pfu.`,
    `Lysate for all plates: ${formatNumber(totalPfu)} / ${formatScientific(titerValue)} pfu/ml x 1,000 µl/ml = ${formatNumber(totalUl)} µl.`,
    `Per plate: ${formatNumber(totalUl)} µl / ${plates} = ${formatNumber(perPlateUl)} µl.`,
  ];
  /** @type {string[]} */
  const notes = [];
  let result;
  if (perPlateUl >= volume * (1 - 1e-9)) {
    steps.push(
      `That is at least the ${formatNumber(volume)} µl plated per plate, so plate the lysate undiluted: ${formatNumber(perPlateUl)} µl on each plate.`,
    );
    result = `${formatNumber(totalUl)} µl of undiluted lysate, ${formatNumber(perPlateUl)} µl on each of ${plates} plates`;
    if (perPlateUl > LAB.maxLysateUl) {
      notes.push(
        `${formatNumber(perPlateUl)} µl is over the lab's limit of ${LAB.maxLysateUl} µl on 250 µl of host (10% of the cell volume), which lyses the cells. Use a lysate with a higher titer.`,
      );
    }
  } else {
    const mixUl = plates * volume;
    if (totalUl >= 1) {
      steps.push(
        `To plate ${formatNumber(volume)} µl on each: ${plates} plates x ${formatNumber(volume)} µl = ${formatNumber(mixUl)} µl, so mix ${formatNumber(totalUl)} µl lysate + ${formatNumber(mixUl - totalUl)} µl phage buffer.`,
      );
      result = `${formatNumber(totalUl)} µl of lysate in ${formatNumber(mixUl)} µl, ${formatNumber(volume)} µl on each of ${plates} plates`;
    } else {
      steps.push(
        `${formatNumber(totalUl)} µl is under 1 µl, too little to pipette, so dilute the lysate first and plate ${formatNumber(volume)} µl of the last tube on each plate.`,
      );
      result = `${formatNumber(totalUl)} µl of lysate for ${plates} plates, made by dilution`;
      notes.push("The webbed plate calculator plans the dilution tubes for these numbers.");
    }
  }
  return { ok: true, sections: [{ heading: "Lysate needed", steps, result, notes }] };
}
