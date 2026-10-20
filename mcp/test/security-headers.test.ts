/**
 * The security headers, graded by the shared package's own check on responses the real handlers
 * make: /health, a 404, the consent page, a refused consent POST, the callback's errors, a
 * redirect, an MCP initialize over the real protocol layer, the probe and the CSP sink. The entry
 * (index.ts) imports the OAuth library, which Node cannot load, so the wiring there is pinned by
 * reading its source, and check:conformance grades the real entry under wrangler dev.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { checkSecurityHeaders, failures, parsePolicy } from "@dustinedwards/site-runtime/check";
import { scriptHash } from "@dustinedwards/site-runtime/csp";

import { CONSENT_STYLE, defaultHandler, type LoginEnv } from "../src/login-handler.ts";
import { handleMcp } from "../src/mcp-handler.ts";
import { handleProbe } from "../src/probe.ts";
import { handleCspReport } from "../src/csp-report.ts";
import { CSP_REPORT_PATH, NON_HTML_CSP, consentPageCsp, securityHeaders, withSecurityHeaders } from "../src/security-headers.ts";
import { WRITER, freshEnv } from "./fake-operator.ts";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const ORIGIN = "https://wrapper.test";

const LOGIN_ENV = {
  ACCESS_TEAM_DOMAIN: "https://team.example.com",
  ACCESS_SAAS_CLIENT_ID: "client-id",
  ACCESS_SAAS_CLIENT_SECRET: "client-secret",
  ADMIN_EMAIL: "admin@example.com",
  OAUTH_PROVIDER: {
    async parseAuthRequest() {
      return { clientId: "https://client.example.com/meta", redirectUri: "https://client.example.com/cb", scope: ["dei.read"], state: "s" };
    },
    async lookupClient() {
      return { clientName: "Sample client" };
    },
    async completeAuthorization() {
      return { redirectTo: "https://client.example.com/cb?code=x" };
    },
  },
} as unknown as LoginEnv;

const login = (path: string, init?: RequestInit) => defaultHandler.fetch(new Request(`${ORIGIN}${path}`, init), LOGIN_ENV);

function assertGraded(label: string, response: Response) {
  const failed = failures(checkSecurityHeaders(response.headers, { standard: securityHeaders }));
  assert.deepEqual(failed, [], `${label}: ${failed.map((f) => `${f.name} (${f.detail})`).join("; ")}`);
}

const initialize = () =>
  handleMcp(
    new Request(`${ORIGIN}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-11-25" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } },
      }),
    }),
    freshEnv(),
    ctx,
    WRITER,
  );

const RESPONSES: Array<[string, () => Promise<Response>]> = [
  ["GET /health", () => login("/health")],
  ["a 404", () => login("/nowhere")],
  ["the consent page", () => login("/authorize?client_id=x")],
  ["a consent POST without its token", () => login("/authorize", { method: "POST", body: new FormData() })],
  ["the callback without a code", () => login("/callback")],
  ["a redirect with immutable headers", async () => Response.redirect("https://client.example.com/cb", 302)],
  ["an MCP initialize", initialize],
  ["the probe", () => handleProbe(new Request(`${ORIGIN}/probe/health`), {} as never, ORIGIN)],
  ["a CSP report", () => handleCspReport(new Request(`${ORIGIN}${CSP_REPORT_PATH}`, { method: "POST", body: "{}" }), {})],
];

describe("security headers", () => {
  for (const [label, make] of RESPONSES) {
    test(`${label} carries the set and an enforced policy`, async () => {
      assertGraded(label, await withSecurityHeaders(await make()));
    });
  }

  test("the check bites: a response this Worker made, unwrapped, fails it", async () => {
    const bare = await login("/health");
    assert.ok(failures(checkSecurityHeaders(bare.headers, { standard: securityHeaders })).length > 0);
  });

  test("the consent page's policy trusts exactly the style it renders, and has no form-action", async () => {
    const response = await withSecurityHeaders(await login("/authorize?client_id=x"));
    const html = await response.text();
    const rendered = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1];
    assert.equal(rendered, CONSENT_STYLE);
    const policy = parsePolicy(response.headers.get("Content-Security-Policy") ?? "");
    assert.deepEqual(policy.get("style-src"), [`'${await scriptHash(rendered)}'`]);
    assert.deepEqual(policy.get("default-src"), ["'none'"]);
    // A form-action breaks the consent POST's redirect chain (security-headers.ts).
    assert.equal(policy.has("form-action"), false);
    assert.equal(response.headers.get("Content-Security-Policy"), await consentPageCsp());
    // The consent token cookie survives the rebuild.
    assert.match(response.headers.get("Set-Cookie") ?? "", /mcp_consent=/);
  });

  test("non-HTML gets the strict policy, and the OAuth window keeps its opener (no COOP)", async () => {
    const response = await withSecurityHeaders(await login("/health"));
    assert.equal(response.headers.get("Content-Security-Policy"), NON_HTML_CSP);
    assert.equal(response.headers.get("Cross-Origin-Opener-Policy"), null);
    assert.equal(await response.text(), "ok");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  test("the MCP response still parses after the rebuild", async () => {
    const response = await withSecurityHeaders(await initialize());
    assert.equal(response.status, 200);
    const text = await response.text();
    const data = text.split("\n").find((line) => line.startsWith("data: "));
    const message = JSON.parse(data ? data.slice(6) : text);
    assert.equal(message.result.serverInfo.name, "dustinedwards-mcp");
  });

  test("a redirect keeps its status and Location", async () => {
    const response = await withSecurityHeaders(Response.redirect("https://client.example.com/cb", 302));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "https://client.example.com/cb");
  });

  test("the sink answers 204 to a POST and 405 to anything else", async () => {
    const post = await handleCspReport(new Request(`${ORIGIN}${CSP_REPORT_PATH}`, { method: "POST", body: "{}" }), {});
    assert.equal(post.status, 204);
    const get = await handleCspReport(new Request(`${ORIGIN}${CSP_REPORT_PATH}`), {});
    assert.equal(get.status, 405);
  });
});

describe("one place sets the headers", () => {
  const src = new URL("../src/", import.meta.url);
  const index = readFileSync(new URL("index.ts", src), "utf8");

  test("the entry's fetch returns only through withSecurityHeaders, and routes the sink", () => {
    const entry = index.slice(index.indexOf("export default {"));
    const returns = [...entry.matchAll(/\breturn\s+([^;]+);/g)].map((m) => m[1]);
    assert.deepEqual(returns, ["withSecurityHeaders(response)"]);
    assert.match(index, /url\.pathname === CSP_REPORT_PATH\) return handleCspReport\(/);
  });

  test("no other source file names a security header", () => {
    const names = [...Object.keys(securityHeaders), "Content-Security-Policy", "Reporting-Endpoints"].map((n) => n.toLowerCase());
    for (const file of readdirSync(src).filter((f) => f.endsWith(".ts") && f !== "security-headers.ts")) {
      const text = readFileSync(new URL(file, src), "utf8").toLowerCase();
      for (const name of names) assert.ok(!text.includes(`"${name}"`), `src/${file} sets ${name}`);
    }
  });
});
