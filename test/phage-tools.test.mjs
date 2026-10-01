import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  LAB,
  TOOLS,
  eop,
  floodYield,
  formatNumber,
  formatScientific,
  lysateForPlates,
  lysatePerPlate,
  moi,
  parseNumber,
  planDilution,
  platesForLysate,
  resultView,
  runTool,
  textParts,
  titer,
  toolValues,
  toolsOnPage,
} from "../app/lib/phage-tools.mjs";

/** @param {string} slug */
const procedure = (slug) => readFileSync(new URL(`../content/procedures/${slug}.md`, import.meta.url), "utf8");

/** Equal at the precision the page states: 1.1 x 10^10 is two significant figures. */
function sameAsStated(actual, mantissa, exponent) {
  const digits = mantissa.replace(".", "").replace(/^0+/, "").length;
  const stated = Number(mantissa) * 10 ** exponent;
  assert.equal(Number(actual.toPrecision(digits)), Number(stated.toPrecision(digits)), `${actual} is not ${mantissa} x 10^${exponent}`);
}

/* ------------------------------------------------------------ titer, by hand */

test("titer: hand arithmetic, 111 plaques in 10 µl of 10^-6", () => {
  // 111 / 10 = 11.1 pfu/µl; x 1,000 = 11,100 pfu/ml; x 10^6 = 1.11 x 10^10.
  const { perUl, perMlDiluted, pfuPerMl } = titer({ plaques: 111, volumeUl: 10, dilutionExponent: 6 });
  assert.equal(perUl, 11.1);
  assert.equal(Math.round(perMlDiluted), 11100);
  assert.equal(Math.round(pfuPerMl / 1e6), 11100);
});

test("titer: a spot titer divides by the spot volume, 6 plaques in 3 µl of 10^-3", () => {
  // 6 / 3 = 2 pfu/µl; x 1,000 = 2,000; x 10^3 = 2 x 10^6. Undivided by 3 µl it would be 6 x 10^6.
  assert.equal(titer({ plaques: 6, volumeUl: 3, dilutionExponent: 3 }).pfuPerMl, 2e6);
  // A 10 µl spot is the same formula: 6 / 10 x 1,000 x 10^3 = 6 x 10^5.
  assert.equal(Math.round(titer({ plaques: 6, volumeUl: 10, dilutionExponent: 3 }).pfuPerMl), 6e5);
});

test("titer: every row of the protocol's worked-numbers table", () => {
  const md = procedure("phage-isolation");
  const rows = [...md.matchAll(/^\| (\d+) \| (\d+) µl(?: \(spot\))? \| (10\^-(\d+)|undiluted) \| ([\d.]+) x 10\^(\d+) pfu\/ml \|$/gm)];
  // The table has ten rows; a count this low means the table moved and nothing was checked.
  assert.ok(rows.length >= 10, `read ${rows.length} rows from the protocol's titer table`);
  for (const [, plaques, volume, , n, mantissa, exponent] of rows) {
    const { pfuPerMl } = titer({ plaques: Number(plaques), volumeUl: Number(volume), dilutionExponent: n ? Number(n) : 0 });
    sameAsStated(pfuPerMl, mantissa, Number(exponent));
  }
});

test("titer: the FAQ's worked numbers, all from 10 µl plated", () => {
  // Lab Calculations and Common Questions, "How do you calculate the titer": its table and example.
  const faq = [
    [111, 6, "1.11", 10],
    [81, 3, "8.1", 6],
    [40, 4, "4", 7],
    [42, 6, "4.2", 9],
    [10, 8, "1.0", 11],
    [376, 0, "3.76", 4],
  ];
  for (const [plaques, n, mantissa, exponent] of faq) {
    sameAsStated(titer({ plaques, volumeUl: 10, dilutionExponent: n }).pfuPerMl, mantissa, exponent);
  }
});

test("titer: the notebooks' recorded mistakes come out right", () => {
  // Protocol, titer arithmetic: 40 at 10^-4 written 4 x 10^-7, 74 at 10^-5 written 7.4 x 10^11,
  // 376 undiluted written 3.76 x 10^5. The calculator gives the corrected values.
  assert.equal(runTool("titer", { plaques: "40", volume: "10", dilution: "4" }).sections[0].result, "4 x 10^7 pfu/ml");
  assert.equal(runTool("titer", { plaques: "74", volume: "10", dilution: "5" }).sections[0].result, "7.4 x 10^8 pfu/ml");
  assert.equal(runTool("titer", { plaques: "376", volume: "10", dilution: "0" }).sections[0].result, "3.76 x 10^4 pfu/ml");
});

