/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// /systems, the family of systems (app/routes/systems.tsx): the award checklist of
// capsid/research/design-system-explorer.md, section 6, measured in a real Chromium over the
// committed model, and the page being one page: one tap on any system zooms into its circle in
// place, kept in ?system=<id>, and the old /systems/<id> addresses moved there. Each check names
// what it holds.
//
// What a browser cannot prove is said where it is skipped: a real phone's frame rate (the release
// PR's remote DevTools run) and a screen reader (VoiceOver and NVDA by hand).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { explorerUrl, loadSystemModel, systemHref } from "../../../../app/lib/systems.mjs";
import { BASE, FETCH_TIMEOUT_MS, ok, report, root } from "../harness.mjs";

const require = createRequire(import.meta.url);
const MODEL = loadSystemModel(JSON.parse(readFileSync(join(root, "data", "system-model.json"), "utf8")));
const IDS = MODEL.systems.map((s) => s.id).sort();
const CORE = MODEL.systems.find((s) => s.ring === "core")?.id ?? "";

/** The map's own script, gzipped, under the design's budget. */
const SCRIPT_BUDGET_GZIP = 25 * 1024;
/** Section 6: CLS under 0.05 while zooming in and out. */
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
  // site-runtime-security's and the script-set case's to judge.
  await page.setBypassCSP(true);
  try {
    // Each part on its own: one that throws is a failed check, and the parts after it still run.
    for (const part of [everyNodeByKeyboard, listMatchesModel, oneTapZooms, choosingInPlace, chosenFromTheAddress, everyFactWithoutScript, reducedMotion, noLayoutShift, inputResponse, framesWhileEntering, axeBothThemes, scriptBudget, explorerLinks]) {
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
  const entered = await page.$eval("#family", (el) => el.hasAttribute("data-entered"));
  await page.keyboard.press("Escape");
  // Focus returns in the next frame.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const left = await page.$eval("#family", (el) => !el.hasAttribute("data-entered"));
  ok("/systems: Enter once on the core zooms into it, Escape returns to the map and to it", entered && left && (await page.evaluate(focusedId)) === CORE, `entered ${entered}, left ${left}`);
}

/** Zooming in scrolls the circle into view, smoothly: a click aimed before it ends lands where the circle was. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 800));

/** What the map shows: the system zoomed into, if any, and the layers shown. */
const zoomState = () => {
  const root = /** @type {HTMLElement} */ (document.querySelector("#family"));
  return {
    entered: root.hasAttribute("data-entered"),
    zoom: root.dataset.zoom ?? null,
    shown: [...root.querySelectorAll("[data-layer='inside'][data-shown]")].map((l) => /** @type {HTMLElement} */ (l).dataset.system),
    url: location.pathname + location.search,
  };
};

/**
 * Dustin, 2026-10-18: "it's not intuitive to click twice". One tap on any system zooms into its circle, with
 * its parts inside and the systems it connects to round the rim; a system on the rim is a tap to zoom there;
 * "Back to all systems", beside the views, and a tap outside the circle return to the map.
 */
async function oneTapZooms(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  // The circles other than the core's are fetched once the page has loaded.
  await page.waitForSelector("#family[data-insides-ready]", { timeout: 10_000 });
  const layers = (await page.$$eval("#family [data-layer='inside'][data-system]", (els) => els.map((e) => /** @type {HTMLElement} */ (e).dataset.system ?? ""))).sort();
  ok("/systems: every system has a circle of its own to zoom into", JSON.stringify(layers) === JSON.stringify(IDS), `${layers.length} circles for ${IDS.length} systems`);

  const other = MODEL.systems.find((s) => s.ring !== "core" && !s.private)?.id ?? CORE;
  await page.click(tileSelector(other));
  await settle();
  const zoomed = await page.evaluate(zoomState);
  // The way back is a button with the views, beside Capsid and Plain map, shown while a system is zoomed into.
  const back = await page.$eval("#family [data-cap-part='views']", (el) => [...el.querySelectorAll("button:not([hidden])")].map((b) => b.textContent).join("|"));
  ok(
    "/systems: one tap on a system zooms into its circle, with the way back",
    zoomed.entered && zoomed.zoom === other && zoomed.shown.length === 1 && zoomed.shown[0] === other && zoomed.url === systemHref(other) && back.includes("Back to all systems"),
    `entered ${zoomed.entered}, zoom ${zoomed.zoom}, shown ${zoomed.shown.join(", ") || "none"}, address ${zoomed.url}, buttons ${back || "none"}`,
  );

  const goto = await page.$eval(`#family [data-layer='inside'][data-system="${other}"]`, (l) => /** @type {HTMLElement | null} */ (l.querySelector(".cap-system-map-rim[data-goto]"))?.dataset.goto ?? "");
  if (goto) {
    await page.click(`#family [data-layer='inside'][data-system="${other}"] .cap-system-map-rim[data-goto="${goto}"]`);
    await settle();
    const there = await page.evaluate(zoomState);
    ok("/systems: a system on the rim is one tap to zoom into it", there.zoom === goto && there.shown.length === 1 && there.shown[0] === goto && there.url === systemHref(goto), `zoom ${there.zoom}, shown ${there.shown.join(", ") || "none"}, address ${there.url}`);
  } else ok(`/systems: ${other}'s circle has a system on its rim to go to`, false, "no .cap-system-map-rim[data-goto]");

  await page.click("#family [data-cap-part='views'] [data-cap-part='out']");
  const rest = await page.evaluate(zoomState);
  ok("/systems: Back to all systems returns to the map", !rest.entered && rest.zoom === null && rest.shown.length === 0 && rest.url === "/systems", `entered ${rest.entered}, zoom ${rest.zoom}, address ${rest.url}`);

  await page.click(tileSelector(other));
  await settle();
  // The stage's top-left corner is outside every circle.
  const corner = await page.$eval("#family [data-cap-part='stage']", (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + 4, y: r.top + 4 };
  });
  await page.mouse.click(corner.x, corner.y);
  const outside = await page.evaluate(zoomState);
  ok("/systems: a tap outside the circle returns to the map", !outside.entered && outside.zoom === null, `entered ${outside.entered}, zoom ${outside.zoom}`);

  // A private system is wired like any other (Dustin, 2026-10-23): its circle draws its parts.
  const hidden = MODEL.systems.find((s) => s.private && MODEL.containers.some((c) => c.system === s.id))?.id;
  if (hidden) {
    const boxes = await page.$eval(`#family [data-layer='inside'][data-system="${hidden}"]`, (l) => l.querySelectorAll(".cap-system-map-box").length);
    ok("/systems: a private system's circle draws its parts", boxes > 0, `${boxes} parts drawn in ${hidden}'s circle`);
  }
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

/** Section 6, reduced motion: zooming in runs no animation and ends inside. The control first proves the read can see one. */
async function reducedMotion(/** @type {import("puppeteer").Page} */ page) {
  const enterAndCount = async () => {
    await page.click(tileSelector(CORE));
    // Only animations that run over time: the letterhead's fade follows the scroll position, so
    // it stays listed as running and moves nothing on a zoom.
    const animations = await page.evaluate(
      () => document.getAnimations().filter((a) => a.timeline instanceof DocumentTimeline).length,
    );
    const entered = await page.$eval("#family", (el) => el.hasAttribute("data-entered"));
    return { animations, entered };
  };
  await open(page, "light");
  const control = await enterAndCount();
  ok("/systems: zooming in animates (the control for the reduced-motion read)", control.animations > 0 && control.entered, `${control.animations} animations`);

  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  try {
    await open(page, "light");
    const reduced = await enterAndCount();
    ok("/systems under reduced motion: zooming in runs no animation and ends inside", reduced.animations === 0 && reduced.entered, `${reduced.animations} animations, entered ${reduced.entered}`);
  } finally {
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  }
}

/**
 * Section 6, CLS: the page does not move while systems are zoomed into and out of, the core among them. Two
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
    // Every shift counts, input-driven ones included: zooming must not move the page at all.
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
  const escape = () => page.keyboard.press("Escape");
  for (const step of [...others, { id: CORE }].flatMap((s) => [() => page.click(tileSelector(s.id)), escape])) {
    await step();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const now = await place();
    moved = Math.max(moved, ...now.map((y, i) => Math.abs(y - (before[i] ?? NaN))));
  }
  const shift = await page.evaluate(() => /** @type {Window & { __shift?: number }} */ (window).__shift ?? -1);
  ok(`/systems: zooming in and out shifts the page under ${CLS_BUDGET}`, shift >= 0 && shift < CLS_BUDGET, `layout shift ${shift.toFixed(4)}`);
  ok("/systems: zooming in and out leaves the map and its detail line where they are", moved === 0, `moved up to ${moved}px (stage and detail tops ${before.join(", ")})`);
}

