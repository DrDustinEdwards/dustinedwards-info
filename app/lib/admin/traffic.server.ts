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

import { READERSHIP_PATH_LIMIT, TOP_N, WINDOW_DAYS } from "./origin-requests.mjs";
import type { PostReadership, SourceResult, TrafficReport, TrafficRow } from "./types";

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

/**
 * THE PER-POST READ, and it adds no query. Roadmap item G, first half.
 *
 * The post list wants origin requests for each post's public route. That is the
 * SAME data the origin-requests panel already reads, windowed the same way, so
 * this composes `trafficQuery` and `trafficTotalQuery` above rather than adding
 * a third statement. A second builder would be a second definition of what a
 * window is and what an origin request counts as, and those two would agree
 * until the day one of them was edited.
 *
 * ## ONE READ FOR THE WHOLE LIST, never one per row
 *
 * Twelve posts must not be twelve HTTP calls to a third party inside a loader
 * that already makes three network reads. The two statements here are the same
 * two the panel makes, issued in parallel, and the route indexes the result by
 * path. Adding a post costs nothing.
 *
 * ## THE LIMIT IS A CUT AND THE CALLER IS TOLD WHEN IT BITES
 *
 * `trafficQuery` orders by origin requests descending and applies a LIMIT, so a
 * path below the limit is absent from the result for a reason that has nothing
 * to do with its count. `pathsReturned` from the total query is the independent
 * measure of how many paths actually had activity, and comparing the two is the
 * only way to know whether the absence of a path means zero. `complete` carries
 * that answer so the column never has to guess, and the guess it would
 * otherwise make is the one ruling 2 forbids: showing a zero for a post whose
 * number simply was not asked for.
 *
 * ## WHY A CACHE, AND WHY THIS TTL
 *
 * Measured against production 2026-09-04, five samples: `ae_fetch_traffic` ran
 * 165 to 244ms. The post list's own loader ran a median of about 145ms over ten
 * samples, so an uncached read here would have been the slowest thing in it.
 * `askDriftCount` solved the identical problem for the nav badge and the same
 * shape is used here.
 *
 * The TTL is not a guess about freshness, it is BELOW a lag this data already
 * has: `CACHE_SENTENCE` records 72 seconds of Analytics Engine ingestion lag,
 * measured. A number this panel could not have shown yet anyway is not made
 * staler by holding it for a minute, so the cache costs no accuracy that
 * existed to lose.
 *
 * NO BUDGET RACE, deliberately, and the difference from `askDriftCount` is that
 * its 1000ms budget came from twelve measurements of a call that had been seen
 * at 2332ms. There is no such measurement here. A budget picked without one
 * would be an invented threshold in a file whose whole subject is not inventing
 * numbers, so the cache is the mitigation and the tail is recorded rather than
 * guarded against.
 */
const READERSHIP_CACHE_KEY = "traffic:by-path";

/** See the TTL paragraph above: under the measured ingestion lag, not over it. */
const READERSHIP_CACHE_TTL_SECONDS = 60;

async function readCachedReadership(env: Env): Promise<PostReadership | null> {
  try {
    const cached = await env.APP_KV.get(READERSHIP_CACHE_KEY, "json");
    if (!cached || typeof cached !== "object") return null;
    const value = cached as Partial<PostReadership>;
    // Shape-checked rather than trusted. A stored object from an older shape
    // must read as a miss, not as a report with undefined fields, because
    // `byPath` being undefined would make every post render as a measured zero.
    if (typeof value.windowDays !== "number") return null;
    if (typeof value.pathsReturned !== "number") return null;
    if (typeof value.complete !== "boolean") return null;
    if (!value.byPath || typeof value.byPath !== "object") return null;
    return value as PostReadership;
  } catch {
    // A KV outage costs the column its cache, never the page its render.
    return null;
  }
}

/**
 * Reads origin requests for every path in the window, for the post list.
 *
 * @param env the Worker environment
 */
export async function fetchPostReadership(env: Env): Promise<SourceResult<PostReadership>> {
  if (!env.ANALYTICS_READ_TOKEN) {
    return {
      status: "error",
      data: null,
      message:
        "No Analytics Engine read token is configured, so there is nothing to " +
        "query. Set ANALYTICS_READ_TOKEN as a Worker secret to turn this on.",
    };
  }

  const cached = await readCachedReadership(env);
  if (cached !== null) {
    return { status: "live", data: cached, fetchedAt: new Date().toISOString() };
  }

  try {
    const [pathRows, totalRows] = await Promise.all([
      runSql(env, trafficQuery(WINDOW_DAYS, READERSHIP_PATH_LIMIT)),
      runSql(env, trafficTotalQuery(WINDOW_DAYS)),
    ]);

    const byPath: Record<string, number> = {};
    for (const row of pathRows) {
      const path = String(row.path ?? "");
      if (path) byPath[path] = num(row.origin_requests);
    }
    const pathsReturned = num((totalRows[0] ?? {}).paths);

    const report: PostReadership = {
      windowDays: WINDOW_DAYS,
      byPath,
      pathsReturned,
      /*
       * Both halves, and the second is the one that catches a silent cut. The
       * row count proves the limit was not reached; the total proves no path
       * with activity is missing. Either alone can be satisfied while the
       * result is short: a query that returned fewer rows than the limit
       * because the API truncated would pass the first, and a stale total would
       * pass the second.
       */
      complete: pathRows.length < READERSHIP_PATH_LIMIT && pathsReturned <= pathRows.length,
    };

    try {
      await env.APP_KV.put(READERSHIP_CACHE_KEY, JSON.stringify(report), {
        expirationTtl: READERSHIP_CACHE_TTL_SECONDS,
      });
    } catch {
      // Failing to cache is not failing to read. The number is in hand.
    }

    return { status: "live", data: report, fetchedAt: new Date().toISOString() };
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