test("titer: a minus sign on the dilution means the same dilution", () => {
  assert.deepEqual(
    runTool("titer", { plaques: "111", volume: "10", dilution: "-6" }),
    runTool("titer", { plaques: "111", volume: "10", dilution: "6" }),
  );
});

test("titer: refuses inputs it cannot compute, naming the field", () => {
  const cases = [
    [{ plaques: "", volume: "10", dilution: "6" }, /plaques/],
    [{ plaques: "2.5", volume: "10", dilution: "6" }, /whole number/],
    [{ plaques: "10", volume: "0", dilution: "6" }, /volume/],
    [{ plaques: "10", volume: "10", dilution: "1.5" }, /exponent/],
    [{ plaques: "10", volume: "10", dilution: "abc" }, /exponent/],
  ];
  for (const [values, message] of cases) {
    const result = runTool("titer", values);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, message);
  }
});

/* ------------------------------------------------------------ dilution, by hand */

test("dilution: 10 µl into 90 µl is 10-fold, and 10 µl into 100 µl is 11-fold", () => {
  // The FAQ's recipe and its recorded error.
  assert.equal((10 + 90) / 10, 10);
  assert.equal((10 + 100) / 10, 11);
  const plan = planDilution({ startPfuPerMl: 1e9, targetPfuPerMl: 1e8 });
  assert.deepEqual(
    plan.steps.map(({ transferUl, bufferUl }) => [transferUl, bufferUl]),
    [[10, 90]],
  );
});

test("dilution: 1.11 x 10^10 to 1.11 x 10^6 is four 10-fold tubes", () => {
  const plan = planDilution({ startPfuPerMl: 1.11e10, targetPfuPerMl: 1.11e6 });
  assert.equal(plan.steps.length, 4);
  assert.ok(plan.steps.every((step) => step.transferUl === 10 && step.bufferUl === 90));
  sameAsStated(plan.finalPfuPerMl, "1.11", 6);
});

test("dilution: the notebook's two-tube 10^-4 is the same total, 1 + 999 then 7 + 63", () => {
  // FAQ: 1 µl lysate + 999 µl buffer (10^-3), then 7 µl + 63 µl (10^-4), 70 µl in the last tube.
  assert.equal(((1 + 999) / 1) * ((7 + 63) / 7), 1e4);
  assert.equal(7 + 63, 70);
});

test("dilution: a total that is not a power of ten ends in one smaller step", () => {
  // Protocol, bracketing: 3.0 x 10^9 lysate, 6,000 pfu in 10 µl = 6 x 10^5 pfu/ml, 5,000-fold.
  // By hand: 10^3 in three 10 + 90 steps, then 5-fold as 10 µl + 40 µl.
  const plan = planDilution({ startPfuPerMl: 3e9, targetPfuPerMl: 6e5 });
  assert.equal(plan.tenfold, 3);
  assert.deepEqual(
    plan.steps.map(({ transferUl, bufferUl }) => [transferUl, bufferUl]),
    [[10, 90], [10, 90], [10, 90], [10, 40]],
  );
  sameAsStated(plan.finalPfuPerMl, "6", 5);
});

test("dilution: the last tube is made large enough for every plate, and the tubes before it supply it", () => {
  // FAQ: the 10^-3 plate webbed; 10 µl on each of 6 plates uses 60 µl of the 100 µl tube.
  const six = planDilution({ startPfuPerMl: 1e9, targetPfuPerMl: 1e6, neededUl: 60 });
  const last = six.steps[six.steps.length - 1];
  assert.equal(last.transferUl + last.bufferUl, 100);
  // 250 µl needed: the last tube is 25 + 225, and tube 3 still holds the 25 µl it gives.
  const big = planDilution({ startPfuPerMl: 1e10, targetPfuPerMl: 1e6, neededUl: 250 });
  const end = big.steps[3];
  assert.deepEqual([end.transferUl, end.bufferUl], [25, 225]);
  assert.ok(big.steps[2].transferUl + big.steps[2].bufferUl >= 25);
});

