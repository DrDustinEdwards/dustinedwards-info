/* The endpoint is public and unauthenticated, so nothing the client says about the body size
 * may take part in the cap. */

import test from "node:test";
import assert from "node:assert/strict";

import { readCapped } from "../app/lib/read-capped.mjs";

const MAX = 8 * 1024;

function post(bytes, { contentLength } = {}) {
  const payload = new TextEncoder().encode("x".repeat(bytes));
  const headers = new Headers({ "content-type": "application/csp-report" });
  if (contentLength !== undefined) headers.set("content-length", String(contentLength));
  return new Request("https://example.test/api/csp-report", {
    method: "POST",
    headers,
    body: payload,
    duplex: "half",
  });
}

test("a body under the cap is returned whole", async () => {
  const text = await readCapped(post(100), MAX);
  assert.equal(text?.length, 100);
});

test("a body exactly at the cap is accepted", async () => {
  const text = await readCapped(post(MAX), MAX);
  assert.equal(text?.length, MAX);
});

test("a body over the cap is refused, not truncated", async () => {
  // NULL rather than a short string: the caller returns 413. Truncating would
  // log a fragment of a body we should not have accepted.
  const text = await readCapped(post(MAX + 1), MAX);
  assert.equal(text, null);
});

test("a LYING small content-length does not buy a large body", async () => {
  const text = await readCapped(post(64 * 1024, { contentLength: 10 }), MAX);
  assert.equal(text, null, "the declared length must not decide this");
});

test("an ABSENT content-length does not buy a large body", async () => {
  const text = await readCapped(post(64 * 1024), MAX);
  assert.equal(text, null);
});

test("a body stream that errors mid-read THROWS, and is never handed back as a body", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("source=https://a.example/"));
      controller.error(new Error("planted connection reset"));
    },
  });
  await assert.rejects(readCapped({ body }, MAX), /body stream failed.*planted connection reset/);
});

test("an empty body reads as the empty string, not null", async () => {
  // Null is reserved for "over the cap", so an empty POST must not 413.
  const req = new Request("https://example.test/api/csp-report", { method: "POST" });
  assert.equal(await readCapped(req, MAX), "");
});
