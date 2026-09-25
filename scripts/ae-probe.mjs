// The AE write is fire and forget and swallows a throw, so a missing point is only weak evidence
// that the Worker did not run.

import { setTimeout as sleep } from "node:timers/promises";

import { SITE_ORIGIN } from "../app/lib/seo.ts";

// The account id comes from the environment: account-scoped identifiers never go in a tracked file.
const ORIGIN = SITE_ORIGIN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATASET = "dustinedwards_traffic";
const PATH = "/playground";
const UA = "dustinedwards-ae-probe";

const POLL_SECONDS = 10;
const CAP_SECONDS = 240;
const STABLE_READS = 2;

if (!ACCOUNT) {
  console.error(
    "CLOUDFLARE_ACCOUNT_ID is not set in this environment, so there is no account " +
      "to query. It is a var in the Worker's config rather than a secret, and it " +
      "is deliberately not committed; read it out of wrangler.jsonc or the " +
      "Cloudflare dashboard and export it.",
  );
  process.exit(1);
}

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
  // A reshaped answer read as no rows, which the probe reports as NO RISE: a finding it never made.
  if (!Array.isArray(json?.data)) {
    console.error(`SQL API answered without a data array. Body: ${text.slice(0, 400)}`);
    process.exit(1);
  }
  return json.data;
}

/** @returns {Promise<{ weighted: number, rows: number }>} */
async function counts() {
  const data = await sql(
    `SELECT SUM(_sample_interval) AS origin_requests, COUNT() AS rows ` +
      `FROM ${DATASET} ` +
      `WHERE timestamp >= NOW() - INTERVAL '1' DAY AND blob1 = '${PATH}'`,
  );
  // An aggregate always answers one row. SUM over no rows is null, which is zero only when COUNT agrees.
  if (data.length !== 1) {
    console.error(`the count query answered ${data.length} row(s), expected 1: ${JSON.stringify(data).slice(0, 300)}`);
    process.exit(1);
  }
  const row = data[0];
  const rows = Number(row.rows);
  const weighted = row.origin_requests === null && rows === 0 ? 0 : Number(row.origin_requests);
  if (!Number.isFinite(rows) || !Number.isFinite(weighted)) {
    console.error(`the count query answered a row without numeric counts: ${JSON.stringify(row)}`);
    process.exit(1);
  }
  return { weighted, rows };
}

/** @returns {Promise<{ weighted: number, rows: number, waited: number }>} */
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
 * @param {string} label
 * @param {boolean} bypass
 * @returns {Promise<string>}
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
console.log(`  bypass  cache-control: no-cache, per get() in scripts/lib/live/client.mjs`);
console.log(`  eligible plain GET, per warm() in scripts/lib/live/cache.mjs\n`);

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
      "                      forget and recordTraffic in workers/app.ts swallows throws, so this\n" +
      "                      is consistent with the Worker not running AND with the\n" +
      "                      Worker running and the write being dropped.",
  );
}
console.log("======================================================");
