/**
 * The consent step and the upstream sign-in through Cloudflare Access: the shared handler
 * (@dustinedwards/site-runtime/mcp-login), configured for this server. It lets in only the single
 * configured administrator (ADMIN_EMAIL). Capsid, Carrel and Foxing Admin sign in the same way, so
 * one Access login covers every server.
 *
 * Access rather than dustinedwards.info's own Better Auth: this server's identity stays independent
 * of the site's Google project, so a change there cannot affect operator access here.
 */

import { durableObjectCheck, healthResponse, kvCheck, type HealthCheck } from "@dustinedwards/site-runtime/health";
import { isAdminUser, loginHandler, type LoginEnv as SharedLoginEnv } from "@dustinedwards/site-runtime/mcp-login";

import { SCOPE_READ, SCOPE_WRITE } from "./auth";
import type { Env } from "./index";
import { SERVER_INFO } from "./mcp-handler";

export interface LoginEnv extends SharedLoginEnv {
  ADMIN_EMAIL?: string;
  /** The deployed commit, which `npm run ship:mcp` passes (--var DEPLOY_SHA) and /health reports. */
  DEPLOY_SHA?: string;
}

/** Everything the OAuth provider does not own: the consent flow and /health. */
export const defaultHandler = loginHandler<LoginEnv>({
  name: "Dustin Edwards Admin",
  scopes: { read: SCOPE_READ, write: SCOPE_WRITE },
  about: `<p>Dustin Edwards Admin runs dustinedwards.info: site health, drift repair,
webmentions, media, registries, citations and procedures. It cannot write posts;
Carrel owns writing.</p>
<p>It will always be able to read. Changes (repairing drift, deciding mentions,
uploading and backing up media, refreshing citations, saving a procedure) need the
box below. It will not be able to publish a procedure for the first time; that
stays with you.</p>`,
  admit: isAdminUser,
  // Every sign-in, admitted or refused, is a row in the tool-call log.
  audit: { name: SERVER_INFO.name, version: SERVER_INFO.version },
  // site-runtime's healthResponse: application/health+json, no-store and noindex, with a check per binding.
  health: (env) => healthResponse({ sha: env.DEPLOY_SHA, checks: healthChecks(env as unknown as Env) }),
});

/**
 * One check per binding in wrangler.jsonc.example. Fail level for what the door cannot work without: OAUTH_KV (no
 * token is checked), SITE (no tool reaches the operator API), OPERATOR_RATE_LIMIT (every /mcp call is a 429, it fails
 * closed) and TOOL_CALL_LOG (every tool call is refused). PROBE_KV warns: only the measurement probe uses it. SITE is
 * checked by presence only, since a request over it would be an operator API call; the Durable Object checks mint an
 * id and wake no object.
 */
function healthChecks(env: Env): HealthCheck[] {
  const site: HealthCheck = {
    name: "site",
    run: async () => typeof env.SITE?.fetch === "function" || { ok: false, detail: "binding missing" },
  };
  return [
    { ...kvCheck("oauth-kv", env.OAUTH_KV), level: "fail" },
    site,
    { ...durableObjectCheck("operator-rate-limit", env.OPERATOR_RATE_LIMIT), level: "fail" },
    { ...durableObjectCheck("tool-call-log", env.TOOL_CALL_LOG), level: "fail" },
    { ...kvCheck("probe-kv", env.PROBE_KV), level: "warn" },
  ];
}
