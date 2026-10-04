/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, ok, pollUntil, skip } from "../harness.mjs";

/**
 * The calculators folded under a protocol's steps (docs/PROCEDURES.md, "Calculators in steps"), at a phone's width: each
 * is already answered in the server HTML, opens to a form that fits the screen, recomputes as a number is typed without
 * touching the address bar, and keeps working once run mode (app/enhance/run.ts) has been started.
 *
 * @param {import("../harness.mjs").CaseContext} ctx
 */
export async function run({ page }) {
  await page.setViewport({ width: 390, height: 844 });
  const path = "/research/protocols/phage-isolation";
  const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  if (!response || response.status() !== 200) {
    skip("step calculators", `${path} answered ${response?.status() ?? "nothing"} on this origin`);
    return;
  }
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("dustinedwards.run:")) localStorage.removeItem(key);
  });
  await page.reload({ waitUntil: "networkidle0" });

  const shape = await page.evaluate(() => ({
    folded: [...document.querySelectorAll("li.procedure-step details.phage-tool-step")].map((d) => ({
      tool: d.querySelector("form[data-tool]")?.getAttribute("data-tool") ?? "",
      answered: (d.querySelector(".phage-tool-answer")?.textContent ?? "").trim().length > 0,
      open: d.hasAttribute("open"),
    })),
  }));
  if (shape.folded.length === 0) {
    skip("step calculators", `${path} has no calculator under a step on this origin`);
    return;
  }
  ok(
    "each calculator a step names is folded under that step, closed, and already carries its answer",
    shape.folded.every((f) => f.answered && !f.open) && shape.folded.some((f) => f.tool === "webbed-plate"),
    JSON.stringify(shape.folded),
  );

  /** One check on opening the webbed plate calculator, typing in it, and the page it leaves behind. */
  async function exercise(/** @type {string} */ when) {
    const selector = 'details.phage-tool-step:has(form[data-tool="webbed-plate"])';
    await page.evaluate((sel) => document.querySelector(sel)?.setAttribute("open", ""), selector);
    const before = await page.$eval(`${selector} .phage-tool-answer`, (n) => n.textContent ?? "");
    const search = await page.evaluate(() => location.search);
    await page.$eval(`${selector} input[name="pfu"]`, (n) => {
      n.focus();
      /** @type {HTMLInputElement} */ (n).select();
    });
    await page.type(`${selector} input[name="pfu"]`, "22200");
    /** @type {string} */
    const after = await pollUntil(
      () => page.$eval(`${selector} .phage-tool-answer`, (n) => n.textContent ?? ""),
      (now) => now !== before,
      { tries: 20, everyMs: 150 },
    );
    const state = await page.evaluate(() => ({
      search: location.search,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    ok(
      `the webbed plate calculator under its step recomputes as a number is typed ${when}, and leaves the address bar alone`,
      after !== before && state.search === search,
      `the answer was "${before}" and became "${after}"; the address went from "${search}" to "${state.search}".`,
    );
    ok(
      `the open calculator fits a 390px screen ${when}`,
      state.overflow <= 0,
      `the page is ${state.overflow}px wider than the screen.`,
    );
  }

  await exercise("before a run is started");

  await page.click(".run-start");
  const started = await page.evaluate(() => ({
    mode: document.querySelector(".procedure")?.getAttribute("data-run") ?? "",
    folded: document.querySelectorAll("li.procedure-step details.phage-tool-step").length,
  }));
  ok(
    "starting a run leaves every calculator in its step",
    started.mode === "on" && started.folded === shape.folded.length,
    `mode "${started.mode}", ${started.folded} of ${shape.folded.length} calculators still under their steps.`,
  );
  await exercise("in run mode");

  // Leave no run behind for the cases after this one.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("dustinedwards.run:")) localStorage.removeItem(key);
  });
}
