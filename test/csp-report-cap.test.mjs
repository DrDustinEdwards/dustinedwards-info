/**
 * The CSP report sink's body cap counts BYTES, not the client's claim.
 *
 * REPLAYS THE DEFECT, per hard rule 12. The endpoint is public, unauthenticated
 * and POST. Its only cap was `Number(request.headers.get("content-length") ?? "0")`
 * compared against 8 KB, so:
 *
 *   - a request with NO Content-Length became 0 and sailed past the check
 *   - a request understating its length did the same
 *   - and `request.text()` then materialised the whole body before `.slice()`
 *     could shorten it, so the slice bounded what was LOGGED and never what was
 *     received. The comment above it claimed the cap preceded the read.
 *
 * `readCapped` counts chunks as they arrive and cancels the stream on the first
 * one that crosses the limit, so nothing the client says about the size takes
 * part in the decision.
 *
 * @see app/lib/read-capped.mjs, and its caller app/routes/api.csp-report.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { readCapped } from "../app/lib/read-capped.mjs";

const MAX = 8 * 1024;

/** A POST whose body is `bytes` long, with whatever Content-Length we choose. */
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
  // The defect, in one case. The header says 10; the body is 64 KB.
  const text = await readCapped(post(64 * 1024, { contentLength: 10 }), MAX);
  assert.equal(text, null, "the declared length must not decide this");
});

test("an ABSENT content-length does not buy a large body", async () => {
  // The other half: `?? "0"` made a missing header mean an empty body.
  const text = await readCapped(post(64 * 1024), MAX);
  assert.equal(text, null);
});

test("an empty body reads as the empty string, not null", async () => {
  // Null is reserved for "over the cap", so an empty POST must not 413.
  const req = new Request("https://example.test/api/csp-report", { method: "POST" });
  assert.equal(await readCapped(req, MAX), "");
});
