import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { agentScopes, authorizeCall, callerName, isAdminUser } from "../src/auth.ts";

const env = { ADMIN_GITHUB_LOGIN: "DrDustinEdwards" };
const props = { id: 1, login: "drdustinedwards", name: null };

describe("isAdminUser", () => {
  test("matches the login case-insensitively, or the numeric id exactly", () => {
    assert.equal(isAdminUser(env, props), true);
    assert.equal(isAdminUser({ ADMIN_GITHUB_LOGIN: "1" }, props), true);
    assert.equal(isAdminUser({ ADMIN_GITHUB_LOGIN: "2" }, props), false);
  });

  test("an unset administrator admits nobody", () => {
    assert.equal(isAdminUser({}, props), false);
    assert.equal(isAdminUser({ ADMIN_GITHUB_LOGIN: "  " }, props), false);
  });
});

describe("agentScopes", () => {
  test("an agent reads unless AGENT_WRITE names it", () => {
    assert.deepEqual(agentScopes({}, "grok"), ["dei.read"]);
    assert.deepEqual(agentScopes({ AGENT_WRITE: "" }, "grok"), ["dei.read"]);
    assert.deepEqual(agentScopes({ AGENT_WRITE: "gemini, Grok" }, "grok"), ["dei.read", "dei.write"]);
    assert.deepEqual(agentScopes({ AGENT_WRITE: "grokker" }, "grok"), ["dei.read"]);
  });
});

describe("authorizeCall", () => {
  test("the administrator with the scope passes", () => {
    assert.equal(authorizeCall(env, { kind: "admin", props, scopes: ["dei.read"] }, "dei.read"), null);
  });

  test("an unset administrator refuses even a grant that once passed", () => {
    assert.match(authorizeCall({}, { kind: "admin", props, scopes: ["dei.read"] }, "dei.read") ?? "", /does not belong/);
  });

  test("an agent needs a well-formed principal and the scope", () => {
    assert.equal(authorizeCall(env, { kind: "agent", principal: "grok", scopes: ["dei.read"] }, "dei.read"), null);
    assert.match(authorizeCall(env, { kind: "agent", principal: "Grok!", scopes: ["dei.read"] }, "dei.read") ?? "", /malformed/);
    assert.match(authorizeCall(env, { kind: "agent", principal: "grok", scopes: ["dei.read"] }, "dei.write") ?? "", /AGENT_WRITE/);
  });

  test("no read scope is refused too", () => {
    assert.match(authorizeCall(env, { kind: "admin", props, scopes: [] }, "dei.read") ?? "", /no read scope/);
  });

  test("the audit name never carries a credential", () => {
    assert.equal(callerName({ kind: "admin", props, scopes: [] }), "github:drdustinedwards");
    assert.equal(callerName({ kind: "agent", principal: "grok", scopes: [] }), "agent:grok");
  });
});
