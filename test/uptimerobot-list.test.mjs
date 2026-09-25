/**
 * uptime-ensure creates every desired monitor the listing does not show, so a listing that reads as
 * shorter than the truth creates duplicates.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { listMonitors } from "../scripts/lib/uptimerobot.mjs";

const realFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

/** @param {(offset: number) => unknown} page */
function serve(page) {
  globalThis.fetch = /** @type {any} */ (
    async (/** @type {string} */ url) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      return new Response(JSON.stringify(page(offset)), { status: 200 });
    }
  );
}

test("a short page ends the listing", async () => {
  serve(() => ({ data: [{ id: 1 }, { id: 2 }] }));
  assert.deepEqual(await listMonitors("k"), [{ id: 1 }, { id: 2 }]);
});

test("REPLAY: a body with no data array throws rather than reading as no monitors", async () => {
  serve(() => ({ monitors: [{ id: 1 }] }));
  await assert.rejects(listMonitors("k"), /no data array/);
});

test("REPLAY: a listing still full at the page cap throws rather than truncating", async () => {
  serve((offset) => ({ data: Array.from({ length: 50 }, (_, i) => ({ id: offset + i })) }));
  await assert.rejects(listMonitors("k"), /listing is incomplete/);
});
