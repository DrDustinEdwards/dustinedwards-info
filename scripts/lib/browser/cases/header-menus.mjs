/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, FETCH_TIMEOUT_MS, menuUnrolled, ok, pollUntil, skip } from "../harness.mjs";

/*
 * The header's mega menus (app/components/site-header.tsx, app/enhance/header.ts): a disclosure
 * button per menu, never role=menu; the chevron toggles aria-expanded by click, Enter and Space;
 * Escape closes and hands focus back to the chevron; hover content stays hoverable; an open card meets
 * the header, stays in the viewport (at 200% zoom too), veils and inerts the page, and a click on the
 * veil closes it without reaching the page; Teaching, Software and About share one width; a phone gets
 * a full-bleed sheet with 44px rows; and every link the menus render answers 200. On pages of its own, so
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
    hrefs.includes("/research") &&
      hrefs.includes("/research/protocols") &&
      !hrefs.some((href) => href.startsWith("/research/protocols/")) &&
      hrefs.includes("/teaching/virus-isolation") &&
      navHtml.includes("Protocols: Lab methods and primer library"),
    `found ${hrefs.length} href(s) in the served nav: ${hrefs.join(", ") || "none"}. A menu link that ` +
      `only script renders is one no crawler and no reader without script can follow. Protocols is one ` +
      `Research entry, the hub, not a primer page.`,
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

    /* The open card: hung from the header's foot with no gap (the hover path crosses that edge),
       inside the viewport, and the page under it inert and veiled while the header stays live. */
    await page.click(CHEVRON);
    const card = await page.evaluate((panel) => {
      const p = /** @type {HTMLElement} */ (document.querySelector(panel));
      const box = p.getBoundingClientRect();
      const header = document.querySelector("[data-site-header]")?.getBoundingClientRect();
      const style = getComputedStyle(p);
      return {
        top: box.top,
        headerBottom: header?.bottom ?? -1,
        left: box.left,
        right: box.right,
        width: box.width,
        viewport: document.documentElement.clientWidth,
        edges: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        radius: style.borderTopLeftRadius,
        inert: [...document.querySelectorAll("#main, .site-shell-footer")].map((el) => el.hasAttribute("inert")),
        headerInert: Boolean(document.querySelector("[data-site-header]")?.closest("[inert]")),
      };
    }, PANEL);
    ok(
      "an open card meets the header's foot with no gap, has an edge on all four sides, and stays inside the viewport",
      card.top <= card.headerBottom &&
        card.top >= card.headerBottom - 2 &&
        card.edges.every((w) => parseFloat(w) >= 1) &&
        parseFloat(card.radius) > 0 &&
        card.left >= 0 &&
        card.right <= card.viewport,
      JSON.stringify(card),
    );
    ok(
      "while a card is open, main and the footer are inert and the header is not",
      card.inert.length >= 1 && card.inert.every(Boolean) && !card.headerInert,
      `inert per region ${JSON.stringify(card.inert)}, header inside an inert region: ${card.headerInert}`,
    );

    /* A point on the page, off the card, where a real link sits: the veil must take the click. */
    const target = await page.evaluate((panel) => {
      const p = /** @type {HTMLElement} */ (document.querySelector(panel)).getBoundingClientRect();
      const floor = document.querySelector("[data-site-header]")?.getBoundingClientRect().bottom ?? 0;
      for (const a of document.querySelectorAll("#main a[href]")) {
        const box = a.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        const onCard = x >= p.left && x <= p.right && y >= p.top && y <= p.bottom;
        if (box.width > 0 && y > floor + 4 && y < window.innerHeight - 4 && !onCard) {
          const hit = document.elementFromPoint(x, y);
          return { x, y, href: a.getAttribute("href"), veiled: Boolean(hit?.closest("[data-nav-veil]")) };
        }
      }
      return null;
    }, PANEL);
    if (target) {
      const before = page.url();
      await page.mouse.click(target.x, target.y);
      await sleep(400);
      const after = await state(page);
      const inertAfter = await page.evaluate(() =>
        [...document.querySelectorAll("#main, .site-shell-footer")].some((el) => el.hasAttribute("inert")),
      );
      ok(
        "a click on the veil closes the card and does not reach the link beneath it",
        target.veiled && !after.open && after.expanded === "false" && page.url() === before,
        `link ${target.href} at (${Math.round(target.x)}, ${Math.round(target.y)}), veil on top: ${target.veiled}, ` +
          `after the click ${JSON.stringify(after)}, url ${page.url()} (was ${before})`,
      );
      ok(
        "once the card closes, main and the footer are no longer inert",
        !inertAfter,
        "inert left behind after the veil closed the card would freeze the page",
      );
    } else {
      ok("a link sits on the page beside the open card for the veil check", false, "none found in #main");
    }

    /* Every other way it closes clears inert too: the chevron again, and Escape. */
    await page.click(CHEVRON);
    await page.click(CHEVRON);
    const afterToggle = await page.evaluate(() =>
      [...document.querySelectorAll("#main, .site-shell-footer")].some((el) => el.hasAttribute("inert")),
    );
    await page.click(CHEVRON);
    await page.keyboard.press("Escape");
    await sleep(100);
    const afterEscape = await page.evaluate(() =>
      [...document.querySelectorAll("#main, .site-shell-footer")].some((el) => el.hasAttribute("inert")),
    );
    ok(
      "closing by the chevron or by Escape leaves nothing inert",
      !afterToggle && !afterEscape,
      `inert after the chevron ${afterToggle}, after Escape ${afterEscape}`,
    );

    /* Teaching, Software and About share one width, so moving among them never resizes the card;
       Research is wider. No card cuts its content off sideways. */
    const widths = await page.evaluate(async () => {
      /** @type {Record<string, { width: number, clipped: boolean }>} */
      const out = {};
      for (const id of ["research", "teaching", "software", "about"]) {
        const chevron = /** @type {HTMLElement | null} */ (document.querySelector(`[aria-controls="site-nav-${id}"]`));
        const p = /** @type {HTMLElement | null} */ (document.getElementById(`site-nav-${id}`));
        if (!chevron || !p) continue;
        chevron.click();
        out[id] = { width: p.getBoundingClientRect().width, clipped: p.scrollWidth > p.clientWidth + 1 };
        chevron.click();
      }
      return out;
    });
    const narrow = ["teaching", "software", "about"].map((id) => widths[id]?.width);
    ok(
      "Teaching, Software and About open at one shared width, narrower than Research, and none clips its content",
      narrow.every((w) => typeof w === "number" && Math.abs(w - narrow[0]) < 0.5) &&
        typeof widths.research?.width === "number" &&
        widths.research.width > narrow[0] &&
        Object.values(widths).every((w) => !w.clipped),
      JSON.stringify(widths),
    );

    /* 200% zoom on a 1440 screen: a 720x405 viewport, still the wide layout. The card stays inside the
       viewport and scrolls inside itself rather than running off the bottom. */
    await page.setViewport({ width: 720, height: 405 });
    await page.click(CHEVRON);
    const zoomed = await page.evaluate((panel) => {
      const p = /** @type {HTMLElement} */ (document.querySelector(panel));
      const box = p.getBoundingClientRect();
      return {
        open: p.matches(":popover-open"),
        box: [box.left, box.top, box.right, box.bottom].map(Math.round),
        viewport: [document.documentElement.clientWidth, window.innerHeight],
        overflow: getComputedStyle(p).overflowY,
        scrolls: p.scrollHeight > p.clientHeight,
      };
    }, PANEL);
    await page.keyboard.press("Escape");
    ok(
      "at 200% zoom (720x405) the open card stays inside the viewport and scrolls inside itself",
      zoomed.open &&
        zoomed.box[0] >= 0 &&
        zoomed.box[2] <= zoomed.viewport[0] &&
        zoomed.box[3] <= zoomed.viewport[1] &&
        zoomed.overflow === "auto",
      JSON.stringify(zoomed),
    );
    await page.setViewport({ width: 1280, height: 900 });

    /* Hover (app/enhance/header.ts): a word opens its card the moment the pointer arrives, whole on
       that frame; another word takes over at once; the card survives the trip from its word down into
       it; and leaving closes it once the close grace (150ms) runs out. Every "at once" read below is
       taken with no wait after the move, so an intent timer or a grow would fail it. */
    const words = await page.evaluate(() => {
      /** @param {string} href */
      const at = (href) => {
        const box = document.querySelector(`.site-nav-word[href="${href}"]`)?.getBoundingClientRect();
        return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
      };
      return { research: at("/research"), teaching: at("/teaching") };
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
    /** @param {string} id */
    const cardState = (id) =>
      page.evaluate((id) => {
        const p = /** @type {HTMLElement | null} */ (document.getElementById(`site-nav-${id}`));
        if (!p) return null;
        const box = p.getBoundingClientRect();
        return {
          open: p.matches(":popover-open"),
          // Whole: its full height and full opacity already, nothing inline mid-animation.
          whole: box.height > 40 && box.height >= p.clientHeight && getComputedStyle(p).opacity === "1" && !p.style.height,
          box: [box.left, box.top, box.right, box.bottom].map(Math.round),
        };
      }, id);
    if (!canHover) {
      skip("hover opens, switches and closes the cards", "this browser reports no fine, hovering pointer even under emulation");
    } else if (words.research && words.teaching) {
      // From off the header, or the pointer left on the chevron by the clicks above is already inside.
      await page.mouse.move(640, 880);
      await page.mouse.move(words.research.x, words.research.y, { steps: 4 });
      const opened = await cardState("research");
      ok(
        "hover opens the card at once, whole on the first read, with no intent wait and no grow",
        opened !== null && opened.open && opened.whole,
        JSON.stringify(opened),
      );

      await page.mouse.move(words.teaching.x, words.teaching.y, { steps: 4 });
      const [from, to] = [await cardState("research"), await cardState("teaching")];
      ok(
        "moving to another word switches cards at once: the new one open and whole, the old one shut",
        from !== null && to !== null && !from.open && to.open && to.whole,
        `research ${JSON.stringify(from)}, teaching ${JSON.stringify(to)}`,
      );

      /* Straight down off the word, across the header's foot, and into the card: leaving the word
         starts the grace, and arriving in the card ends it. Waiting well past the grace proves it did. */
      const into = to ? { x: words.teaching.x, y: to.box[1] + 40 } : { x: words.teaching.x, y: words.teaching.y + 120 };
      await page.mouse.move(into.x, into.y, { steps: 8 });
      await sleep(450);
      const inside = await cardState("teaching");
      ok(
        "the card stays open through the move from its word down into it, and after resting there past the grace",
        inside !== null && inside.open,
        `pointer at (${Math.round(into.x)}, ${Math.round(into.y)}), card ${JSON.stringify(inside)}`,
      );

      await page.mouse.move(640, 880, { steps: 4 });
      const started = performance.now();
      const gone = await pollUntil(() => cardState("teaching"), (c) => c !== null && !c.open, { tries: 12, everyMs: 50 });
      const took = Math.round(performance.now() - started);
      ok(
        "leaving the card closes it once the short close grace runs out",
        gone !== null && !gone.open,
        `still ${JSON.stringify(gone)} ${took}ms after leaving; the grace is 150ms`,
      );
    } else {
      ok("the Research and Teaching words are laid out for the hover checks", false, JSON.stringify(words));
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

    /* The open Menu is a sheet: full bleed from the header's foot to the bottom, opaque, square, the
       Menu button still on screen above it, and the page under it inert. */
    const sheet = () =>
      page.evaluate(() => {
        const nav = /** @type {HTMLElement} */ (document.querySelector("[data-site-nav]"));
        const box = nav.getBoundingClientRect();
        const header = document.querySelector("[data-site-header]")?.getBoundingClientRect();
        const button = document.querySelector("[data-header-menu]")?.getBoundingClientRect();
        const style = getComputedStyle(nav);
        const channels = style.backgroundColor.match(/[\d.]+/g) ?? [];
        return {
          box: [box.left, box.top, box.right, box.bottom].map(Math.round),
          viewport: [document.documentElement.clientWidth, window.innerHeight],
          headerBottom: Math.round(header?.bottom ?? -1),
          buttonShown: Boolean(button && button.top >= 0 && button.bottom <= (header?.bottom ?? 0) && button.width > 0),
          // rgb() has three channels; a fourth is alpha.
          opaque: channels.length === 3 || (channels.length === 4 && Number(channels[3]) === 1),
          radius: style.borderTopLeftRadius,
          overflow: style.overflowY,
          scrolls: nav.scrollHeight > nav.clientHeight,
          inert: [...document.querySelectorAll("#main, .site-shell-footer")].map((el) => el.hasAttribute("inert")),
        };
      });
    const phoneSheet = await sheet();
    ok(
      "on a phone the open Menu is a full-bleed, opaque, square sheet under the header, the Menu button visible and the page inert",
      phoneSheet.box[0] === 0 &&
        phoneSheet.box[2] === phoneSheet.viewport[0] &&
        Math.abs(phoneSheet.box[1] - phoneSheet.headerBottom) <= 1 &&
        phoneSheet.box[3] === phoneSheet.viewport[1] &&
        phoneSheet.opaque &&
        parseFloat(phoneSheet.radius) === 0 &&
        phoneSheet.buttonShown &&
        phoneSheet.inert.length >= 1 &&
        phoneSheet.inert.every(Boolean),
      JSON.stringify(phoneSheet),
    );

    /* 200% zoom on a 1280 screen is 640x360: the Menu layout, and its sheet scrolls inside. */
    await page.setViewport({ width: 640, height: 360 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    await page.click("[data-header-menu]");
    await menuUnrolled(page);
    await page.click(CHEVRON);
    const small = await sheet();
    await page.click("[data-header-menu]");
    await sleep(300);
    const closedInert = await page.evaluate(() =>
      [...document.querySelectorAll("#main, .site-shell-footer")].some((el) => el.hasAttribute("inert")),
    );
    ok(
      "at 200% zoom (640x360) the open Menu stays inside the viewport and scrolls inside, and closing it clears inert",
      small.box[0] >= 0 &&
        small.box[2] <= small.viewport[0] &&
        small.box[3] <= small.viewport[1] &&
        small.overflow === "auto" &&
        small.scrolls &&
        !closedInert,
      `${JSON.stringify(small)}, inert after closing ${closedInert}`,
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
