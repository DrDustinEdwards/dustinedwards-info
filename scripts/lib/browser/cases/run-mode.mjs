/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, ok, pollUntil, skip } from "../harness.mjs";

/**
 * Run mode on a protocol page (app/enhance/run.ts): the checklist a person works a procedure by. Drives a real
 * protocol at a phone's width: start, check a step, run and pause a timer, change the scale in place (the page does
 * not navigate), keep the run across a reload, and finish to a record that downloads and prints. Every number the
 * page shows at a new scale is the server's, so this also shows the swap read them.
 *
 * @param {import("../harness.mjs").CaseContext} ctx
 */
export async function run({ page }) {
  await page.setViewport({ width: 390, height: 844 });
  const path = "/research/protocols/phage-dna-extraction";
  /** @type {string[]} */
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

  const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  if (!response || response.status() !== 200) {
    skip("run mode on a protocol page", `${path} answered ${response?.status() ?? "nothing"} on this origin, so there is no protocol to run`);
    return;
  }
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("dustinedwards.run:")) localStorage.removeItem(key);
  });
  await page.reload({ waitUntil: "networkidle0" });

  const shape = await page.evaluate(() => ({
    start: document.querySelector(".run-start")?.textContent ?? null,
    steps: document.querySelectorAll("li.procedure-step[data-step]").length,
    stepsWithTimers: document.querySelectorAll("li.procedure-step[data-timers]").length,
    toolsBefore: document.querySelectorAll(".run-tools").length,
    barHidden: document.querySelector(".run-bar")?.hasAttribute("hidden") ?? null,
  }));
  ok(
    "a protocol page offers to run it, and shows nothing of run mode until it is started",
    shape.start === "Run this procedure" && shape.steps > 0 && shape.toolsBefore === 0 && shape.barHidden === true,
    `start button "${shape.start}", ${shape.steps} step(s), ${shape.toolsBefore} tool(s) before starting, bar hidden ${shape.barHidden}. ` +
      `The page must read as it always did until a person starts a run.`,
  );
  if (shape.steps === 0) return;

  await page.click(".run-start");
  const started = await page.evaluate(() => ({
    tools: document.querySelectorAll(".run-tools").length,
    steps: document.querySelectorAll("li.procedure-step[data-step]").length,
    progress: document.querySelector(".run-progress")?.textContent ?? "",
    current: document.querySelectorAll('li.procedure-step[aria-current="step"]').length,
    mode: document.querySelector(".procedure")?.getAttribute("data-run") ?? "",
  }));
  ok(
    "starting a run puts a Done check, a note and the stored timers on every step, and marks the current step",
    started.tools === started.steps && started.mode === "on" && started.current === 1 && /^0 of \d+ steps done$/.test(started.progress),
    `${started.tools} tool block(s) for ${started.steps} step(s), mode "${started.mode}", ${started.current} current step(s), progress "${started.progress}".`,
  );

  // The 44px tap target a phone needs, on the controls a gloved hand uses.
  const targets = await page.evaluate(() =>
    [".run-done", ".run-bar button", ".run-timer-act", ".run-note > summary"].map((sel) => {
      const node = document.querySelector(sel);
      const box = node?.getBoundingClientRect();
      return { sel, height: box ? Math.round(box.height) : null };
    }),
  );
  ok(
    "the run controls are at least 44px tall, so they work with a thumb at the bench",
    targets.filter((t) => t.height !== null).every((t) => (t.height ?? 0) >= 43),
    targets.map((t) => `${t.sel} ${t.height}`).join(", "),
  );

  // Check the first step.
  await page.click("li.procedure-step[data-step] .run-done-check");
  const afterCheck = await page.evaluate(() => ({
    progress: document.querySelector(".run-progress")?.textContent ?? "",
    done: document.querySelectorAll("li.procedure-step.run-done").length,
  }));
  ok(
    "checking a step updates the progress and marks the step done",
    /^1 of \d+ steps done$/.test(afterCheck.progress) && afterCheck.done === 1,
    `progress "${afterCheck.progress}", ${afterCheck.done} step(s) marked done.`,
  );

  // A timer counts, pauses, and is stored as an end time.
  if (shape.stepsWithTimers > 0) {
    const before = await page.$eval(".run-timer .run-clock", (n) => n.textContent ?? "");
    await page.click(".run-timer-act");
    /** @type {string} */
    const counting = await pollUntil(
      () => page.$eval(".run-timer .run-clock", (n) => n.textContent ?? ""),
      (now) => now !== before,
      { tries: 12, everyMs: 300 },
    );
    ok("a started timer counts down", counting !== before, `the clock read ${before} and stayed there.`);
    await page.click(".run-timer-act");
    const paused = await page.$eval(".run-timer", (n) => n.getAttribute("data-state"));
    const frozen = await page.$eval(".run-timer .run-clock", (n) => n.textContent ?? "");
    await new Promise((r) => setTimeout(r, 1300));
    const later = await page.$eval(".run-timer .run-clock", (n) => n.textContent ?? "");
    ok("a paused timer holds its time", paused === "paused" && later === frozen, `state ${paused}, clock ${frozen} then ${later}.`);
  } else {
    skip("run mode timers", `${path} has no step with a timer, so the timer cases would assert nothing`);
  }

  // A note is kept.
  await page.evaluate(() => document.querySelector(".run-note")?.setAttribute("open", ""));
  await page.type(".run-note-text", "tube 3 cloudy");
  await page.evaluate(() => /** @type {HTMLElement | null} */ (document.querySelector(".run-note-text"))?.blur());

  // The scale changes in place: no navigation, the address follows, the materials are the server's numbers.
  const hasScale = await page.$("form.procedure-scale input[name]");
  if (hasScale) {
    await page.evaluate(() => {
      /** @type {any} */ (window).__runMarker = 1;
    });
    const beforeScale = await page.$eval('[data-run-swap="materials"]', (n) => n.textContent ?? "");
    await page.$eval("form.procedure-scale input[name]", (n) => {
      /** @type {HTMLInputElement} */ (n).value = "9";
    });
    await page.click("form.procedure-scale button[type=submit]");
    /** @type {string} */
    const swapped = await pollUntil(
      () => page.$eval('[data-run-swap="materials"]', (n) => n.textContent ?? ""),
      (now) => now !== beforeScale,
      { tries: 25, everyMs: 200 },
    );
    const state = await page.evaluate(() => ({ marker: /** @type {any} */ (window).__runMarker, search: location.search }));
    ok(
      "changing the scale updates the amounts in place: the page does not reload and the address follows",
      swapped !== beforeScale && state.marker === 1 && /[?&]n=9\b/.test(state.search),
      `materials changed ${swapped !== beforeScale}, the page marker ${state.marker === 1 ? "survived" : "was lost (the page reloaded)"}, search "${state.search}".`,
    );
    const stillChecked = await page.evaluate(() => document.querySelectorAll("li.procedure-step.run-done").length);
    ok("a scale change keeps the steps already checked", stillChecked === 1, `${stillChecked} step(s) still marked done.`);
  } else {
    skip("run mode scale", `${path} has no scale form`);
  }

  // Reload: the run is kept on this device, and offered.
  await new Promise((r) => setTimeout(r, 500));
  await page.reload({ waitUntil: "networkidle0" });
  const resume = await page.$eval(".run-start", (n) => n.textContent ?? "");
  ok("a run survives a reload and is offered as Resume, with its progress", /^Resume your run \(1 of \d+ done\)$/.test(resume), `the start button read "${resume}".`);
  await page.click(".run-start");
  const restored = await page.evaluate(() => ({
    checked: document.querySelectorAll("li.procedure-step.run-done").length,
    note: /** @type {HTMLTextAreaElement | null} */ (document.querySelector(".run-note-text"))?.value ?? "",
  }));
  ok("a resumed run keeps its checked steps and its notes", restored.checked === 1 && restored.note === "tube 3 cloudy", `${restored.checked} step(s) done, first note "${restored.note}".`);

  // Finish: the record.
  await page.click(".run-finish");
  const record = await page.evaluate(() => ({
    visible: !document.querySelector(".run-summary")?.hasAttribute("hidden"),
    buttons: [...document.querySelectorAll(".run-summary button")].map((b) => b.textContent ?? ""),
    saidSaved: /nothing was sent anywhere/i.test(document.querySelector(".run-summary")?.textContent ?? ""),
  }));
  ok(
    "finishing a run shows its record, which downloads as text and JSON, prints, and says nothing was sent anywhere",
    record.visible && ["Download as text", "Download as JSON", "Print", "Start over"].every((b) => record.buttons.includes(b)) && record.saidSaved,
    `summary visible ${record.visible}, buttons [${record.buttons.join(", ")}], says saved on this device ${record.saidSaved}.`,
  );

  // Start over clears it.
  const startOver = await page.evaluateHandle(() => [...document.querySelectorAll(".run-summary button")].find((b) => b.textContent === "Start over"));
  await /** @type {import("puppeteer").ElementHandle<HTMLElement>} */ (startOver).click();
  const cleared = await page.evaluate(() => ({
    stored: Object.keys(localStorage).filter((k) => k.startsWith("dustinedwards.run:")).length,
    start: document.querySelector(".run-start")?.textContent ?? "",
    tools: document.querySelectorAll(".run-tools").length,
  }));
  ok("Start over discards the run and returns the page to how it was served", cleared.stored === 0 && cleared.start === "Run this procedure" && cleared.tools === 0, `${cleared.stored} stored run(s), start button "${cleared.start}", ${cleared.tools} tool block(s).`);

  ok("run mode raised no page error", errors.length === 0, errors.join(" | "));
}
