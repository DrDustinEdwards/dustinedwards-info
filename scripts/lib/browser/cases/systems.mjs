/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// /systems, the family of systems (app/routes/systems.tsx): the award checklist of
// capsid/research/design-system-explorer.md, section 6, measured in a real Chromium over the
// committed model. Each check names its number, and each was seen red once before it was trusted.
//
// What a browser cannot prove is said where it is skipped: a real phone's frame rate (the release
// PR's remote DevTools run) and a screen reader (VoiceOver and NVDA by hand).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { EXPLORER_ORIGIN, explorerUrl, loadSystemModel } from "../../../../app/lib/systems.mjs";
import { BASE, FETCH_TIMEOUT_MS, ok, report, root } from "../harness.mjs";

const require = createRequire(import.meta.url);
const MODEL = loadSystemModel(JSON.parse(readFileSync(join(root, "data", "system-model.json"), "utf8")));
const IDS = MODEL.systems.map((s) => s.id).sort();
const CORE = MODEL.systems.find((s) => s.ring === "core")?.id ?? "";

/** The map's own script, gzipped, under the design's budget. */
const SCRIPT_BUDGET_GZIP = 25 * 1024;
/** Section 6: CLS under 0.05 while choosing, going inside and stepping out. */
const CLS_BUDGET = 0.05;
/**
 * Section 6: the INP proxy under 4x CPU throttling, over interactions only (entries with an
 * interactionId, as INP counts them; a hover is not one). The page's own share, the input delay
 * and the handlers, must be under the budget. The whole duration adds the next paint, which in a
 * headless runner with no GPU is software rendering: measured 2026-10-11 it swung from 96 to 360ms
 * between runs of the same build, so it is reported against the budget, warn only.
 */
const INPUT_BUDGET_MS = 100;
/** Section 6: frame gaps while going inside, under 4x throttling; warn only, runners vary. */
const FRAME_P95_MS = 20;

const tileSelector = (/** @type {string} */ id) => `#family .cap-system-map-tile[data-id="${id}"]`;
/** page.focus refuses an SVG element, and each capsomer is one, so the page focuses it itself. */
const focusTile = (/** @type {import("puppeteer").Page} */ page, /** @type {string} */ id) =>
  page.$eval(tileSelector(id), (el) => /** @type {SVGElement} */ (el).focus());
const focusedId = () => /** @type {HTMLElement | null} */ (document.activeElement)?.dataset?.id ?? null;

/**
 * @param {import("puppeteer").Page} page
 * @param {"light" | "dark"} theme
 * @param {string} path
 */
async function open(page, theme, path = "/systems") {
  await page.setCookie({ name: "theme", value: theme, url: BASE });
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#family[data-cap-ready]", { timeout: 10_000 });
}