test("dilution: no step asks for less than 1 µl", () => {
  // 1.05-fold at 10 µl would be 10 µl + 0.5 µl. The planner scales the step up instead.
  const plan = planDilution({ startPfuPerMl: 1.05e8, targetPfuPerMl: 1e8 });
  assert.ok(plan.steps.every((step) => step.transferUl >= 1 && step.bufferUl >= 1), JSON.stringify(plan.steps));
  sameAsStated(plan.finalPfuPerMl, "1.00", 8);
});

test("dilution: refuses a target at or above the start", () => {
  const result = runTool("dilution", { start: "1e6", target: "1e7", transfer: "10", needed: "" });
  assert.equal(result.ok, false);
});

/* ------------------------------------------------------------ webbed plate, by hand */

test("webbed plate: the FAQ's example, 11,100 pfu from a 1.1 x 10^10 lysate", () => {
  // 11,100 / 1.1 x 10^10 x 1,000 = 1.009 x 10^-3 µl, which the FAQ and protocol print as 1.01 x 10^-3.
  // The notebook's dilution (1/10^4, 10 µl per plate) delivered 10 x 10^-4 = 1 x 10^-3 µl of lysate
  // per plate, which is that volume at the precision a pipette can hold.
  sameAsStated(lysatePerPlate({ titerPfuPerMl: 1.1e10, pfuPerPlate: 11100 }), "1.01", -3);
  assert.ok(procedure("phage-isolation").includes("A target of about 11,100 pfu needs 1.01 x 10^-3 µl of lysate per plate."));
  sameAsStated(lysatePerPlate({ titerPfuPerMl: 1.11e10, pfuPerPlate: 11100 }), "1.00", -3);
  assert.equal(10 * (1 / 1000) * (7 / 70), 1e-3);
});

test("webbed plate: the protocol's bracketing and pfu-per-web numbers", () => {
  // 3.0 x 10^9 lysate, 6,000 pfu target: 2.0 x 10^-3 µl.
  sameAsStated(lysatePerPlate({ titerPfuPerMl: 3e9, pfuPerPlate: 6000 }), "2.0", -3);
  // 1.44 x 10^7 lysate, 1,500 pfu target: 0.104 µl.
  sameAsStated(lysatePerPlate({ titerPfuPerMl: 1.44e7, pfuPerPlate: 1500 }), "1.04", -1);
  // 4.8 x 10^9 lysate, 3.125 x 10^-3 µl per plate: 15,000 pfu.
  assert.equal(Math.round((3.125e-3 * 4.8e9) / 1000), 15000);
  // 10 µl of 10^-2 of a 7.4 x 10^7 lysate is about 7,400 pfu.
  const tube2 = planDilution({ startPfuPerMl: 7.4e7, targetPfuPerMl: 7.4e5 }).steps[1];
  assert.equal(Math.round((10 * tube2.pfuPerMl) / 1000), 7400);
  // 8 µl of 10^-2 of a 2.5 x 10^8 lysate is about 20,000 pfu.
  assert.equal((8 * (2.5e8 / 100)) / 1000, 20000);
  // 20 to 30 µl of 10^-3 of a 4 x 10^8 lysate is 8,000 to 12,000 pfu.
  assert.deepEqual([20, 30].map((ul) => (ul * (4e8 / 1000)) / 1000), [8000, 12000]);
});

test("webbed plate: the calculator plates 10 µl of the 10^-4 tube for the worked example", () => {
  const result = runTool("webbed-plate", { titer: "1.11e10", pfu: "11100", volume: "10", plates: "6" });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.sections[0].result, "10 µl of tube 4 (11,100 pfu) on each of 6 plates");
});

test("webbed plate: warns above the lab's 25 µl limit on 250 µl of host", () => {
  // 1 x 10^6 pfu from a 1 x 10^7 lysate is 100 µl of undiluted lysate.
  const result = runTool("webbed-plate", { titer: "1e7", pfu: "1e6", volume: "10", plates: "6" });
  assert.ok(result.ok);
  assert.match(result.sections[0].notes.join(" "), /25 µl/);
  const fine = runTool("webbed-plate", { titer: "1e8", pfu: "1e6", volume: "10", plates: "6" });
  assert.ok(fine.ok);
  assert.equal(fine.sections[0].result, "10 µl of undiluted lysate per plate");
  assert.equal(fine.sections[0].notes.length, 0);
});

