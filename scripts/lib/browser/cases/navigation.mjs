/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, ok, pollUntil } from "../harness.mjs";

/*
 * Cross-document view transitions are on (motion-print.css, type `site`). `pagereveal` must
 * fire either way, or an unattached listener would pass. Reduced motion opts out with
 * navigation: none, which this case checks on a second click after the media feature is set.
 */
/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ browser }) {
  const context = await browser.createBrowserContext();
  const probe = await context.newPage();

  /** @type {Array<{ path: string, hasTransition: boolean, types: string }>} */
  const reveals = [];
  await probe.exposeFunction(
    "__checkBrowserReveal",
    /** @param {string} path @param {boolean} hasTransition @param {string} types */
    (path, hasTransition, types) => {
      reveals.push({ path, hasTransition, types });
    },
  );
  await probe.evaluateOnNewDocument(() => {
    addEventListener("pagereveal", (event) => {
      const vt = event.viewTransition;
      let types = "";
      if (vt && vt.types && typeof vt.types[Symbol.iterator] === "function") {
        types = [...vt.types].join(" ");
      }
      /** @type {any} */ (window).__checkBrowserReveal(location.pathname, Boolean(vt), types);
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
  /** @param {string} href */
  const openTarget = async (href) => {
    const read = () =>
      probe.evaluate((path) => {
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
        const bar = pick(`.site-header-nav a[href="${path}"]`);
        if (bar) return { ...bar, via: "the header nav" };
        const menu = pick(`.site-shell-menu a[href="${path}"]`);
        return menu ? { ...menu, via: "the overflow menu" } : null;
      }, href);

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

  /**
   * @param {string} href
   * @returns {Promise<{ arrived: string, reveal: { path: string, hasTransition: boolean, types: string } | null }>}
   */
  const clickNav = async (href) => {
    const target = await openTarget(href);
    if (!target) return { arrived: "", reveal: null };
    console.log(`  (the navigation case clicked ${href} via ${target.via})`);
    reveals.length = 0;
    await probe.mouse.move(target.x, target.y);
    await new Promise((r) => setTimeout(r, 350));
    await probe.mouse.click(target.x, target.y);
    const arrived = await pollUntil(
      () => probe.evaluate(() => location.pathname).catch(() => ""),
      (path) => path === href,
      { everyMs: 150, sleepFirst: false },
    );
    /* The event fires on the incoming document, so give it a moment to land. */
    for (let i = 0; i < 6 && !reveals.some((r) => r.path === href); i += 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const reveal = reveals.find((r) => r.path === href) ?? reveals[reveals.length - 1] ?? null;
    return { arrived, reveal };
  };

  const writingTarget = await openTarget("/writing");
  const clickable = writingTarget !== null;
  ok(
    "the header carries a laid-out /writing link for the navigation case to click",
    clickable,
    'neither `.site-header-nav a[href="/writing"]` nor `.site-shell-menu a[href="/writing"]` ' +
      "is present with a non-zero box, even with the overflow disclosure opened. A " +
      "hidden link puts the click at the document corner and the navigation " +
      "assertions below then measure nothing, which is how one breakpoint read as " +
      "three unrelated failures.",
  );

  let arrived = "";
  /** @type {{ path: string, hasTransition: boolean, types: string } | null} */
  let reveal = null;
  if (clickable) {
    const first = await clickNav("/writing");
    arrived = first.arrived;
    reveal = first.reveal;
  }

  let reducedArrived = "";
  /** @type {{ path: string, hasTransition: boolean, types: string } | null} */
  let reducedReveal = null;
  if (arrived === "/writing") {
    /* Reload under the feature so BOTH documents opt out. A live media change on the
       outgoing page is not what the at-rule was parsed with. */
    await probe.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    reveals.length = 0;
    await probe.goto(`${BASE}/writing`, { waitUntil: "networkidle0" });
    for (let i = 0; i < 6 && !reveals.some((r) => r.path === "/writing"); i += 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const second = await clickNav("/about");
    reducedArrived = second.arrived;
    reducedReveal = second.reveal;
  }
  await context.close();

  ok(
    "the header click reaches /writing, so the navigation below was real",
    arrived === "/writing",
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
    "the public navigation runs a type-site view transition",
    reveal !== null && reveal.hasTransition === true && reveal.types.split(" ").includes("site"),
    `pagereveal on ${JSON.stringify(reveal?.path)} carried ` +
      `${reveal?.hasTransition ? `types ${JSON.stringify(reveal.types)}` : "no view transition"}. ` +
      `Expected a view transition whose types include "site". Missing means cross-document ` +
      `transitions are off again. Present without "site" means the UA root crossfade is back: ` +
      `plus-lighter stacks both pages for about a quarter of a second. The owner is ` +
      `@view-transition in app/styles/motion-print.css.`,
  );
  ok(
    "the reduced-motion navigation reaches /about, so the opt-out below was real",
    reducedArrived === "/about",
    `landed on ${JSON.stringify(reducedArrived)} after prefers-reduced-motion: reduce. ` +
      `A click that did not navigate makes the opt-out assertion vacuous.`,
  );
  ok(
    "prefers-reduced-motion turns the page view transition off",
    reducedReveal !== null && reducedReveal.hasTransition === false,
    `pagereveal on ${JSON.stringify(reducedReveal?.path)} carried ` +
      `${reducedReveal?.hasTransition ? "a view transition" : "no record"}. Expected null. ` +
      `The duration kill on * does not reach ::view-transition pseudos, so navigation: none ` +
      `under reduced motion is the off switch. Owner: app/styles/motion-print.css.`,
  );
}
