import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { agentScopes as sharedAgentScopes } from "@dustinedwards/site-runtime/agent-keys";

import { SCOPES } from "../src/auth.ts";

// The shared rule is tested in site-runtime; what is this server's is the deployed AGENT_WRITE below.
const agentScopes = (env: { AGENT_WRITE?: string }, principal: string) => sharedAgentScopes(env, principal, SCOPES);

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