/** Section 6, INP proxy: under 4x CPU throttling, the slowest response to zooming into any system and back out. */
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
    // Each zoom is an animation of its own, so the next input waits for it, as a reader's does: an input
    // landing mid-animation measures the animation's frames as its own delay.
    const pause = () => new Promise((resolve) => setTimeout(resolve, 400));
    for (const s of MODEL.systems) {
      await page.click(tileSelector(s.id));
      await pause();
      await page.keyboard.press("Escape");
      await pause();
    }
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
    `/systems under 4x CPU throttling: every zoom in and out is handled under ${INPUT_BUDGET_MS}ms`,
    events.length > 0 && worstWork < INPUT_BUDGET_MS,
    `slowest input delay plus handling ${Math.round(worstWork)}ms over ${events.length} interaction entries (Event Timing, a lab proxy for INP)`,
  );
  report(
    `/systems under 4x CPU throttling: slowest interaction to its next paint ${Math.round(worstWhole)}ms (warn over ${INPUT_BUDGET_MS}ms; ` +
      `the paint in a GPU-less headless runner is software rendering, so a real phone is the release's check)` +
      (worstWhole >= INPUT_BUDGET_MS ? "  WARN" : ""),
  );
}

/** Section 6, frame rate: the gaps between frames while zooming into the core under 4x throttling. Warn only. */
async function framesWhileEntering(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
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
      `/systems zooming in under 4x throttling: frame gap p95 ${p95.toFixed(1)}ms over ${sorted.length} frames (warn over ${FRAME_P95_MS}ms; ` +
        `runners vary, so a real mid-range phone over remote DevTools is the release's check)` +
        (p95 > FRAME_P95_MS ? "  WARN" : ""),
    );
  } finally {
    await page.emulateCPUThrottling(null);
  }
}

