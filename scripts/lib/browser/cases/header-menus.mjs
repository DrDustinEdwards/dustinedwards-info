/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, DRIVES_PREVIEW, FETCH_TIMEOUT_MS, ok, pollUntil } from "../harness.mjs";

/*
 * The header (app/components/site-header.tsx) is Capsomer's site header written by hand, wired by
 * app/enhance/header.ts with Capsomer's behaviour: 56px, sticky, full width; a disclosure button per section,
 * never role=menu. A click toggles aria-expanded; Enter opens with focus on the panel's first link, Down
 * moves through it and Escape hands focus back; a mouse opens a panel at once and leaving closes it. The
 * panel starts under the header, one width, inside the viewport. On a phone the header is one row and the
 * Menu button opens Capsomer's sheet with every section's links. Every link the panels render answers 200,
 * and the spotlights point at pages that carry what they say. On pages of its own, so no navigation here
 * voids a later case on the shared page.
 */

const PANEL = "#site-nav-research";

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
const BUTTON = 'button[aria-controls="site-nav-research"]';

/**
 * Read a tick after the action: Capsomer writes aria-expanded from the popover's toggle event, which the
 * browser fires a task after the panel opens or closes.
 *
 * @param {import("puppeteer").Page} page @param {string} id
 */
const stateOf = async (page, id = "research") => {
  await sleep(50);
  return page.evaluate((id) => {
    const p = document.getElementById(`site-nav-${id}`);
    const b = document.querySelector(`button[aria-controls="site-nav-${id}"]`);
    return {
      open: p instanceof HTMLElement && p.matches(":popover-open"),
      expanded: b?.getAttribute("aria-expanded") ?? null,
      focusOnButton: document.activeElement === b,
      focusInPanel: Boolean(p && document.activeElement && p.contains(document.activeElement)),
    };
  }, id);
};

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
  {
    const header = html.slice(html.indexOf("data-site-header"), html.indexOf("</header>"));
    const footer = html.slice(html.indexOf('class="site-shell-footer"'));
    const workspace = footer.slice(footer.indexOf('id="footer-workspace"'), footer.indexOf("</nav>"));
    ok(
      "the Lab sign-in link is in the served footer's Workspace group, and not in the header",
      !header.includes('href="/lab"') && /<a [^>]*href="\/lab"[^>]*>/.test(workspace),
      "the lab workspace link moved from the bar to the footer's Workspace group (Dustin, 2026-10-14)",
    );
  }

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

    const frame = await page.evaluate(() => {
      const header = document.querySelector("[data-site-header]");
      const box = header?.getBoundingClientRect();
      return header && box
        ? {
            capsomer: header.matches('header.cap-site-header[data-cap="site-header"]'),
            ready: header.hasAttribute("data-cap-ready"),
            height: Math.round(box.height),
            width: Math.round(box.width),
            client: document.documentElement.clientWidth,
            position: getComputedStyle(header).position,
            last: header.querySelector(".cap-site-header-tools > :nth-last-child(2)")?.className ?? "",
          }
        : null;
    });
    ok(
      "the header is Capsomer's site header, wired: 56px, sticky, full width, and the account (Sign in) last before the phone's Menu",
      frame !== null &&
        frame.capsomer &&
        frame.ready &&
        frame.height === 56 &&
        frame.width === frame.client &&
        frame.position === "sticky" &&
        frame.last.includes("cap-site-header-account"),
      JSON.stringify(frame),
    );

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
      return button
        ? {
            marked: button.hasAttribute("data-current"),
            current: button.getAttribute("aria-current"),
            underline: getComputedStyle(button, "::after").content !== "none",
          }
        : null;
    }, BUTTON);
    ok(
      "inside Research its button is marked as the current section, underlined, and not aria-current",
      section !== null && section.marked && section.underline && section.current === null,
      JSON.stringify(section),
    );

    const lab = await page.evaluate(() => {
      const link = document.querySelector('[aria-labelledby="footer-workspace"] a[href="/lab"]');
      const box = link?.getBoundingClientRect();
      return link && box
        ? {
            onBar: Boolean(document.querySelector('[data-site-header] a[href="/lab"]')),
            shown: box.width > 0 && box.right <= document.documentElement.clientWidth,
            text: (link.textContent ?? "").trim(),
            locked: Boolean(link.querySelector(".footer-private-lock")),
          }
        : null;
    });
    ok(
      "Lab sign-in is off the bar at 1280 and sits in the footer's Workspace group, visible, with the lock, going to /lab",
      lab !== null && !lab.onBar && lab.shown && lab.text === "Lab" && lab.locked,
      JSON.stringify(lab),
    );

    await page.click(BUTTON);
    const clicked = await stateOf(page);
    await page.click(BUTTON);
    const reclicked = await stateOf(page);
    ok(
      "a click on the button opens the panel with aria-expanded true, and a second click closes it with aria-expanded false",
      clicked.open && clicked.expanded === "true" && !reclicked.open && reclicked.expanded === "false",
      `after one click ${JSON.stringify(clicked)}, after two ${JSON.stringify(reclicked)}`,
    );

    await page.mouse.move(640, 880);
    await page.focus(BUTTON);
    await page.keyboard.press("Enter");
    const entered = await stateOf(page);
    await page.keyboard.press("ArrowDown");
    const stepped = await page.evaluate((panel) => {
      const p = document.querySelector(panel);
      const items = p ? [...p.querySelectorAll("a[href]")] : [];
      return items.indexOf(/** @type {Element} */ (document.activeElement));
    }, PANEL);
    await page.keyboard.press("Escape");
    const escaped = await stateOf(page);
    ok(
      "Enter opens the panel with focus on its first link, Down moves to the next, and Escape closes it back to the button",
      entered.open && entered.expanded === "true" && entered.focusInPanel && stepped === 1 && !escaped.open && escaped.expanded === "false" && escaped.focusOnButton,
      `after Enter ${JSON.stringify(entered)}, Down at item ${stepped}, after Escape ${JSON.stringify(escaped)}`,
    );

    /* The open card: under the header (never covering it), inside the viewport, its own width. */
    await page.click(BUTTON);
    const card = await page.evaluate((panel) => {
      const p = document.querySelector(panel);
      const h = document.querySelector("[data-site-header]")?.getBoundingClientRect();
      const box = p?.getBoundingClientRect();
      return box && h
        ? {
            top: Math.round(box.top),
            headerBottom: Math.round(h.bottom),
            left: Math.round(box.left),
            right: Math.round(box.right),
            width: Math.round(box.width),
            client: document.documentElement.clientWidth,
          }
        : null;
    }, PANEL);
    await page.click(BUTTON);
    ok(
      "the open panel starts under the header, about 640px wide, inside the viewport",
      card !== null && card.top >= card.headerBottom && card.left >= 0 && card.right <= card.client && Math.abs(card.width - 640) <= 2,
      JSON.stringify(card),
    );

    /* Hover: a mouse over a button opens its panel at once, and leaving both closes it. */
    const at = await page.evaluate((sel) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    }, BUTTON);
    if (at) {
      await page.mouse.move(640, 880);
      await page.mouse.move(at.x, at.y, { steps: 4 });
      const hovered = await stateOf(page);
      await page.mouse.move(at.x, 880, { steps: 4 });
      await sleep(400);
      const left = await stateOf(page);
      ok(
        "hover opens the panel at once, and leaving the button and the panel closes it",
        hovered.open && hovered.expanded === "true" && !left.open,
        `on the button ${JSON.stringify(hovered)}, after leaving ${JSON.stringify(left)}`,
      );
    } else {
      ok("the Research button is laid out for the hover check", false, "no box");
    }

    /* Each icon control names itself in Capsomer's tip on hover. */
    const searchAt = await page.evaluate(() => {
      const r = document.querySelector("[data-search-trigger]")?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    });
    if (searchAt) {
      await page.mouse.move(searchAt.x, searchAt.y, { steps: 2 });
      const tip = await pollUntil(
        () =>
          page.evaluate(() => {
            const t = document.querySelector("[data-search-trigger] .cap-site-header-tip");
            return t instanceof HTMLElement && t.matches(":popover-open") ? (t.textContent ?? "").trim() : "";
          }),
        (text) => text.length > 0,
        { everyMs: 100 },
      );
      await page.mouse.move(640, 880);
      ok("hovering Search shows its tip, naming it and its keys", tip.startsWith("Search") && tip.endsWith("K"), JSON.stringify(tip));
    } else {
      ok("the Search control is laid out for the tip check", false, "no box");
    }

    const roles = await page.evaluate(() => document.querySelectorAll('[role="menu"], [role="menubar"], [role="menuitem"]').length);
    ok("no role=menu, menubar or menuitem after the enhancement ran", roles === 0, `${roles} found`);

    /* Phone: one row, the Menu button opens the sheet with focus on its heading, Escape gives focus back. */
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    const row = await page.evaluate(() => ({
      sections: getComputedStyle(/** @type {Element} */ (document.querySelector("[data-site-nav]"))).display,
      menu: getComputedStyle(/** @type {Element} */ (document.querySelector("[data-header-menu]"))).display,
      height: Math.round(document.querySelector("[data-site-header]")?.getBoundingClientRect().height ?? 0),
    }));
    await page.click("[data-header-menu]");
    const sheet = await pollUntil(
      () =>
        page.evaluate(() => {
          const d = /** @type {HTMLDialogElement | null} */ (document.querySelector("dialog.cap-site-header-sheet"));
          return {
            open: Boolean(d?.open && d.matches(":modal")),
            expanded: document.querySelector("[data-header-menu]")?.getAttribute("aria-expanded"),
            focusOnTitle: document.activeElement?.classList.contains("cap-site-header-sheet-title") ?? false,
            links: d ? d.querySelectorAll("a[href]").length : 0,
            signIn: Boolean(d?.querySelector('.cap-site-header-sheet-account a[href="/admin"]')),
          };
        }),
      (s) => s.open,
      { everyMs: 50, sleepFirst: false },
    );
    await page.keyboard.press("Escape");
    // The dialog's close event, which sets aria-expanded back, is fired a task after it closes.
    await sleep(100);
    const shut = await page.evaluate(() => ({
      open: Boolean(/** @type {HTMLDialogElement | null} */ (document.querySelector("dialog.cap-site-header-sheet"))?.open),
      expanded: document.querySelector("[data-header-menu]")?.getAttribute("aria-expanded"),
      focusOnMenu: document.activeElement === document.querySelector("[data-header-menu]"),
    }));
    ok(
      "on a phone the header is one 56px row, the Menu opens the sheet with focus on its heading and every section's links, and Escape gives focus back",
      row.sections === "none" &&
        row.menu !== "none" &&
        row.height === 56 &&
        sheet.open &&
        sheet.expanded === "true" &&
        sheet.focusOnTitle &&
        sheet.links >= 40 &&
        sheet.signIn &&
        !shut.open &&
        shut.expanded === "false" &&
        shut.focusOnMenu,
      JSON.stringify({ row, sheet, shut }),
    );

    /** @type {string[]} */
    const cramped = [];
    for (const width of [320, 360, 390, 767, 768, 800, 880, 1024]) {
      await page.setViewport({ width, height: 800 });
      await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
      const fit = await page.evaluate(() => {
        const header = document.querySelector("[data-site-header]");
        const parts = [...(header?.querySelectorAll(".cap-site-header-logo, .cap-site-header-sections, .cap-site-header-tools") ?? [])]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0);
        const overlap = parts.some((r, i) => i > 0 && r.left < parts[i - 1].right);
        return {
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
          height: Math.round(header?.getBoundingClientRect().height ?? 0),
          overlap,
        };
      });
      if (fit.scroll > fit.client || fit.height !== 56 || fit.overlap) cramped.push(`${width}: ${JSON.stringify(fit)}`);
    }
    ok(
      "the header is one 56px row with no sideways scroll and nothing overlapping at 320, 360, 390, 767, 768, 800, 880 and 1024 wide",
      cramped.length === 0,
      cramped.join("; ") || "all fit",
    );
  } finally {
    await page.close();
  }

  /* No script: the section button is still a working popover invoker, and what it opens is links. */
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
