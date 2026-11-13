/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// /systems and /systems/<id> (app/routes/systems.tsx, app/routes/system.tsx): the network as hexagons, the plain map
// of cards a tab away, and one system at level 2 (Dustin, 2026-11-03), measured in a real Chromium over the committed model. Each check names what it holds.
//
// What a browser cannot prove is said where it is skipped: a real phone's frame rate (the release PR's remote
// DevTools run) and a screen reader (VoiceOver and NVDA by hand).
import { errorMessage } from "@dustinedwards/site-runtime/log";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { explorerHref } from "capsomer/behavior/system-model";

import { loadSystemModel, systemPath } from "../../../../app/lib/systems.mjs";
import { BASE, FETCH_TIMEOUT_MS, ok, report, root } from "../harness.mjs";

const require = createRequire(import.meta.url);
const MODEL = loadSystemModel(
  JSON.parse(readFileSync(join(root, "data", "system-model.json"), "utf8")),
);
const IDS = MODEL.systems.map((s) => s.id);
const CORE = MODEL.systems.find((s) => s.ring === "core")?.id ?? "";
/** The system with the most flows over its parts: where stepping is checked. */
const FLOWED = MODEL.systems.find((s) => s.id === CORE)?.id ?? CORE;
const SHARED = MODEL.systems.find((s) => s.ring === "shared")?.id ?? CORE;
const PRIVATE = MODEL.systems.find((s) => s.private);

/** The map's own script, gzipped, under the design's budget. */
const SCRIPT_BUDGET_GZIP = 25 * 1024;
/** Lighting changes no card's size, so nothing on the page moves. */
const CLS_BUDGET = 0.01;
/** The INP proxy under 4x CPU throttling: a flow's Start, Next and Back, input delay plus handling. */
const INPUT_BUDGET_MS = 100;

/**
 * @param {import("puppeteer").Page} page
 * @param {"light" | "dark"} theme
 * @param {string} path
 */
async function open(page, theme, path = "/systems") {
  await page.setCookie({ name: "theme", value: theme, url: BASE });
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".cap-system-map[data-cap-ready]", { timeout: 10_000 });
}

/** Focuses a system's hexagon: an SVG link, which Puppeteer's page.focus refuses as not an HTMLElement. */
async function focusCell(/** @type {import("puppeteer").Page} */ page, /** @type {string} */ id) {
  await page.$eval(`#network a.cap-system-map-cell[data-id="${id}"]`, (el) => el.focus());
}

/** The network's second tab: the plain map of cards. */
async function plainMap(/** @type {import("puppeteer").Page} */ page) {
  // Focusing a hexagon can scroll the tabs up under the sticky site header, where a click lands
  // on the header; bring them to the middle of the screen first, as a reader would.
  await page.$eval("#network-tab-plain", (tab) => tab.scrollIntoView({ block: "center" }));
  await page.click("#network-tab-plain");
  await page.waitForSelector("#network .cap-system-map-network:not([hidden])", { timeout: 10_000 });
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
    for (const part of [
      everyCardOpensItsPage,
      focusLightsTies,
      everySystemHasAPage,
      stepsAFlow,
      wholeWithoutScript,
      noLayoutShift,
      inputResponse,
      axeBothThemes,
      scriptBudget,
      explorerLinks,
    ]) {
      try {
        await part(page);
      } catch (error) {
        ok(`/systems: ${part.name} ran`, false, errorMessage(error));
      }
    }
  } finally {
    // The theme cookie lives in the browser's default context, which the cases after this one share.
    await page.deleteCookie({ name: "theme", url: BASE });
    await page.close();
  }
}

/** Every system in the model is one hexagon and one card, each a link to its own page; the hexagons show first. */
async function everyCardOpensItsPage(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  const views = await page.$eval("#network", (root) => ({
    hex: !root.querySelector(".cap-system-map-hex")?.hasAttribute("hidden"),
    plain: !root.querySelector(".cap-system-map-network")?.hasAttribute("hidden"),
  }));
  ok(
    "/systems: the hexagons show first, the plain map a tab away",
    views.hex && !views.plain,
    `hexagons shown ${views.hex}, plain map shown ${views.plain}`,
  );
  const links = await page.$$eval(
    "#network a.cap-system-map-cell, #network .cap-system-map-card",
    (els) =>
      els.map((el) => ({
        id: /** @type {HTMLElement} */ (el).dataset.id,
        href: el.matches("a")
          ? el.getAttribute("href")
          : el.querySelector("a")?.getAttribute("href"),
      })),
  );
  const ids = links.map((c) => c.id).sort();
  const wrong = links.filter((c) => c.href !== systemPath(c.id ?? ""));
  ok(
    "/systems: every system is one hexagon and one card, and each link opens /systems/<id>",
    JSON.stringify(ids) === JSON.stringify([...IDS, ...IDS].sort()) && wrong.length === 0,
    `${links.length} links for ${IDS.length} systems; wrong links ${wrong.map((c) => c.id).join(", ") || "none"}`,
  );
  await page.click(`#network a.cap-system-map-cell[data-id="${SHARED}"]`);
  await page.waitForSelector(`.cap-system-map[data-system="${SHARED}"]`, { timeout: 10_000 });
  ok(
    "/systems: one tap on a hexagon opens its system",
    new URL(page.url()).pathname === systemPath(SHARED),
    page.url(),
  );
}

