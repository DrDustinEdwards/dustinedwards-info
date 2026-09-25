/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { HEALTH_POLL_INTERVAL_SECONDS } from "../../../../app/lib/health/snapshot.mjs";
import { HEALTH_FACT_SELECTOR, freshHealthRatio } from "../../health-tile.mjs";
import { BASE, FETCH_TIMEOUT_MS, ok, skip } from "../harness.mjs";

/*
 * `/api/health` is hit first to exercise the snapshot write; the read is
 * cache-busted because the home page is shared-cached.
 */
/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ page }) {
  /** @param {string} tag */
  const readTile = async (tag) => {
    await page.goto(`${BASE}/?browsercase=health-${tag}-${Date.now()}`, {
      waitUntil: "networkidle0",
    });
    const read = await page.evaluate((factSelector) => {
      const el = document.querySelector("[data-health-age]");
      const value = document.querySelector(factSelector);
      return {
        present: !!el,
        age: el ? Number(el.getAttribute("data-health-age")) : null,
        value: value ? value.textContent.trim() : null,
      };
    }, HEALTH_FACT_SELECTOR);
    return { ...read, readAtMs: Date.now() };
  };

  /** @param {{age: number|null, readAtMs: number}} t */
  const writtenAtMs = (t) => t.readAtMs - Number(t.age) * 1000;

  /*
   * Compares write times before and after: a leftover snapshot in persistent KV
   * passes an absolute age check. Polled, because KV reads are edge-cached.
   */
  const before = await readTile("before");

  const primed = await fetch(`${BASE}/api/health`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const primedBody = await primed.text();
  ok(
    "the health endpoint answered, so a snapshot could be written",
    primed.status === 200 || primed.status === 503,
    `${BASE}/api/health answered ${primed.status}. Neither a verdict nor a ` +
      `refusal, so nothing was stored and the tile assertions below would fail ` +
      `for a reason that is not about the tile. Body: ${primedBody.slice(0, 200)}`,
  );

  const POLL_BUDGET_MS = 90_000;
  const POLL_EVERY_MS = 5_000;
  const STAMP_TOLERANCE_MS = 2_000;

  /** @param {{present: boolean, age: number|null, readAtMs: number}} t */
  const isNewer = (t) =>
    t.present && Number.isInteger(t.age) &&
    writtenAtMs(t) > writtenAtMs(before) + STAMP_TOLERANCE_MS;

  let after = await readTile("after");
  let polls = 1;
  if (before.present && Number.isInteger(before.age)) {
    const deadline = Date.now() + POLL_BUDGET_MS;
    while (Date.now() < deadline && !isNewer(after)) {
      await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
      after = await readTile(`after-${polls}`);
      polls += 1;
    }
  }

  ok(
    "the home page carries a health verdict rather than a placeholder",
    after.present,
    `no element on / carries data-health-age. The tile is in its "missing" ` +
      `state, which means the snapshot was not written by the request above ` +
      `or was not read by the loader. Check the APP_KV binding and ` +
      `app/lib/health/snapshot.server.ts.`,
  );

  ok(
    "the tile's age is a number this gate can compare",
    Number.isInteger(after.age) && Number(after.age) >= 0,
    `data-health-age is ${JSON.stringify(after.age)}. A non-numeric age makes ` +
      `both comparisons below vacuous.`,
  );

  ok(
    "the home page's health verdict is inside one poll interval",
    Number.isInteger(after.age) && Number(after.age) < HEALTH_POLL_INTERVAL_SECONDS,
    `the tile reports a verdict ${after.age} second(s) old, which is not under ` +
      `the ${HEALTH_POLL_INTERVAL_SECONDS}s poll interval.`,
  );

  /* Skipped with no first reading: an absent number would pass vacuously. */
  if (before.present && Number.isInteger(before.age)) {
    ok(
      "calling /api/health made the home page's verdict NEWER",
      isNewer(after),
      `the tile reported a snapshot written at ` +
        `${new Date(writtenAtMs(before)).toISOString()} before the call and ` +
        `${after.present ? new Date(writtenAtMs(after)).toISOString() : "nothing"} after ` +
        `it, over ${polls} read(s) across up to ${POLL_BUDGET_MS / 1000}s. A snapshot ` +
        `that is being rewritten moves that timestamp forward; this one did not, ` +
        `which means the page is reading a leftover and NOTHING WROTE ONE. That is ` +
        `the exact defect a leftover in the preview's persistent KV hides from an ` +
        `absolute-age check. The budget is longer than the KV read cache, so a stale ` +
        `READ cannot be the explanation: check that /api/health reached ` +
        `writeHealthSnapshot, and that it did not answer 429 or take the catch path, ` +
        `both of which return before the write.`,
    );
  } else {
    skip(
      "calling /api/health made the home page's verdict NEWER",
      `the first read found no verdict (a genuinely empty KV), so there is no ` +
        `earlier age to compare against. The absolute assertions above still ` +
        `prove a snapshot was written and read; only the differential is ` +
        `unavailable, and it covers itself on the next run.`,
    );
  }

  ok(
    "the tile renders the verdict and not the stale placeholder",
    freshHealthRatio(after.value) !== null,
    `the health fact at ${HEALTH_FACT_SELECTOR} reads ${JSON.stringify(after.value)}. A fresh ` +
      `snapshot renders "N/M passing"; "-- passing" is what the stale and missing states ` +
      `show, and seeing it here means the age assertions above passed on the wrong element.`,
  );

  /* Back to /blog: every case below reuses this page. */
  await page.goto(`${BASE}/blog`, { waitUntil: "networkidle0" });
}
