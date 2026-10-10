import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { ApiLegError, callOperator, readHealth } from "../src/api-client.ts";
import { API_URL, HEALTH_URL, ORIGIN, SITE, FIRST_PUBLISH_REFUSAL, TOKEN, fakeOperator, type FakeOperator } from "./fake-operator.ts";

const ENV = { SITE, SITE_ORIGIN: ORIGIN, OPERATOR_TOKEN: TOKEN };

let api: FakeOperator;
beforeEach(() => {
  api = fakeOperator();
});
afterEach(() => api.restore());

describe("callOperator: the request it sends", () => {
  test("POSTs { tool, args } as JSON to SITE_ORIGIN/api/operator over the SITE binding", async () => {
    await callOperator(ENV, "get_post", { slug: "hello" });
    assert.equal(api.calls.length, 1);
    const [call] = api.calls;
    assert.equal(call.url, API_URL);
    assert.equal(call.method, "POST");
    assert.equal(call.headers.get("content-type"), "application/json");
    assert.deepEqual(call.body, { tool: "get_post", args: { slug: "hello" } });
  });

  test("sends the operator token as the bearer", async () => {
    await callOperator(ENV, "list_procedures", {});
    assert.equal(api.calls[0].headers.get("authorization"), `Bearer ${TOKEN}`);
  });

  test("names itself in the user-agent without carrying the token", async () => {
    await callOperator(ENV, "list_procedures", {});
    const ua = api.calls[0].headers.get("user-agent") ?? "";
    assert.match(ua, /^dustinedwards-mcp\//);
    assert.ok(!ua.includes(TOKEN));
  });

  test("never logs the operator token, on success or refusal", async () => {
    await callOperator(ENV, "list_procedures", {});
    api.reply(FIRST_PUBLISH_REFUSAL);
    await callOperator(ENV, "save_procedure", { slug: "a", raw: "x" });
    api.reply({ throws: new Error("socket hang up") });
    await callOperator(ENV, "list_procedures", {}).catch(() => {});
    assert.ok(api.logs.every((line) => !line.includes(TOKEN)), api.logs.join("\n"));
  });
});

describe("callOperator: configuration", () => {
  test("refuses without the SITE binding and makes no request", async () => {
    await assert.rejects(callOperator({ SITE_ORIGIN: ORIGIN, OPERATOR_TOKEN: TOKEN }, "list_procedures", {}), (e: unknown) => {
      assert.ok(e instanceof ApiLegError);
      assert.equal(e.kind, "unconfigured");
      assert.match(e.message, /SITE service binding is missing/);
      return true;
    });
    assert.equal(api.calls.length, 0);
  });

  test("refuses without SITE_ORIGIN and makes no request", async () => {
    await assert.rejects(callOperator({ SITE, OPERATOR_TOKEN: TOKEN }, "list_procedures", {}), /SITE_ORIGIN is unset/);
    assert.equal(api.calls.length, 0);
  });

  test("refuses without OPERATOR_TOKEN and makes no request", async () => {
    await assert.rejects(callOperator({ SITE, SITE_ORIGIN: ORIGIN }, "list_procedures", {}), (e: unknown) => {
      assert.ok(e instanceof ApiLegError);
      assert.equal(e.kind, "unconfigured");
      assert.match(e.message, /OPERATOR_TOKEN is unset or too short/);
      return true;
    });
    assert.equal(api.calls.length, 0);
  });

  test("refuses a token shorter than 32 characters and accepts exactly 32", async () => {
    const short = { SITE, SITE_ORIGIN: ORIGIN, OPERATOR_TOKEN: "x".repeat(31) };
    await assert.rejects(callOperator(short, "list_procedures", {}), { name: "ApiLegError" });
    assert.equal(api.calls.length, 0);
    await callOperator({ SITE, SITE_ORIGIN: ORIGIN, OPERATOR_TOKEN: "x".repeat(32) }, "list_procedures", {});
    assert.equal(api.calls.length, 1);
  });

  test("the unconfigured error does not echo the token", async () => {
    const short = { SITE, SITE_ORIGIN: ORIGIN, OPERATOR_TOKEN: "short-secret" };
    await assert.rejects(callOperator(short, "list_procedures", {}), (e: Error) => !e.message.includes("short-secret"));
  });
});

describe("callOperator: what comes back", () => {
  test("returns the API's data unchanged on ok:true", async () => {
    const data = { procedures: [{ slug: "a" }], headSha: "abc1234" };
    api.reply({ body: { ok: true, data } });
    assert.deepEqual(await callOperator(ENV, "list_procedures", {}), { status: 200, ok: true, data });
  });

  test("relays a 403 first-publish refusal in the API's own words", async () => {
    api.reply(FIRST_PUBLISH_REFUSAL);
    const result = await callOperator(ENV, "save_procedure", { slug: "a", raw: "x" });
    assert.deepEqual(result, {
      status: 403,
      ok: false,
      error: FIRST_PUBLISH_REFUSAL.body.error,
      detail: FIRST_PUBLISH_REFUSAL.body.detail,
    });
  });

  test("an ok:false body is a refusal even with HTTP 200", async () => {
    api.reply({ status: 200, body: { ok: false, error: "nope" } });
    const result = await callOperator(ENV, "list_procedures", {});
    assert.equal(result.ok, false);
    assert.equal(result.error, "nope");
  });

  test("names the status when a refusal carries no error string", async () => {
    api.reply({ status: 500, body: { ok: false } });
    const result = await callOperator(ENV, "list_procedures", {});
    assert.equal(result.error, "The operator API refused with status 500.");
  });

  test("an unreachable API is an ApiLegError of kind unreachable", async () => {
    api.reply({ throws: new TypeError("fetch failed") });
    await assert.rejects(callOperator(ENV, "list_procedures", {}), (e: unknown) => {
      assert.ok(e instanceof ApiLegError);
      assert.equal(e.kind, "unreachable");
      assert.equal(e.message, "The operator API could not be reached: fetch failed");
      return true;
    });
  });

  test("a body that is not JSON is an ApiLegError of kind malformed", async () => {
    api.reply({ status: 502, raw: "<html>bad gateway</html>" });
    await assert.rejects(callOperator(ENV, "list_procedures", {}), (e: unknown) => {
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
        callOperator(ENV, "list_procedures", {}),
        (e: unknown) => e instanceof ApiLegError && e.kind === "malformed" && /unrecognized payload shape/.test(e.message),
        `body ${JSON.stringify(raw)}`,
      );
    }
  });
});

describe("readHealth", () => {
  test("GETs SITE_ORIGIN/api/health with no bearer", async () => {
    api.health({ status: 503, body: { ok: false, checks: [] } });
    assert.deepEqual(await readHealth(ENV), { status: 503, body: { ok: false, checks: [] } });
    assert.equal(api.healthCalls[0].url, HEALTH_URL);
    assert.equal(api.healthCalls[0].method, "GET");
    assert.equal(api.healthCalls[0].headers.get("authorization"), null);
  });

  test("never throws: an unreachable site is status 0 with the cause", async () => {
    api.health({ throws: new TypeError("1042") });
    assert.deepEqual(await readHealth(ENV), { status: 0, body: null, error: "1042" });
  });

  test("an unbound wrapper reads as unreachable, not as healthy", async () => {
    const reading = await readHealth({ SITE_ORIGIN: ORIGIN });
    assert.equal(reading.status, 0);
    assert.match(reading.error ?? "", /SITE service binding/);
  });
});