test("flooding: the notebooks' yields fall inside 5 to 7 ml per plate", () => {
  // FAQ: 4 plates gave about 27 ml, 7 plates 40 ml, 8 plates over 50 ml.
  for (const [plates, ml] of [[4, 27], [7, 40], [8, 51]]) {
    const { lowMl, highMl } = floodYield({ plates });
    assert.ok(lowMl <= ml && ml <= highMl, `${plates} plates: ${ml} ml outside ${lowMl} to ${highMl}`);
  }
  assert.deepEqual(floodYield({ plates: 6 }), { lowMl: 30, highMl: 42 });
});

test("flooding: 20 ml at 5 ml per plate is 4 plates, as the FAQ works it", () => {
  assert.deepEqual(platesForLysate({ mlWanted: 20 }), { fewest: 3, most: 4 });
  assert.deepEqual(platesForLysate({ mlWanted: 35 }), { fewest: 5, most: 7 });
});

/* ------------------------------------------------------------ MOI, by hand */

/** Equal to a relative 1e-9: floating point, not rounding, is all this allows. */
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * 1e-9, `${actual} is not ${expected}`);
}

test("MOI: the page's worked example, 10 µl of 1 x 10^9 on 250 µl of 1 x 10^8 cells/ml", () => {
  // pfu: 1 x 10^9 pfu/ml x 10 µl / 1,000 µl/ml = 1 x 10^7 pfu.
  // cells: 1 x 10^8 cells/ml x 250 µl / 1,000 µl/ml = 2.5 x 10^7 cells.
  // MOI: 1 x 10^7 / 2.5 x 10^7 = 0.4.
  // infected: 1 - exp(-0.4) = 1 - 0.67032 = 0.32968, about 33%.
  const result = moi({ titerPfuPerMl: 1e9, phageUl: 10, cellsPerMl: 1e8, hostUl: 250 });
  close(result.pfu, 1e7);
  close(result.cells, 2.5e7);
  close(result.moi, 0.4);
  assert.equal(result.infected.toFixed(4), "0.3297");
  const run = runTool("moi", { titer: "1e9", phage: "10", cells: "1e8", host: "250" });
  assert.ok(run.ok);
  assert.equal(run.sections[0].result, "0.4 pfu per cell");
});

test("MOI: an MOI of 1 infects about 63% of cells, and of 10 nearly all", () => {
  // 1 - exp(-1) = 1 - 0.36788 = 0.63212. 1 - exp(-10) = 1 - 0.0000454 = 0.99995.
  // 1 x 10^9 x 25 µl / 1,000 = 2.5 x 10^7 pfu on 2.5 x 10^7 cells is MOI 1.
  const one = moi({ titerPfuPerMl: 1e9, phageUl: 25, cellsPerMl: 1e8, hostUl: 250 });
  close(one.moi, 1);
  assert.equal(one.infected.toFixed(4), "0.6321");
  // 1 x 10^10 x 25 µl / 1,000 = 2.5 x 10^8 pfu on 2.5 x 10^7 cells is MOI 10.
  const ten = moi({ titerPfuPerMl: 1e10, phageUl: 25, cellsPerMl: 1e8, hostUl: 250 });
  close(ten.moi, 10);
  assert.equal(ten.infected.toFixed(5), "0.99995");
});

test("MOI: volumes are µl and titers per ml, however the number is written", () => {
  // 1,000 µl is 1 ml: 1 x 10^9 pfu/ml x 1,000 µl / 1,000 = 1 x 10^9 pfu; 1 x 10^9 cells/ml x 1,000 µl = 1 x 10^9 cells.
  close(moi({ titerPfuPerMl: 1e9, phageUl: 1000, cellsPerMl: 1e9, hostUl: 1000 }).moi, 1);
  const written = [
    { titer: "1 x 10^9", phage: "10", cells: "1×10^8", host: "250" },
    { titer: "1,000,000,000", phage: "10", cells: "100,000,000", host: "250" },
  ];
  for (const values of written) assert.deepEqual(runTool("moi", values), runTool("moi", toolValues("moi")));
});

test("MOI: refuses zero, empty and non-numeric inputs, naming the field", () => {
  const good = { titer: "1e9", phage: "10", cells: "1e8", host: "250" };
  const cases = [
    [{ ...good, titer: "0" }, /titer/],
    [{ ...good, titer: "" }, /titer/],
    [{ ...good, phage: "0" }, /phage added/],
    [{ ...good, cells: "" }, /cells per ml/],
    [{ ...good, cells: "OD 0.5" }, /cells per ml/],
    [{ ...good, host: "-250" }, /host culture/],
  ];
  for (const [values, message] of cases) {
    const result = runTool("moi", values);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, message);
  }
});

