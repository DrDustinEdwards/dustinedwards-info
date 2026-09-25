/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import {
  ADMIN_ORIGIN,
  COOKIE_SOURCE,
  CREDENTIAL,
  CREDENTIAL_ERROR,
  CREDENTIAL_PRESENT,
  CREDENTIAL_SOURCE,
  REFILL_HINT,
  SESSION_COOKIE_NAME,
  SESSION_EXAMPLE,
  SMOKE_SOURCE,
  applyCredential,
  credentialAuthenticates,
  smokeRepair,
} from "../credential.mjs";
import { countCssRules, ok, overflowScan, skip } from "../harness.mjs";

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
      `no admin credential of either kind, so NONE of this ran: the 6 admin surfaces, the ` +
        `editor mount, the two mark fills, the four media interactions, and the ` +
        `sideways-scroll cases at 1280, 553, 480, 400 and 320.\n` +
        `        These cases need a REAL credential and are deliberately ` +
        `not stubbed: a fake auth path would not render what production renders, and the ` +
        `defects they exist to catch live in the authenticated render.\n` +
        `        PREFERRED, and the one that runs unattended: mint a smoke token with ` +
        `\`node scripts/mint-smoke-token.mjs > .smoke-token\`, set it on the Worker with ` +
        `\`npx wrangler secret put SMOKE_TOKEN < .smoke-token\`, and set ADMIN_ORIGIN.\n` +
        `        OR: copy ${SESSION_EXAMPLE} to .admin-session and paste a live session ` +
        `cookie into it. That file carries the five Chrome clicks. Both are gitignored.`,
    );
  } else if (CREDENTIAL_ERROR) {
    ok(
      `the ${CREDENTIAL} credential supplied in ${CREDENTIAL_SOURCE} is usable`,
      false,
      `${CREDENTIAL_ERROR}\n` +
        `        This is a FORMAT or CONFIGURATION problem, not a rejected credential. ` +
        `${CREDENTIAL === "smoke" ? "See RECOVERY.md for the three places the token goes." : `See ${SESSION_EXAMPLE}.`} ` +
        `The admin cases below did not run.`,
    );
  } else if (!ADMIN_ORIGIN) {
    ok(
      "the admin cases have an origin to drive",
      false,
      `a ${CREDENTIAL} credential was supplied in ${CREDENTIAL_SOURCE} and no origin was. ` +
        `These cases CANNOT run against the preview server, and that is true of BOTH ` +
        `credentials for the same underlying reason: neither one exists there. Sessions live ` +
        `in the production KV namespace and the preview reads local miniflare storage; ` +
        `SMOKE_TOKEN is a wrangler secret and this repo has no .dev.vars by design, so the ` +
        `preview would answer 503 not-configured. Measured for the cookie, and structural ` +
        `for the token.\n` +
        `        Set ADMIN_ORIGIN, or add an \`origin =\` line to .admin-session. The admin ` +
        `cases below did not run.`,
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
        : CREDENTIAL === "smoke"
        ? `GET /admin with it did not return 200. The status NAMES the repair, which is why ` +
          `the smoke path reports one rather than guessing:\n` +
          `        ${smokeRepair(AUTH_RESULT.status)}\n` +
          `        The admin cases below did not run.`
        : `GET /admin with it did not return 200, so the session is almost certainly EXPIRED. ` +
          `The format parsed fine and the cookie was named ${SESSION_COOKIE_NAME}, so this is ` +
          `not a broken test and not a code defect.\n` +
          `        TO FIX: ${REFILL_HINT}\n` +
          `        The other possibility is that ${ADMIN_ORIGIN} does not share the production ` +
          `KV namespace. The admin cases below did not run.`,
    );
  } else {
    /*
     * State which credential ran: the smoke token is read-only, so its green says nothing about
     * writes; the cookie is Dustin, so its green says nothing about CI.
     */
    console.log(
      CREDENTIAL === "smoke"
        ? `\n  admin credential: THE SMOKE TOKEN, read from ${SMOKE_SOURCE}` +
          `\n  admin cases: observing ${ADMIN_ORIGIN} (DEPLOYED, not the preview build)` +
          `\n  the smoke actor is READ ONLY: every case below is a GET, and no write surface is exercised\n`
        : `\n  admin credential: the pasted session cookie, read from ${COOKIE_SOURCE}` +
          `\n  NO SMOKE TOKEN was found, so these cases needed a human to supply a session.` +
          `\n  To run them unattended, see RECOVERY.md: node scripts/mint-smoke-token.mjs` +
          `\n  admin cases: observing ${ADMIN_ORIGIN} (DEPLOYED, not the preview build)\n`,
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
     * The shell (sidebar and topbar) is the assertion, not the title, which survives an empty
     * body. The login page is named, because a bounced session renders a complete page.
     */
    const SURFACES = [
      ["/admin", "the cockpit"],
      ["/admin/posts", "the posts list"],
      ["/admin/media?view=grid", "the media library, grid"],
      ["/admin/media?view=list", "the media library, list"],
      ["/admin/tools", "tools"],
      ["/admin/origin-requests", "origin requests"],
      ["/admin/mentions", "the mentions queue"],
    ];
    for (const [path, what] of SURFACES) {
      await admin.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "networkidle0" });
      const r = await admin.evaluate(() => ({
        sidebar: !!document.querySelector(".admin-sidebar"),
        topbar: !!document.querySelector(".admin-topbar"),
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

    /* Asserted as resolved color against the token, never a hex: @import order decides what wins. */
    /* Throws on anything but a hex: parseInt("") is NaN, NaN shifts to 0, and rgb(0, 0, 0) is also
       SVG's default fill, so an unresolved --brand and a lost fill rule would agree and pass. */
    const rgb = (/** @type {string} */ hex) => {
      const h = hex.trim().replace("#", "");
      if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) {
        throw new Error(`rgb(): ${JSON.stringify(hex)} is not a 3 or 6 digit hex`);
      }
      const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    const isHex = (/** @type {string} */ v) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

    await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
    const adminMark = await admin.evaluate(() => {
      const el = document.querySelector(".admin-brand-mark .site-logo-brand");
      const root = getComputedStyle(document.documentElement);
      return {
        present: !!el,
        fill: el ? getComputedStyle(el).fill : "",
        brand: root.getPropertyValue("--brand").trim(),
      };
    });
    ok(
      "the admin sidebar mark exists to measure",
      adminMark.present,
      "no .admin-brand-mark .site-logo-brand, so the fill assertion below would examine nothing",
    );
    ok(
      "the admin mark's fill resolves to --brand, the base binding in app.css",
      adminMark.present && isHex(adminMark.brand) && adminMark.fill === rgb(adminMark.brand),
      isHex(adminMark.brand)
        ? `fill is ${JSON.stringify(adminMark.fill)} and --brand is ${JSON.stringify(adminMark.brand)} ` +
            `(${rgb(adminMark.brand)}). The base rule in app.css is not reaching the admin mark.`
        : `--brand resolved to ${JSON.stringify(adminMark.brand)} on the admin plane, not a hex, so ` +
            `there is nothing for the fill to be compared with.`,
    );

    await admin.goto(`${ADMIN_ORIGIN}/`, { waitUntil: "networkidle0" });
    const publicMark = await admin.evaluate(() => {
      const paths = [...document.querySelectorAll(".site-header .site-header-mark path")];
      const fill = (/** @type {Element} */ el) => getComputedStyle(el).fill;
      return {
        total: paths.length,
        brand: paths.filter((el) => el.classList.contains("site-logo-brand")).map(fill),
        warm: paths.filter((el) => !el.classList.contains("site-logo-brand")).map(fill),
        token: getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
      };
    });
    ok(
      "the public header mark exists to measure",
      publicMark.total === 8 && publicMark.brand.length === 5 && publicMark.warm.length === 3,
      `the header drew ${publicMark.total} paths, ${publicMark.brand.length} of them branded, so ` +
        `the fill assertions below would examine nothing.`,
    );
    ok(
      "the public header mark's purple resolves to --brand, the base binding in app.css",
      publicMark.brand.length > 0 &&
        isHex(publicMark.token) &&
        publicMark.brand.every((f) => f === rgb(publicMark.token)),
      `fills are ${JSON.stringify(publicMark.brand)} and --brand is ` +
        `${JSON.stringify(publicMark.token)} (${isHex(publicMark.token) ? rgb(publicMark.token) : "not a hex"}). Ruling 118.2 ` +
        `removed the header override, so the (0,1,0) base in app.css has to reach the mark, ` +
        `which is what the sixteen-file split put at risk.`,
    );
    // Asserted by difference, not against hexes whose owner is site-logo.tsx: one ink means all eight
    // paths compute to the same fill, and hex equality would pass a mark re-inked to those hexes.
    ok(
      "the public header mark's warm paths keep their own fills, so the mark is not one ink",
      publicMark.warm.length > 0 &&
        publicMark.warm.every((f) => f && !publicMark.brand.includes(f)) &&
        new Set(publicMark.warm).size === publicMark.warm.length,
      `warm fills are ${JSON.stringify(publicMark.warm)} against purple ` +
        `${JSON.stringify(publicMark.brand[0])}. A stylesheet is repainting the presentation ` +
        `attributes site-logo.tsx sets, which is the one-ink header ruling 118.2 retired.`,
    );

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
      const head = document.querySelector(".media-list-head");
      if (!head) return null;
      const cells = [...head.querySelectorAll(".media-col-head")].map((el) => ({
        label: (el.textContent || "").trim(),
        active: el.classList.contains("is-active"),
        sortable: el.tagName.toLowerCase() === "a",
        href: el.getAttribute("href") || "",
        sortKey: el.getAttribute("data-sort") || "",
        ariaSort: el.getAttribute("aria-sort") || "",
      }));
      return { cells };
    });

    ok(
      "/admin/media?view=list: the list view renders its header row",
      !!listHead && listHead.cells.length >= 5,
      listHead
        ? `${listHead.cells.length} header cell(s), expected the five columns`
        : "no .media-list-head at all, so the sort assertions below examine nothing",
    );
    ok(
      "the list header marks exactly the column the URL sorted by",
      !!listHead &&
        listHead.cells.filter((c) => c.active).length === 1 &&
        listHead.cells.some((c) => c.active && c.label.startsWith("Size")),
      listHead
        ? `active: ${listHead.cells.filter((c) => c.active).map((c) => c.label).join(", ") || "(none)"}. ` +
          `The URL asked for sort=size, so Size and nothing else should carry is-active.`
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
      "exactly one column carries a live aria-sort, and it is the sorted one",
      !!listHead &&
        listHead.cells.filter((c) => c.ariaSort && c.ariaSort !== "none").length === 1 &&
        listHead.cells.some(
          (c) => c.ariaSort === "descending" && c.label.startsWith("Size"),
        ),
      listHead
        ? `aria-sort values ${JSON.stringify(
            listHead.cells.filter((c) => c.sortable).map((c) => `${c.label}=${c.ariaSort}`),
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
        const panel = document.querySelector(".media-detail");
        if (!panel) return null;
        const r = panel.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          namesKey: (panel.textContent || "").includes(wanted.slice(0, 12)),
          hasClose: !!panel.querySelector(".media-detail-close"),
        };
      }, firstKey);

      ok(
        "/admin/media?key=: the inspector opens on a key in the URL",
        !!inspector,
        "no .media-detail rendered for a key taken off the library page itself. The inspector " +
          "is URL-driven by design, so this is the whole of that contract.",
      );
      ok(
        "the inspector is actually laid out, not present and collapsed",
        !!inspector && inspector.width > 200 && inspector.height > 100,
        inspector
          ? `.media-detail measures ${inspector.width}x${inspector.height}. A panel that exists ` +
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
    const beforeSelect = await admin.evaluate(() => !!document.querySelector(".posts-bulk"));
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
        .waitForSelector(".posts-bulk", { timeout: 5000 })
        .catch(() => null);
      const bulk = await admin.evaluate(() => {
        const bar = document.querySelector(".posts-bulk");
        if (!bar) return null;
        const count = bar.querySelector(".posts-bulk-count");
        const size = bar.querySelector(".posts-bulk-size");
        return {
          count: (count?.textContent || "").trim(),
          size: (size?.textContent || "").trim(),
          live: count?.getAttribute("aria-live") || "",
          label: bar.getAttribute("aria-label") || "",
        };
      });

      ok(
        "selecting one row opens the bulk bar",
        !!bulk,
        "clicking a row checkbox did not produce .posts-bulk. Either the page is not hydrated " +
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
        !!bulk && bulk.live === "polite" && bulk.label.length > 0,
        bulk ? `aria-live=${JSON.stringify(bulk.live)} aria-label=${JSON.stringify(bulk.label)}` : "not measured",
      );
    }

    // The one confirmation a GET reaches; the others open from `actionData` and need a POST.
    // It never submits: the enabled state is the assertion.
    await admin.goto(`${ADMIN_ORIGIN}/admin/media?confirm=empty-trash`, {
      waitUntil: "networkidle0",
    });
    /* The Trash chip's count, so "no modal" can be told apart from "empty trash". */
    const trashed = await admin.evaluate(() => {
      const chip = [...document.querySelectorAll(".admin-chip")].find((a) =>
        /^\s*Trash\b/.test(a.textContent ?? ""),
      );
      const count = chip?.querySelector(".admin-chip-count")?.textContent?.trim() ?? "";
      return /^\d+$/.test(count) ? Number(count) : null;
    });
    ok(
      "/admin/media shows how many files are in the trash",
      trashed !== null,
      "no Trash chip with a numeric count, so an absent confirmation could not be told apart " +
        "from an empty trash",
    );
    const modal = await admin.evaluate(() => {
      const panel = document.querySelector(".media-modal");
      if (!panel) return null;
      const prompt = panel.querySelector(".media-modal-typed .sr-only");
      const typed = /Type\s+(\S+)\s+to confirm/i.exec(prompt?.textContent || "");
      return {
        role: panel.getAttribute("role") || "",
        modal: panel.getAttribute("aria-modal") || "",
        required: typed ? typed[1] : "",
        hasInput: !!panel.querySelector(".media-modal-typed input"),
        confirmDisabled: !!panel.querySelector(".media-modal-actions .btn-danger[disabled]"),
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
        modal.role === "dialog" && modal.modal === "true",
        `role=${JSON.stringify(modal.role)} aria-modal=${JSON.stringify(modal.modal)}. This ` +
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
        const field = ".media-modal-typed input";
        // The WRONG value first. A button that enables on any input at all would
        // pass an assertion that only ever typed the right answer.
        await admin.type(field, `${modal.required}x`);
        const afterWrong = await admin.evaluate(
          () => !!document.querySelector(".media-modal-actions .btn-danger[disabled]"),
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
          () => !!document.querySelector(".media-modal-actions .btn-danger[disabled]"),
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
    /* A rule count proves `app/admin.css` arrived; the computed style proves the cascade applied it. */
    await admin.setViewport({ width: 1280, height: 900 });
    await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
    const rules = await admin.evaluate(countCssRules);
    const adminCss = await admin.evaluate(() => {
      const sidebar = document.querySelector(".admin-sidebar");
      const style = sidebar ? getComputedStyle(sidebar) : null;
      return {
        sheets: [...document.styleSheets].length,
        display: style?.display ?? "",
        width: style ? Math.round(parseFloat(style.width)) : 0,
      };
    });
    ok(
      "the ADMIN stylesheet is actually applied where the layout is measured",
      rules >= 670,
      `${rules} CSS rule(s) across ${adminCss.sheets} sheet(s), floor 670, ` +
        `measured 730 on 2026-08-28. Below this admin.css did not load and every ` +
        `overflow number below is about browser defaults.` +
        `
        RE-MEASURED because the public half shrank, not because the admin ` +
        `half did. The old figure was 965 on 2026-08-24, read as 351 public plus 614 ` +
        `admin. The per-route CSS split of 2026-08-27 took the public sheet down to the ` +
        `chrome, so an admin page now loads roughly 116 public rules beside the same ` +
        `admin bundle. A floor set against the old sum is a floor no correct build can ` +
        `clear, which is the unfailable-floor class inverted and is how this same ` +
        `assertion failed after the 2026-08-23 admin split.`,
    );
    ok(
      "the admin shell is laid out by admin.css, not by the browser default",
      adminCss.display === "flex" && adminCss.width > 100,
      `.admin-sidebar computed display=${adminCss.display || "(none)"} width=${adminCss.width}px. ` +
        `An unstyled sidebar is a block at full width, which would make the overflow ` +
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
      const el = document.querySelector(".admin-topbar");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const kids = [...el.children].map((k) => {
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
      "the admin topbar exists to measure at 320px",
      bar !== null,
      "no .admin-topbar, so the containment assertion below would examine nothing",
    );
    ok(
      "no admin topbar child overflows the bar at 320px",
      bar !== null && bar.out.length === 0,
      bar === null
        ? "not measured"
        : `bar ends at ${bar.right} and ${bar.out
            .map((k) => `${k.sel}@${k.right}`)
            .join(", ")} extend past it. The document may not scroll, but the ` +
          `controls are being clipped.`,
    );

    // Compared by accessible name, since a swap holds a count steady. Opened via the `open`
    // property, as a scriptless `<summary>` click does.
    const NARROW = 375;
    const topbarActions = async (/** @type {number} */ width, /** @type {boolean} */ openDetails) => {
      await admin.setViewport({ width, height: 800 });
      await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
      return admin.evaluate((shouldOpen) => {
        const bar = document.querySelector(".admin-topbar");
        if (!bar) return { names: [], details: 0, summary: "" };
        const detailsEls = [...bar.querySelectorAll("details")];
        if (shouldOpen) for (const d of detailsEls) d.open = true;
        const names = [];
        for (const el of bar.querySelectorAll(
          'a[href], button, summary, input:not([type="hidden"]), select, textarea',
        )) {
          // display:none is out of the accessibility tree, so it is not
          // reachable and must not be counted at either width.
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const name = (
            el.getAttribute("aria-label") ||
            el.textContent ||
            ""
          )
            .replace(/\s+/g, " ")
            .trim();
          if (name) names.push(name);
        }
        return {
          names: [...new Set(names)].sort(),
          details: detailsEls.length,
          summary: detailsEls[0]?.querySelector("summary")?.tagName ?? "",
        };
      }, openDetails);
    };

    const wide = await topbarActions(1280, false);
    const narrow = await topbarActions(NARROW, true);

    // An empty wide set makes the subset test vacuously true.
    ok(
      "the wide admin topbar offers actions to compare against",
      wide.names.length >= 2,
      `only ${wide.names.length} named control(s) at 1280px: [${wide.names.join(" | ")}]. ` +
        `The subset assertion below would agree with anything.`,
    );
    ok(
      `the folded topbar is a native disclosure at ${NARROW}px`,
      narrow.details >= 1 && narrow.summary === "SUMMARY",
      `${narrow.details} <details> in the bar, first summary tag ` +
        `${JSON.stringify(narrow.summary)}. The fold has to open with no script, so a ` +
        `button plus a state hook is not the shape; the progressive-enhancement rule and the admin plane's ` +
        `own no-script door.`,
    );

    const lost = wide.names.filter((name) => !narrow.names.includes(name));
    ok(
      `every wide topbar action is still reachable at ${NARROW}px through the disclosure`,
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