/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ browser }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  // axe is injected as a script, which the site's policy rightly refuses; the policy itself is
  // check:headers' and the script-set case's to judge.
  await page.setBypassCSP(true);
  try {
    // Each part on its own: one that throws is a failed check, and the parts after it still run.
    for (const part of [everyNodeByKeyboard, listMatchesModel, reducedMotion, noLayoutShift, inputResponse, framesWhileEntering, axeBothThemes, scriptBudget, explorerLinks]) {
      try {
        await part(page);
      } catch (error) {
        ok(`/systems: ${part.name} ran`, false, error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    // The theme cookie lives in the browser's default context, which the cases after this one share.
    await page.deleteCookie({ name: "theme", url: BASE });
    await page.close();
  }
}

/** Section 6, keyboard: one tab stop into the map, and the arrows reach every system from the core. */
async function everyNodeByKeyboard(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  const stops = await page.$$eval("#family .cap-system-map-tile[tabindex='0']", (els) => els.map((e) => /** @type {HTMLElement} */ (e).dataset.id));
  ok("/systems: the map is one tab stop, on the core", stops.length === 1 && stops[0] === CORE, `tab stops: ${stops.join(", ") || "none"}`);

  /** @type {Set<string>} */
  const seen = new Set([CORE]);
  const queue = [CORE];
  while (queue.length) {
    const id = /** @type {string} */ (queue.shift());
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      await focusTile(page, id);
      await page.keyboard.press(/** @type {import("puppeteer").KeyInput} */ (key));
      const next = await page.evaluate(focusedId);
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  const reached = [...seen].sort();
  ok(
    "/systems: the arrow keys reach every system in the model, and nothing else",
    JSON.stringify(reached) === JSON.stringify(IDS),
    `reached ${reached.length} of ${IDS.length}; missing ${IDS.filter((id) => !seen.has(id)).join(", ") || "none"}; extra ${reached.filter((id) => !IDS.includes(id)).join(", ") || "none"}`,
  );

  await focusTile(page, CORE);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  const entered = await page.$eval("#family", (el) => el.hasAttribute("data-entered"));
  await page.keyboard.press("Escape");
  const left = await page.$eval("#family", (el) => !el.hasAttribute("data-entered"));
  ok("/systems: Enter twice on the core goes inside, Escape steps out to it", entered && left && (await page.evaluate(focusedId)) === CORE, `entered ${entered}, left ${left}`);
}

/** Section 6, screen-reader list: the list of the same data holds the model's systems, both ways, with script and without. */
async function listMatchesModel(/** @type {import("puppeteer").Page} */ page) {
  const listed = async () => (await page.$$eval("#family .cap-system-map-list li[data-id]", (els) => els.map((e) => /** @type {HTMLElement} */ (e).dataset.id ?? ""))).sort();
  await open(page, "light");
  const withScript = await listed();
  ok("/systems: the list holds every system in the model and no other", JSON.stringify(withScript) === JSON.stringify(IDS), `listed ${withScript.length}, model ${IDS.length}`);

  await page.setJavaScriptEnabled(false);
  try {
    await page.goto(`${BASE}/systems`, { waitUntil: "networkidle0" });
    const without = await listed();
    const open = await page.$eval("#family .cap-system-map-list", (el) => /** @type {HTMLDetailsElement} */ (el).open);
    ok("/systems with no script: the list is open and holds every system", open && JSON.stringify(without) === JSON.stringify(IDS), `open ${open}, listed ${without.length}`);
  } finally {
    await page.setJavaScriptEnabled(true);
  }
}

/** Section 6, reduced motion: going inside runs no animation and ends inside. The control first proves the read can see one. */
async function reducedMotion(/** @type {import("puppeteer").Page} */ page) {
  const enterAndCount = async () => {
    await page.click(tileSelector(CORE));
    await page.click(tileSelector(CORE));
    const animations = await page.evaluate(() => document.getAnimations().length);
    const entered = await page.$eval("#family", (el) => el.hasAttribute("data-entered"));
    return { animations, entered };
  };
  await open(page, "light");
  const control = await enterAndCount();
  ok("/systems: going inside animates (the control for the reduced-motion read)", control.animations > 0 && control.entered, `${control.animations} animations`);

  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  try {
    await open(page, "light");
    const reduced = await enterAndCount();
    ok("/systems under reduced motion: going inside runs no animation and ends inside", reduced.animations === 0 && reduced.entered, `${reduced.animations} animations, entered ${reduced.entered}`);
  } finally {
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  }
}

/**
 * Section 6, CLS: the page does not move while a system is chosen, the core entered and left. Two
 * reads. The layout-shift score, against the budget. And the map's own geometry, the stage and the
 * detail line by their place in the document, which must not move by a pixel: the score is divided
 * by the viewport and Chrome's scroll anchoring hides a move above the fold, so a map that jumped
 * 200px measured under 0.05 on its own (2026-10-11).
 */
async function noLayoutShift(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  await page.evaluate(() => {
    const w = /** @type {Window & { __shift?: number }} */ (window);
    w.__shift = 0;
    // Every shift counts, input-driven ones included: choosing must not move the page at all.
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__shift = (w.__shift ?? 0) + /** @type {PerformanceEntry & { value: number }} */ (entry).value;
    }).observe({ type: "layout-shift" });
  });
  const place = () =>
    page.evaluate(() =>
      ["stage", "detail"].map((part) => {
        const el = document.querySelector(`#family [data-cap-part="${part}"]`);
        return el ? Math.round(el.getBoundingClientRect().top + scrollY) : NaN;
      }),
    );
  const before = await place();
  let moved = 0;
  const others = MODEL.systems.filter((s) => s.ring !== "core").slice(0, 3);
  for (const step of [...others.map((s) => () => page.click(tileSelector(s.id))), () => page.click(tileSelector(CORE)), () => page.click(tileSelector(CORE)), () => page.keyboard.press("Escape")]) {
    await step();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const now = await place();
    moved = Math.max(moved, ...now.map((y, i) => Math.abs(y - (before[i] ?? NaN))));
  }
  const shift = await page.evaluate(() => /** @type {Window & { __shift?: number }} */ (window).__shift ?? -1);
  ok(`/systems: choosing, going inside and stepping out shift the page under ${CLS_BUDGET}`, shift >= 0 && shift < CLS_BUDGET, `layout shift ${shift.toFixed(4)}`);
  ok("/systems: choosing, going inside and stepping out leave the map and its detail line where they are", moved === 0, `moved up to ${moved}px (stage and detail tops ${before.join(", ")})`);
}

/** Section 6, INP proxy: under 4x CPU throttling, the slowest response to choosing any system, entering and leaving. */
async function inputResponse(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  await page.evaluate(() => {
    const w = /** @type {Window & { __events?: Array<{ name: string, duration: number, work: number }> }} */ (window);
    w.__events = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = /** @type {PerformanceEventTiming & { interactionId?: number }} */ (entry);
        if (e.interactionId) w.__events?.push({ name: e.name, duration: e.duration, work: e.processingEnd - e.startTime });
      }
    }).observe(/** @type {PerformanceObserverInit} */ ({ type: "event", durationThreshold: 16, buffered: true }));
  });
  await page.emulateCPUThrottling(4);
  try {
    for (const s of MODEL.systems) await page.click(tileSelector(s.id));
    await page.click(tileSelector(CORE));
    await page.click(tileSelector(CORE));
    await page.keyboard.press("Escape");
    await new Promise((resolve) => setTimeout(resolve, 500));
  } finally {
    await page.emulateCPUThrottling(null);
  }
  const events = await page.evaluate(() => /** @type {Window & { __events?: Array<{ name: string, duration: number, work: number }> }} */ (window).__events ?? []);
  const worstWork = events.reduce((max, e) => Math.max(max, e.work), 0);
  const worstWhole = events.reduce((max, e) => Math.max(max, e.duration), 0);
  // Event Timing reports nothing under 16ms, and under 4x throttling every click paints for longer,
  // so an empty list is an observer that saw nothing, not a fast page.
  ok(
    `/systems under 4x CPU throttling: every choice, entering and leaving is handled under ${INPUT_BUDGET_MS}ms`,
    events.length > 0 && worstWork < INPUT_BUDGET_MS,
    `slowest input delay plus handling ${Math.round(worstWork)}ms over ${events.length} interaction entries (Event Timing, a lab proxy for INP)`,
  );
  report(
    `/systems under 4x CPU throttling: slowest interaction to its next paint ${Math.round(worstWhole)}ms (warn over ${INPUT_BUDGET_MS}ms; ` +
      `the paint in a GPU-less headless runner is software rendering, so a real phone is the release's check)` +
      (worstWhole >= INPUT_BUDGET_MS ? "  WARN" : ""),
  );
}

