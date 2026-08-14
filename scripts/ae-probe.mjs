/**
 * Does a CACHED serve reach the Worker, and therefore Analytics Engine?
 *
 * The cockpit's traffic panel counts what Analytics Engine recorded. With
 * `cache.enabled` on, an edge HIT may never invoke the Worker, in which case
 * the panel is counting ORIGIN REQUESTS rather than reads, and it has to say
 * so. This script measures which it is, before any panel exists.
 *
 *   npm run ae-probe
 *
 * It needs a Cloudflare API token with Account, Account Analytics, Read, in
 * ANALYTICS_READ_TOKEN. It fails closed and prints a plain sentence if the
 * variable is absent. IT NEVER PRINTS THE TOKEN, any request header, or any
 * URL carrying a credential. The final block is numbers only and is safe to
 * paste anywhere.
 *
 * METHOD. Three fetches, each followed by its own poll, so a point is
 * attributable to the fetch that caused it rather than to a batch:
 *
 *   W  plain GET, warms the edge entry              expect MISS
 *   H  plain GET again, should come from the cache  expect HIT
 *   N  GET with `cache-control: no-cache`           expect a bypass
 *
 * W exists because a cache-eligible fetch that MISSES proves nothing about a
 * HIT: it reaches the origin by definition. Only H answers the question.
 *
 * THE BYPASS MECHANISM IS NOT INVENTED HERE. It is read from the live gate:
 * `scripts/verify-live.mjs:108` sends `cache-control: no-cache` on every
 * request, and the cache-eligible plain GET is that file's `warm` helper at
 * `scripts/verify-live.mjs:992` to `997`, which deliberately omits the header
 * because cache behaviour is its subject.
 *
 * EVERY COUNT IS SAMPLING WEIGHTED. Analytics Engine samples, and the
 * documented way to count events is `SUM(_sample_interval)`, not `COUNT()`.
 * A raw `COUNT()` silently undercounts the moment sampling engages, so the
 * weighted figure is the measurement and the row count is carried only as a
 * diagnostic that shows whether sampling is active at all.
 *
 * OBSERVATION BOUNDARY. `writeDataPoint` is fire and forget and
 * `workers/app.ts:286` swallows any throw, so a point that APPEARS is strong
 * evidence the Worker ran, while a point that does NOT appear is weaker
 * evidence that it did not: the write could have been dropped instead. The
 * report states that ambiguity whenever a fetch produces no point.
 */

import { setTimeout as sleep } from "node:timers/promises";

const ORIGIN = "https://dustinedwards.dustin-edwards.workers.dev";
const ACCOUNT = "f852925ce701e6c56f6feae83f0eb2d3";
const DATASET = "dustinedwards_traffic";
const PATH = "/playground";
const UA = "dustinedwards-ae-probe";

/** Poll cadence and cap, stated rather than implied. */
const POLL_SECONDS = 10;
const CAP_SECONDS = 240;
/** Consecutive equal readings that count as settled. */
const STABLE_READS = 2;

const TOKEN = process.env.ANALYTICS_READ_TOKEN;
if (!TOKEN) {
  console.error(
    "ANALYTICS_READ_TOKEN is not set in this environment, so there is nothing to " +
      "query with. Export a Cloudflare API token scoped to Account, Account " +
      "Analytics, Read, then run this again.",
  );
  process.exit(1);
}

const SQL_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`;

let shapeShown = false;

/**
 * Runs one read-only statement against the SQL API.
 *
 * @param {string} query
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function sql(query) {
  const res = await fetch(SQL_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}` },
    body: query,
  });
  const text = await res.text();
  if (!res.ok) {
    // The API echoes the QUERY on error, never the credential, so this is safe.
    console.error(`SQL API returned ${res.status}. Body: ${text.slice(0, 400)}`);
    process.exit(1);
  }
  if (!shapeShown) {
    console.log("  response shape, first call only:");
    console.log("    " + text.slice(0, 240).replace(/\n/g, "\n    "));
    shapeShown = true;
  }
  const json = JSON.parse(text);
  return json.data ?? [];
}

/**
 * Sampling-weighted origin requests for PATH, plus the raw row count.
 *
 * @returns {Promise<{ weighted: number, rows: number }>}
 */
async function counts() {
  const data = await sql(
    `SELECT SUM(_sample_interval) AS origin_requests, COUNT() AS rows ` +
      `FROM ${DATASET} ` +
      `WHERE timestamp >= NOW() - INTERVAL '1' DAY AND blob1 = '${PATH}'`,
  );
  const row = data[0] ?? {};
  return {
    weighted: Number(row.origin_requests ?? 0),
    rows: Number(row.rows ?? 0),
  };
}

/**
 * Polls until the weighted count settles: STABLE_READS consecutive equal
 * readings. Used for the baseline so the experiment does not start mid flight.
 *
 * @returns {Promise<{ weighted: number, rows: number, waited: number }>}
 */
