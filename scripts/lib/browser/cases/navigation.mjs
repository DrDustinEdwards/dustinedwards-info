/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, ok, pollUntil } from "../harness.mjs";

/*
 * Chrome's root crossfade blinks full-document navigations, so the ViewTransition must
 * be null. `pagereveal` must also fire, or an unattached listener would pass.
 */
/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ browser }) {
  const context = await browser.createBrowserContext();
  const probe = await context.newPage();

  /** @type {Array<{ path: string, hasTransition: boolean }>} */
  const reveals = [];
  await probe.exposeFunction(
    "__checkBrowserReveal",
    /** @param {string} path @param {boolean} hasTransition */
    (path, hasTransition) => {
      reveals.push({ path, hasTransition });
    },
  );
  await probe.evaluateOnNewDocument(() => {
    addEventListener("pagereveal", (event) => {
      /** @type {any} */ (window).__checkBrowserReveal(
        location.pathname,
        Boolean(event.viewTransition),
      );
    });
  });

  /* An activated prerender is a separate target the probe never ran in. */
  const probeClient = await probe.createCDPSession();
  await probeClient.send("Page.setPrerenderingAllowed", { isAllowed: false });

  /* The nav is a wrapping row with no breakpoint of its own, so a destination is laid out at every width. */
  await probe.setViewport({ width: 1280, height: 900 });

  await probe.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  ok(
    "the pagereveal probe is installed, so a later silence means something",
    reveals.some((r) => r.path === "/"),
    `the initial load produced ${JSON.stringify(reveals)}. pagereveal fires on ` +
      `every document load, so nothing here means the listener never attached and ` +
      `the navigation assertions below would pass or fail for the wrong reason.`,
  );
  reveals.length = 0;

  /*
   * A hidden element's zero box clicks the document corner, so it fails. Falls back to
   * the overflow menu's copy; fails if neither is laid out.
   */
  const openTarget = async () => {
    const read = () =>
      probe.evaluate(() => {
        /** @param {string} sel */
        const pick = (sel) => {
          const link = document.querySelector(sel);
          if (!link) return null;
          const box = link.getBoundingClientRect();
          if (box.width <= 0 || box.height <= 0) return null;
          return {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
          };
        };
        const bar = pick('.site-header-nav a[href="/blog"]');
        if (bar) return { ...bar, via: "the header nav" };
        const menu = pick('.site-shell-menu a[href="/blog"]');
        return menu ? { ...menu, via: "the overflow menu" } : null;
      });

    const first = await read();
    if (first) return first;

    const opened = await probe.evaluate(() => {
      const d = document.querySelector("details.site-shell-overflow");
      if (!(d instanceof HTMLDetailsElement)) return false;
      d.open = true;
      return true;
    });
    if (!opened) return null;
    await new Promise((r) => setTimeout(r, 250));
    return read();
  };

  const target = await openTarget();
  const clickable = target !== null;
  ok(
    "the header carries a laid-out /blog link for the navigation case to click",
    clickable,
    'neither `.site-header-nav a[href="/blog"]` nor `.site-shell-menu a[href="/blog"]` ' +
      "is present with a non-zero box, even with the overflow disclosure opened. A " +
      "hidden link puts the click at the document corner and the navigation " +
      "assertions below then measure nothing, which is how one breakpoint read as " +
      "three unrelated failures.",
  );
  if (clickable) console.log(`  (the navigation case clicked via ${target.via})`);

  let arrived = "";
  let reveal = null;
  if (clickable) {
    await probe.mouse.move(target.x, target.y);
    await new Promise((r) => setTimeout(r, 350));
    await probe.mouse.click(target.x, target.y);
    arrived = await pollUntil(
      () => probe.evaluate(() => location.pathname).catch(() => ""),
      (path) => path === "/blog",
      { everyMs: 150, sleepFirst: false },
    );
    /* The event fires on the incoming document, so give it a moment to land. */
    for (let i = 0; i < 6 && reveals.length === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
    reveal = reveals.find((r) => r.path === "/blog") ?? reveals[reveals.length - 1] ?? null;
  }
  await context.close();

  ok(
    "the header click reaches /blog, so the navigation below was real",
    arrived === "/blog",
    `landed on ${JSON.stringify(arrived)}. Everything after this measures a ` +
      `navigation, and a click that did not navigate makes it vacuous.`,
  );
  ok(
    "pagereveal fires on the public navigation",
    reveal !== null,
    `no pagereveal record. The event fires on every document load, so its ` +
      `absence means the probe never attached rather than that the site is fine, ` +
      `and the assertion below would then be about nothing.`,
  );
  ok(
    "THE PUBLIC NAVIGATION RUNS NO VIEW TRANSITION",
    reveal !== null && reveal.hasTransition === false,
    `pagereveal on ${JSON.stringify(reveal?.path)} carried ${reveal?.hasTransition ? "an object" : "no record"}, ` +
      `expected null. An object means the document opted back into cross-document ` +
      `view transitions, and Chrome's default root crossfade then stacks both ` +
      `pages at partial opacity for about a quarter of a second on every click: ` +
      `measured 12 to 14 intermediate frames, 214-220 ms dark and 245-259 ms ` +
      `light. The one owner is @view-transition in app/styles/motion-print.css.`,
  );
}