/** Focusing a hexagon lights its lines; on the plain map, Tab reaches each card's link, and focusing one lights it and the systems tied to it. */
async function focusLightsTies(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  await focusCell(page, SHARED);
  const hex = await page.$eval("#network", (root) => ({
    lit: /** @type {HTMLElement} */ (root).dataset.lit ?? null,
    lines: root.querySelectorAll(".cap-system-map-comb-lines [data-on]").length,
  }));
  ok(
    "/systems: focusing a hexagon lights its lines",
    hex.lit === SHARED && hex.lines > 0,
    `lit ${hex.lit}, ${hex.lines} lines on`,
  );
  await plainMap(page);
  await page.focus(`#network .cap-system-map-card[data-id="${SHARED}"] a`);
  const lit = await page.$eval("#network", (root) => ({
    lit: /** @type {HTMLElement} */ (root).dataset.lit ?? null,
    self: root.querySelectorAll(".cap-system-map-card[data-tie='self']").length,
    tied: root.querySelectorAll(".cap-system-map-card[data-tie]:not([data-tie='self'])").length,
    words: [
      ...root.querySelectorAll(
        ".cap-system-map-card[data-tie]:not([data-tie='self']) .cap-system-map-card-tie",
      ),
    ].every((el) => /^(Used by|Uses|Uses and used by) /.test(el.textContent ?? "")),
  }));
  const card = await page.$eval(
    `#network .cap-system-map-card[data-id="${SHARED}"]`,
    (el) => /** @type {HTMLElement} */ (el).dataset.usedBy?.split(" ").filter(Boolean).length ?? 0,
  );
  ok(
    "/systems: focusing a card lights it and every system tied to it, each saying how in words",
    lit.lit === SHARED && lit.self === 1 && lit.tied >= card && lit.tied > 0 && lit.words,
    `lit ${lit.lit}, ${lit.tied} tied (it is used by ${card}), words ${lit.words}`,
  );
  await page.keyboard.press("Tab");
  const next = await page.$eval(
    "#network",
    (root) => /** @type {HTMLElement} */ (root).dataset.lit ?? null,
  );
  ok(
    "/systems: Tab moves the light to the next card",
    next !== null && next !== SHARED,
    `lit ${next}`,
  );
}

