/**
 * The consent step and the upstream sign-in through Cloudflare Access: the shared handler
 * (@dustinedwards/site-runtime/mcp-login), configured for this server. It lets in only the single
 * configured administrator (ADMIN_EMAIL). Capsid, Carrel and Foxing Admin sign in the same way, so
 * one Access login covers every server.
 *
 * Access rather than dustinedwards.info's own Better Auth: this server's identity stays independent
 * of the site's Google project, so a change there cannot affect operator access here.
 */

import { auditLogCheck, type AuditEnv } from "@dustinedwards/site-runtime/audit-log";
import { durableObjectCheck, healthResponse, kvCheck, type HealthCheck } from "@dustinedwards/site-runtime/health";
import { isAdminUser, loginHandler, type LoginEnv as SharedLoginEnv } from "@dustinedwards/site-runtime/mcp-login";

import { SCOPE_READ, SCOPE_WRITE } from "./auth";
import type { Env } from "./index";
import { SERVER_INFO } from "./mcp-handler";

export interface LoginEnv extends SharedLoginEnv, Partial<AuditEnv> {
  ADMIN_EMAIL?: string;
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
  // The deployed commit, a check per binding (area 8, H5), and the tool-call log's check (checklist L8): a call
  // started and never finished, a spike in calls, or rows not copied to AUDIT_BUCKET for two days. The log's check
  // reads TOOL_CALL_LOG, so it is that binding's check too.
  health: (env) => healthResponse({ sha: env.DEPLOY_SHA, checks: [...bindingChecks(env as unknown as Env), auditLogCheck(env)] }),
});

/**
 * One check per binding in wrangler.jsonc.example, as Foxing Admin's door does. Fail level for what the door cannot
 * work without: OAUTH_KV (no token is checked), SITE (no tool reaches the operator API) and OPERATOR_RATE_LIMIT (every
 * /mcp call is a 429: it fails closed). Warn for PROBE_KV (only the measurement probe uses it). SITE is checked by
 * presence only, since a request over it would be an operator API call; the Durable Object check mints an id and wakes
 * no object. AUDIT_BUCKET is not touched here: only exportAuditLog may (check:wrapper), and the log's own check alerts
 * when its copy is two days late (mcp/.ops-audit.json).
 */
function bindingChecks(env: Env): HealthCheck[] {
  const site: HealthCheck = {
    name: "site",
    run: async () => typeof env.SITE?.fetch === "function" || { ok: false, detail: "binding missing" },
  };
  const bound = <T>(name: string, binding: T | undefined, check: (b: T) => HealthCheck): HealthCheck =>
    binding ? check(binding) : { name, run: async () => ({ ok: false, detail: "binding missing" }) };
  return [
    { ...kvCheck("oauth-kv", env.OAUTH_KV), level: "fail" },
    { ...site, level: "fail" },
    { ...bound("operator-rate-limit", env.OPERATOR_RATE_LIMIT, (b) => durableObjectCheck("operator-rate-limit", b)), level: "fail" },
    { ...bound("probe-kv", env.PROBE_KV, (b) => kvCheck("probe-kv", b)), level: "warn" },
  ];
}
