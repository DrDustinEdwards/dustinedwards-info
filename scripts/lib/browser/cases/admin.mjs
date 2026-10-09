/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import {
  ADMIN_ORIGIN,
  CREDENTIAL,
  CREDENTIAL_ERROR,
  CREDENTIAL_PRESENT,
  CREDENTIAL_SOURCE,
  SMOKE_SOURCE,
  applyCredential,
  credentialAuthenticates,
  smokeRepair,
} from "../credential.mjs";
import { countCssRules, ok, overflowScan, skip } from "../harness.mjs";

/** Re-measure when the admin's stylesheets change: the floor sits a few under a measured run. */
const ADMIN_RULE_MEASURED = 74;
const ADMIN_RULE_FLOOR = 70;

/**
 * The admin plane, driven on ADMIN_ORIGIN with the supplied credential. Returns whether the admin
 * cases ran, which the closing report needs.
 *
 * @param {import("../harness.mjs").CaseContext} ctx
 */
export async function run({ browser }) {
  /** Not `skipped.length`: that cannot tell a rejected session from a completed run. */
  let adminCasesRan = false;

  /** @type {{ ok: boolean, status: number, error?: string }} */
  let AUTH_RESULT = { ok: false, status: 0 };

  /* Only an absent credential is a skip; a supplied but unusable one fails with a named repair. */
  if (!CREDENTIAL_PRESENT) {
    ok(
      "the admin plane has a credential to observe it with",
      false,
      `no admin credential, so NONE of this ran: the 6 admin surfaces, the ` +
        `editor mount, the two mark fills, the four media interactions, and the ` +
        `sideways-scroll cases at 1280, 553, 480, 400 and 320.\n` +
        `        These cases need a REAL credential and are deliberately ` +
        `not stubbed: a fake auth path would not render what production renders, and the ` +
        `defects they exist to catch live in the authenticated render.\n` +
        `        Mint a smoke token with ` +
        `\`node scripts/mint-smoke-token.mjs > .smoke-token\`, set it on the Worker with ` +
        `\`npx wrangler secret put SMOKE_TOKEN < .smoke-token\`, and set ADMIN_ORIGIN. ` +
        `The token file is gitignored.`,
    );
  } else if (CREDENTIAL_ERROR) {
    ok(
      `the ${CREDENTIAL} credential supplied in ${CREDENTIAL_SOURCE} is usable`,
      false,
      `${CREDENTIAL_ERROR}\n` +
        `        This is a FORMAT or CONFIGURATION problem, not a rejected credential. ` +
        `See RECOVERY.md for the three places the token goes. ` +
        `The admin cases below did not run.`,
    );
  } else if (!ADMIN_ORIGIN) {
    ok(
      "the admin cases have an origin to drive",
      false,
      `a ${CREDENTIAL} credential was supplied in ${CREDENTIAL_SOURCE} and no origin was. ` +
        `These cases CANNOT run against the preview server: SMOKE_TOKEN is a wrangler secret and ` +
        `this repo has no .dev.vars by design, so the preview would answer 503 not-configured.\n` +
        `        Set ADMIN_ORIGIN. The admin cases below did not run.`,
    );
  } else if (!(AUTH_RESULT = await credentialAuthenticates(ADMIN_ORIGIN)).ok) {
    ok(
      `the ${CREDENTIAL} credential supplied in ${CREDENTIAL_SOURCE} authenticates against ${ADMIN_ORIGIN}`,
      false,
      /* Status 0 is a request that never got an answer (DNS, TLS, timeout): no credential was
         judged, so neither repair below applies, and the cause is the error itself. */
      AUTH_RESULT.status === 0
        ? `GET /admin never got an answer: ${AUTH_RESULT.error ?? "no error was recorded"}. ` +
          `No credential was judged, so this is ${ADMIN_ORIGIN} being unreachable from here, ` +
          `not an expired session or a drifted token.\n` +
          `        The admin cases below did not run.`
        : `GET /admin with it did not return 200. The status NAMES the repair, which is why ` +
          `the smoke path reports one rather than guessing:\n` +
          `        ${smokeRepair(AUTH_RESULT.status)}\n` +
          `        The admin cases below did not run.`,
    );
  } else {
    /* State which credential ran: the smoke token is read-only, so its green says nothing about writes. */
    console.log(
      `\n  admin credential: THE SMOKE TOKEN, read from ${SMOKE_SOURCE}` +
        `\n  admin cases: observing ${ADMIN_ORIGIN} (DEPLOYED, not the preview build)` +
        `\n  the smoke actor is READ ONLY: every case below is a GET, and no write surface is exercised\n`,
    );
    ok(`the supplied ${CREDENTIAL} credential authenticates against ${ADMIN_ORIGIN}`, true);
    adminCasesRan = true;

    const admin = await browser.newPage();
    /** @type {string[]} */
    const errors = [];
    admin.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    /** @type {number[]} */
    const fetched = [];
    admin.on("response", (r) => {
      if (/markdown-editor.*\.js/.test(r.url())) fetched.push(r.status());
    });
    await applyCredential(admin, ADMIN_ORIGIN);
    await admin.setViewport({ width: 1280, height: 900 });

    /*
     * The shell (rail and top bar) is the assertion, not the title, which survives an empty
     * body. The login page is named, because a bounced session renders a complete page.
     */
    const SURFACES = [
      ["/admin", "the cockpit"],
      ["/admin/posts", "the posts list"],
      ["/admin/media?view=grid", "the media library, grid"],
      ["/admin/media?view=list", "the media library, list"],
      ["/admin/tools", "tools"],
      ["/admin/mentions", "the mentions queue"],
      ["/admin/kb", "the knowledge base"],
      ["/admin/kb?tab=needs-info", "the knowledge base, needs info"],
    ];
    for (const [path, what] of SURFACES) {
      await admin.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "networkidle0" });
      const r = await admin.evaluate(() => ({
        sidebar: !!document.querySelector(".cap-admin-menu"),
        topbar: !!document.querySelector(".cap-admin-bar"),
        onLogin: location.pathname === "/login",
        textLen: (document.body.innerText || "").trim().length,
      }));
      ok(
        `${path}: ${what} renders the admin shell`,
        r.sidebar && r.topbar && !r.onLogin && r.textLen > 100,
        r.onLogin
          ? "the session bounced to /login part way through the sweep"
          : `sidebar=${r.sidebar} topbar=${r.topbar} bodyText=${r.textLen} chars`,
      );
    }

    await admin.goto(`${ADMIN_ORIGIN}/admin/posts`, { waitUntil: "networkidle0" });
    const slug = await admin.evaluate(() => {
      const a = document.querySelector('a[href*="/edit"]');
      return a ? a.getAttribute("href") : null;
    });

    ok(
      "an edit route was reachable with the supplied session",
      !!slug,
      "no edit link on /admin/posts, so the mount assertions below examine nothing",
    );

    if (slug) {
      /* Only this navigation's requests: the listener has been on since the sweep began, and an
         earlier surface fetching the chunk would otherwise satisfy the case below. */
      fetched.length = 0;
      await admin.goto(`${ADMIN_ORIGIN}${slug}`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 2500));
      const mounted = await admin.evaluate(() => !!document.querySelector(".cm-editor"));
      ok("the CodeMirror chunk was fetched", fetched.length > 0, "no markdown-editor chunk request");
      ok(
        "the chunk was served, not refused",
        fetched.every((s) => s === 200),
        `statuses ${fetched.join(", ")}`,
      );
      ok(".cm-editor exists in the live DOM", mounted, "the Suspense boundary never resolved");
      ok(
        "no React #419 in the console",
        !errors.some((e) => /#419|Minified React error/.test(e)),
        errors.filter((e) => /#419|Minified React error/.test(e)).join(" | "),
      );
    }

    /* Nothing here submits, under either credential: the cookie path runs as Dustin. */
    await admin.setViewport({ width: 1280, height: 900 });

    /* Sorted by size, not the default, so a header that hardcodes its active column fails. */
    await admin.goto(`${ADMIN_ORIGIN}/admin/media?view=list&sort=size`, {
      waitUntil: "networkidle0",
    });
    const listHead = await admin.evaluate(() => {
      const head = document.querySelector('table[data-view="list"] thead tr');
      if (!head) return null;
      const cells = [...head.querySelectorAll("th")].map((el) => {
        const link = el.querySelector("a");
        return {
          label: (el.textContent || "").replace(/\s+/g, " ").trim(),
          sortable: !!link,
          href: link?.getAttribute("href") || "",
          sortKey: link?.getAttribute("data-sort") || "",
          /* The sort state in words inside the link: the sorted column says so, with no aria-sort. */
          sorted: (link?.querySelector(".cap-sr-only")?.textContent || "").replace(/\s+/g, " ").trim(),
        };
      });
      return { cells: cells.map((c) => ({ ...c, active: c.sorted !== "" })) };
    });

    ok(
      "/admin/media?view=list: the list view renders its header row",
      !!listHead && listHead.cells.length >= 5,
      listHead
        ? `${listHead.cells.length} header cell(s), expected the five columns`
        : "no list table header at all, so the sort assertions below examine nothing",
    );
    ok(
      "the list header marks exactly the column the URL sorted by",
      !!listHead &&
        listHead.cells.filter((c) => c.active).length === 1 &&
        listHead.cells.some((c) => c.active && c.label.startsWith("Size")),
      listHead
        ? `active: ${listHead.cells.filter((c) => c.active).map((c) => c.label).join(", ") || "(none)"}. ` +
          `The URL asked for sort=size, so Size and nothing else should say it is sorted.`
        : "not measured",
    );
    /*
     * Every sortable cell is an anchor, so sorting has an address. Not every href carries `sort=`:
     * `hrefWith` omits a parameter equal to its default.
     */
    ok(
      "every sortable header cell is a real link, so sorting has an address",
      !!listHead &&
        listHead.cells.filter((c) => c.sortable).length === 4 &&
        listHead.cells
          .filter((c) => c.sortable)
          .every((c) => c.href.startsWith("/admin/media") && c.sortKey.length > 0),
      listHead
        ? `${listHead.cells.filter((c) => c.sortable).length} anchor(s) of the four sortable ` +
          `columns; hrefs ${JSON.stringify(listHead.cells.filter((c) => c.sortable).map((c) => c.href))}. ` +
          `A header cell that is not an anchor does not work with scripting off.`
        : "not measured",
    );
    ok(
      "exactly one column says it is sorted, and it is the sorted one",
      !!listHead &&
        listHead.cells.filter((c) => c.sorted).length === 1 &&
        listHead.cells.some(
          (c) => c.sorted === ", sorted descending" && c.label.startsWith("Size"),
        ),
      listHead
        ? `sort words ${JSON.stringify(
            listHead.cells.filter((c) => c.sortable).map((c) => `${c.label}=${c.sorted}`),
          )}. The URL asked for sort=size and size defaults to descending.`
        : "not measured",
    );

    /* The key comes off the page, never a fixture: the bucket owns it and may delete it. */
    const firstKey = await admin.evaluate(() => {
      const tile = document.querySelector("[data-tile]");
      return tile ? tile.getAttribute("data-tile") : null;
    });
    ok(
      "the media library lists an object to inspect",
      !!firstKey,
      "nothing carries data-tile, so the inspector assertions below examine nothing. " +
        "An empty bucket would do this legitimately, and it would still be worth failing on: " +
        "these cases cannot say anything about a library with no rows in it.",
    );

    if (firstKey) {
      await admin.goto(
        `${ADMIN_ORIGIN}/admin/media?view=list&key=${encodeURIComponent(firstKey)}`,
        { waitUntil: "networkidle0" },
      );
      const inspector = await admin.evaluate((wanted) => {
        const panel = document.querySelector("dialog[data-media-inspector]");
        if (!panel) return null;
        const r = panel.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          namesKey: (panel.textContent || "").includes(wanted.slice(0, 12)),
          hasClose: !!panel.querySelector(".cap-dialog-close"),
        };
      }, firstKey);

      ok(
        "/admin/media?key=: the inspector opens on a key in the URL",
        !!inspector,
        "no inspector dialog rendered for a key taken off the library page itself. The inspector " +
          "is URL-driven by design, so this is the whole of that contract.",
      );
      ok(
        "the inspector is actually laid out, not present and collapsed",
        !!inspector && inspector.width > 200 && inspector.height > 100,
        inspector
          ? `the inspector measures ${inspector.width}x${inspector.height}. A panel that exists ` +
            `in the DOM at zero size is the mount class wearing a different hat.`
          : "not measured",
      );
      ok(
        "the inspector names the object it was opened for, and offers a way out",
        !!inspector && inspector.namesKey && inspector.hasClose,
        inspector
          ? `namesKey=${inspector.namesKey} close=${inspector.hasClose}. An inspector showing a ` +
            `DIFFERENT object than the URL asked for is worse than one that does not open.`
          : "not measured",
      );
    }

    /* The size is the half worth asserting: a sum over the wrong subset still renders a plausible number. */
    await admin.goto(`${ADMIN_ORIGIN}/admin/media?view=grid`, { waitUntil: "networkidle0" });
    const beforeSelect = await admin.evaluate(() => !!document.querySelector(".cap-bulk"));
    ok(
      "the bulk bar is absent before anything is selected",
      !beforeSelect,
      "a bulk bar rendered with an empty selection would offer actions that act on nothing, " +
        "and it would make the assertion below pass without a click happening at all",
    );

    const boxes = await admin.$$('input[type="checkbox"][name="key"]');
    ok(
      "the media grid renders row checkboxes to select",
      boxes.length > 0,
      "no checkbox carries name=key, so the bulk assertions below examine nothing",
    );

    if (boxes.length > 0) {
      await boxes[0].click();
      // The bar is rendered by React state, so it appears on the next paint
      // rather than synchronously with the click.
      await admin
        .waitForSelector(".cap-bulk", { timeout: 5000 })
        .catch(() => null);
      const bulk = await admin.evaluate(() => {
        const bar = document.querySelector(".cap-bulk");
        if (!bar) return null;
        const count = bar.querySelector(".cap-bulk-count");
        const size = bar.querySelector(".cap-bulk-detail");
        // The announcement is the form's status region, in the document before the bar mounted.
        const status = bar.closest("form")?.querySelector(':scope > [role="status"]');
        return {
          count: (count?.textContent || "").replace(/\s+/g, " ").trim(),
          size: (size?.textContent || "").trim(),
          announced: (status?.textContent || "").trim(),
          label: bar.getAttribute("aria-label") || "",
        };
      });

      ok(
        "selecting one row opens the bulk bar",
        !!bulk,
        "clicking a row checkbox did not produce .cap-bulk. Either the page is not hydrated " +
          "or the selection state is not reaching the bar.",
      );
      ok(
        "the bulk bar reports the count it was given",
        !!bulk && bulk.count.startsWith("1 selected"),
        bulk ? `count reads ${JSON.stringify(bulk.count)} after exactly one click` : "not measured",
      );
      /* `byteSize` over an empty subset renders "0 B", which is what a bar summing the wrong array shows. */
      ok(
        "the bulk bar sizes the selection rather than rendering an empty sum",
        !!bulk && bulk.size.length > 0 && !/^0\s*B$/i.test(bulk.size),
        bulk
          ? `size reads ${JSON.stringify(bulk.size)}. "0 B" is what summing an empty or wrong ` +
            `subset produces, and one selected object is not zero bytes.`
          : "not measured",
      );
      ok(
        "the bulk bar announces itself to a screen reader",
        !!bulk && bulk.announced === "1 selected" && bulk.label.length > 0,
        bulk
          ? `status region reads ${JSON.stringify(bulk.announced)}, aria-label=${JSON.stringify(bulk.label)}. ` +
            `The count region is the grid form's role=status, mounted before anything was selected, ` +
            `because a region that mounts with its text is often never announced.`
          : "not measured",
      );
    }

    // The one confirmation a GET reaches; the others open from `actionData` and need a POST.
    // It never submits: the enabled state is the assertion.
    await admin.goto(`${ADMIN_ORIGIN}/admin/media?confirm=empty-trash`, {
      waitUntil: "networkidle0",
    });
    /* The Trash chip's count, so "no modal" can be told apart from "empty trash". */
    const trashed = await admin.evaluate(() => {
      const chip = [...document.querySelectorAll(".cap-tab")].find((a) =>
        /^\s*Trash/.test(a.textContent ?? ""),
      );
      const count = chip?.querySelector(".cap-tab-count")?.textContent?.trim() ?? "";
      return /^\d+$/.test(count) ? Number(count) : null;
    });
    ok(
      "/admin/media shows how many files are in the trash",
      trashed !== null,
      "no Trash tab with a numeric count, so an absent confirmation could not be told apart " +
        "from an empty trash",
    );
    const modal = await admin.evaluate(() => {
      const panel = document.querySelector('dialog.cap-dialog[role="alertdialog"]');
      if (!panel) return null;
      const prompt = panel.querySelector(".cap-confirm-typed label");
      const typed = /Type\s+(\S+)\s+to confirm/i.exec(prompt?.textContent || "");
      return {
        // showModal() is what makes it modal; the element alone is only a dialog.
        modal: panel.matches(":modal"),
        required: typed ? typed[1] : "",
        hasInput: !!panel.querySelector(".cap-confirm-typed input"),
        confirmDisabled: !!panel.querySelector('.cap-dialog-footer .cap-btn[data-variant="danger"][disabled]'),
      };
    });

    if (!modal && trashed === 0) {
      skip(
        "/admin/media?confirm=empty-trash: the typed-confirmation ladder",
        "the trash is EMPTY on this deployment and the modal is gated on trashedCount > 0. " +
          "Nothing is wrong and nothing was measured. This case covers itself again as soon as " +
          "one object is trashed.",
      );
    } else if (!modal) {
      ok(
        "/admin/media?confirm=empty-trash renders the typed-confirmation dialog",
        false,
        `the trash holds ${trashed ?? "an unknown number of"} file(s) and the confirmation did ` +
          `not render, so the destructive action has lost its confirmation or its route.`,
      );
    } else {
      ok(
        "the empty-trash confirmation is a real dialog",
        modal.modal,
        `a <dialog> that is not open as a modal. This ` +
          `replaced window.prompt(), which was unreadable to a screen reader and which did not ` +
          `run at all with scripting off, submitting the destruction unconfirmed.`,
      );
      ok(
        "it asks for a specific string to be typed",
        modal.hasInput && modal.required.length > 0,
        `input=${modal.hasInput} required=${JSON.stringify(modal.required)}. The ladder is the ` +
          `count, and a modal that asks for nothing is a dialog rather than a confirmation.`,
      );
      ok(
        "the confirm button starts DISABLED on a hydrated page",
        modal.confirmDisabled,
        "the destructive button is pressable before anything has been typed. The server still " +
          "re-checks, so this is early feedback rather than the check, but an ungated button " +
          "means the ladder exists only on the server and the page contradicts it.",
      );

      if (modal.hasInput && modal.required) {
        const field = ".cap-confirm-typed input";
        // The WRONG value first. A button that enables on any input at all would
        // pass an assertion that only ever typed the right answer.
        await admin.type(field, `${modal.required}x`);
        const afterWrong = await admin.evaluate(
          () => !!document.querySelector('.cap-dialog-footer .cap-btn[data-variant="danger"][disabled]'),
        );
        ok(
          "a WRONG value leaves the confirm button disabled",
          afterWrong,
          `typing ${JSON.stringify(`${modal.required}x`)} enabled the destructive button, so the ` +
            `gate is "something was typed" rather than "the count was typed".`,
        );

        await admin.evaluate((sel) => {
          const el = /** @type {HTMLInputElement | null} */ (document.querySelector(sel));
          if (el) {
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value",
            )?.set;
            setter?.call(el, "");
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }, field);
        await admin.type(field, modal.required);
        const afterRight = await admin.evaluate(
          () => !!document.querySelector('.cap-dialog-footer .cap-btn[data-variant="danger"][disabled]'),
        );
        ok(
          "the exact value ENABLES the confirm button",
          !afterRight,
          `typing ${JSON.stringify(modal.required)}, which is the string the modal itself asks ` +
            `for, left the button disabled. The ladder would then be unpassable and the trash ` +
            `could not be emptied from the browser at all.`,
        );
        /*
         * NOT SUBMITTED. Navigating away is the end of this case, deliberately,
         * and the navigation is what discards the typed value.
         */
        await admin.goto(`${ADMIN_ORIGIN}/admin/media`, { waitUntil: "networkidle0" });
      }
    }

    /* Several widths, because the overflow is linear in the viewport; 1280 catches a fix that collapses desktop. */
    /* A rule count proves the admin's sheets arrived; the computed style proves the cascade applied them. */
    await admin.setViewport({ width: 1280, height: 900 });
    await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
    const rules = await admin.evaluate(countCssRules);
    const adminCss = await admin.evaluate(() => {
      const rail = document.querySelector(".cap-admin-menu");
      const style = rail ? getComputedStyle(rail) : null;
      return {
        sheets: [...document.styleSheets].length,
        display: style?.display ?? "",
        width: style ? Math.round(parseFloat(style.width)) : 0,
      };
    });
    ok(
      "the ADMIN stylesheet is actually applied where the layout is measured",
      rules >= ADMIN_RULE_FLOOR,
      `${rules} CSS rule(s) across ${adminCss.sheets} sheet(s), floor ${ADMIN_RULE_FLOOR}, ` +
        `measured ${ADMIN_RULE_MEASURED} on 2026-10-03, when the admin moved onto Capsomer. Below this the ` +
        `admin stylesheet did not load and every overflow number below is about browser defaults.`,
    );
    ok(
      "the admin shell is laid out by Capsomer's CSS, not by the browser default",
      adminCss.display !== "inline" && adminCss.display !== "block" && adminCss.width > 100,
      `.cap-admin-menu computed display=${adminCss.display || "(none)"} width=${adminCss.width}px. ` +
        `An unstyled rail is a block at full width, which would make the overflow ` +
        `readings below meaningless while looking like a real measurement.`,
    );

    /* 582 is the measured floor, on the fold boundary; 375 is the common phone width. */
    const OVERFLOW_WIDTHS = [1280, 582, 553, 480, 400, 375, 320];
    for (const width of OVERFLOW_WIDTHS) {
      await admin.setViewport({ width, height: 800 });
      for (const [path, what] of [
        ["/admin", "the cockpit"],
        ["/admin/posts", "the posts list"],
        ["/admin/mentions", "the mentions queue"],
        ["/admin/kb?tab=needs-info", "the knowledge base, needs info"],
      ]) {
        await admin.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "networkidle0" });
        const o = await admin.evaluate(overflowScan);
        ok(
          `${path}: ${what} does not scroll sideways at ${width}px`,
          o.scrollW <= o.clientW,
          `scrollWidth ${o.scrollW} exceeds clientWidth ${o.clientW} by ` +
            `${o.scrollW - o.clientW}px. Widest: ${o.over.join(", ") || "(nothing measured wider " +
              "than the viewport, so the overflow is on an element this scan skipped)"}`,
        );
      }
    }

    /*
     * The bar itself fits: an ancestor with `overflow: hidden` would clip its children while the
     * document does not scroll.
     */
    await admin.setViewport({ width: 320, height: 800 });
    await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
    const bar = await admin.evaluate(() => {
      const el = document.querySelector(".cap-admin-bar");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const kids = [...el.querySelectorAll("a, button, label, fieldset")].map((k) => {
        const kr = k.getBoundingClientRect();
        const cls = typeof k.className === "string" ? k.className : "";
        return {
          sel: `${k.tagName.toLowerCase()}${cls ? "." + cls.split(/\s+/)[0] : ""}`,
          right: Math.round(kr.right),
          visible: kr.width > 0,
        };
      });
      const out = kids.filter((k) => k.visible && k.right > Math.round(r.right) + 0.5);
      return { right: Math.round(r.right), out };
    });
    ok(
      "the admin top bar exists to measure at 320px",
      bar !== null,
      "no .cap-admin-bar, so the containment assertion below would examine nothing",
    );
    ok(
      "no admin top bar control overflows the bar at 320px",
      bar !== null && bar.out.length === 0,
      bar === null
        ? "not measured"
        : `bar ends at ${bar.right} and ${bar.out
            .map((k) => `${k.sel}@${k.right}`)
            .join(", ")} extend past it. The document may not scroll, but the ` +
          `controls are being clipped.`,
    );

    // Compared by accessible name, since a swap holds a count steady. On a phone the top bar hides what the
    // tab bar and its More sheet carry, so the More sheet is opened first, as a tap does.
    const NARROW = 375;
    const topbarActions = async (/** @type {number} */ width, /** @type {boolean} */ openMore) => {
      await admin.setViewport({ width, height: 800 });
      await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
      if (openMore) {
        await admin.click('.cap-admin-tabs button[data-cap-part="more"]');
        await new Promise((r) => setTimeout(r, 300));
      }
      return admin.evaluate(() => {
        const names = [];
        for (const el of document.querySelectorAll(
          ".cap-admin-bar, .cap-admin-tabs, dialog.cap-admin-sheet[open]",
        )) {
          for (const control of el.querySelectorAll(
            'a[href], button, summary, input:not([type="hidden"]), select, textarea',
          )) {
            // display:none is out of the accessibility tree, so it is not
            // reachable and must not be counted at either width.
            const r = control.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            const name = (control.getAttribute("aria-label") || control.textContent || "")
              .replace(/\s+/g, " ")
              .trim();
            if (name) names.push(name);
          }
        }
        return {
          names: [...new Set(names)].sort(),
          more: !!document.querySelector('.cap-admin-tabs button[data-cap-part="more"]'),
        };
      });
    };

    const wide = await topbarActions(1280, false);
    const narrow = await topbarActions(NARROW, true);

    // An empty wide set makes the subset test vacuously true.
    ok(
      "the wide admin top bar offers actions to compare against",
      wide.names.length >= 2,
      `only ${wide.names.length} named control(s) at 1280px: [${wide.names.join(" | ")}]. ` +
        `The subset assertion below would agree with anything.`,
    );
    ok(
      `the phone's tab bar has a More sheet at ${NARROW}px`,
      narrow.more,
      "no More button in the tab bar, so what the top bar hides on a phone has nowhere to go",
    );

    const lost = wide.names.filter((name) => !narrow.names.includes(name));
    ok(
      `every wide top bar action is still reachable at ${NARROW}px`,
      lost.length === 0,
      `${lost.length} action(s) disappear when the bar folds: [${lost.join(" | ")}].\n` +
        `        1280px offers [${wide.names.join(" | ")}]\n` +
        `        ${NARROW}px offers [${narrow.names.join(" | ")}]\n` +
        `        A fold that drops controls passes every width assertion above, ` +
        `because nothing overflows if nothing is there.`,
    );

    await admin.close();
  }

  return adminCasesRan;
}