/** Every system has a page with its three columns, a private one says so and links no repo, and an unknown id is 404. */
async function everySystemHasAPage() {
  const bad = [];
  for (const s of MODEL.systems) {
    const res = await fetch(`${BASE}${systemPath(s.id)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const html = res.ok ? await res.text() : "";
    const columns = ["used-by", "inside", "uses"].every((c) => html.includes(`data-column="${c}"`));
    if (!res.ok || !columns || !html.includes(`data-system="${s.id}"`))
      bad.push(`${s.id} (${res.status}${columns ? "" : ", no columns"})`);
  }
  ok(
    "/systems/<id>: every system's page answers with what uses it, its parts and what it uses",
    bad.length === 0,
    bad.join(", ") || `${IDS.length} pages`,
  );
  if (PRIVATE) {
    const html = await (
      await fetch(`${BASE}${systemPath(PRIVATE.id)}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    ).text();
    ok(
      "/systems/<id>: a private system is shown in full, says its repo is private and links none",
      html.includes("private repo") && !/href="https:\/\/github\.com\//.test(html),
      PRIVATE.id,
    );
  }
  const missing = await fetch(`${BASE}/systems/no-such-system`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  ok("/systems/<unknown> answers 404", missing.status === 404, `answered ${missing.status}`);
}

/** On the core's page, Start lights the first step's parts and says where it is; Next steps; Escape stops. */
async function stepsAFlow(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light", systemPath(FLOWED));
  const flows = await page.$$(".cap-system-map-flow");
  if (!flows.length) {
    ok(`/systems/${FLOWED}: has a flow to step`, false, "no .cap-system-map-flow");
    return;
  }
  await page.click(".cap-system-map-flow [data-cap-part='next']");
  const first = await page.$eval("#system", (root) => ({
    step: /** @type {HTMLElement} */ (root).dataset.step,
    lit: root.querySelectorAll(".cap-system-map-part[data-lit]").length,
    status: root.querySelector(".cap-system-map-flow-status")?.textContent ?? "",
  }));
  await page.keyboard.press("Enter");
  const second = await page.$eval(
    "#system",
    (root) => /** @type {HTMLElement} */ (root).dataset.step,
  );
  await page.keyboard.press("Escape");
  const stopped = await page.$eval(
    "#system",
    (root) => !root.hasAttribute("data-step") && root.querySelectorAll("[data-lit]").length === 0,
  );
  ok(
    `/systems/${FLOWED}: Start lights a step's parts and says where it is, Next steps, Escape stops`,
    first.step === "1" &&
      first.lit > 0 &&
      /^Step 1 of \d+: /.test(first.status) &&
      second === "2" &&
      stopped,
    `step ${first.step} with ${first.lit} parts lit, "${first.status}", then ${second}, stopped ${stopped}`,
  );
}

/** With no script both views show, every system a link in each, and each flow an ordered list: the pages are whole as served. */
async function wholeWithoutScript(/** @type {import("puppeteer").Page} */ page) {
  await page.setJavaScriptEnabled(false);
  try {
    await page.goto(`${BASE}/systems`, { waitUntil: "networkidle0" });
    const links = await page.$$eval("#network .cap-system-map-card-name a", (els) => els.length);
    const cells = await page.$$eval(
      "#network a.cap-system-map-cell",
      (els) => els.filter((el) => el.getBoundingClientRect().height > 0).length,
    );
    await page.goto(`${BASE}${systemPath(FLOWED)}`, { waitUntil: "networkidle0" });
    const steps = await page.$$eval(
      ".cap-system-map-steps li",
      (els) => els.filter((el) => el.getBoundingClientRect().height > 0).length,
    );
    const controls = await page.$$eval(
      ".cap-system-map-flow-controls",
      (els) => els.filter((el) => el.getBoundingClientRect().height > 0).length,
    );
    ok(
      "/systems with no script: every hexagon and card is a link, and on a system's page each flow is a list with no dead buttons",
      links === IDS.length && cells === IDS.length && steps > 0 && controls === 0,
      `${cells} hexagon links, ${links} card links, ${steps} steps shown, ${controls} controls shown`,
    );
  } finally {
    await page.setJavaScriptEnabled(true);
  }
}

/** Lighting never changes a size: moving the pointer over every hexagon, then every card, shifts nothing. */
async function noLayoutShift(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  await page.evaluate(() => {
    const w = /** @type {Window & { __cls?: number }} */ (window);
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of /** @type {Array<PerformanceEntry & { value: number }>} */ (
        list.getEntries()
      ))
        w.__cls = (w.__cls ?? 0) + e.value;
    }).observe({ type: "layout-shift", buffered: false });
  });
  for (const selector of ["a.cap-system-map-cell", ".cap-system-map-card"]) {
    if (selector === ".cap-system-map-card") await plainMap(page);
    for (const id of IDS) {
      const box = await (await page.$(`#network ${selector}[data-id="${id}"]`))?.boundingBox();
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }
  }
  await page.mouse.move(1, 1);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const cls = await page.evaluate(
    () => /** @type {Window & { __cls?: number }} */ (window).__cls ?? 0,
  );
  ok(
    `/systems: pointing at every hexagon and card in turn shifts nothing (CLS under ${CLS_BUDGET})`,
    cls < CLS_BUDGET,
    `CLS ${cls.toFixed(4)}`,
  );
}

