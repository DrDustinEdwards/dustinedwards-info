import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { ApiLegError, callOperator } from "../src/api-client.ts";
import { API_URL, ENV, FIRST_PUBLISH_REFUSAL, TOKEN, fakeOperator, type FakeOperator } from "./fake-operator.ts";

let api: FakeOperator;
beforeEach(() => {
  api = fakeOperator();
});
afterEach(() => api.restore());

describe("callOperator: the request it sends", () => {
  test("POSTs { tool, args } as JSON to OPERATOR_API_URL", async () => {
    await callOperator(ENV, "get_post", { slug: "hello" });
    assert.equal(api.calls.length, 1);
    const [call] = api.calls;
    assert.equal(call.url, API_URL);
    assert.equal(call.method, "POST");
    assert.equal(call.headers.get("content-type"), "application/json");
    assert.deepEqual(call.body, { tool: "get_post", args: { slug: "hello" } });
  });

  test("sends the operator token as the bearer", async () => {
    await callOperator(ENV, "list_posts", {});
    assert.equal(api.calls[0].headers.get("authorization"), `Bearer ${TOKEN}`);
  });

  test("names itself in the user-agent without carrying the token", async () => {
    await callOperator(ENV, "list_posts", {});
    const ua = api.calls[0].headers.get("user-agent") ?? "";
    assert.match(ua, /^dustinedwards-mcp\//);
    assert.ok(!ua.includes(TOKEN));
  });

  test("never logs the operator token, on success or refusal", async () => {
    await callOperator(ENV, "list_posts", {});
    api.reply(FIRST_PUBLISH_REFUSAL);
    await callOperator(ENV, "save_post", { slug: "a", raw: "x" });
    api.reply({ throws: new Error("socket hang up") });
    await callOperator(ENV, "list_posts", {}).catch(() => {});
    assert.ok(api.logs.every((line) => !line.includes(TOKEN)), api.logs.join("\n"));
  });
});

describe("callOperator: configuration", () => {
  test("refuses without OPERATOR_API_URL and makes no request", async () => {
    await assert.rejects(callOperator({ OPERATOR_TOKEN: TOKEN }, "list_posts", {}), (e: unknown) => {
      assert.ok(e instanceof ApiLegError);
      assert.equal(e.kind, "unconfigured");
      assert.match(e.message, /OPERATOR_API_URL is unset/);
      return true;
    });
    assert.equal(api.calls.length, 0);
  });

  test("refuses without OPERATOR_TOKEN and makes no request", async () => {
    await assert.rejects(callOperator({ OPERATOR_API_URL: API_URL }, "list_posts", {}), (e: unknown) => {
      assert.ok(e instanceof ApiLegError);
      assert.equal(e.kind, "unconfigured");
      assert.match(e.message, /OPERATOR_TOKEN is unset or too short/);
      return true;
    });
    assert.equal(api.calls.length, 0);
  });

  test("refuses a token shorter than 32 characters and accepts exactly 32", async () => {
    const short = { OPERATOR_API_URL: API_URL, OPERATOR_TOKEN: "x".repeat(31) };
    await assert.rejects(callOperator(short, "list_posts", {}), { name: "ApiLegError" });
    assert.equal(api.calls.length, 0);
    await callOperator({ OPERATOR_API_URL: API_URL, OPERATOR_TOKEN: "x".repeat(32) }, "list_posts", {});
    assert.equal(api.calls.length, 1);
  });

  test("the unconfigured error does not echo the token", async () => {
    const short = { OPERATOR_API_URL: API_URL, OPERATOR_TOKEN: "short-secret" };
    await assert.rejects(callOperator(short, "list_posts", {}), (e: Error) => !e.message.includes("short-secret"));
  });
});

describe("callOperator: what comes back", () => {
  test("returns the API's data unchanged on ok:true", async () => {
    const data = { posts: [{ slug: "a" }], headSha: "abc1234" };
    api.reply({ body: { ok: true, data } });
    assert.deepEqual(await callOperator(ENV, "list_posts", {}), { status: 200, ok: true, data });
  });

  test("relays a 403 first-publish refusal in the API's own words", async () => {
    api.reply(FIRST_PUBLISH_REFUSAL);
    const result = await callOperator(ENV, "save_post", { slug: "a", raw: "x" });
    assert.deepEqual(result, {
      status: 403,
      ok: false,
      error: FIRST_PUBLISH_REFUSAL.body.error,
      detail: FIRST_PUBLISH_REFUSAL.body.detail,
    });
  });

  test("an ok:false body is a refusal even with HTTP 200", async () => {
    api.reply({ status: 200, body: { ok: false, error: "nope" } });
    const result = await callOperator(ENV, "list_posts", {});
    assert.equal(result.ok, false);
    assert.equal(result.error, "nope");
  });

  test("names the status when a refusal carries no error string", async () => {
    api.reply({ status: 500, body: { ok: false } });
    const result = await callOperator(ENV, "list_posts", {});
    assert.equal(result.error, "The operator API refused with status 500.");
  });

  test("an unreachable API is an ApiLegError of kind unreachable", async () => {
    api.reply({ throws: new TypeError("fetch failed") });
    await assert.rejects(callOperator(ENV, "list_posts", {}), (e: unknown) => {
      assert.ok(e instanceof ApiLegError);
      assert.equal(e.kind, "unreachable");
      assert.equal(e.message, "The operator API could not be reached: fetch failed");
      return true;
    });
  });

  test("a body that is not JSON is an ApiLegError of kind malformed", async () => {
    api.reply({ status: 502, raw: "<html>bad gateway</html>" });
    await assert.rejects(callOperator(ENV, "list_posts", {}), (e: unknown) => {
      assert.ok(e instanceof ApiLegError);
      assert.equal(e.kind, "malformed");
      assert.equal(e.message, "The operator API returned status 502 with a body that is not JSON.");
      return true;
    });
  });

  test("an empty body or a body without a boolean ok is malformed", async () => {
    for (const raw of ["", "{}", '{"ok":"true"}', "[]", "null"]) {
      api.reply({ status: 200, raw });
      await assert.rejects(
        callOperator(ENV, "list_posts", {}),
        (e: unknown) => e instanceof ApiLegError && e.kind === "malformed" && /unrecognized payload shape/.test(e.message),
        `body ${JSON.stringify(raw)}`,
      );
    }
  });
});
