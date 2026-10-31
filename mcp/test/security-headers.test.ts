/**
 * What the wrapper must keep while it applies the set: the consent page's own policy, the strict policy and no COOP
 * everywhere else, the MCP stream, a redirect, and the CSP sink. The set itself is graded live (site-runtime-security).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { parsePolicy } from "@dustinedwards/site-runtime/check";
import { scriptHash } from "@dustinedwards/site-runtime/csp";

import { AuthorizationError } from "@cloudflare/workers-oauth-provider";
import { CONSENT_STYLE } from "@dustinedwards/site-runtime/mcp-login";
import { defaultHandler, type LoginEnv } from "../src/login-handler.ts";
import { handleMcp } from "../src/mcp-handler.ts";
import { handleCspReport } from "../src/csp-report.ts";
import { CSP_REPORT_PATH, NON_HTML_CSP, consentPageCsp, withSecurityHeaders } from "../src/security-headers.ts";
import { WRITER, freshEnv } from "./fake-operator.ts";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const ORIGIN = "https://wrapper.test";

const AUTH_REQUEST = { clientId: "https://client.example.com/meta", redirectUri: "https://client.example.com/cb", scope: ["dei.read"], state: "s" };
// The provider's consent and upstream handles, as the library behaves without its cookie: a POST
// or callback that carries no handle is an AuthorizationError with no redirect.
const unbound = () => new AuthorizationError("invalid_request", { description: "The handle is missing or expired." });

const LOGIN_ENV = {
  ACCESS_TEAM_DOMAIN: "https://sample.cloudflareaccess.com",
  ACCESS_SAAS_CLIENT_ID: "client-id",
  ACCESS_SAAS_CLIENT_SECRET: "client-secret",
  ADMIN_EMAIL: "admin@example.com",
  OAUTH_PROVIDER: {
    async parseAuthRequest() {
      return AUTH_REQUEST;
    },
    async lookupClient() {
      return { clientName: "Sample client" };
    },
    async beginConsent() {
      return { handle: "h1", headers: new Headers({ "Set-Cookie": "__Host-consent=bound; Path=/; Secure; HttpOnly; SameSite=Lax" }) };
    },
    async approveConsent() {
      throw unbound();
    },
    async denyConsent() {
      throw unbound();
    },
    async finishUpstream() {
      throw unbound();
    },
    async completeAuthorization() {
      return { redirectTo: "https://client.example.com/cb?code=x" };
    },
  },
} as unknown as LoginEnv;

const login = (path: string, init?: RequestInit) => defaultHandler.fetch(new Request(`${ORIGIN}${path}`, init), LOGIN_ENV);

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

describe("security headers", () => {
  test("the consent page's policy trusts exactly the style it renders, and has no form-action", async () => {
    const response = await withSecurityHeaders(await login("/authorize?client_id=x"), ORIGIN);
    const html = await response.text();
    const rendered = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1];
    assert.equal(rendered, CONSENT_STYLE);
    const policy = parsePolicy(response.headers.get("Content-Security-Policy") ?? "");
    assert.deepEqual(policy.get("style-src"), [`'${await scriptHash(rendered)}'`]);
    assert.deepEqual(policy.get("default-src"), ["'none'"]);
    // A form-action breaks the consent POST's redirect chain (security-headers.ts).
    assert.equal(policy.has("form-action"), false);
    assert.equal(response.headers.get("Content-Security-Policy"), await consentPageCsp());
    // The provider's consent binding cookie survives the rebuild.
    assert.match(response.headers.get("Set-Cookie") ?? "", /__Host-consent=bound/);
  });

  test("non-HTML gets the strict policy, and the OAuth window keeps its opener (no COOP)", async () => {
    const response = await withSecurityHeaders(await login("/health"), ORIGIN);
    assert.equal(response.headers.get("Content-Security-Policy"), NON_HTML_CSP);
    assert.equal(response.headers.get("Cross-Origin-Opener-Policy"), null);
    assert.equal(await response.text(), "ok");
    assert.equal(response.headers.get("cache-control"), "no-store");
    // Absolute: a browser ignores a relative Reporting-Endpoints entry.
    assert.equal(response.headers.get("Reporting-Endpoints"), `csp-endpoint="${ORIGIN}/csp-report"`);
  });

  test("the MCP response still parses after the rebuild", async () => {
    const response = await withSecurityHeaders(await initialize(), ORIGIN);
    assert.equal(response.status, 200);
    const text = await response.text();
    const data = text.split("\n").find((line) => line.startsWith("data: "));
    const message = JSON.parse(data ? data.slice(6) : text);
    assert.equal(message.result.serverInfo.name, "dustinedwards-mcp");
  });

  test("a redirect keeps its status and Location", async () => {
    const response = await withSecurityHeaders(Response.redirect("https://client.example.com/cb", 302), ORIGIN);
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
