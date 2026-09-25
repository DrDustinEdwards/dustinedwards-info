// Public cases drive a preview build because the dev server serves the page unstyled.
// Admin cases always drive ADMIN_ORIGIN, because sessions live in production KV.
//
// This file is the orchestrator and the floor. The credential, the preview server, the seeds and
// the shared helpers live in scripts/lib/browser/, and each case group in scripts/lib/browser/cases/.
// The cases share ONE page and run in this order, so a case that navigates voids the ones after it.

import puppeteer from "puppeteer";

import * as admin from "./lib/browser/cases/admin.mjs";
import * as enhancements from "./lib/browser/cases/enhancements.mjs";
import * as healthTile from "./lib/browser/cases/health-tile.mjs";
import * as layout from "./lib/browser/cases/layout.mjs";
import * as lightbox from "./lib/browser/cases/lightbox.mjs";
import * as math from "./lib/browser/cases/math.mjs";
import * as navigation from "./lib/browser/cases/navigation.mjs";
import * as playground from "./lib/browser/cases/playground.mjs";
import * as postControls from "./lib/browser/cases/post-controls.mjs";
import * as scriptSet from "./lib/browser/cases/script-set.mjs";
import * as speculation from "./lib/browser/cases/speculation.mjs";
import * as themeCache from "./lib/browser/cases/theme-cache.mjs";
import { BASE, DRIVES_PREVIEW, countCssRules, ok, skipped, tally } from "./lib/browser/harness.mjs";
import {
  build,
  cleanupChildren,
  killChildren,
  preflight,
  registry,
  serverDiagnosis,
  startServer,
  waitForServer,
} from "./lib/browser/preview-server.mjs";
import { seedPreview } from "./lib/browser/seed.mjs";
import { assertFloor } from "./lib/floor.mjs";

/** Not `skipped.length`: that cannot tell a rejected session from a completed run. */
let adminCasesRan = false;

console.log("\ncheck:browser\n");

await preflight();

build();

const mathPreviewSeeded = seedPreview();

startServer();

/**
 * Declared before the signal handlers that close over it (temporal dead zone).
 *
 * @type {import("puppeteer").Browser | undefined}
 */
let browser;

/*
 * `taskkill /F` delivers no signal; the registry covers it. `process.exit`, because
 * returning resumes a gate whose children are gone.
 */
for (const signal of /** @type {NodeJS.Signals[]} */ (["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"])) {
  process.on(signal, () => {
    /* --keep holds here too: an interrupted --keep run keeps what the flag asked to keep, and its
       registry entries, which the next preflight needs to free the port. */
    if (process.argv.includes("--keep")) {
      console.error(`\ncheck:browser interrupted by ${signal}. --keep: its children are left running.`);
      process.exit(1);
    }
    console.error(`\ncheck:browser interrupted by ${signal}. Stopping its children.`);
    killChildren(browser);
    process.exit(1);
  });
}

let subjectReachable = true;
try {
  if (!(await waitForServer())) {
    console.error(`check:browser failed. ${serverDiagnosis()}`);
    await cleanupChildren(browser);
    /*
     * Not `process.exit()`: with the probe's undici handle in flight, libuv aborts on
     * Windows.
     */
    process.exitCode = 1;
    subjectReachable = false;
    throw new Error("SUBJECT_UNREACHABLE");
  }

  browser = await puppeteer.launch({ headless: true });
  /* The Puppeteer cache path, not "chrome", so cleanup never reaches a user's browser. */
  registry.record(browser.process()?.pid, "the Puppeteer browser", [".cache/puppeteer"]);
  const page = await browser.newPage();

  console.log(
    DRIVES_PREVIEW
      ? `  public cases: observing the PREVIEW BUILD of the working tree (${BASE})`
      : `  public cases: observing ${BASE} (DEPLOYED). This run says nothing about uncommitted work.`,
  );

  /* Scope first: an unstyled page would pass every layout assertion below. */
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
  const css = await page.evaluate(countCssRules);
  ok(
    "the blog page's stylesheets are actually applied",
    css >= 144,
    `${css} CSS rule(s) reachable on /blog, floor 144, measured 157 on 2026-08-27 ` +
      `after the per-route CSS split. Below this the page is effectively unstyled ` +
      `and every layout assertion below is measuring browser defaults.`,
  );

  const ctx = { page, browser };
  await healthTile.run(ctx);
  await themeCache.run(ctx);
  await navigation.run(ctx);
  await speculation.run(ctx);
  await layout.run(ctx);
  await math.run(ctx, mathPreviewSeeded);
  await playground.run(ctx);
  const { publicConsoleErrors, enhanceStems, codePost, probedPost } = await enhancements.run(ctx);
  const postForShape = await postControls.run(ctx, { codePost, probedPost });
  await lightbox.run(ctx);
  await scriptSet.run(ctx, { postForShape, enhanceStems, publicConsoleErrors });
  adminCasesRan = await admin.run(ctx);

} catch (error) {
  // Only the sentinel is swallowed: a harness that eats unknown errors reports a clean failure
  // for a broken instrument.
  if (!(error instanceof Error) || error.message !== "SUBJECT_UNREACHABLE") throw error;
} finally {
  await cleanupChildren(browser);
}

