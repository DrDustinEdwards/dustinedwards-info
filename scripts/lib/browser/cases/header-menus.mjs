/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, FETCH_TIMEOUT_MS, menuUnrolled, ok, pollUntil, skip } from "../harness.mjs";

/*
 * The header's mega menus (app/components/site-header.tsx, app/enhance/header.ts): a disclosure
 * button per menu, never role=menu; the chevron toggles aria-expanded by click, Enter and Space;
 * Escape closes and hands focus back to the chevron; hover content stays hoverable; a phone gets 44px
 * rows; and every link the menus render answers 200. On pages of its own, so
 * no navigation here voids a later case on the shared page.
 */

const PANEL = "#site-nav-research";
const CHEVRON = '[aria-controls="site-nav-research"]';

/** @param {import("puppeteer").Page} page */
const state = (page) =>
  page.evaluate(
    (panel, chevron) => {
      const p = document.querySelector(panel);
      const c = document.querySelector(chevron);
      return {
        open: p instanceof HTMLElement && p.matches(":popover-open"),
        expanded: c?.getAttribute("aria-expanded") ?? null,
        focusOnChevron: document.activeElement === c,
        focusInPanel: Boolean(p && document.activeElement && p.contains(document.activeElement)),
      };
    },
    PANEL,
    CHEVRON,
  );

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ browser }) {
  /* The server HTML, read off the wire: what a crawler and a reader without script both get. */
  const response = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const html = await response.text();
  const navHtml = html.match(/<nav[^>]*data-site-nav[^>]*>[^]*?<\/nav>/)?.[0] ?? "";
  const hrefs = [...new Set([...navHtml.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]))];
  ok(
    "the header nav is in the server HTML with its menu links as anchors",
    hrefs.includes("/research") && hrefs.includes("/research/protocols") && hrefs.includes("/teaching/virus-isolation"),
    `found ${hrefs.length} href(s) in the served nav: ${hrefs.join(", ") || "none"}. A menu link that ` +
      `only script renders is one no crawler and no reader without script can follow.`,
  );
  ok(
    "the served header carries no role=menu, menubar or menuitem",
    !/role="(menu|menubar|menuitem)"/.test(navHtml),
    "the menus are disclosures of links; menu roles promise arrow-key menus they do not have",
  );

  /** @type {string[]} */
  const broken = [];
  for (const href of hrefs) {
    const url = new URL(href, BASE);
    if (url.origin !== new URL(BASE).origin) continue;
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status !== 200) broken.push(`${href} ${res.status}`);
  }
  ok(
    `every one of the ${hrefs.length} header link(s) answers 200 on this build`,
    // The header since #229 serves 18 links; fewer than 15 means a menu went missing, not a thin nav.
    hrefs.length >= 15 && broken.length === 0,
    broken.length > 0
      ? `${broken.join(", ")}. A menu item stays out until its page exists (app/lib/nav.ts isLive).`
      : `only ${hrefs.length} link(s) found, so the sweep examined too little to mean anything`,
  );

  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/research/phages`, { waitUntil: "networkidle0" });

    const chevrons = await page.evaluate(() =>
      [...document.querySelectorAll("[data-nav-chevron]")].map((c) => {
        const box = c.getBoundingClientRect();
        const target = document.getElementById(c.getAttribute("aria-controls") ?? "");
        return {
          tag: c.tagName,
          expanded: c.getAttribute("aria-expanded"),
          controls: Boolean(target),
          name: c.getAttribute("aria-label"),
          size: [box.width, box.height],
        };
      }),
    );
    ok(
      "each chevron is a button with aria-expanded, aria-controls naming its panel, a name and a 24px target",
      chevrons.length >= 2 &&
        chevrons.every(
          (c) => c.tag === "BUTTON" && c.expanded === "false" && c.controls && c.name && c.size[0] >= 24 && c.size[1] >= 24,
        ),
      JSON.stringify(chevrons),
    );

    const section = await page.evaluate(() => {
      const word = document.querySelector('.site-nav-word[href="/research"]');
      return word
        ? { marked: word.hasAttribute("data-section"), current: word.getAttribute("aria-current"), line: getComputedStyle(word).textDecorationLine }
        : null;
    });
    ok(
      "inside Research the word is marked as the current section, underlined, and not aria-current",
      section !== null && section.marked && section.line.includes("underline") && section.current === null,
      JSON.stringify(section),
    );

    await page.click(CHEVRON);
    const clicked = await state(page);
    await page.click(CHEVRON);
    const reclicked = await state(page);
    ok(
      "a click on the chevron opens the panel with aria-expanded true, and a second click closes it",
      clicked.open && clicked.expanded === "true" && !reclicked.open && reclicked.expanded === "false",
      `after one click ${JSON.stringify(clicked)}, after two ${JSON.stringify(reclicked)}`,
    );

    await page.focus(CHEVRON);
    await page.keyboard.press("Enter");
    const entered = await state(page);
    await page.keyboard.press("Escape");
    const escaped = await state(page);
    ok(
      "Enter opens the panel and Escape closes it with focus back on the chevron",
      entered.open && entered.expanded === "true" && !escaped.open && escaped.expanded === "false" && escaped.focusOnChevron,
      `after Enter ${JSON.stringify(entered)}, after Escape ${JSON.stringify(escaped)}`,
    );

    await page.keyboard.press("Space");
    const spaced = await state(page);
    await page.keyboard.press("Tab");
    const tabbed = await state(page);
    await page.keyboard.press("Escape");
    const escapedInside = await state(page);
    ok(
      "Space opens it, Tab moves into its links, and Escape from a link closes it back to the chevron",
      spaced.open && tabbed.focusInPanel && !escapedInside.open && escapedInside.focusOnChevron,
      `after Space ${JSON.stringify(spaced)}, Tab ${JSON.stringify(tabbed)}, Escape ${JSON.stringify(escapedInside)}`,
    );

    /* Hover content stays hoverable (WCAG 1.4.13): open on the way to and inside the panel. The
       opening delay is a design default and is not asserted. */
    const word = await page.evaluate(() => {
      const box = document.querySelector('.site-nav-word[href="/research"]')?.getBoundingClientRect();
      return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
    });
    /* The header opens on hover only for a fine, hovering pointer (app/enhance/header.ts), and a
       headless Linux runner reports neither, which failed this check on every deploy from
       2026-09-27. Emulate a mouse through the protocol (Puppeteer's own helper refuses these two
       features); if the browser still does not match, the check is skipped, never passed. */
    const cdp = await page.createCDPSession();
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "hover", value: "hover" },
        { name: "pointer", value: "fine" },
      ],
    });
    await page.reload({ waitUntil: "networkidle0" });
    const canHover = await page.evaluate(() => window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    if (!canHover) {
      skip("hover opens the panel", "this browser reports no fine, hovering pointer even under emulation");
    } else if (word) {
      // From off the header, or the pointer left on the chevron by the clicks above is already inside.
      await page.mouse.move(640, 880);
      await page.mouse.move(word.x, word.y, { steps: 4 });
      const late = await pollUntil(() => state(page), (s) => s.open, { tries: 10, everyMs: 150 });
      await page.mouse.move(word.x + 120, word.y + 90, { steps: 6 });
      await sleep(200);
      await page.mouse.move(word.x + 160, word.y + 220, { steps: 6 });
      await sleep(700);
      const inside = await state(page);
      await page.mouse.move(640, 880, { steps: 4 });
      const gone = await pollUntil(() => state(page), (s) => !s.open, { tries: 10, everyMs: 150 });
      ok(
        "hover opens the panel, keeps it open on the way down into it, and closes it after leaving",
        late.open && inside.open && !gone.open,
        `later ${JSON.stringify(late)}, inside ${JSON.stringify(inside)}, ` +
          `after leaving ${JSON.stringify(gone)}`,
      );
    } else {
      ok("the Research word is laid out for the hover check", false, "no .site-nav-word for /research");
    }

    // Back to the browser's own profile, so the phone checks below see a touch screen's media.
    await cdp.send("Emulation.setEmulatedMedia", { features: [] });
    await cdp.detach();

    const roles = await page.evaluate(() => document.querySelectorAll('[role="menu"], [role="menubar"], [role="menuitem"]').length);
    ok("no role=menu, menubar or menuitem after the enhancement ran", roles === 0, `${roles} found`);

    /* Phone: the section opens, shows, and has 44px touch targets. Whether it expands in place or as
       a popover is a design default and is not asserted. */
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    await page.click("[data-header-menu]");
    const unrolled = await menuUnrolled(page);
    await page.click(CHEVRON);
    const phone = await page.evaluate((panel, chevron) => {
      const p = /** @type {HTMLElement} */ (document.querySelector(panel));
      const rows = [...p.querySelectorAll("a")].map((a) => a.getBoundingClientRect().height);
      return {
        menuOpen: /** @type {HTMLElement} */ (document.querySelector("[data-site-nav]")).matches(":popover-open"),
        menuExpanded: document.querySelector("[data-header-menu]")?.getAttribute("aria-expanded"),
        expanded: document.querySelector(chevron)?.getAttribute("aria-expanded"),
        shown: getComputedStyle(p).display !== "none",
        shortest: Math.min(...rows),
      };
    }, PANEL, CHEVRON);
    await page.click(CHEVRON);
    const collapsed = await page.evaluate((chevron) => document.querySelector(chevron)?.getAttribute("aria-expanded"), CHEVRON);
    ok(
      "on a phone the Menu opens, a chevron shows its section with rows at least 44px, and collapses it again",
      unrolled && phone.menuOpen && phone.menuExpanded === "true" && phone.expanded === "true" && phone.shown && phone.shortest >= 44 && collapsed === "false",
      `${JSON.stringify({ unrolled, ...phone })}, then aria-expanded ${collapsed}`,
    );
  } finally {
    await page.close();
  }

  /* No script: the chevron is still a working popover invoker, and what it opens is links. */
  const noScript = await browser.newPage();
  try {
    await noScript.setJavaScriptEnabled(false);
    await noScript.setViewport({ width: 1280, height: 900 });
    await noScript.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    await noScript.click(CHEVRON);
    const opened = await state(noScript);
    ok(
      "with no script the chevron still opens its panel",
      opened.open,
      "popovertarget is what makes the panel open without the enhancement; a panel that needs script is not the fallback",
    );
  } finally {
    await noScript.close();
  }
}
