/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import {
  ADMIN_ORIGIN,
  CREDENTIAL,
  CREDENTIAL_ERROR,
  CREDENTIAL_PRESENT,
  SMOKE_SOURCE,
  applyCredential,
  credentialAuthenticates,
  smokeRepair,
} from "../credential.mjs";
import { countCssRules, ok, overflowScan } from "../harness.mjs";

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
      `the ${CREDENTIAL} credential supplied in ${SMOKE_SOURCE} is usable`,
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
      `a ${CREDENTIAL} credential was supplied in ${SMOKE_SOURCE} and no origin was. ` +
        `These cases CANNOT run against the preview server: SMOKE_TOKEN is a wrangler secret and ` +
        `this repo has no .dev.vars by design, so the preview would answer 503 not-configured.\n` +
        `        Set ADMIN_ORIGIN. The admin cases below did not run.`,
    );
  } else if (!(AUTH_RESULT = await credentialAuthenticates(ADMIN_ORIGIN)).ok) {
    ok(
      `the ${CREDENTIAL} credential supplied in ${SMOKE_SOURCE} authenticates against ${ADMIN_ORIGIN}`,
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

    /* The Knowledge Base's file view is the admin's one CodeMirror mount; posts are edited in Carrel. */
    await admin.goto(`${ADMIN_ORIGIN}/admin/kb`, { waitUntil: "networkidle0" });
    const entry = await admin.evaluate(() => {
      const a = document.querySelector('a[href*="/admin/kb/entry/"]');
      return a ? a.getAttribute("href") : null;
    });
    const slug = entry ? `${entry.split("?")[0]}?view=file` : null;

    ok(
      "an editor route was reachable with the supplied session",
      !!slug,
      "no entry link on /admin/kb, so the mount assertions below examine nothing",
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

    /*
     * The library is Capsomer's MediaLibrary over the content kit, tested where it lives (Capsomer's
     * browser suite and site-api's kit tests). What is this site's: that the page draws it with its
     * stylesheet and the site's files in it. Nothing here submits.
     */
    await admin.goto(`${ADMIN_ORIGIN}/admin/media`, { waitUntil: "networkidle0" });
    const library = await admin.evaluate(() => {
      const root = document.querySelector(".cap-media-lib");
      return root
        ? { display: getComputedStyle(root).display, files: root.querySelectorAll(".cap-media-tile").length }
        : null;
    });
    ok(
      "/admin/media draws the shared media library with its stylesheet",
      !!library && library.display !== "inline",
      library
        ? `.cap-media-lib computed display=${library.display}: the media-library stylesheet did not apply`
        : "no .cap-media-lib on the page, so the library did not render",
    );
    ok(
      "the library lists the site's files",
      !!library && library.files > 0,
      library
        ? "no .cap-media-tile in the library: the kit read no files from the site's own API"
        : "not measured",
    );

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
        ["/admin/tools", "tools"],
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

    /*
     * What each width can reach, compared. Capsomer's AdminShell (#386) puts the wide layout's controls in its side strip and
     * menu, with the account's links in the header's avatar panel, and the top bar holds a page's own actions. A phone hides
     * the strip and menu; since Capsomer 0.9.0 the bottom bar holds up to five pages and no More, and the header's menu
     * button opens one sheet with the apps, every page and the account rows. So every part of the shell is measured at both
     * widths and what is displayed decides, with the avatar panel opened at the wide width and the menu sheet at the narrow
     * one, as a click and a tap would. A link is compared by where it goes and a button by its words, with aria-hidden marks
     * left out (the sheet's app link carries a letter mark) and a parenthesis dropped (the sheet's sign-out names the
     * account). A control that only opens another (the menu toggle, the avatar, the menu button) is not itself a place to
     * reach.
     */
    const NARROW = 375;
    const shellReach = async (/** @type {number} */ width, /** @type {boolean} */ openSheet) => {
      await admin.setViewport({ width, height: 800 });
      await admin.goto(`${ADMIN_ORIGIN}/admin`, { waitUntil: "networkidle0" });
      if (openSheet) {
        await admin.click(".cap-site-header-menu");
      } else {
        await admin.click(".cap-site-header-avatar").catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 300));
      return admin.evaluate(() => {
        const names = [];
        for (const el of document.querySelectorAll(
          ".cap-admin-strip, .cap-admin-menu, .cap-admin-bar, .cap-site-header, .cap-site-tabs, dialog.cap-site-header-sheet[open]",
        )) {
          for (const control of el.querySelectorAll(
            'a[href], button, summary, input:not([type="hidden"]), select, textarea',
          )) {
            // display:none is out of the accessibility tree, so it is not
            // reachable and must not be counted at either width.
            const r = control.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (control.matches("[aria-controls], [popovertarget], [aria-haspopup]")) continue;
            const href = control instanceof HTMLAnchorElement ? new URL(control.href) : null;
            const words = control.cloneNode(true);
            if (words instanceof Element) for (const mark of words.querySelectorAll('[aria-hidden="true"]')) mark.remove();
            const name = (control.getAttribute("aria-label") || words.textContent || "")
              .replace(/\s*\([^)]*\)\s*$/, "")
              .replace(/\s+/g, " ")
              .trim();
            if (href && href.origin === location.origin) names.push(`${name} -> ${href.pathname}`);
            else if (name) names.push(name);
          }
        }
        return {
          names: [...new Set(names)].sort(),
          sheet: !!document.querySelector("dialog.cap-site-header-sheet[open]"),
        };
      });
    };

    const wide = await shellReach(1280, false);
    const narrow = await shellReach(NARROW, true);

    // An empty wide set makes the subset test vacuously true.
    ok(
      "the wide admin shell offers places to compare against",
      wide.names.length >= 2,
      `only ${wide.names.length} named control(s) at 1280px: [${wide.names.join(" | ")}]. ` +
        `The subset assertion below would agree with anything.`,
    );
    ok(
      `the phone's header menu button opens the menu sheet at ${NARROW}px`,
      narrow.sheet,
      "no open .cap-site-header-sheet after pressing the menu button, so what the strip and menu hide on a phone has nowhere to go",
    );

    const lost = wide.names.filter((name) => !narrow.names.includes(name));
    ok(
      `every place the wide admin shell reaches is still reachable at ${NARROW}px`,
      lost.length === 0,
      `${lost.length} place(s) disappear when the shell folds: [${lost.join(" | ")}].\n` +
        `        1280px offers [${wide.names.join(" | ")}]\n` +
        `        ${NARROW}px offers [${narrow.names.join(" | ")}]\n` +
        `        A fold that drops controls passes every width assertion above, ` +
        `because nothing overflows if nothing is there.`,
    );

    await admin.close();
  }

  return adminCasesRan;
}