/* ------------------------------------------------------------ EOP, by hand */

test("EOP: the page's worked example, 2 x 10^8 over 1 x 10^10 is 0.02", () => {
  // 2 x 10^8 / 1 x 10^10 = 2 x 10^-2 = 0.02, which is 2% of the reference titer.
  close(eop({ testPfuPerMl: 2e8, referencePfuPerMl: 1e10 }), 0.02);
  const result = runTool("eop", { test: "2e8", reference: "1e10" });
  assert.ok(result.ok);
  assert.equal(result.sections[0].result, "0.02 (2% of the reference titer)");
  // Better on the test host than the reference: 3 x 10^10 / 1 x 10^10 = 3.
  close(eop({ testPfuPerMl: 3e10, referencePfuPerMl: 1e10 }), 3);
});

test("EOP from counts: the titer calculator's arithmetic on each host, then the ratio", () => {
  // Test host: 20 / 10 µl x 1,000 x 10^5 = 2 x 10^8 pfu/ml.
  // Reference host: 100 / 10 µl x 1,000 x 10^6 = 1 x 10^10 pfu/ml.
  // EOP: 2 x 10^8 / 1 x 10^10 = 0.02, the same as the worked example from titers.
  close(titer({ plaques: 20, volumeUl: 10, dilutionExponent: 5 }).pfuPerMl, 2e8);
  close(titer({ plaques: 100, volumeUl: 10, dilutionExponent: 6 }).pfuPerMl, 1e10);
  const counts = runTool("eop-counts", toolValues("eop-counts"));
  assert.ok(counts.ok);
  assert.equal(counts.sections[0].result, "0.02 (2% of the reference titer)");
  assert.equal(counts.sections[0].steps[0], "Titer on the test host: 20 / 10 µl x 1,000 x 10^5 = 2 x 10^8 pfu/ml.");
  // A 3 µl spot, undiluted, on the test host: 6 / 3 x 1,000 = 2,000 pfu/ml; over 1 x 10^10 = 2 x 10^-7.
  const spot = runTool("eop-counts", { testPlaques: "6", testVolume: "3", testDilution: "0", refPlaques: "100", refVolume: "10", refDilution: "6" });
  assert.ok(spot.ok);
  assert.equal(spot.sections[0].result, "2 x 10^-7 (2 x 10^-5% of the reference titer)");
});

test("EOP: no plaques on the test host is a limit, not an EOP of 0", () => {
  // 0 plaques in 10 µl of 10^-1: one plaque would have been 1 / 10 x 1,000 x 10 = 1,000 pfu/ml,
  // and 1,000 / 1 x 10^10 = 1 x 10^-7, so the EOP is below 1 x 10^-7.
  const result = runTool("eop-counts", { testPlaques: "0", testVolume: "10", testDilution: "1", refPlaques: "100", refVolume: "10", refDilution: "6" });
  assert.ok(result.ok);
  assert.match(result.sections[0].notes.join(" "), /below 1 x 10\^-7/);
  const fromTiters = runTool("eop", { test: "0", reference: "1e10" });
  assert.ok(fromTiters.ok);
  assert.match(fromTiters.sections[0].notes.join(" "), /not the same as an EOP of exactly 0/);
});

test("EOP: refuses a reference with nothing to divide by, and bad counts, naming the host", () => {
  const counts = { testPlaques: "20", testVolume: "10", testDilution: "5", refPlaques: "100", refVolume: "10", refDilution: "6" };
  const cases = [
    ["eop", { test: "2e8", reference: "0" }, /reference host/],
    ["eop", { test: "", reference: "1e10" }, /test host/],
    ["eop", { test: "2e8", reference: "abc" }, /reference host/],
    ["eop", { test: "-1", reference: "1e10" }, /test host/],
    ["eop-counts", { ...counts, refPlaques: "0" }, /no titer to divide by/],
    ["eop-counts", { ...counts, testPlaques: "2.5" }, /on the test host as a whole number/],
    ["eop-counts", { ...counts, refVolume: "0" }, /volume plated or spotted on the reference host/],
    ["eop-counts", { ...counts, testDilution: "x" }, /exponent on the test host/],
  ];
  for (const [id, values, message] of cases) {
    const result = runTool(id, values);
    assert.equal(result.ok, false, `${id} ${JSON.stringify(values)}`);
    assert.match(result.ok ? "" : result.error, message);
  }
});