async function settle() {
  let last = await counts();
  let same = 1;
  let waited = 0;
  while (same < STABLE_READS && waited < CAP_SECONDS) {
    await sleep(POLL_SECONDS * 1000);
    waited += POLL_SECONDS;
    const now = await counts();
    same = now.weighted === last.weighted ? same + 1 : 1;
    last = now;
  }
  return { ...last, waited };
}

/**
 * One fetch. `bypass` sends the verify-live no-cache header.
 *
 * @param {string} label
 * @param {boolean} bypass
 * @returns {Promise<string>} the cf-cache-status
 */
async function fetchOnce(label, bypass) {
  /** @type {Record<string, string>} */
  const headers = { "user-agent": UA };
  if (bypass) headers["cache-control"] = "no-cache";
  const res = await fetch(`${ORIGIN}${PATH}`, { headers, redirect: "manual" });
  await res.text();
  const cf = res.headers.get("cf-cache-status") ?? "(none)";
  console.log(`  ${label}: HTTP ${res.status}, cf-cache-status ${cf}`);
  return cf;
}

/**
 * Polls until the weighted count rises above `from`, or the cap elapses.
 *
 * @param {number} from
 * @returns {Promise<{ weighted: number, rows: number, lag: number | null }>}
 */
async function waitForRise(from) {
  const started = Date.now();
  let waited = 0;
  while (waited <= CAP_SECONDS) {
    const now = await counts();
    if (now.weighted > from) {
      return { ...now, lag: Math.round((Date.now() - started) / 1000) };
    }
    await sleep(POLL_SECONDS * 1000);
    waited += POLL_SECONDS;
  }
  const now = await counts();
  return { ...now, lag: null };
}

console.log("Analytics Engine cache-interaction probe");
console.log(`  path    ${PATH}`);
console.log(`  dataset ${DATASET}`);
console.log(`  poll    every ${POLL_SECONDS}s, cap ${CAP_SECONDS}s per stage`);
console.log(`  bypass  cache-control: no-cache, per scripts/verify-live.mjs:108`);
console.log(`  eligible plain GET, per scripts/verify-live.mjs:992-997\n`);

const base = await settle();
console.log(
  `\n  baseline settled after ${base.waited}s: origin_requests=${base.weighted} rows=${base.rows}\n`,
);

const cfW = await fetchOnce("W plain GET, warming", false);
const rW = await waitForRise(base.weighted);
console.log(
  `    origin_requests ${base.weighted} to ${rW.weighted}, ` +
    `lag ${rW.lag === null ? "NO RISE within cap" : rW.lag + "s"}\n`,
);

const cfH = await fetchOnce("H plain GET, expecting a cache HIT", false);
const rH = await waitForRise(rW.weighted);
console.log(
  `    origin_requests ${rW.weighted} to ${rH.weighted}, ` +
    `lag ${rH.lag === null ? "NO RISE within cap" : rH.lag + "s"}\n`,
);

const cfN = await fetchOnce("N cache-bypassed", true);
const rN = await waitForRise(rH.weighted);
console.log(
  `    origin_requests ${rH.weighted} to ${rN.weighted}, ` +
    `lag ${rN.lag === null ? "NO RISE within cap" : rN.lag + "s"}\n`,
);

const producedW = rW.weighted > base.weighted;
const producedH = rH.weighted > rW.weighted;
const producedN = rN.weighted > rH.weighted;
const lags = [rW.lag, rH.lag, rN.lag].filter((/** @type {number | null} */ l) => l !== null);

console.log("================ PASTE THIS BLOCK BACK ================");
console.log(`path                  ${PATH}`);
console.log(`baseline              ${base.weighted}`);
console.log(`W  cf=${cfW}  after=${rW.weighted}  produced_point=${producedW}  lag=${rW.lag ?? "none"}`);
console.log(`H  cf=${cfH}  after=${rH.weighted}  produced_point=${producedH}  lag=${rH.lag ?? "none"}`);
console.log(`N  cf=${cfN}  after=${rN.weighted}  produced_point=${producedN}  lag=${rN.lag ?? "none"}`);
console.log(`ingestion lag observed ${lags.length > 0 ? Math.min(...lags) + "s to " + Math.max(...lags) + "s" : "none observed"}`);
console.log(`weighted vs rows      ${rN.weighted} vs ${rN.rows}`);
console.log(
  `sampling active       ${rN.weighted !== rN.rows ? "YES, weighted exceeds row count" : "no, one row weighs one"}`,
);
if (!producedW || !producedH || !producedN) {
  console.log(
    "ambiguity             a fetch produced no point. writeDataPoint is fire and\n" +
      "                      forget and workers/app.ts:286 swallows throws, so this\n" +
      "                      is consistent with the Worker not running AND with the\n" +
      "                      Worker running and the write being dropped.",
  );
}
console.log("======================================================");
