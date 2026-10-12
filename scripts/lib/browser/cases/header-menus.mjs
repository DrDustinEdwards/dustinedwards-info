/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, DRIVES_PREVIEW, FETCH_TIMEOUT_MS, menuUnrolled, ok, pollUntil, skip } from "../harness.mjs";

/*
 * The header's structured panels (app/components/site-header.tsx, app/enhance/header.ts): a disclosure
 * button per section, never role=menu. Click toggles aria-expanded (so do Enter and Space); hover opens at
 * once; a click right after hover keeps the panel open; leaving the bar and the panel closes it after the
 * grace (about 300ms); Escape closes and hands focus back to the button; a touch pointer opens by click
 * only. All five panels share one width (about 640px), are close to one height, stay in the viewport at
 * every width, meet the header, veil and inert the page, and a click on the veil closes without reaching
 * the page. A phone gets a full-bleed drawer of expandable groups with 44px rows and the band stacked.
 * Every link the panels render answers 200, and the spotlights point at pages that carry what they say.
 * On pages of its own, so no navigation here voids a later case on the shared page.
 */

const SECTIONS = ["research", "teaching", "software", "writing", "about"];
const PANEL = "#site-nav-research";
const BUTTON = 'button[aria-controls="site-nav-research"]';

/** The close grace in header.ts, and the most a hover-closed panel may take to go after it. */
const CLOSE_GRACE = 300;

/** @param {import("puppeteer").Page} page @param {string} id */
const stateOf = (page, id = "research") =>
  page.evaluate((id) => {
    const p = document.getElementById(`site-nav-${id}`);
    const b = document.querySelector(`button[aria-controls="site-nav-${id}"]`);
    return {
      open: p instanceof HTMLElement && p.matches(":popover-open"),
      expanded: b?.getAttribute("aria-expanded") ?? null,
      focusOnButton: document.activeElement === b,
      focusInPanel: Boolean(p && document.activeElement && p.contains(document.activeElement)),
    };
  }, id);

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/** @param {import("puppeteer").Page} page */
const anyInert = (page) =>
  page.evaluate(() => [...document.querySelectorAll("#main, .site-shell-footer")].some((el) => el.hasAttribute("inert")));

