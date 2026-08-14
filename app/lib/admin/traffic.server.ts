/**
 * The origin-requests source: Analytics Engine, read over the SQL API.
 *
 * SERVER ONLY. `.server.ts` so a leak into the client bundle is a build break
 * rather than a review catch. Nothing Analytics-related reaches the browser
 * except the rendered rows: not the token, not the account id, not the query.
 *
 * WHY THE PANEL SAYS ORIGIN REQUESTS. The dataset is written from the Worker's
 * response path in `workers/app.ts`, and `cache.enabled` means an edge HIT can
 * serve a reader without the Worker running. Every number here is therefore a
 * count of times the origin was reached, which is a floor under readership and
 * not a measure of it. The panel is labelled accordingly, everywhere.
 *
 * EVERY AGGREGATE IS SAMPLING WEIGHTED. Analytics Engine samples, and the
 * documented way to count events is `SUM(_sample_interval)`. A raw `COUNT()`
 * reads correctly at low volume and then silently undercounts the moment
 * sampling engages, which is the worst failure shape available: a number that
 * stays plausible while becoming wrong. The unweighted row count is carried
 * alongside only as the diagnostic for whether sampling is active.
 *
 * IT FAILS CLOSED, AND THAT IS THE ORDINARY CASE. `ANALYTICS_READ_TOKEN` is
 * optional by contract, exactly as `OPERATOR_TOKEN` is, and a development
 * machine will never carry it. Absence therefore returns the error result
 * rather than throwing: a thrown loader would take out the admin route segment
 * and replace the cockpit with an error boundary, which is a far worse outcome
 * than one panel saying it cannot read.
 */

import { TOP_N, WINDOW_DAYS } from "./origin-requests.mjs";
import type { SourceResult, TrafficReport, TrafficRow } from "./types";

/** The dataset written by `recordTraffic` in workers/app.ts. */
const DATASET = "dustinedwards_traffic";

/**
 * Builds the panel query.
 *
 * Exported so the gate can assert its SHAPE without a network call or a token.
 *
 * `INTERVAL '7' DAY` in the QUOTED form. The unquoted `INTERVAL 7 DAY` is
 * rejected by this API and that is recorded law, not a preference. Verified
 * against the current Analytics Engine SQL API documentation before first use.
 *
 * @param windowDays how far back to look
 * @param limit how many paths to return
 */
export function trafficQuery(windowDays: number, limit: number) {
  return (
    `SELECT blob1 AS path, ` +
    `SUM(_sample_interval) AS origin_requests, ` +
    `COUNT() AS sampled_rows ` +
    `FROM ${DATASET} ` +
    `WHERE timestamp >= NOW() - INTERVAL '${windowDays}' DAY ` +
    `GROUP BY path ` +
    `ORDER BY origin_requests DESC ` +
    `LIMIT ${limit}`
  );
}

/**
 * Total across every path in the window, so the top N can state what it omits.
 *
 * A separate statement because the SQL API takes one per request. Two cheap
 * aggregates beat presenting a truncated list as if it were the whole picture.
 *
 * @param windowDays how far back to look
 */
export function trafficTotalQuery(windowDays: number) {
  return (
    `SELECT SUM(_sample_interval) AS origin_requests, ` +
    `COUNT(DISTINCT blob1) AS paths ` +
    `FROM ${DATASET} ` +
    `WHERE timestamp >= NOW() - INTERVAL '${windowDays}' DAY`
  );
}

/** One read-only statement against the SQL API. */
async function runSql(env: Env, query: string): Promise<Array<Record<string, unknown>>> {
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.ANALYTICS_READ_TOKEN}` },
      body: query,
    },
  );
  if (!res.ok) {
    // The status is carried, the body is not: an API error body can echo the
    // query, and there is no reason to route that to a rendered page.
    throw new Error(`Analytics Engine returned ${res.status}`);
  }
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  return json.data ?? [];
}

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Reads the window and returns the panel's report.
 *
 * @param env the Worker environment
 */
export async function fetchTraffic(env: Env): Promise<SourceResult<TrafficReport>> {
  if (!env.ANALYTICS_READ_TOKEN) {
    return {
      status: "error",
      data: null,
      message:
        "No Analytics Engine read token is configured, so this panel has nothing to " +
        "query. Set ANALYTICS_READ_TOKEN as a Worker secret to turn it on.",
    };
  }

  try {
    const [pathRows, totalRows] = await Promise.all([
      runSql(env, trafficQuery(WINDOW_DAYS, TOP_N)),
      runSql(env, trafficTotalQuery(WINDOW_DAYS)),
    ]);

    const rows: TrafficRow[] = pathRows.map((row) => ({
      path: String(row.path ?? ""),
      originRequests: num(row.origin_requests),
      rows: num(row.sampled_rows),
    }));
    const total = totalRows[0] ?? {};

    return {
      status: "live",
      data: {
        windowDays: WINDOW_DAYS,
        rows,
        totalOriginRequests: num(total.origin_requests),
        pathsReturned: num(total.paths),
      },
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      data: null,
      message:
        error instanceof Error
          ? `Could not read Analytics Engine: ${error.message}`
          : "Could not read Analytics Engine.",
    };
  }
}
