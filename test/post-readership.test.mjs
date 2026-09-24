import test from "node:test";
import assert from "node:assert/strict";

import { fetchPostReadership } from "../app/lib/admin/traffic.server.ts";
import { READERSHIP_PATH_LIMIT, WINDOW_DAYS } from "../app/lib/admin/origin-requests.mjs";

const coldKv = () => ({
  get: async () => null,
  put: async () => {},
});

const envWith = (fetchImpl) => ({
  ANALYTICS_READ_TOKEN: "test-token",
  CLOUDFLARE_ACCOUNT_ID: "acct",
  APP_KV: coldKv(),
  __fetch: fetchImpl,
});

/** Restored in `finally` so a failing assertion cannot leave the global patched. */
async function withFetch(impl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("THE DEFECT: no read token gives an absence with a reason, not a zero", async () => {
  const result = await fetchPostReadership({ APP_KV: coldKv() });
  assert.equal(result.status, "error");
  assert.equal(result.data, null);
  assert.match(result.message, /token/i);
  assert.ok(result.message.length > 20, "an empty reason is not a reason");
});

test("a nonexistent dataset gives an absence carrying the status", async () => {
  const result = await withFetch(
    async () => new Response("no such dataset", { status: 404 }),
    () => fetchPostReadership(envWith()),
  );
  assert.equal(result.status, "error");
  assert.equal(result.data, null);
  assert.match(result.message, /404/);
  // The API's body can echo the query, so it must NOT be in the message.
  assert.doesNotMatch(result.message, /SELECT/i);
});

test("a malformed 200 does not become a report full of zeros", async () => {
  const result = await withFetch(
    async () => new Response("not json", { status: 200 }),
    () => fetchPostReadership(envWith()),
  );
  assert.equal(result.status, "error", "an unparseable body must not read as live data");
});

test("a live read indexes by path and reports the window", async () => {
  const result = await withFetch(
    async (_url, init) => {
      const query = String(init.body);
      const data = query.includes("GROUP BY")
        ? [
            { path: "/blog/one", origin_requests: 12, sampled_rows: 12 },
            { path: "/blog/two", origin_requests: 3, sampled_rows: 3 },
          ]
        : [{ origin_requests: 15, paths: 2 }];
      return new Response(JSON.stringify({ data }), { status: 200 });
    },
    () => fetchPostReadership(envWith()),
  );
  assert.equal(result.status, "live");
  assert.equal(result.data.windowDays, WINDOW_DAYS);
  assert.deepEqual(result.data.byPath, { "/blog/one": 12, "/blog/two": 3 });
  assert.equal(result.data.complete, true, "two paths, two rows, nothing was cut");
});

test("COMPLETE IS FALSE when more paths had activity than came back", async () => {
  const result = await withFetch(
    async (_url, init) =>
      new Response(
        JSON.stringify({
          data: String(init.body).includes("GROUP BY")
            ? [{ path: "/blog/one", origin_requests: 12, sampled_rows: 12 }]
            : // The total says nine hundred paths had activity and one row came
              // back, so a post missing from `byPath` is UNKNOWN, not zero.
              [{ origin_requests: 99999, paths: 900 }],
        }),
        { status: 200 },
      ),
    () => fetchPostReadership(envWith()),
  );
  assert.equal(result.status, "live");
  assert.equal(result.data.complete, false);
  assert.equal(result.data.pathsReturned, 900);
});

test("COMPLETE IS FALSE when the limit itself was reached", async () => {
  const rows = Array.from({ length: READERSHIP_PATH_LIMIT }, (_, i) => ({
    path: `/blog/p${i}`,
    origin_requests: 1,
    sampled_rows: 1,
  }));
  const result = await withFetch(
    async (_url, init) =>
      new Response(
        JSON.stringify({
          data: String(init.body).includes("GROUP BY")
            ? rows
            : [{ origin_requests: rows.length, paths: rows.length }],
        }),
        { status: 200 },
      ),
    () => fetchPostReadership(envWith()),
  );
  assert.equal(result.data.complete, false, "a full page is a cut, whatever the total claims");
});