/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ browser }) {
  /* The server HTML, read off the wire: what a crawler and a reader without script both get. */
  const response = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const html = await response.text();
  const navHtml = html.match(/<nav[^>]*data-site-nav[^>]*>[^]*?<\/nav>/)?.[0] ?? "";
  const hrefs = [...new Set([...navHtml.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]))];
  ok(
    "the header nav is in the server HTML with every panel's links as anchors",
    ["/research", "/research/publications", "/research/protocols", "/teaching/virus-isolation", "/teaching#join-the-lab", "/software/capsid", "/systems", "/writing", "/writing/rss.xml", "/about", "/cv", "/dustin-edwards-cv.pdf"].every((href) => hrefs.includes(href)) &&
      !hrefs.some((href) => href.startsWith("/research/protocols/")) &&
      !hrefs.some((href) => href.startsWith("/interests/")) &&
      !navHtml.includes("Protocols: Lab methods and primer library"),
    `found ${hrefs.length} href(s) in the served nav: ${hrefs.join(", ") || "none"}. A panel link that ` +
      `only script renders is one no crawler and no reader without script can follow. Protocols is one ` +
      `Research entry, the library hub, not a primer page, and the old Interests pages are gone.`,
  );
  ok(
    "the served header carries no role=menu, menubar or menuitem",
    !/role="(menu|menubar|menuitem)"/.test(navHtml),
    "the panels are disclosures of links; menu roles promise arrow-key menus they do not have",
  );
  ok(
    "the Lab sign-in link is in the served header outside the nav",
    /<a [^>]*href="\/lab"[^>]*>Lab/.test(html) || /<a [^>]*data-lab-link[^>]*href="\/lab"/.test(html),
    "the lab workspace link must be on the bar at every width, beside Search",
  );

  /** @type {string[]} */
  const broken = [];
  for (const href of hrefs) {
    const url = new URL(href, BASE);
    if (url.origin !== new URL(BASE).origin) continue;
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    /* The CV's PDF is the one R2 object the Worker renders after a CV save (app/routes/cv-pdf.ts), and a
       preview's empty local bucket has none: there it must answer 404 from the route, never an error. On a
       deployed origin it must be a 200 like the rest. */
    if (DRIVES_PREVIEW && href === "/dustin-edwards-cv.pdf" && res.status === 404) continue;
    if (res.status !== 200) broken.push(`${href} ${res.status}`);
  }
  ok(
    `every one of the ${hrefs.length} header link(s) answers 200 on this build`,
    // The five panels serve about 70 links; fewer than 40 means a panel went missing, not a thin nav.
    hrefs.length >= 40 && broken.length === 0,
    broken.length > 0
      ? `${broken.join(", ")}. A panel link stays out until its page exists (app/lib/nav.ts isLive).`
      : `only ${hrefs.length} link(s) found, so the sweep examined too little to mean anything`,
  );

  /* The spotlights say what they point at: the page behind each carries the title shown. */
  const spots = [...html.matchAll(/<a [^>]*class="site-nav-spot"[^>]*>[^]*?<\/a>/g)].map((m) => ({
    href: m[0].match(/href="([^"]+)"/)?.[1] ?? "",
    title: (m[0].match(/class="site-nav-spot-title">([^<]*)</)?.[1] ?? "").replaceAll("&amp;", "&"),
  }));
  /** @type {string[]} */
  const unsaid = [];
  for (const spot of spots.filter((s) => s.href.startsWith("/research/publications/") || s.href.startsWith("/writing/"))) {
    const page = await (await fetch(new URL(spot.href, BASE), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })).text();
    /* The page's own main, never the whole document: the header, spotlight included, is on every page, so
       the whole document would carry the title whatever the page is about. */
    const main = (page.match(/<main[^>]*>[^]*<\/main>/)?.[0] ?? "").replaceAll("&amp;", "&").replaceAll("&#x27;", "'");
    if (!main.includes(spot.title)) unsaid.push(`${spot.href} does not carry "${spot.title}" in its main`);
  }
  ok(
    "the Latest paper and Newest spotlights point at pages that carry the title they show",
    spots.length === 5 && unsaid.length === 0,
    `${spots.length} spotlight(s) found; ${unsaid.join("; ") || "all matched"}`,
  );

  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/research/phages`, { waitUntil: "networkidle0" });

    const buttons = await page.evaluate(() =>
      [...document.querySelectorAll("[data-nav-button]")].map((c) => {
        const box = c.getBoundingClientRect();
        const target = document.getElementById(c.getAttribute("aria-controls") ?? "");
        return {
          tag: c.tagName,
          expanded: c.getAttribute("aria-expanded"),
          controls: Boolean(target),
          name: (c.textContent ?? "").trim(),
          size: [box.width, box.height],
        };
      }),
    );
    ok(
      "the bar has five section buttons, each with aria-expanded, aria-controls naming its panel, a name and a 24px target",
      buttons.length === 5 &&
        buttons.map((b) => b.name).join() === "Research,Teaching,Software,Writing,About" &&
        buttons.every((c) => c.tag === "BUTTON" && c.expanded === "false" && c.controls && c.size[0] >= 24 && c.size[1] >= 24),
      JSON.stringify(buttons),
    );

    const section = await page.evaluate((sel) => {
      const button = document.querySelector(sel);
      const label = button?.querySelector(".site-nav-button-label");
      return button && label
        ? { marked: button.hasAttribute("data-section"), current: button.getAttribute("aria-current"), line: getComputedStyle(label).textDecorationLine }
        : null;
    }, BUTTON);
    ok(
      "inside Research its button is marked as the current section, underlined, and not aria-current",
      section !== null && section.marked && section.line.includes("underline") && section.current === null,
      JSON.stringify(section),
    );

    const lab = await page.evaluate(() => {
      const link = document.querySelector("[data-lab-link]");
      const box = link?.getBoundingClientRect();
      return link && box ? { href: link.getAttribute("href"), shown: box.width > 0 && box.right <= document.documentElement.clientWidth, text: (link.textContent ?? "").trim() } : null;
    });
    ok(
      "Lab sign-in sits on the bar at 1280, visible, and goes to /lab",
      lab !== null && lab.href === "/lab" && lab.shown && lab.text === "Lab sign-in",
      JSON.stringify(lab),
    );

    /* Click toggles. With no hovering pointer this page is the touch case: a mouse that only moves over
       a button opens nothing, and the click is what opens it. */
    const touchLike = await page.evaluate(() => !window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    if (touchLike) {
      const box = await page.evaluate((sel) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      }, BUTTON);
      if (box) {
        await page.mouse.move(640, 880);
        await page.mouse.move(box.x, box.y, { steps: 4 });
        await sleep(100);
        const moved = await stateOf(page);
        await page.click(BUTTON);
        const tapped = await stateOf(page);
        await page.click(BUTTON);
        ok(
          "with no hovering pointer, moving over a button opens nothing and a click opens it (touch uses click only)",
          !moved.open && moved.expanded === "false" && tapped.open && tapped.expanded === "true",
          `after the move ${JSON.stringify(moved)}, after the click ${JSON.stringify(tapped)}`,
        );
      } else {
        ok("the Research button is laid out for the touch check", false, "no box");
      }
    } else {
      skip("a touch pointer opens by click only", "this browser reports a fine, hovering pointer already");
    }

    await page.click(BUTTON);
    const clicked = await stateOf(page);
    await page.click(BUTTON);
    const reclicked = await stateOf(page);
    ok(
      "a click on the button opens the panel with aria-expanded true, and a second click closes it with aria-expanded false",
      clicked.open && clicked.expanded === "true" && !reclicked.open && reclicked.expanded === "false",
      `after one click ${JSON.stringify(clicked)}, after two ${JSON.stringify(reclicked)}`,
    );

    await page.focus(BUTTON);
    await page.keyboard.press("Enter");
    const entered = await stateOf(page);
    await page.keyboard.press("Escape");
    const escaped = await stateOf(page);
    ok(
      "Enter opens the panel and Escape closes it with focus back on the button and aria-expanded false",
      entered.open && entered.expanded === "true" && !escaped.open && escaped.expanded === "false" && escaped.focusOnButton,
      `after Enter ${JSON.stringify(entered)}, after Escape ${JSON.stringify(escaped)}`,
    );

    await page.keyboard.press("Space");
    const spaced = await stateOf(page);
    await page.keyboard.press("Tab");
    const tabbed = await stateOf(page);
    await page.keyboard.press("Escape");
    const escapedInside = await stateOf(page);
    ok(
      "Space opens it, Tab moves into its links, and Escape from a link closes it back to the button",
      spaced.open && tabbed.focusInPanel && !escapedInside.open && escapedInside.focusOnButton,
      `after Space ${JSON.stringify(spaced)}, Tab ${JSON.stringify(tabbed)}, Escape ${JSON.stringify(escapedInside)}`,
    );

    /* The open card: hung from the header's foot with no gap (the hover path crosses that edge),
       inside the viewport, and the page under it inert and veiled while the header stays live. */
    await page.click(BUTTON);
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
      "an open panel meets the header's foot with no gap, has an edge on all four sides, and stays inside the viewport",
      card.top <= card.headerBottom &&
        card.top >= card.headerBottom - 2 &&
        card.edges.every((w) => parseFloat(w) >= 1) &&
        parseFloat(card.radius) > 0 &&
        card.left >= 0 &&
        card.right <= card.viewport,
      JSON.stringify(card),
    );
    ok(
      "while a panel is open, main and the footer are inert and the header is not",
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
      const after = await stateOf(page);
      const inertAfter = await anyInert(page);
      ok(
        "a click on the veil closes the panel and does not reach the link beneath it",
        target.veiled && !after.open && after.expanded === "false" && page.url() === before,
        `link ${target.href} at (${Math.round(target.x)}, ${Math.round(target.y)}), veil on top: ${target.veiled}, ` +
          `after the click ${JSON.stringify(after)}, url ${page.url()} (was ${before})`,
      );
      ok(
        "once the panel closes, main and the footer are no longer inert",
        !inertAfter,
        "inert left behind after the veil closed the panel would freeze the page",
      );
    } else {
      ok("a link sits on the page beside the open panel for the veil check", false, "none found in #main");
    }

    /* Every other way it closes clears inert too: the button again, and Escape. */
    await page.click(BUTTON);
    await page.click(BUTTON);
    const afterToggle = await anyInert(page);
    await page.click(BUTTON);
    await page.keyboard.press("Escape");
    await sleep(100);
    const afterEscape = await anyInert(page);
    ok(
      "closing by the button or by Escape leaves nothing inert",
      !afterToggle && !afterEscape,
      `inert after the button ${afterToggle}, after Escape ${afterEscape}`,
    );

    /* All five panels, one width and close to one height, at each desktop width: none clips its content
       sideways, each stays inside the viewport, and the widest case (About, at the right edge) is
       pushed back inside the inset. */
    /** @param {number} width */
    const measure = async (width) => {
      await page.setViewport({ width, height: 900 });
      return page.evaluate(async (ids) => {
        /** @type {Record<string, { width: number, height: number, left: number, right: number, clipped: boolean }>} */
        const out = {};
        for (const id of ids) {
          const button = /** @type {HTMLElement | null} */ (document.querySelector(`button[aria-controls="site-nav-${id}"]`));
          const p = /** @type {HTMLElement | null} */ (document.getElementById(`site-nav-${id}`));
          if (!button || !p) continue;
          button.click();
          const box = p.getBoundingClientRect();
          out[id] = { width: box.width, height: box.height, left: box.left, right: box.right, clipped: p.scrollWidth > p.clientWidth + 1 };
          button.click();
        }
        return out;
      }, SECTIONS);
    };
    const wide = await measure(1280);
    const widths = Object.values(wide).map((w) => w.width);
    const heights = Object.values(wide).map((w) => w.height);
    ok(
      "all five panels open at one width of about 640px, and none clips its content",
      Object.keys(wide).length === 5 &&
        widths.every((w) => Math.abs(w - widths[0]) < 0.5) &&
        Math.abs(widths[0] - 640) <= 1 &&
        Object.values(wide).every((w) => !w.clipped),
      JSON.stringify(wide),
    );
    ok(
      "all five panels are close to one height: the tallest is within 8 percent of the shortest",
      heights.length === 5 && Math.max(...heights) <= Math.min(...heights) * 1.08,
      `heights ${heights.map(Math.round).join(", ")} for ${Object.keys(wide).join(", ")}`,
    );
    /** @type {string[]} */
    const outside = [];
    for (const width of [1280, 1024, 900]) {
      const at = width === 1280 ? wide : await measure(width);
      for (const [id, w] of Object.entries(at)) {
        if (w.left < 0 || w.right > width) outside.push(`${id} at ${width}: ${Math.round(w.left)} to ${Math.round(w.right)}`);
      }
    }
    ok(
      "at 1280, 1024 and 900 wide (the narrowest wide layout) every panel stays within the viewport, clamped under its own button",
      outside.length === 0,
      outside.join("; ") || "all inside",
    );
    await page.setViewport({ width: 1280, height: 900 });

    /* 200% zoom on a 1800 screen: a 900x405 viewport, still the wide layout (it begins at 880px). The card
       stays inside the viewport and scrolls inside itself rather than running off the bottom. */
    await page.setViewport({ width: 900, height: 405 });
    await page.click(BUTTON);
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
      "at 200% zoom (900x405) the open panel stays inside the viewport and scrolls inside itself",
      zoomed.open &&
        zoomed.box[0] >= 0 &&
        zoomed.box[2] <= zoomed.viewport[0] &&
        zoomed.box[3] <= zoomed.viewport[1] &&
        zoomed.overflow === "auto",
      JSON.stringify(zoomed),
    );
    await page.setViewport({ width: 1280, height: 900 });

    /* Hover (app/enhance/header.ts): a button opens its panel the moment the pointer arrives, whole on
       that frame; a click right after keeps it open; a pointer crossing another button on its way down to
       the open panel keeps that panel (the safe triangle), and takes the crossed button's panel once it
       comes to rest there; a level move to another button takes over at once; the panel survives the
       trip from its button down into it; and leaving closes it after the grace (300ms). Every "at once"
       read below is taken with no wait after the move, so an intent timer or a grow would fail it. */
    const buttonsAt = await page.evaluate(() => {
      /** @param {string} id */
      const at = (id) => {
        const box = document.querySelector(`button[aria-controls="site-nav-${id}"]`)?.getBoundingClientRect();
        return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
      };
      return { research: at("research"), teaching: at("teaching") };
    });
    /* The header opens on hover only for a fine, hovering pointer (app/enhance/header.ts), and a
       headless Linux runner reports neither, which failed this check on every deploy from
       2026-09-27. Emulate a mouse through the protocol (Puppeteer's own helper refuses these two
       features); if the browser still does not match, the check is skipped, never passed. */
    const cdp = await page.createCDPSession();
    // A browser that already has a fine, hovering pointer needs no emulation, and emulating over it can undo it.
    const realHover = await page.evaluate(() => window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    if (!realHover) {
      await cdp.send("Emulation.setEmulatedMedia", {
        features: [
          { name: "hover", value: "hover" },
          { name: "pointer", value: "fine" },
        ],
      });
    }
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
      skip("hover opens, switches and closes the panels", "this browser reports no fine, hovering pointer even under emulation");
    } else if (buttonsAt.research && buttonsAt.teaching) {
      // From off the header, or the pointer left on the button by the clicks above is already inside.
      await page.mouse.move(640, 880);
      /* Timestamps taken inside the page: the pointer arriving, and the panel's toggle to open. */
      await page.evaluate(() => {
        const stamps = { enter: 0, open: 0 };
        Object.assign(window, { __navStamps: stamps });
        document.querySelector('button[aria-controls="site-nav-research"]')?.closest("li")?.addEventListener("pointerenter", () => {
          stamps.enter = stamps.enter || performance.now();
        });
        document.getElementById("site-nav-research")?.addEventListener("toggle", (event) => {
          if (/** @type {ToggleEvent} */ (event).newState === "open") stamps.open = stamps.open || performance.now();
        });
      });
      await page.mouse.move(buttonsAt.research.x, buttonsAt.research.y, { steps: 4 });
      const opened = await cardState("research");
      const stamps = await page.evaluate(() => /** @type {{ enter: number, open: number }} */ (Reflect.get(window, "__navStamps")));
      const delay = Math.round(stamps.open - stamps.enter);
      ok(
        "hover opens the panel at once, whole on the first read, with no intent wait and no grow",
        opened !== null && opened.open && opened.whole && stamps.enter > 0 && delay >= 0 && delay < 60,
        `${JSON.stringify(opened)}, pointerenter to open ${delay}ms (the page's own clock; a delay is more than 60)`,
      );

      /* Hover then click: the panel hover opened stays open, with aria-expanded true; the next click closes it. */
      await page.mouse.click(buttonsAt.research.x, buttonsAt.research.y);
      const kept = await stateOf(page);
      await page.mouse.click(buttonsAt.research.x, buttonsAt.research.y);
      await sleep(50);
      const toggledOff = await stateOf(page);
      ok(
        "a click right after hover keeps the panel open, and the next click closes it",
        kept.open && kept.expanded === "true" && !toggledOff.open && toggledOff.expanded === "false",
        `after hover and click ${JSON.stringify(kept)}, after the second click ${JSON.stringify(toggledOff)}`,
      );

      /* Hover opens it again; Escape (focus is nowhere near the panel) closes it and puts focus on the button. */
      await page.mouse.move(640, 880);
      await sleep(CLOSE_GRACE + 200);
      await page.mouse.move(buttonsAt.research.x, buttonsAt.research.y, { steps: 4 });
      /* Focus off the button first (the clicks above left it there), so the return is header.ts's own doing
         and not focus that never moved. */
      await page.evaluate(() => /** @type {HTMLElement | null} */ (document.activeElement)?.blur());
      const hoverOpen = await stateOf(page);
      await page.keyboard.press("Escape");
      const hoverEscaped = await stateOf(page);
      ok(
        "Escape after a hover returns focus to the button, closes the panel and sets aria-expanded false",
        hoverOpen.open && hoverOpen.expanded === "true" && !hoverOpen.focusOnButton && !hoverEscaped.open && hoverEscaped.expanded === "false" && hoverEscaped.focusOnButton,
        `after hover ${JSON.stringify(hoverOpen)}, after Escape ${JSON.stringify(hoverEscaped)}`,
      );

      /* The diagonal: from the top of the Research button, down and right across the foot of the Teaching
         button, into the right part of Research's panel. The line is solved backward from its end in the
         panel through a point low in Teaching's item, so the path really crosses Teaching. Every panel
         that opens on the way is counted, so a Teaching panel open for one frame fails it. */
      await page.mouse.move(640, 880);
      await sleep(CLOSE_GRACE + 200);
      await page.mouse.move(buttonsAt.research.x, buttonsAt.research.y, { steps: 4 });
      const path = await page.evaluate(() => {
        const research = document.querySelector('button[aria-controls="site-nav-research"]')?.getBoundingClientRect();
        const teaching = document.querySelector('button[aria-controls="site-nav-teaching"]')?.closest("[data-nav-menu]")?.getBoundingClientRect();
        const card = document.getElementById("site-nav-research")?.getBoundingClientRect();
        if (!research || !teaching || !card) return null;
        const sx = research.left + research.width / 2;
        for (let ex = card.right - 40; ex > teaching.right + 40; ex -= 20) {
          const end = { x: ex, y: card.top + 40 };
          const via = { x: teaching.left + teaching.width * 0.3, y: teaching.bottom - 3 };
          const slope = (end.y - via.y) / (end.x - via.x);
          const start = { x: sx, y: via.y + (sx - via.x) * slope };
          if (start.y >= research.top + 1 && start.y <= research.bottom - 1) return { start, via, end, card: card.top };
        }
        return null;
      });
      if (path) {
        await page.evaluate(() => {
          /** @type {string[]} */
          const opened = [];
          Object.assign(window, { __navOpened: opened });
          for (const p of document.querySelectorAll("[data-nav-panel]")) {
            p.addEventListener("toggle", (event) => {
              if (/** @type {ToggleEvent} */ (event).newState === "open") opened.push(p.id);
            });
          }
        });
        await page.mouse.move(path.start.x, path.start.y, { steps: 2 });
        await page.mouse.move(path.end.x, path.end.y, { steps: 40 });
        await sleep(300);
        const [kept, crossed] = [await cardState("research"), await cardState("teaching")];
        const opens = await page.evaluate(() => /** @type {string[]} */ (Reflect.get(window, "__navOpened")));
        ok(
          "a diagonal move from Research across the Teaching button into Research's panel keeps Research open and never opens Teaching",
          kept !== null && crossed !== null && kept.open && !crossed.open && opens.length === 0 &&
            path.end.x >= kept.box[0] && path.end.x <= kept.box[2] && path.end.y >= kept.box[1] && path.end.y <= kept.box[3],
          `path ${JSON.stringify(path)}, research ${JSON.stringify(kept)}, teaching ${JSON.stringify(crossed)}, ` +
            `panels opened on the way ${JSON.stringify(opens)}`,
        );

        /* The same line, stopped on the Teaching button: at rest, the crossed button takes the panel within
           one look (80ms). Back to the Research button first, inside its panel and up the button's strip. */
        await page.mouse.move(path.start.x, path.card + 30, { steps: 4 });
        await page.mouse.move(path.start.x, path.start.y, { steps: 4 });
        await page.mouse.move(path.via.x, path.via.y, { steps: 20 });
        await sleep(300);
        const [left, rested] = [await cardState("research"), await cardState("teaching")];
        ok(
          "a pointer that comes to rest on the button it was crossing opens that button's panel",
          left !== null && rested !== null && !left.open && rested.open,
          `pointer at (${Math.round(path.via.x)}, ${Math.round(path.via.y)}), research ${JSON.stringify(left)}, teaching ${JSON.stringify(rested)}`,
        );
      } else {
        ok("the header lays out a diagonal from Research across Teaching into Research's panel", false, JSON.stringify(buttonsAt));
      }

      /* Level along the header from Research to Teaching: outside the triangle, so it switches on the
         move itself, with no look and no wait. */
      await page.mouse.move(buttonsAt.research.x, buttonsAt.research.y, { steps: 4 });
      const back = await cardState("research");
      await page.mouse.move(buttonsAt.teaching.x, buttonsAt.teaching.y, { steps: 4 });
      const [from, to] = [await cardState("research"), await cardState("teaching")];
      ok(
        "moving level to another button switches panels at once: the new one open and whole, the old one shut",
        back !== null && back.open && from !== null && to !== null && !from.open && to.open && to.whole,
        `research before ${JSON.stringify(back)}, research after ${JSON.stringify(from)}, teaching ${JSON.stringify(to)}`,
      );

      /* Straight down off the button, across the header's foot, and into the panel: leaving the button
         starts the grace, and arriving in the panel ends it. Waiting well past the grace proves it did. */
      const into = to ? { x: buttonsAt.teaching.x, y: to.box[1] + 40 } : { x: buttonsAt.teaching.x, y: buttonsAt.teaching.y + 120 };
      await page.mouse.move(into.x, into.y, { steps: 8 });
      await sleep(CLOSE_GRACE + 250);
      const inside = await cardState("teaching");
      ok(
        "the panel stays open through the move from its button down into it, and after resting there past the grace",
        inside !== null && inside.open,
        `pointer at (${Math.round(into.x)}, ${Math.round(into.y)}), panel ${JSON.stringify(inside)}`,
      );

      /* Leaving both the bar and the panel: still open right after (the pointer is on its way), closed once
         the 300ms grace has run. */
      await page.mouse.move(640, 880, { steps: 4 });
      const right = await cardState("teaching");
      const started = performance.now();
      const gone = await pollUntil(() => cardState("teaching"), (c) => c !== null && !c.open, { tries: 20, everyMs: 50, sleepFirst: false });
      const took = Math.round(performance.now() - started);
      ok(
        "leaving the bar and the panel closes it after the grace, not before it",
        right !== null && right.open && gone !== null && !gone.open && took >= 150 && took <= CLOSE_GRACE + 450,
        `open straight after leaving: ${right?.open}; closed ${took}ms later (the grace is ${CLOSE_GRACE}ms), ${JSON.stringify(gone)}`,
      );
    } else {
      ok("the Research and Teaching buttons are laid out for the hover checks", false, JSON.stringify(buttonsAt));
    }

    // Back to the browser's own profile, so the phone checks below see a touch screen's media.
    await cdp.send("Emulation.setEmulatedMedia", { features: [] });
    await cdp.detach();

    const roles = await page.evaluate(() => document.querySelectorAll('[role="menu"], [role="menubar"], [role="menuitem"]').length);
    ok("no role=menu, menubar or menuitem after the enhancement ran", roles === 0, `${roles} found`);

    /* Phone: the drawer opens, each section is a group that expands in place with its tiles, rows,
       spotlight and quick links, rows are 44px, the two-column band stacks, and nothing opens by hover. */
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    await page.click("[data-header-menu]");
    const unrolled = await menuUnrolled(page);
    await page.click(BUTTON);
    const phone = await page.evaluate((panel, button) => {
      const p = /** @type {HTMLElement} */ (document.querySelector(panel));
      const rows = [...p.querySelectorAll("a")].map((a) => a.getBoundingClientRect().height);
      const list = p.querySelector(".site-nav-rows")?.getBoundingClientRect();
      const spot = p.querySelector(".site-nav-spot")?.getBoundingClientRect();
      const lab = document.querySelector("[data-lab-link]")?.getBoundingClientRect();
      return {
        menuOpen: /** @type {HTMLElement} */ (document.querySelector("[data-site-nav]")).matches(":popover-open"),
        menuExpanded: document.querySelector("[data-header-menu]")?.getAttribute("aria-expanded"),
        expanded: document.querySelector(button)?.getAttribute("aria-expanded"),
        shown: getComputedStyle(p).display !== "none",
        shortest: Math.min(...rows),
        links: rows.length,
        stacked: Boolean(list && spot && spot.top >= list.bottom - 1),
        parts: ["site-nav-tiles", "site-nav-rows", "site-nav-spot", "site-nav-foot"].map((c) => Boolean(p.querySelector(`.${c}`))),
        labShown: Boolean(lab && lab.width > 0 && lab.left >= 0 && lab.right <= document.documentElement.clientWidth),
      };
    }, PANEL, BUTTON);
    await page.click(BUTTON);
    const collapsed = await page.evaluate((button) => document.querySelector(button)?.getAttribute("aria-expanded"), BUTTON);
    ok(
      "on a phone the Menu opens, a section button expands its group with rows at least 44px, and collapses it again",
      unrolled && phone.menuOpen && phone.menuExpanded === "true" && phone.expanded === "true" && phone.shown && phone.shortest >= 44 && collapsed === "false",
      `${JSON.stringify({ unrolled, ...phone })}, then aria-expanded ${collapsed}`,
    );
    ok(
      "on a phone a group holds the same parts as the wide panel, the two-column band stacks, and Lab sign-in stays on the bar",
      phone.links >= 10 && phone.parts.every(Boolean) && phone.stacked && phone.labShown,
      JSON.stringify(phone),
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
    await page.click(BUTTON);
    const small = await sheet();
    await page.click("[data-header-menu]");
    await sleep(300);
    const closedInert = await anyInert(page);
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

    /* The bar fits on one line at every width, on both sides of the 55rem breakpoint: the wide layout
       wanted 867px when Lab sign-in joined it, so it is the Menu below 880px. */
    /** @type {string[]} */
    const cramped = [];
    for (const width of [320, 360, 390, 704, 800, 879, 880, 1024]) {
      await page.setViewport({ width, height: 800 });
      await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
      const fit = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        height: Math.round(document.querySelector("[data-site-header]")?.getBoundingClientRect().height ?? 0),
      }));
      if (fit.scroll > fit.client || fit.height > 84) cramped.push(`${width}: ${JSON.stringify(fit)}`);
    }
    ok(
      "the header fits on one line with no sideways scroll at 320, 360, 390, 704, 800, 879, 880 and 1024 wide",
      cramped.length === 0,
      cramped.join("; ") || "all fit",
    );
  } finally {
    await page.close();
  }

  /* No script: the button is still a working popover invoker, and what it opens is links. */
  const noScript = await browser.newPage();
  try {
    await noScript.setJavaScriptEnabled(false);
    await noScript.setViewport({ width: 1280, height: 900 });
    await noScript.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    await noScript.click(BUTTON);
    const opened = await stateOf(noScript);
    ok(
      "with no script the section button still opens its panel",
      opened.open,
      "popovertarget is what makes the panel open without the enhancement; a panel that needs script is not the fallback",
    );
  } finally {
    await noScript.close();
  }
}
