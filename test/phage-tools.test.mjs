import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  LAB,
  TOOLS,
  floodYield,
  formatNumber,
  formatScientific,
  lysatePerPlate,
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

const page = (name) => readFileSync(new URL(`../content/pages/${name}.md`, import.meta.url), "utf8");

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
  const md = page("research-protocols-phage-isolation");
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
  // 11,100 / 1.1 x 10^10 x 1,000 = 1.009 x 10^-3 µl. The FAQ and protocol print 1.1 x 10^-3, which
  // is 11,100 / 1.0 x 10^10 x 1,000; the notebook's dilution (1/10^4, 10 µl per plate) delivered
  // 10 x 10^-4 = 1 x 10^-3 µl of lysate per plate, which is the value this arithmetic gives.
  sameAsStated(lysatePerPlate({ titerPfuPerMl: 1.1e10, pfuPerPlate: 11100 }), "1.01", -3);
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

/* ------------------------------------------------------------ the pages say what the module says */

/** Every step of a result, numbered as the page numbers it, must appear in the page's markdown. */
function assertWorkedOnPage(md, sections) {
  for (const section of sections) {
    section.steps.forEach((step, i) => {
      assert.ok(md.includes(`${i + 1}. ${step}\n`), `the page lacks step ${i + 1}: ${step}`);
    });
  }
}

test("the titer page's worked examples are what the calculator prints", () => {
  const md = page("research-tools-titer");
  for (const values of [
    { plaques: "111", volume: "10", dilution: "6" },
    { plaques: "6", volume: "3", dilution: "3" },
  ]) {
    const result = runTool("titer", values);
    assert.ok(result.ok);
    assertWorkedOnPage(md, result.sections);
    assert.ok(md.includes(`The titer is ${result.sections[0].result}.`));
  }
});

test("the dilution page's worked examples are what the calculator prints", () => {
  const md = page("research-tools-dilution");
  for (const values of [
    { start: "1.11e10", target: "1.11e6", transfer: "10", needed: "" },
    { start: "3.0e9", target: "6e5", transfer: "10", needed: "" },
  ]) {
    const result = runTool("dilution", values);
    assert.ok(result.ok);
    assertWorkedOnPage(md, result.sections);
  }
});

test("the webbed plate page's worked examples are what the calculator prints", () => {
  const md = page("research-tools-webbed-plate");
  const web = runTool("webbed-plate", toolValues("webbed-plate"));
  assert.ok(web.ok);
  assertWorkedOnPage(md, web.sections);
  const flood = runTool("flood", toolValues("flood"));
  assert.ok(flood.ok);
  assertWorkedOnPage(md, flood.sections);
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
  const protocol = page("research-protocols-phage-isolation");
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