/* ------------------------------------------------------------ lysate volume, by hand */

test("lysate volume: the page's worked example, 10,000 pfu on 6 plates from 1 x 10^7", () => {
  // pfu: 10,000 x 6 = 60,000. Lysate: 60,000 / 1 x 10^7 x 1,000 = 6 µl. Per plate: 6 / 6 = 1 µl.
  // 6 plates x 10 µl = 60 µl to plate, so 6 µl lysate + 54 µl buffer.
  const plan = lysateForPlates({ titerPfuPerMl: 1e7, pfuPerPlate: 10000, plates: 6 });
  assert.equal(plan.totalPfu, 60000);
  close(plan.totalUl, 6);
  close(plan.perPlateUl, 1);
  const result = runTool("lysate-volume", toolValues("lysate-volume"));
  assert.ok(result.ok);
  assert.equal(result.sections[0].result, "6 µl of lysate in 60 µl, 10 µl on each of 6 plates");
  assert.match(result.sections[0].steps[3], /6 µl lysate \+ 54 µl phage buffer/);
  // The webbed plate calculator's single plate is the same formula: 11,100 / 1.11 x 10^10 x 1,000 = 1 x 10^-3 µl.
  close(lysateForPlates({ titerPfuPerMl: 1.11e10, pfuPerPlate: 11100, plates: 1 }).totalUl, 1e-3);
});

test("lysate volume: under 1 µl in all means dilute first; at or above the plated volume means undiluted", () => {
  // 60,000 / 1 x 10^9 x 1,000 = 0.06 µl: too little to pipette.
  const tiny = runTool("lysate-volume", { titer: "1e9", pfu: "10000", plates: "6", volume: "10" });
  assert.ok(tiny.ok);
  assert.equal(tiny.sections[0].result, "0.06 µl of lysate for 6 plates, made by dilution");
  // 60,000 / 1 x 10^6 x 1,000 = 60 µl, 10 µl per plate: exactly the plated volume, so undiluted.
  const even = runTool("lysate-volume", { titer: "1e6", pfu: "10000", plates: "6", volume: "10" });
  assert.ok(even.ok);
  assert.equal(even.sections[0].result, "60 µl of undiluted lysate, 10 µl on each of 6 plates");
  assert.equal(even.sections[0].notes.length, 0);
});

test("lysate volume: warns above the lab's 25 µl on 250 µl of host", () => {
  // 10,000 x 2 = 20,000 pfu; 20,000 / 1 x 10^5 x 1,000 = 200 µl, 100 µl per plate, over 25 µl.
  const result = runTool("lysate-volume", { titer: "1e5", pfu: "10000", plates: "2", volume: "10" });
  assert.ok(result.ok);
  assert.match(result.sections[0].notes.join(" "), /over the lab's limit of 25 µl/);
});

test("lysate volume: refuses zero, empty, fractional and non-numeric inputs", () => {
  const good = { titer: "1e7", pfu: "10000", plates: "6", volume: "10" };
  const cases = [
    [{ ...good, titer: "0" }, /titer/],
    [{ ...good, titer: "" }, /titer/],
    [{ ...good, pfu: "ten thousand" }, /pfu wanted/],
    [{ ...good, plates: "0" }, /whole number/],
    [{ ...good, plates: "2.5" }, /whole number/],
    [{ ...good, volume: "" }, /volume plated/],
  ];
  for (const [values, message] of cases) {
    const result = runTool("lysate-volume", values);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, message);
  }
});

/* ------------------------------------------------------------ the pages say what the module says */

// What each calculator page must state (its worked example, the links to every calculator, the lysate sum)
// is checked on the page itself by app/lib/pages/invariants.mjs, which build:content and the page save both
// run; test/pages.test.mjs shows each rule firing. llms.txt is not a page, so its links are checked here.
test("llms.txt links every calculator page", () => {
  const llms = readFileSync(new URL("../content/llms.txt", import.meta.url), "utf8");
  for (const path of new Set(Object.values(TOOLS).map((tool) => tool.path))) {
    assert.ok(llms.includes(`  ${path}
`), `llms.txt lacks ${path}`);
  }
});

