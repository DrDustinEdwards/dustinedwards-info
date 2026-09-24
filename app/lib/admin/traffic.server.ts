// Count with SUM(_sample_interval): a raw COUNT() silently undercounts once sampling engages.
// A missing token returns the error result, never throws: a thrown loader blanks the whole cockpit.

import { READERSHIP_PATH_LIMIT, TOP_N, WINDOW_DAYS } from "./origin-requests.mjs";
import type { PostReadership, SourceResult, TrafficReport, TrafficRow } from "./types";

const DATASET = "dustinedwards_traffic";

// `INTERVAL '7' DAY` must be the QUOTED form; this API rejects the unquoted spelling.
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

// A separate statement because the SQL API takes one per request.
export function trafficTotalQuery(windowDays: number) {
  return (
    `SELECT SUM(_sample_interval) AS origin_requests, ` +
    `COUNT(DISTINCT blob1) AS paths ` +
    `FROM ${DATASET} ` +
    `WHERE timestamp >= NOW() - INTERVAL '${windowDays}' DAY`
  );
}

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
    // Status only: an API error body can echo the query.
    throw new Error(`Analytics Engine returned ${res.status}`);
  }
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  return json.data ?? [];
}

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

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

// One cached read for the whole post list, never one per row.
const READERSHIP_CACHE_KEY = "traffic:by-path";

// Under the ~72s ingestion lag, so the cache loses no accuracy.
const READERSHIP_CACHE_TTL_SECONDS = 60;

async function readCachedReadership(env: Env): Promise<PostReadership | null> {
  try {
    const cached = await env.APP_KV.get(READERSHIP_CACHE_KEY, "json");
    if (!cached || typeof cached !== "object") return null;
    const value = cached as Partial<PostReadership>;
    // Shape-checked: an older stored shape must MISS, or undefined `byPath` renders every post as zero.
    if (typeof value.windowDays !== "number") return null;
    if (typeof value.pathsReturned !== "number") return null;
    if (typeof value.complete !== "boolean") return null;
    if (!value.byPath || typeof value.byPath !== "object") return null;
    return value as PostReadership;
  } catch {
    return null;
  }
}

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
      // Both halves: the row count proves the limit was not hit, the total proves no path is missing.
      complete: pathRows.length < READERSHIP_PATH_LIMIT && pathsReturned <= pathRows.length,
    };

    try {
      await env.APP_KV.put(READERSHIP_CACHE_KEY, JSON.stringify(report), {
        expirationTtl: READERSHIP_CACHE_TTL_SECONDS,
      });
    } catch {
      // Failing to cache is not failing to read.
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
