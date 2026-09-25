/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { BASE, bundleFetches, clickOrFail, ok, pollUntil, report, skip } from "../harness.mjs";

/**
 * A post page's controls: the theme toggle with and without script, the scriptless header menu, the
 * search hint and the palette. Returns the post it ran on, for the script-set case.
 *
 * @param {import("../harness.mjs").CaseContext} ctx
 * @param {{ codePost: string | null, probedPost: string | null }} posts
 */
export async function run({ page, browser }, { codePost, probedPost }) {
  /* The cases below navigate for themselves. */
  const postForShape = codePost ?? probedPost;
  if (postForShape === null) {
    skip("a post page's enhancements", "the listing yielded no post links at all");
  } else {
    await page.goto(`${BASE}${postForShape}`, { waitUntil: "networkidle0" });
    ok(
      `${postForShape}: the reading progress bar exists`,
      await page.evaluate(() => Boolean(document.querySelector(".reading-progress"))),
      "script-created and absent without script, so its absence here means the blog " +
        "bundle did not run",
    );

    /* The sentinel proves no navigation happened: a fallback form post would still look right. */
    /* A dead bundle lets the form navigate; the destroyed-context throw is the finding. */
    /* The hidden twin must be `display: none`, not `.sr-only`, measured via `offsetParent`. */
    const control = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll(".theme-toggle button")];
      const shown = buttons.filter((b) => /** @type {HTMLElement} */ (b).offsetParent !== null);
      const hidden = buttons.filter((b) => /** @type {HTMLElement} */ (b).offsetParent === null);
      return {
        total: buttons.length,
        shown: shown.length,
        hiddenAreDisplayNone: hidden.every(
          (b) => getComputedStyle(/** @type {Element} */ (b)).display === "none",
        ),
        label: shown[0]?.getAttribute("aria-label") ?? null,
        value: shown[0]?.getAttribute("value") ?? null,
        pressed: shown[0]?.hasAttribute("aria-pressed") ?? false,
        /* A DOMRect serializes as an empty object, so return plain numbers. */
        width: shown[0] ? /** @type {HTMLElement} */ (shown[0]).getBoundingClientRect().width : 0,
        height: shown[0] ? /** @type {HTMLElement} */ (shown[0]).getBoundingClientRect().height : 0,
      };
    });
    ok(
      "the theme control offers exactly ONE button, and the twin is display:none",
      control.total === 2 &&
        control.shown === 1 &&
        control.hiddenAreDisplayNone &&
        !control.pressed,
      `${control.total} button(s) in the control, ${control.shown} displayed, the hidden ` +
        `one(s) are display:none ${control.hiddenAreDisplayNone}, the visible one carries ` +
        `aria-pressed ${control.pressed}. A third button is back, or the twin is only ` +
        `visually hidden and a screen reader is being offered both actions.`,
    );
    ok(
      "the visible theme button names the action it performs",
      /^Switch to (light|dark) theme$/.test(control.label ?? "") &&
        (control.value === "light" || control.value === "dark"),
      `aria-label ${JSON.stringify(control.label)}, value ${JSON.stringify(control.value)}. ` +
        `The single control carries no pressed state, so the NAME is the only thing telling ` +
        `a screen reader what activating it will do.`,
    );
    ok(
      "the theme button clears the WCAG 2.2 target floor",
      control.width >= 24 && control.height >= 24,
      `${Math.round(control.width)}x${Math.round(control.height)}px, floor 24x24.`,
    );

    /* Scrolled first: at the top of the page a scroll jump has nowhere to go. */
    const scrolledTo = await page.evaluate(() => {
      window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.4));
      /** @type {any} */ (window).__probe = "same-document";
      return window.scrollY;
    });
    /* Clicked by what is visible; by value could pick the hidden button. */
    const themeClicked = await clickOrFail(
      page,
      '.theme-toggle button[value="dark"]',
      "the theme control is present to click",
    );
    /* Top level, so no return; dependent cases are skipped by name. */
    if (!themeClicked) {
      skip(
        "the theme flips in place, without a navigation, and the control turns around",
        "the theme control could not be clicked, so nothing below it was exercised",
      );
    }
    await new Promise((r) => setTimeout(r, 250));
    /** @type {{ attr: string | null, sameDocument: boolean, shownValue: string | null, shownCount: number, scrollY: number } | null} */
    let flipped = null;
    /** Any other failure of the read, kept so it is not reported as a navigation. */
    let flipReadError = "";
    try {
      flipped = await page.evaluate(() => {
        const shown = [...document.querySelectorAll(".theme-toggle button")].filter(
          (b) => /** @type {HTMLElement} */ (b).offsetParent !== null,
        );
        return {
          attr: document.documentElement.getAttribute("data-theme"),
          sameDocument: /** @type {any} */ (window).__probe === "same-document",
          shownValue: shown[0]?.getAttribute("value") ?? null,
          shownCount: shown.length,
          scrollY: window.scrollY,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A real navigation destroys the context the read ran in; nothing else means that.
      if (!/Execution context was destroyed/i.test(message)) flipReadError = message;
      flipped = null;
    }
    if (themeClicked) ok(
      "the theme flip keeps the reader's scroll position",
      scrolledTo > 0 && flipped !== null && flipped.scrollY === scrolledTo,
      scrolledTo === 0
        ? `${postForShape} is too short to scroll, so this case measured nothing.`
        : `scrolled to ${scrolledTo}, after the flip ${flipped?.scrollY ?? "a new document"}. ` +
            `The focus hand-off in app/enhance/theme.ts lost preventScroll, or something ` +
            `else on the flip moves the page.`,
    );
    if (themeClicked) ok(
      "the theme flips in place, without a navigation, and the control turns around",
      flipped !== null &&
        flipped.attr === "dark" &&
        flipped.sameDocument &&
        flipped.shownValue === "light" &&
        flipped.shownCount === 1,
      flipped === null
        ? flipReadError
          ? `reading the page after the click failed: ${flipReadError}`
          : "the click caused a real navigation: the theme bundle did not intercept the " +
            "submit (the form fallback is what carried the click)"
        : `data-theme=${JSON.stringify(flipped.attr)}, same document ${flipped.sameDocument}, ` +
            `the visible button now posts ${JSON.stringify(flipped.shownValue)} and there ` +
            `are ${flipped.shownCount} of them. The theme bundle did not run, the submit ` +
            `interception broke, or the cascade did not turn the control around.`,
    );

    /* With JavaScript disabled. Only the path is asserted: `Referer` never carries a fragment. */
    {
      const scriptless = await browser.newPage();
      try {
        await scriptless.setJavaScriptEnabled(false);
        /* Clear the theme cookie the scripted case left, so this page loads as a first-time reader's. */
        await scriptless.deleteCookie({ name: "theme", url: BASE });
        const hash = "#a-fragment-to-return-to";
        await scriptless.goto(`${BASE}${postForShape}${hash}`, { waitUntil: "networkidle0" });

        const before = await scriptless.evaluate(() => {
          const shown = [...document.querySelectorAll(".theme-toggle button")].filter(
            (b) => /** @type {HTMLElement} */ (b).offsetParent !== null,
          );
          return {
            count: shown.length,
            value: shown[0]?.getAttribute("value") ?? null,
            attr: document.documentElement.getAttribute("data-theme"),
          };
        });
        ok(
          "with script OFF the theme control still offers exactly one button",
          before.count === 1 && (before.value === "light" || before.value === "dark"),
          `${before.count} visible button(s), value ${JSON.stringify(before.value)}. The ` +
            `cascade decides which one shows, so this must hold with no script at all; ` +
            `if it does not, the control depends on the enhancement to be usable.`,
        );

        /*
         * Click the button just read as visible, never by position: the shared cookie jar may have
         * hidden the first one, and puppeteer throws on a hidden element.
         */
        /* A navigation is awaited only for a click that happened: waiting on one that never comes
           throws after 30 s and ends the whole run, which is what clickOrFail exists to prevent. */
        const toggle =
          before.value === "light" || before.value === "dark"
            ? await scriptless.$(`.theme-toggle button[value="${before.value}"]`)
            : null;
        ok(
          "the scriptless theme control is present to click",
          toggle !== null,
          `no visible .theme-toggle button with a light or dark value ` +
            `(read ${JSON.stringify(before.value)})`,
        );
        if (toggle) {
          await Promise.all([
            scriptless.waitForNavigation({ waitUntil: "networkidle0" }),
            toggle.click(),
          ]);

          const after = await scriptless.evaluate(() => ({
            attr: document.documentElement.getAttribute("data-theme"),
            hash: location.hash,
            path: location.pathname,
          }));
          ok(
            "with script OFF the form post changes the theme and returns the reader to the same page",
            after.attr === before.value && after.path === postForShape,
            `asked for ${JSON.stringify(before.value)}, came back with ` +
              `data-theme=${JSON.stringify(after.attr)} at ` +
              `${after.path}${after.hash}. The no-script path is the one the progressive-enhancement rule ` +
              `requires to work: the enhancement is allowed to fail, this is not.`,
          );
          /*
           * Reported, not asserted: the fragment is unreachable by construction, so a failure here
           * would be permanent and say nothing about the code.
           */
          if (after.hash !== hash) {
            report(
              `the scriptless theme post drops the fragment (${JSON.stringify(hash)} -> ` +
                `${JSON.stringify(after.hash)}). Not a defect and not fixable server-side: ` +
                `Referer never carries a fragment (RFC 9110), so /theme cannot learn it. ` +
                `The scripted path holds the reader's position by not navigating at all.`,
            );
          }
        }
      } finally {
        await scriptless.close();
      }
    }

    // With no script the narrow header menu is the navigation. Asserted by opening it and following a
    // link: a details element that opens but whose links do not navigate would pass a check on `open`.
    {
      const noScript = await browser.newPage();
      try {
        await noScript.setJavaScriptEnabled(false);
        await noScript.setViewport({ width: 375, height: 700 });
        await noScript.goto(BASE, { waitUntil: "networkidle0" });

        const menu = await noScript.evaluate(() => {
          const details = document.querySelector("[data-header-menu]");
          if (!details) return null;
          return {
            displayed: getComputedStyle(details).display !== "none",
            open: /** @type {HTMLDetailsElement} */ (details).open,
            links: details.querySelectorAll("a").length,
          };
        });

        ok(
          "the header menu is present and closed with no script",
          menu !== null && menu.displayed && !menu.open && menu.links > 0,
          `menu state ${JSON.stringify(menu)}. At 375 the destinations live behind this control, ` +
            `so an absent or hidden one is a header with no navigation at all.`,
        );

        const opened = await clickOrFail(
          noScript,
          ".site-header-menu-button",
          "the scriptless header menu button is present to click",
        );
        const isOpen = await noScript.evaluate(() => {
          const d = document.querySelector("[data-header-menu]");
          return d instanceof HTMLDetailsElement && d.open;
        });
        ok(
          "the header menu OPENS with no script, because it is a details element",
          opened && isOpen,
          "clicking the summary did not open it. A menu that needs script to open is not rule " +
            "9's fallback, it is the enhancement pretending to be one.",
        );

        const link = await noScript.$(".site-header-menu-panel a");
        const target = link ? await link.evaluate((a) => a.getAttribute("href")) : null;
        ok(
          "the open header menu offers a link to follow",
          link !== null && Boolean(target),
          "no link inside .site-header-menu-panel, so there is nothing for the reader to follow",
        );
        if (link && target) {
          await Promise.all([
            noScript.waitForNavigation({ waitUntil: "domcontentloaded" }),
            link.click(),
          ]);
          ok(
            "a header menu link NAVIGATES with no script",
            new URL(noScript.url()).pathname === target,
            `landed on ${new URL(noScript.url()).pathname}, expected ${target}. Opening is half the ` +
              `contract; the other half is that the thing inside goes somewhere.`,
          );
        }
      } finally {
        await noScript.close();
      }
    }

    // The hint must exist and be unhidden (a missing hint makes `!hidden` true), and the anchor's
    // `aria-describedby` must resolve to it, or no screen reader reads it.
    const hintShown = await page.evaluate(() => {
      const hint = document.querySelector("[data-search-hint]");
      const trigger = document.querySelector("[data-search-trigger]");
      if (!(hint instanceof HTMLElement) || !(trigger instanceof HTMLElement)) return null;
      const described = trigger.getAttribute("aria-describedby");
      return {
        unhidden: !hint.hidden,
        associated: Boolean(described) && described === hint.id && hint.id !== "",
        /*
         * The title must name the live key. `-K` rather than the whole chord, because the modifier is
         * Command on a Mac and Control elsewhere.
         */
        titled: /-K\b/.test(trigger.getAttribute("title") ?? ""),
        text: (hint.textContent ?? "").trim(),
        textNamesKey: /-K\b/.test((hint.textContent ?? "").trim()),
        painted: Boolean(trigger.querySelector("kbd")),
      };
    });
    ok(
      "the shortcut hint is unhidden, associated and unpainted once the palette is listening",
      hintShown !== null &&
        hintShown.unhidden &&
        hintShown.associated &&
        hintShown.titled &&
        hintShown.text.length > 0 &&
        hintShown.textNamesKey &&
        !hintShown.painted,
      hintShown === null
        ? "the [data-search-hint] or [data-search-trigger] element is missing, so the " +
            "header lost the hint or the control"
        : `unhidden ${hintShown.unhidden}, aria-describedby resolves ${hintShown.associated}, ` +
            `title names the chord ${hintShown.titled}, text ${JSON.stringify(hintShown.text)}, ` +
            `that text names the chord ${hintShown.textNamesKey}, a <kbd> is painted inside ` +
            `the control ${hintShown.painted}. The theme bundle did not run, the badge came ` +
            `back, or a surface still advertises a shortcut that was retired.`,
    );

    const beforeGesture = await bundleFetches(page, "palette");
    ok(
      "the palette bundle is NOT fetched by a page nobody searched on",
      beforeGesture === 0,
      `${beforeGesture} request(s) for the palette bundle before any gesture. It is ` +
        `back on every document, which is the cost this split removed: a reader who ` +
        `never opens search should never download the dialog.`,
    );

    const triggerClicked = await clickOrFail(
      page,
      "[data-search-trigger]",
      "the search trigger is present to click",
    );
    /* Polled, not slept: opening costs a network round trip for the bundle, so a fixed wait races. */
    let paletteOpen = { open: false, focused: false };
    let navigatedToSearch = false;
    if (triggerClicked) {
      ({ paletteOpen, navigatedToSearch } = await pollUntil(
        async () => ({
          paletteOpen: await page.evaluate(() => ({
            open: Boolean(document.querySelector("dialog.palette[open]")),
            focused: document.activeElement?.classList.contains("palette-input") ?? false,
          })),
          // The other legal outcome: with no bundle, theme.ts falls back to location.assign('/search').
          navigatedToSearch: /\/search(\?|$)/.test(page.url()),
        }),
        (r) => (r.paletteOpen.open && r.paletteOpen.focused) || r.navigatedToSearch,
      ));
    }
    ok(
      "clicking the search trigger opens the palette with focus in its input, or navigates to /search",
      (paletteOpen.open && paletteOpen.focused) || navigatedToSearch,
      `open ${paletteOpen.open}, input focused ${paletteOpen.focused}, url ${page.url()}. ` +
        `The gesture is bound in theme.ts and the dialog is built by the bundle it appends, ` +
        `so this fails if either half broke, including a CSP that refuses the injected ` +
        `script. Navigating to /search is the accepted fallback; navigating anywhere ` +
        `else, or nowhere, is not.`,
    );

    // Everything that reads the open dialog runs before anything that submits it, because Enter
    // navigates to /search. The dialog CSS loads on demand, and an unstyled `<dialog open>` still passes.
    const dialogStyled = await page.evaluate(() => {
      const dialog = document.querySelector("dialog.palette");
      if (!dialog) return null;
      const style = getComputedStyle(dialog);
      return {
        borderTopWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
        background: style.backgroundColor,
      };
    });
    ok(
      "the palette dialog is styled by the time it opens",
      dialogStyled !== null &&
        dialogStyled.borderTopWidth === "1px" &&
        dialogStyled.borderRadius !== "0px",
      `computed ${JSON.stringify(dialogStyled)}. The dialog's stylesheet is fetched ` +
        `on the gesture beside the bundle and awaited before opening; a default ` +
        `border here means it did not arrive, or arrived after the modal was up.`,
    );

    const afterGesture = await bundleFetches(page, "palette");
    ok(
      "the gesture fetches the palette bundle, exactly once",
      afterGesture === 1,
      `${afterGesture} request(s) after the gesture. Zero means the loader never ran ` +
        `or the injected script was refused (check the console for a CSP violation); ` +
        `more than one means the once-only guard in theme.ts stopped holding.`,
    );
    if (paletteOpen.open) {
      // Guarded: a missing field here throws and voids the rest of the run.
      const resultsField = await page.$(".palette-input");
      if (!resultsField) {
        ok(
          "the palette returns live results",
          false,
          "the palette is open and has no .palette-input, so no query could be typed.",
        );
      } else {
      await resultsField.type("cloudflare");
      // The debounce and a cold D1 query both outlast a fixed wait; poll instead.
      let paletteResult = { options: 0, status: "" };
      paletteResult = await pollUntil(
        () =>
          page.evaluate(() => ({
            options: document.querySelectorAll(".palette-option").length,
            status: document.querySelector(".palette-status")?.textContent ?? "",
          })),
        (r) => r.options > 0 || /result|unavailable/i.test(r.status),
      );
      ok(
        "the palette returns live results",
        paletteResult.options > 0,
        `0 options after 5s; status ${JSON.stringify(paletteResult.status)}. The JSON ` +
          `endpoint or the palette's fetch path broke.`,
      );
      /* Emptied, not closed: the query case below types into this same open field. */
      await resultsField.evaluate((input) => {
        /** @type {HTMLInputElement} */ (input).value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      }
    }

    /* Last, because it leaves the page. */
    if (paletteOpen.open) {
      const QUERY = "phage cocktail";
      /* Typed through a handle, not `page.type`, which throws on a missing field and voids the run. */
      const field = await page.$(".palette-input");
      if (!field) {
        ok(
          "the typed query survives the search gesture and reaches the URL",
          false,
          "the palette reported itself open but carries no .palette-input to type into, " +
            "so the query could not be entered. The dialog opened without its field.",
        );
      } else {
        await field.type(QUERY);
        await page.keyboard.press("Enter");

        // Polled rather than slept: the submit is a navigation on some paths and
        // a same-document update on others, and a fixed wait races both.
        const landed = await pollUntil(
          async () => page.url(),
          (url) => /[?&]q=/.test(url),
        );

        const carried = (() => {
          try {
            return new URL(landed).searchParams.get("q");
          } catch {
            return null;
          }
        })();

        ok(
          "the typed query survives the search gesture and reaches the URL",
          carried === QUERY,
          `submitted ${JSON.stringify(QUERY)} and landed on ${landed}, whose q is ` +
            `${JSON.stringify(carried)}. A control that navigates to a bare /search ` +
            `throws the reader's query away, which is what build 2 shipped and what ` +
            `no offline gate could see.`,
        );
      }
    } else {
      skip(
        "the typed query survives the search gesture and reaches the URL",
        "the palette never opened, so there was no field to type a query into",
      );
    }
  }

  return postForShape;
}