/** Section 6, frame rate: the gaps between frames while going inside under 4x throttling. Warn only. */
async function framesWhileEntering(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  await page.click(tileSelector(CORE));
  await page.emulateCPUThrottling(4);
  try {
    const gaps = await page.evaluate(
      (core) =>
        new Promise((resolve) => {
          /** @type {number[]} */
          const out = [];
          let last = performance.now();
          const end = last + 800;
          const tick = (/** @type {number} */ now) => {
            out.push(now - last);
            last = now;
            if (now < end) requestAnimationFrame(tick);
            else resolve(out);
          };
          requestAnimationFrame(tick);
          /** @type {HTMLElement | null} */ (document.querySelector(`#family .cap-system-map-tile[data-id="${core}"]`))?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }),
      CORE,
    );
    const sorted = /** @type {number[]} */ (gaps).slice(1).sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? Infinity;
    report(
      `/systems going inside under 4x throttling: frame gap p95 ${p95.toFixed(1)}ms over ${sorted.length} frames (warn over ${FRAME_P95_MS}ms; ` +
        `runners vary, so a real mid-range phone over remote DevTools is the release's check)` +
        (p95 > FRAME_P95_MS ? "  WARN" : ""),
    );
  } finally {
    await page.emulateCPUThrottling(null);
  }
}

