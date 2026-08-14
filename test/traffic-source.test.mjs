/**
 * The origin-requests source FAILS CLOSED.
 *
 * This is the forced-failure test for the panel's error path, and the path is
 * not hypothetical: the read token is optional by contract and a development
 * machine never carries it, so absence is what this code does every day.
 *
 * WHAT IS ACTUALLY AT STAKE. A loader that THROWS takes out the admin route
 * segment and React Router replaces the cockpit with an error boundary, so one
 * unreachable analytics API would blank the whole admin plane. Returning an
 * error result instead keeps the failure inside the one panel that owns it.
 * These tests assert the difference by calling the real module, not by reading
 * it.
 *
 * `Env` is ambient in the app's tsconfig and absent here, so the fake envs are
 * cast through the call. Node strips the types; nothing is compiled.
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";

import {
  fetchTraffic,
  trafficQuery,
  trafficTotalQuery,
} from "../app/lib/admin/traffic.server.ts";
import { TOP_N, WINDOW_DAYS } from "../app/lib/admin/origin-requests.mjs";

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

test("no token returns the error state rather than throwing", async () => {
  const result = await fetchTraffic({ CLOUDFLARE_ACCOUNT_ID: "acct" });
  assert.equal(result.status, "error");
  assert.equal(result.data, null);
  assert.match(result.message, /ANALYTICS_READ_TOKEN/);
});

test("no token performs no network call at all", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("should never be reached");
  };
  const result = await fetchTraffic({ CLOUDFLARE_ACCOUNT_ID: "acct" });
  globalThis.fetch = realFetch;
  assert.equal(called, false, "it must short circuit before touching the network");
  assert.equal(result.status, "error");
});

test("a non-200 from the SQL API becomes the error state", async () => {
  globalThis.fetch = async () =>
    new Response("upstream detail that should not be rendered", { status: 403 });
  const result = await fetchTraffic({
    CLOUDFLARE_ACCOUNT_ID: "acct",
    ANALYTICS_READ_TOKEN: "t",
  });
  globalThis.fetch = realFetch;
  assert.equal(result.status, "error");
  assert.match(result.message, /403/);
  // The API echoes the QUERY on error. There is no reason to route that to a
  // rendered page, so the status travels and the body does not.
  assert.doesNotMatch(result.message, /upstream detail/);
});

test("a thrown fetch becomes the error state", async () => {
  globalThis.fetch = async () => {
    throw new Error("network is down");
  };
  const result = await fetchTraffic({
    CLOUDFLARE_ACCOUNT_ID: "acct",
    ANALYTICS_READ_TOKEN: "t",
  });
  globalThis.fetch = realFetch;
  assert.equal(result.status, "error");
  assert.match(result.message, /network is down/);
});

test("malformed JSON becomes the error state rather than a crash", async () => {
  globalThis.fetch = async () => new Response("not json at all", { status: 200 });
  const result = await fetchTraffic({
    CLOUDFLARE_ACCOUNT_ID: "acct",
    ANALYTICS_READ_TOKEN: "t",
  });
  globalThis.fetch = realFetch;
  assert.equal(result.status, "error");
});

test("a good response becomes the live state, sampling weighted", async () => {
  globalThis.fetch = async (_url, init) => {
    const body = String(init.body);
    // The per-path statement and the total statement are distinguishable by
    // their GROUP BY, so one stub can answer both without guessing at order.
    if (body.includes("GROUP BY")) {
      return Response.json({
        data: [{ path: "/", origin_requests: "96", sampled_rows: "48" }],
      });
    }
    return Response.json({ data: [{ origin_requests: "940", paths: "23" }] });
  };
  const result = await fetchTraffic({
    CLOUDFLARE_ACCOUNT_ID: "acct",
    ANALYTICS_READ_TOKEN: "t",
  });
  globalThis.fetch = realFetch;
  assert.equal(result.status, "live");
  assert.equal(result.data.rows.length, 1);
  // Strings from the API become numbers, and the WEIGHTED figure is the one
  // that lands in originRequests. A regression that read the row count instead
  // would report 48 here and look entirely plausible.
  assert.equal(result.data.rows[0].originRequests, 96);
  assert.equal(result.data.rows[0].rows, 48);
  assert.equal(result.data.totalOriginRequests, 940);
  assert.equal(result.data.pathsReturned, 23);
});

test("the query counts by sampling interval, never by row", () => {
  const q = trafficQuery(WINDOW_DAYS, TOP_N);
  assert.match(q, /SUM\(_sample_interval\) AS origin_requests/);
  assert.match(q, /GROUP BY path/);
  assert.match(q, /ORDER BY origin_requests DESC/);
  assert.match(q, new RegExp(`LIMIT ${TOP_N}`));
  // COUNT() may appear ONLY as the sampling diagnostic, never as the metric.
  assert.doesNotMatch(q, /COUNT\(\) AS origin_requests/);
});

test("the INTERVAL literal is quoted, which this API requires", () => {
  // Recorded law: INTERVAL '7' DAY parses, INTERVAL 7 DAY does not.
  assert.match(trafficQuery(7, 5), /INTERVAL '7' DAY/);
  assert.match(trafficTotalQuery(7), /INTERVAL '7' DAY/);
  assert.doesNotMatch(trafficQuery(7, 5), /INTERVAL 7 DAY/);
});
