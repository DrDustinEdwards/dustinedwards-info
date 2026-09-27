/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { PredefinedNetworkConditions } from "puppeteer";

import { BASE, ok, overflowScan, readSkipLink } from "../harness.mjs";

/* The network profile the /writing layout shift was measured on. */
const SLOW_4G = PredefinedNetworkConditions["Slow 4G"];

/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ page, browser }) {
  /* The cases below read the current page and expect /writing. */
  await page.goto(`${BASE}/writing`, { waitUntil: "networkidle0" });

  /*
   * Throttled, or a local font arrives in time and CLS can never fail. A missing observer
   * returns null, which fails.
   */
  {
    const context = await browser.createBrowserContext();
    const probe = await context.newPage();
    await probe.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
    await probe.setCacheEnabled(false);
    await probe.evaluateOnNewDocument(() => {
      const w = /** @type {any} */ (window);
      w.__cls = 0;
      w.__observed = true;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = /** @type {any} */ (entry);
          if (!shift.hadRecentInput) w.__cls += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await probe.emulateNetworkConditions(SLOW_4G);
    await probe.emulateCPUThrottling(4);
    await probe.goto(`${BASE}/writing`, { waitUntil: "networkidle0", timeout: 300_000 });
    // CLS accumulates after load; a reading taken at load is the first frame.
    await new Promise((r) => setTimeout(r, 4000));
    const shift = await probe.evaluate(() => {
      const w = /** @type {any} */ (window);
      return w.__observed === true ? w.__cls : null;
    });
    await context.close();

    ok(
      "the layout-shift observer ran, so a zero below means stability",
      shift !== null,
      "the page reported no observer at all, and a missing observer reports the same " +
        "0.0000 a stable page does.",
    );
    ok(
      "/writing does not shift while the font arrives (CLS under 0.02)",
      shift !== null && shift < 0.02,
      `CLS ${shift === null ? "(unobserved)" : shift.toFixed(4)} on Slow 4G with a cold ` +
        `cache, ceiling 0.02, measured 0.0000 on 2026-08-28. It was 0.0674 with ` +
        `font-display: swap, one shift, the tag-chip row re-wrapping when the web font ` +
        `replaced the fallback. The ceiling is well under Google's 0.1 "good" threshold ` +
        `on purpose: this page measured zero, so anything approaching a tenth is a ` +
        `regression rather than a page that is merely acceptable.`,
    );
  }

  for (const path of ["/", "/writing", "/search?q=workers", "/colophon"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    const s = await page.evaluate(readSkipLink);
    ok(
      `${path}: the skip link exists and its target does`,
      s.link && s.target,
      s.link
        ? `href is ${JSON.stringify(s.href)} and no element carries that id, so the link ` +
          `moves focus nowhere`
        : "there is no .skip-link at all",
    );
  }

  /* `NavLink` without `end` marks Blog current on every `/writing/*` page. */
  await page.goto(`${BASE}/writing`, { waitUntil: "networkidle0" });
  const firstPost = await page.evaluate(() => {
    const a = document.querySelector('.entry-list a[href^="/writing/"]');
    return a ? a.getAttribute("href") : null;
  });

  ok(
    "the blog index lists at least one post to navigate to",
    !!firstPost,
    "no post link found, so the aria-current assertion below would examine nothing",
  );

  if (firstPost) {
    await page.goto(`${BASE}${firstPost}`, { waitUntil: "networkidle0" });
    const marked = await page.evaluate(() =>
      [...document.querySelectorAll(".site-header-nav a")]
        .filter((a) => a.getAttribute("aria-current"))
        .map((a) => `${(a.textContent || "").trim()} -> ${a.getAttribute("href")}`),
    );
    ok(
      "no header nav link claims to be the current page on a post page",
      marked.length === 0,
      `${marked.join(", ")} carries aria-current on ${firstPost}, which is not that link's ` +
        `page. NavLink needs \`end\`, exactly as the admin nav already has.`,
    );
  }

  /* `/playground` boxes scroll by design; the page must not. */
  await page.setViewport({ width: 320, height: 800 });
  for (const path of [
    "/",
    "/writing",
    "/search?q=workers",
    "/colophon",
    "/projects",
    "/playground?key=dustin-edwards-4f2d7f1a9c3b5e07-1600x900.webp&cookie=theme%3Ddark&md=links&q=fusion",
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    const o = await page.evaluate(overflowScan);
    ok(
      `${path}: no horizontal scroll at 320px`,
      o.scrollW <= o.clientW,
      `scrollWidth ${o.scrollW} exceeds clientWidth ${o.clientW}. Widest: ${o.over.join(", ")}`,
    );
  }
}