/** Section 6, color and both themes: axe finds nothing at rest, zoomed into the core or into another system, in each theme. */
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
  const other = MODEL.systems.find((s) => s.ring !== "core" && !s.private)?.id ?? CORE;
  for (const theme of /** @type {const} */ (["light", "dark"])) {
    await open(page, theme, systemHref(CORE));
    const core = await scan();
    await open(page, theme, systemHref(other));
    const inside = await scan();
    await open(page, theme);
    const rest = await scan();
    const all = [...rest.map((v) => `at rest: ${v}`), ...core.map((v) => `in ${CORE}: ${v}`), ...inside.map((v) => `in ${other}: ${v}`)];
    ok(`/systems in the ${theme} theme: axe finds nothing at rest, zoomed into the core, or into another system`, all.length === 0, all.join("; "));
  }
}

/** The design's budget for the map's script: 25 KB gzip. */
async function scriptBudget(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  // The island as the page loaded it, and the shared chunks it imports: what a reader downloads for the map.
  const src = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).find((n) => /\/islands\/system-map-[^/]*\.js$/.test(n)));
  const fetchCode = async (/** @type {string} */ url) => {
    const response = await fetch(url);
    return response.ok ? { code: Buffer.from(await response.arrayBuffer()) } : null;
  };
  const island = src ? await fetchCode(src) : null;
  const chunks = island ? [...island.code.toString("utf8").matchAll(/from"(\.\/chunks\/[^"]+)"/g)].map((m) => new URL(m[1], src).href) : [];
  const files = island ? [island, ...(await Promise.all(chunks.map(fetchCode)))] : [];
  const bytes = files.length > 0 && files.every(Boolean) ? files.reduce((n, f) => n + gzipSync(/** @type {{ code: Buffer }} */ (f).code, { level: 9 }).length, 0) : -1;
  ok(`/systems: the map's script is under ${SCRIPT_BUDGET_GZIP / 1024} KB gzip`, bytes > 0 && bytes < SCRIPT_BUDGET_GZIP, `${src ?? "no system-map module on the page"}: ${bytes} bytes gzip`);
}