/** Under 4x CPU throttling, each press of a flow's Start, Next and Back is handled within the budget. */
async function inputResponse(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light", systemPath(FLOWED));
  await page.evaluate(() => {
    /** @type {Window & { __events?: Array<{ duration: number, work: number }> }} */ (
      window
    ).__events = [];
    new PerformanceObserver((list) => {
      for (const e of /** @type {Array<PerformanceEventTiming & { interactionId?: number }>} */ (
        list.getEntries()
      )) {
        if (e.interactionId)
          /** @type {Window & { __events?: Array<{ duration: number, work: number }> }} */ (
            window
          ).__events?.push({ duration: e.duration, work: e.processingEnd - e.startTime });
      }
    }).observe(
      /** @type {PerformanceObserverInit} */ ({
        type: "event",
        durationThreshold: 16,
        buffered: true,
      }),
    );
  });
  await page.emulateCPUThrottling(4);
  try {
    for (const part of ["next", "next", "next", "back", "back"]) {
      await page.click(`.cap-system-map-flow [data-cap-part='${part}']`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  } finally {
    await page.emulateCPUThrottling(null);
  }
  const events = await page.evaluate(
    () =>
      /** @type {Window & { __events?: Array<{ duration: number, work: number }> }} */ (window)
        .__events ?? [],
  );
  const worstWork = events.reduce((max, e) => Math.max(max, e.work), 0);
  const worstWhole = events.reduce((max, e) => Math.max(max, e.duration), 0);
  ok(
    `/systems/<id> under 4x CPU throttling: every step of a flow is handled under ${INPUT_BUDGET_MS}ms`,
    events.length > 0 && worstWork < INPUT_BUDGET_MS,
    `slowest input delay plus handling ${Math.round(worstWork)}ms over ${events.length} interaction entries (Event Timing, a lab proxy for INP)`,
  );
  report(
    `/systems/<id> under 4x CPU throttling: slowest interaction to its next paint ${Math.round(worstWhole)}ms (the paint in a GPU-less headless runner is software rendering)`,
  );
}

/** Color and both themes: axe finds nothing on either view of the network, lit or at rest, or on the core's and a shared system's page. */
async function axeBothThemes(/** @type {import("puppeteer").Page} */ page) {
  const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  /** @returns {Promise<string[]>} each violation, as its rule and its first node */
  const scan = async () => {
    await page.addScriptTag({ content: axeSource });
    return page.evaluate(async () => {
      // @ts-expect-error axe is the injected global
      const result = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      });
      return result.violations.map(
        (/** @type {{ id: string, nodes: Array<{ target: string[] }> }} */ v) =>
          `${v.id} at ${v.nodes[0]?.target.join(" ")}`,
      );
    });
  };
  for (const theme of /** @type {const} */ (["light", "dark"])) {
    const found = [];
    await open(page, theme);
    found.push(...(await scan()).map((v) => `at rest: ${v}`));
    await focusCell(page, SHARED);
    found.push(...(await scan()).map((v) => `lit: ${v}`));
    await plainMap(page);
    found.push(...(await scan()).map((v) => `plain map: ${v}`));
    await page.focus(`#network .cap-system-map-card[data-id="${SHARED}"] a`);
    found.push(...(await scan()).map((v) => `plain map lit: ${v}`));
    for (const id of [CORE, SHARED]) {
      await open(page, theme, systemPath(id));
      found.push(...(await scan()).map((v) => `${id}: ${v}`));
    }
    ok(
      `/systems in the ${theme} theme: axe finds nothing on either view of the network, at rest or lit, or on a system's page`,
      found.length === 0,
      found.join("; "),
    );
  }
}

/** The design's budget for the map's script: 25 KB gzip. */
async function scriptBudget(/** @type {import("puppeteer").Page} */ page) {
  await open(page, "light");
  // The island as the page loaded it, and the shared chunks it imports: what a reader downloads for the map.
  const src = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((n) => /\/islands\/system-map-[^/]*\.js$/.test(n)),
  );
  const fetchCode = async (/** @type {string} */ url) => {
    const response = await fetch(url);
    return response.ok ? { code: Buffer.from(await response.arrayBuffer()) } : null;
  };
  const island = src ? await fetchCode(src) : null;
  const chunks = island
    ? [...island.code.toString("utf8").matchAll(/from"(\.\/chunks\/[^"]+)"/g)].map(
        (m) => new URL(m[1], src).href,
      )
    : [];
  const files = island ? [island, ...(await Promise.all(chunks.map(fetchCode)))] : [];
  const bytes =
    files.length > 0 && files.every(Boolean)
      ? files.reduce(
          (n, f) => n + gzipSync(/** @type {{ code: Buffer }} */ (f).code, { level: 9 }).length,
          0,
        )
      : -1;
  ok(
    `/systems: the map's script is under ${SCRIPT_BUDGET_GZIP / 1024} KB gzip`,
    bytes > 0 && bytes < SCRIPT_BUDGET_GZIP,
    `${src ?? "no system-map module on the page"}: ${bytes} bytes gzip`,
  );
}

/** Deep links both ways: each system's page links to the same system in the Capsid explorer, as served. */
async function explorerLinks() {
  const missing = [];
  for (const s of MODEL.systems) {
    const res = await fetch(`${BASE}${systemPath(s.id)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !(await res.text()).includes(`href="${explorerHref(s.id)}"`)) missing.push(s.id);
  }
  ok(
    "/systems/<id> links to the same system in the Capsid explorer",
    missing.length === 0,
    missing.length ? `no link on ${missing.join(", ")}` : `${IDS.length} links`,
  );
}
