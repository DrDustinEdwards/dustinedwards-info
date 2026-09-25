/**
 * callTool feeds build-capsid-guidelines, which rebuilds a directory from what it returns. A failed
 * call used to come back as `{}`, and an MCP tool error as whatever its text parsed to.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { callTool } from "../scripts/lib/capsid.mjs";

/** @param {string} body */
function answer(body) {
  globalThis.fetch = /** @type {any} */ (async () => new Response(body, { status: 200 }));
}

const realFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a result's text content is parsed and returned", async () => {
  answer(JSON.stringify({ result: { content: [{ type: "text", text: '{"body":"x"}' }] } }));
  assert.deepEqual(await callTool("t", "read", {}), { body: "x" });
});

test("the last SSE data line is the answer", async () => {
  answer(
    'event: message\ndata: {"progress":1}\n\n' +
      `data: ${JSON.stringify({ result: { content: [{ type: "text", text: '{"ok":1}' }] } })}\n\n`,
  );
  assert.deepEqual(await callTool("t", "read", {}), { ok: 1 });
});

test("REPLAY: an SSE body with no data line throws rather than returning {}", async () => {
  answer("event: message\ndata:\n\n");
  await assert.rejects(callTool("t", "read", {}), /no JSON-RPC payload/);
});

test("REPLAY: a result with no content throws rather than returning {}", async () => {
  answer(JSON.stringify({ result: {} }));
  await assert.rejects(callTool("t", "read", {}), /no text content/);
});

test("an MCP tool error throws with its message", async () => {
  answer(
    JSON.stringify({ result: { isError: true, content: [{ type: "text", text: "not found" }] } }),
  );
  await assert.rejects(callTool("t", "read", {}), /read: not found/);
});

test("an rpc error throws", async () => {
  answer(JSON.stringify({ error: { message: "bad token" } }));
  await assert.rejects(callTool("t", "read", {}), /bad token/);
});