/** Section 6, colour and both themes: axe finds nothing at rest, chosen and inside, in each theme. */
async function axeBothThemes(/** @type {import("puppeteer").Page} */ page) {
  const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  /** @returns {Promise<string[]>} each violation, as its rule and its first node */
  const scan = async () => {
    await page.addScriptTag({ content: axeSource });
    return page.evaluate(async () => {
      // @ts-expect-error axe is the injected global
      const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return result.violations.map((/** @type {{ id: string, nodes: Array<{ target: string[] }> }} */ v) => `${v.id} at ${v.nodes[0]?.target.join(" ")}`);
    });
  };
  for (const theme of /** @type {const} */ (["light", "dark"])) {
    await open(page, theme, `/systems/${CORE}`);
    const chosen = await scan();
    await page.click(tileSelector(CORE));
    const inside = await scan();
    await open(page, theme);
    const rest = await scan();
    const all = [...rest.map((v) => `at rest: ${v}`), ...chosen.map((v) => `chosen: ${v}`), ...inside.map((v) => `inside: ${v}`)];
    ok(`/systems in the ${theme} theme: axe finds nothing at rest, with a system chosen, or inside`, all.length === 0, all.join("; "));
  }
}

/** The design's budget for the map's script: 25 KB gzip. */
async function scriptBudget(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  const src = await page.$eval('template[data-enhance*="system-map"]', (el) => el.getAttribute("data-enhance"));
  const response = src ? await fetch(new URL(src, BASE)) : null;
  const bytes = response?.ok ? gzipSync(Buffer.from(await response.arrayBuffer()), { level: 9 }).length : -1;
  ok(`/systems: the map's script is under ${SCRIPT_BUDGET_GZIP / 1024} KB gzip`, bytes > 0 && bytes < SCRIPT_BUDGET_GZIP, `${src ?? "no system-map module on the page"}: ${bytes} bytes gzip`);
}

/** Section 4, deep links both ways: /systems links to the explorer, and every system's page to the same system there, as served. */
async function explorerLinks() {
  const pages = [["/systems", `${EXPLORER_ORIGIN}/`], ...MODEL.systems.map((s) => [`/systems/${s.id}`, explorerUrl(s.id)])];
  const missing = await Promise.all(
    pages.map(async ([path, href]) => {
      const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) return `${path} answered ${res.status}`;
      return (await res.text()).includes(`href="${href}"`) ? null : `${path} has no link to ${href}`;
    }),
  );
  const wrong = missing.filter(Boolean);
  ok("/systems and every /systems/<id> link to the same place in the Capsid explorer", wrong.length === 0, wrong.length ? wrong.join("; ") : `${pages.length} pages`);
}