test("every calculator opens on its page's worked example, and computes", () => {
  assert.deepEqual(toolValues("titer"), { plaques: "111", volume: "10", dilution: "6" });
  assert.deepEqual(toolValues("dilution"), { start: "1.11e10", target: "1.11e6", transfer: "10", needed: "" });
  for (const id of Object.keys(TOOLS)) assert.equal(runTool(id, toolValues(id)).ok, true, id);
});

test("every lab default names a source page, and the value matches the lab's number", () => {
  const withSource = Object.values(TOOLS).flatMap((tool) => tool.fields.filter((field) => field.source));
  assert.ok(withSource.length >= 4);
  for (const field of withSource) assert.match(field.source.href, /^\/(research|teaching)\//);
  assert.equal(LAB.ulSpot, 3);
  assert.equal(LAB.ulPlated, 10);
  assert.equal(LAB.floodMl, 8);
  assert.deepEqual([LAB.yieldLowMl, LAB.yieldHighMl], [5, 7]);
  // The numbers are the protocol's own words, so a change there has to be made here too.
  const protocol = procedure("phage-isolation");
  assert.ok(protocol.includes("(Protocol 6.4, 3 µl spots)"));
  assert.ok(protocol.includes("plating 10 µl of each dilution with 250 µl host"));
  assert.ok(protocol.includes("typically 5 to 7 ml per plate"));
  assert.ok(protocol.includes("no more than 25 µl onto 250 µl host"));
  assert.ok(protocol.includes("Plan about 6 webbed plates"));
});

test("the query string sets a calculator's values, and nothing else does", () => {
  const params = new URLSearchParams("plaques=42&volume=10&dilution=6&other=1");
  assert.deepEqual(toolValues("titer", params), { plaques: "42", volume: "10", dilution: "6" });
  assert.equal(runTool("titer", toolValues("titer", params)).sections[0].result, "4.2 x 10^9 pfu/ml");
  assert.deepEqual(toolsOnPage("/research/tools/webbed-plate"), ["webbed-plate", "flood"]);
  assert.deepEqual(toolsOnPage("/research/tools/eop"), ["eop", "eop-counts"]);
  assert.deepEqual(toolsOnPage("/research/tools"), []);
});

/* ------------------------------------------------------------ numbers in and out */

test("parseNumber reads the ways the bench writes a number", () => {
  assert.equal(parseNumber("1.1e10"), 1.1e10);
  assert.equal(parseNumber("1.1 x 10^10"), 1.1e10);
  assert.equal(parseNumber("1.1×10^10"), 1.1e10);
  assert.equal(parseNumber("1.1 X 10^-3"), 1.1e-3);
  assert.equal(parseNumber("11,100"), 11100);
  assert.equal(parseNumber("10^-3"), 1e-3);
  assert.equal(parseNumber(" 7 "), 7);
  assert.ok(Number.isNaN(parseNumber("")));
  assert.ok(Number.isNaN(parseNumber("ten")));
  assert.ok(Number.isNaN(parseNumber("1e")));
});

test("formatNumber and formatScientific write numbers the way the FAQ does", () => {
  assert.equal(formatNumber(11.1), "11.1");
  assert.equal(formatNumber(11100.000000000002), "11,100");
  assert.equal(formatNumber(1.11e10), "1.11 x 10^10");
  assert.equal(formatNumber(0.001), "1 x 10^-3");
  assert.equal(formatNumber(2.857142), "2.86");
  assert.equal(formatScientific(4e7), "4 x 10^7");
  assert.equal(formatScientific(2.04e10), "2.04 x 10^10");
});

test("textParts raises exponents, and resultView builds both summary and steps", () => {
  assert.deepEqual(textParts("1.11 x 10^10 pfu/ml"), [
    { text: "1.11 x 10" },
    { text: "10", sup: true },
    { text: " pfu/ml" },
  ]);
  assert.deepEqual(textParts("10^-3"), [{ text: "10" }, { text: "−3", sup: true }]);
  const view = resultView(runTool("titer", toolValues("titer")));
  assert.equal(view.summary.length, 1);
  assert.equal(view.detail.length, 1);
  const failed = resultView({ ok: false, error: "Enter the plaques." });
  assert.deepEqual(failed.detail, []);
  assert.equal(failed.summary[0].className, "phage-tool-error");
});