/** Section 4, deep links both ways: /systems links to every system's place in the explorer, as served. */
async function explorerLinks() {
  const res = await fetch(`${BASE}/systems`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const html = res.ok ? await res.text() : "";
  const missing = MODEL.systems.map((s) => explorerUrl(s.id)).filter((href) => !html.includes(`href="${href}"`));
  ok("/systems links to every system in the Capsid explorer", res.ok && missing.length === 0, res.ok ? (missing.length ? `no link to ${missing.join(", ")}` : `${MODEL.systems.length} links`) : `answered ${res.status}`);
}

/** The facts each system's section shows, as the reader sees them: which sections are displayed. */
const shownFacts = () => [...document.querySelectorAll("[data-systems-facts] .systems-facts[data-system]")].filter((el) => getComputedStyle(el).display !== "none").map((el) => /** @type {HTMLElement} */ (el).dataset.system);

/**
 * One page: zooming into a system shows its facts in place and writes ?system=<id> into the address with no
 * navigation (a value set on window survives, and history does not grow); Escape returns to the map and clears
 * the address.
 */
async function choosingInPlace(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  const other = MODEL.systems.find((s) => s.ring !== "core" && !s.private)?.id ?? CORE;
  await page.evaluate(() => {
    /** @type {Window & { __stay?: boolean }} */ (window).__stay = true;
  });
  const before = await page.evaluate(() => ({ length: history.length, shown: [...document.querySelectorAll("[data-systems-facts] .systems-facts")].filter((el) => getComputedStyle(el).display !== "none").length }));
  await page.click(tileSelector(other));
  const after = await page.evaluate(() => ({ url: location.pathname + location.search, stayed: /** @type {Window & { __stay?: boolean }} */ (window).__stay === true, length: history.length }));
  const shown = await page.evaluate(shownFacts);
  ok(
    "/systems: choosing a system shows only its facts, in place, and keeps it in the address as ?system=<id> with no navigation",
    before.shown === 0 && after.url === systemHref(other) && after.stayed && after.length === before.length && shown.length === 1 && shown[0] === other,
    `facts shown at rest ${before.shown}; address ${after.url}; same document ${after.stayed}; history ${before.length} to ${after.length}; facts shown ${shown.join(", ") || "none"}`,
  );

  await page.keyboard.press("Escape");
  const cleared = await page.evaluate(() => ({ url: location.pathname + location.search }));
  const shownAfter = await page.evaluate(shownFacts);
  ok("/systems: Escape clears the choice, its facts and ?system from the address", cleared.url === "/systems" && shownAfter.length === 0, `address ${cleared.url}, facts shown ${shownAfter.join(", ") || "none"}`);
}

/** A shared link: /systems?system=<id> opens with that system chosen, its lines drawn and its facts shown; a value naming no system chooses nothing and is dropped. */
async function chosenFromTheAddress(/** @type {import("puppeteer").Page} */ page) {
  const id = MODEL.systems.find((s) => s.ring !== "core" && !s.private)?.id ?? CORE;
  await open(page, "light", systemHref(id));
  const state = await page.$eval(
    "#family",
    (root, chosen) => ({
      pressed: root.querySelector(`.cap-system-map-tile[data-id="${chosen}"]`)?.getAttribute("aria-pressed"),
      on: root.querySelectorAll(".cap-system-map-edge[data-on]").length,
      detail: root.querySelector("[data-cap-part='detail'] .cap-system-map-detail-name")?.textContent ?? "",
      zoom: /** @type {HTMLElement} */ (root).dataset.zoom ?? null,
      shown: [...root.querySelectorAll("[data-layer='inside'][data-shown]")].map((l) => /** @type {HTMLElement} */ (l).dataset.system),
    }),
    id,
  );
  const shown = await page.evaluate(shownFacts);
  const name = MODEL.systems.find((s) => s.id === id)?.name ?? id;
  ok(
    "/systems?system=<id> opens zoomed into that system: pressed, its lines drawn, its circle, its detail and its facts shown",
    state.pressed === "true" && state.on > 0 && state.detail === name && state.zoom === id && state.shown.length === 1 && state.shown[0] === id && shown.length === 1 && shown[0] === id,
    `pressed ${state.pressed}, ${state.on} lines on, zoom ${state.zoom}, circle shown ${state.shown.join(", ") || "none"}, detail "${state.detail}", facts shown ${shown.join(", ") || "none"}`,
  );

  await open(page, "light", "/systems?system=no-such-system");
  const unknown = await page.evaluate(() => ({ url: location.pathname + location.search, pressed: document.querySelectorAll("#family .cap-system-map-tile[aria-pressed='true']").length }));
  ok("/systems?system=<unknown> chooses nothing and drops the value from the address", unknown.pressed === 0 && unknown.url === "/systems", `pressed ${unknown.pressed}, address ${unknown.url}`);
}

/** With script off the page carries every system's facts, and the server draws a chosen system's lines. */
async function everyFactWithoutScript(/** @type {import("puppeteer").Page} */ page) {
  const id = MODEL.systems.find((s) => s.ring !== "core" && !s.private)?.id ?? CORE;
  await page.setJavaScriptEnabled(false);
  try {
    await page.goto(`${BASE}/systems`, { waitUntil: "networkidle0" });
    const shown = (await page.evaluate(shownFacts)).sort();
    ok("/systems with no script: every system's facts are on the page and shown", JSON.stringify(shown) === JSON.stringify(IDS), `shown ${shown.length} of ${IDS.length}`);
    await page.goto(`${BASE}${systemHref(id)}`, { waitUntil: "networkidle0" });
    const drawn = await page.$eval(
      "#family",
      (root, chosen) => ({
        selected: root.hasAttribute("data-selected"),
        pressed: root.querySelector(`.cap-system-map-tile[data-id="${chosen}"]`)?.getAttribute("aria-pressed"),
        on: root.querySelectorAll(".cap-system-map-edge[data-on]").length,
        circle: !!root.querySelector(`[data-layer='inside'][data-system="${chosen}"][data-shown]`) && root.hasAttribute("data-entered"),
      }),
      id,
    );
    const all = (await page.evaluate(shownFacts)).length;
    ok(
      "/systems?system=<id> with no script: the server draws that system's lines and its circle, and every system's facts are still shown",
      drawn.selected && drawn.pressed === "true" && drawn.on > 0 && drawn.circle && all === IDS.length,
      `selected ${drawn.selected}, pressed ${drawn.pressed}, ${drawn.on} lines on, circle ${drawn.circle}, ${all} facts shown`,
    );
  } finally {
    await page.setJavaScriptEnabled(true);
  }
}

