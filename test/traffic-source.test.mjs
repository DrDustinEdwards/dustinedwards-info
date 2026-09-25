// A loader that THROWS takes out the admin route segment and blanks the whole cockpit, so
// an unreachable analytics API must come back as an error result, not an exception.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { fetchTraffic } from "../app/lib/admin/traffic.server.ts";

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
  // The WEIGHTED figure lands in originRequests; reading the row count instead would report
  // 48 here and look entirely plausible.
  assert.equal(result.data.rows[0].originRequests, 96);
  assert.equal(result.data.rows[0].rows, 48);
  assert.equal(result.data.totalOriginRequests, 940);
  assert.equal(result.data.pathsReturned, 23);
});

test("an answer with no data array, or a count that is not a number, is an error, not zero traffic", async () => {
  for (const answer of [{}, { data: [{ path: "/", origin_requests: "n/a", sampled_rows: "1" }] }]) {
    globalThis.fetch = async () => Response.json(answer);
    const result = await fetchTraffic({
      CLOUDFLARE_ACCOUNT_ID: "acct",
      ANALYTICS_READ_TOKEN: "t",
    });
    globalThis.fetch = realFetch;
    assert.equal(result.status, "error", JSON.stringify(answer));
  }
});
