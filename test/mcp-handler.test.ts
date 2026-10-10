/**
 * The MCP request layer, end to end: a JSON-RPC request into handleMcp, through
 * the real server and tool registration, out to the fake operator API, and back.
 * Driven at the 2025-11-25 era, the one every measured client opens at today.
 */
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { handleMcp } from "../src/mcp-handler.ts";
import { ENV, FIRST_PUBLISH_REFUSAL, TOKEN, fakeOperator, type FakeOperator } from "./fake-operator.ts";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const ERA = "2025-11-25";

let nextId = 1;
async function rpc(method: string, params: Record<string, unknown>, env: Partial<typeof ENV> = ENV) {
  const response = await handleMcp(
    new Request("https://wrapper.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": ERA,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    }),
    env,
    ctx,
  );
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data: "));
  return { status: response.status, raw: text, message: JSON.parse(data ? data.slice(6) : text) };
}

const callTool = (name: string, args: Record<string, unknown>) => rpc("tools/call", { name, arguments: args });

let api: FakeOperator;
beforeEach(() => {
  api = fakeOperator();
});
afterEach(() => api.restore());

describe("handleMcp", () => {
  test("initialize names the server and carries the first-publish instruction", async () => {
    const { message } = await rpc("initialize", {
      protocolVersion: ERA,
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    assert.equal(message.result.serverInfo.name, "dustinedwards-mcp");
    assert.match(message.result.instructions, /first-publish-requires-admin/);
    assert.equal(api.calls.length, 0);
  });

  test("tools/list offers the eleven operator tools and nothing else", async () => {
    const { message } = await rpc("tools/list", {});
    assert.deepEqual(
      message.result.tools.map((t: { name: string }) => t.name).sort(),
      [
        "decide_mention",
        "delete_post",
        "get_post",
        "get_procedure",
        "list_mentions",
        "list_posts",
        "list_procedures",
        "save_post",
        "save_procedure",
        "sync_status",
        "upload_media",
      ],
    );
    assert.equal(api.calls.length, 0);
  });

  test("tools/call becomes one operator request with the bearer and the tool's args", async () => {
    api.reply({ body: { ok: true, data: { slug: "a", raw: "x" } } });
    const { message } = await callTool("get_post", { slug: "a" });
    assert.equal(api.calls.length, 1);
    assert.deepEqual(api.calls[0].body, { tool: "get_post", args: { slug: "a" } });
    assert.equal(api.calls[0].headers.get("authorization"), `Bearer ${TOKEN}`);
    assert.deepEqual(message.result.structuredContent, { slug: "a", raw: "x" });
  });

  test("a 403 first-publish refusal reaches the agent verbatim as a tool error", async () => {
    api.reply(FIRST_PUBLISH_REFUSAL);
    const { message } = await callTool("save_post", { slug: "a", raw: "---\ndraft: false\n---\n" });
    assert.equal(message.error, undefined, "a refusal is a tool result, not a protocol error");
    assert.equal(message.result.isError, true);
    assert.equal(
      message.result.content[0].text,
      `${FIRST_PUBLISH_REFUSAL.body.error}\npolicy: first-publish-requires-admin`,
    );
    assert.equal(message.result.structuredContent.status, 403);
  });

  test("a malformed slug fails at the schema with no operator request", async () => {
    const { message } = await callTool("get_post", { slug: "Not A Slug" });
    assert.equal(api.calls.length, 0);
    const failed = message.error !== undefined || message.result?.isError === true;
    assert.ok(failed, JSON.stringify(message));
  });

  test("an unknown tool is refused with no operator request", async () => {
    const { message } = await callTool("publish_post", { slug: "a" });
    assert.equal(api.calls.length, 0);
    const failed = message.error !== undefined || message.result?.isError === true;
    assert.ok(failed, JSON.stringify(message));
  });

  test("a 2026-07-28 request is answered by the modern era, not the legacy shim", async () => {
    api.reply({ body: { ok: true, data: { posts: [] } } });
    const response = await handleMcp(
      new Request("https://wrapper.test/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2026-07-28",
          "mcp-method": "tools/call",
          "mcp-name": "list_posts",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: nextId++,
          method: "tools/call",
          params: {
            name: "list_posts",
            arguments: {},
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              "io.modelcontextprotocol/clientCapabilities": {},
              "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
            },
          },
        }),
      }),
      ENV,
      ctx,
    );
    assert.equal(response.status, 200);
    const message = JSON.parse(await response.text());
    assert.equal(message.result.resultType, "complete");
    assert.deepEqual(message.result.structuredContent, { posts: [] });
    assert.deepEqual(api.calls[0].body, { tool: "list_posts", args: {} });
  });

  test("the token appears in no response and no log", async () => {
    const bodies = [
      (await rpc("tools/list", {})).raw,
      (await callTool("list_posts", {})).raw,
    ];
    api.reply(FIRST_PUBLISH_REFUSAL);
    bodies.push((await callTool("save_post", { slug: "a", raw: "r" })).raw);
    api.reply({ throws: new Error("down") });
    bodies.push((await callTool("list_posts", {})).raw);
    for (const body of bodies) assert.ok(!body.includes(TOKEN));
    assert.ok(api.logs.every((line) => !line.includes(TOKEN)));
  });
});
