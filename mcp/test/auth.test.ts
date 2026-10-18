import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { agentScopes, authorizeCall, callerName, isAdminUser } from "../src/auth.ts";

const env = { ADMIN_EMAIL: "Admin@Example.com" };
const props = { email: "admin@example.com" };

describe("isAdminUser", () => {
  test("matches the email without case, and nothing else", () => {
    assert.equal(isAdminUser(env, props), true);
    assert.equal(isAdminUser({ ADMIN_EMAIL: "other@example.com" }, props), false);
    assert.equal(isAdminUser(env, {}), false);
  });

  test("an unset administrator admits nobody", () => {
    assert.equal(isAdminUser({}, props), false);
    assert.equal(isAdminUser({ ADMIN_EMAIL: "  " }, props), false);
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
    assert.equal(callerName({ kind: "admin", props, scopes: [] }), "access:admin@example.com");
    assert.equal(callerName({ kind: "agent", principal: "grok", scopes: [] }), "agent:grok");
  });
});

describe("the deployed AGENT_WRITE", () => {
  // Read from the tracked config, the one the CI build and a fresh deploy start from, through the
  // same parser check:wrapper uses: comments stripped, then JSON.
  const text = readFileSync(new URL("../wrangler.jsonc.example", import.meta.url), "utf8");
  const config = JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""));

  test("grok writes (its key is its only door, since it cannot complete OAuth)", () => {
    assert.deepEqual(agentScopes(config.vars, "grok"), ["dei.read", "dei.write"]);
  });

  test("grok is the only agent that writes, so a new key still starts read-only", () => {
    assert.equal(config.vars.AGENT_WRITE, "grok");
    assert.deepEqual(agentScopes(config.vars, "gemini"), ["dei.read"]);
  });
});