/* Only if something was measured: an unreachable subject would print `0 checks, 0 failures`. */
if (subjectReachable) {
  /* Each floor sits `max(3, ceil(count * 0.05))` under a measured run; re-measure when touching this file. */
  const MINIMUM_CHECKS = DRIVES_PREVIEW ? 248 : 230;
  console.log(
    `\n${tally.checks} checks, ${tally.failures} failures` +
      (skipped.length ? `, ${skipped.length} skipped` : "") +
      "\n",
  );
  if (!adminCasesRan) {
    console.log(
      "  NOT COVERED: the admin plane. No surface under /admin was rendered, the editor\n" +
        "  mount was not checked, neither mark fill was measured, and NOTHING ON THIS PLANE\n" +
        "  WAS MEASURED AT ANY NARROW WIDTH. The public pages are gated at 320 and the admin\n" +
        "  plane was not, which is how it came to scroll sideways below 576 unnoticed. The\n" +
        "  run above is RED for this reason since 2026-09-06: it used to be a skip under a\n" +
        "  halved floor, which let a quarter-run print green. A\n" +
        "  green result above is a statement about the public pages only.\n",
    );
  }

  /* Widening the read-only credential to reach these would grant the authority the design withholds. */
  console.log(
    "  REMAINING HUMAN, and why:\n" +
      "    BY CONSTRUCTION, and deliberately permanent:\n" +
      "      - the single-delete and index-rebuild confirmations. Both open from actionData,\n" +
      "        so reaching them needs the POST a read-only credential is refused. Their SERVER\n" +
      "        half is gated by check:destructive; only the browser half is uncovered.\n" +
      "      - every write outcome: upload, tag, trash, restore, rebuild. The gate proves the\n" +
      "        controls RENDER and never that a submission lands.\n" +
      "    BY THE HARNESS:\n" +
      "      - hover states, including the heading permalinks. Puppeteer rejects hover\n" +
      "        emulation, so this is owed as a real-device eyeball.\n" +
      "      - drag and drop onto the library, and the paste-to-upload path. Both need a real\n" +
      "        DataTransfer that the automation API does not synthesise faithfully.\n" +
      "      - the clipboard buttons. The headless permission prompt is not the real one.\n" +
      "    BY JUDGEMENT:\n" +
      "      - whether any of it LOOKS right. Every assertion here is a number or an\n" +
      "        attribute; a page that lays out correctly and is unreadable passes.\n",
  );
  /* Folded into `failures`: `process.exitCode` alone is overwritten by the assignment below. */
  const floorBreach = assertFloor(
    "check:browser",
    DRIVES_PREVIEW ? "checks:preview" : "checks:deployed",
    tally.checks,
    MINIMUM_CHECKS,
  );
  if (floorBreach) {
    console.error(`check:browser REFUSED: ${floorBreach}`);
    tally.fail(floorBreach);
  }
  process.exitCode = tally.failures > 0 ? 1 : 0;

}