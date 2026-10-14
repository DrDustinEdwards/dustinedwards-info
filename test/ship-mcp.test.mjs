// The mcp ship target's two pure halves: which config it will deploy from, and whether the live
// discovery documents describe the server. The rest of the target deploys, so it is not run here.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { MCP_GATES, MCP_TARGETS, discoveryProblems, mcpConfig } from "../scripts/lib/ship-mcp.mjs";

const ORIGIN = "https://admin-mcp.dustinedwards.info";

function good() {
  return {
    prm: { status: 200, body: { resource: `${ORIGIN}/mcp` } },
    as: {
      status: 200,
      body: { issuer: ORIGIN, client_id_metadata_document_supported: true, registration_endpoint: `${ORIGIN}/register` },
    },
    discover: {
      status: 401,
      challenge: `Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
    },
  };
}

await test("discovery that describes this server has no problems", () => {
  assert.deepEqual(discoveryProblems(good(), ORIGIN), []);
});

await test("a token audience other than ORIGIN/mcp is a problem", () => {
  const r = good();
  r.prm.body.resource = "https://dustinedwards-mcp.dustin-edwards.workers.dev/mcp";
  assert.match(discoveryProblems(r, ORIGIN).join(), /protected resource is/);
});

await test("an issuer on another host, no CIMD, or no registration endpoint is a problem", () => {
  const r = good();
  r.as.body = { issuer: "http://admin-mcp.dustinedwards.info" };
  const problems = discoveryProblems(r, ORIGIN).join(" | ");
  assert.match(problems, /issuer is/);
  assert.match(problems, /CIMD/);
  assert.match(problems, /registration endpoint/);
});

await test("server/discover answered without a token is a problem, and so is a challenge naming no document", () => {
  const open = good();
  open.discover = { status: 200, challenge: "" };
  assert.match(discoveryProblems(open, ORIGIN).join(), /answered 200, not 401/);
  const vague = good();
  vague.discover.challenge = "Bearer";
  assert.match(discoveryProblems(vague, ORIGIN).join(), /path-scoped/);
});

await test("unreachable documents are named by status", () => {
  const r = good();
  r.prm = { status: 0, body: null };
  r.as = { status: 404, body: null };
  assert.deepEqual(discoveryProblems(r, ORIGIN).slice(0, 2), [
    "protected resource metadata answered 0",
    "authorization server metadata answered 404",
  ]);
});

function root(config) {
  const dir = mkdtempSync(join(tmpdir(), "ship-mcp-"));
  mkdirSync(join(dir, "mcp"));
  if (config !== null) writeFileSync(join(dir, "mcp", "wrangler.jsonc"), config);
  return dir;
}

await test("mcpConfig refuses a missing config, the example's placeholders, and a non-https origin", () => {
  assert.match(mcpConfig(root(null)).why, /does not exist/);
  assert.match(mcpConfig(root('{ "kv_namespaces": [{ "id": "YOUR_OAUTH_KV_ID" }] }')).why, /placeholders/);
  assert.match(mcpConfig(root('{ "vars": { "PUBLIC_ORIGIN": "http://x.test" } }')).why, /https PUBLIC_ORIGIN/);
});

await test("mcpConfig reads PUBLIC_ORIGIN through comments", () => {
  const config = `{
    // the one public address
    "vars": { "PUBLIC_ORIGIN": "${ORIGIN}/" }
  }`;
  assert.deepEqual(mcpConfig(root(config)), { ok: true, origin: ORIGIN });
});

await test("the gates are the four CI's mcp job runs, typecheck first", () => {
  assert.deepEqual(MCP_GATES, ["typecheck", "check:wrapper", "test", "build"]);
});

await test("the mcp target deploys mcp/ and runs the four gates", () => {
  assert.deepEqual(MCP_TARGETS.mcp.dir, ["mcp"]);
  assert.deepEqual(MCP_TARGETS.mcp.gates, MCP_GATES);
});
