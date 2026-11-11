/**
 * dustinedwards-mcp: the operator MCP wrapper (Dustin Edwards Admin).
 *
 * THE LAW (Capsid capsid/mcp-wrapper-standard.md, ratified 2026-07-30). This Worker contains NO policy, NO gates, and NO
 * second write path. Every tool call becomes an authenticated HTTP request to POST /api/operator on the dustinedwards
 * Worker, where all rules live. If this Worker vanished, nothing about what is allowed would change.
 *
 * It is a SEPARATE Worker for a structural reason, not a stylistic one: the only path from here to the publish machinery
 * IS the API. Mounted as a route on the app Worker, the cheap path would be an in-process call that silently skips
 * operator authentication and the rate limiter. Here that call is not merely discouraged, it is unreachable.
 *
 * The Worker is site-runtime's adminMcpWorker, the door every admin MCP server shares: the Origin and Host checks, the
 * list-only test key, the OAuth provider bound to PUBLIC_ORIGIN + /mcp, the Cloudflare Access sign-in admitting the
 * single ADMIN_EMAIL (on every request too), the rate limit, /owner, /health and the tool-call log's daily copy (also
 * run now through /api/operator's run_job, behind OPERATOR_TOKEN, by Capsid Admin). What
 * is this server's own is below:
 *
 *   agentKeys              ruling 37: Grok cannot complete OAuth (measured 2026-09-07), so its AGENT_KEY_GROK secret is
 *                          its door, read only unless AGENT_WRITE names it. The principal is the secret's name, never the
 *                          request's; it has its own rate limit, operator rights only (the API sees OPERATOR_TOKEN), and
 *                          the same handleMcp as the OAuth door, so one tool surface.
 *   /probe/*               the client measurement instrument (probe.ts), OUTSIDE the OAuth provider on purpose: it
 *                          observes unauthenticated client behavior. One no-op tool, no route to the operator API, and
 *                          every capture (a KV write anyone can trigger) metered per address (Grok audit, DE-5).
 *   probe-kv               its /health check, warn level: only the instrument uses it.
 *
 * Access rather than dustinedwards.info's own Better Auth: this server's identity stays independent of the site's Google
 * project, so a change there cannot affect operator access here.
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { adminMcpWorker, type AdminMcpEnv } from "@dustinedwards/site-runtime/admin-mcp";
import { kvCheck } from "@dustinedwards/site-runtime/health";
import { clientIp } from "@dustinedwards/site-runtime/http";
import { checkRateLimit, refuse } from "@dustinedwards/site-runtime/mcp-server";
import { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";
import { dustinedwardsMcp } from "@dustinedwards/site-runtime/sites";

import type { ApiEnv } from "./api-client";
import { handleMcp, SERVER } from "./mcp-handler";
import { handleProbe, type ProbeEnv } from "./probe";

/** The door's limiter. The class keeps its name, so the existing Durable Object and its migration stay as they are. */
export class OperatorRateLimit extends RateLimiter {}
export { ToolCallLog } from "@dustinedwards/site-runtime/audit-log";

export interface Env extends AdminMcpEnv, Partial<ApiEnv>, Partial<ProbeEnv> {}

export default adminMcpWorker<Env>({
  name: "Dustin Edwards Admin",
  server: SERVER,
  site: dustinedwardsMcp,
  // The site's contact and expiry (app/routes/security-txt.ts); renew both together.
  securityTxt: { contact: "security@dustinedwards.info", expires: "2027-09-28T00:00:00.000Z" },
  about: `<p>Dustin Edwards Admin runs dustinedwards.info: the Knowledge Base, citations
and procedures. It cannot write posts, change the media library or moderate
webmentions; Carrel owns all three.</p>
<p>It will always be able to read. Changes (refreshing citations, saving a procedure) need the
box below. It will not be able to publish a procedure for the first time; that
stays with you.</p>`,
  // The service binding is checked by presence only: a request over it would be an operator API call.
  api: { binding: "SITE", name: "site" },
  OAuthProvider,
  agentKeys: true,
  serve: (request, env, ctx, caller) => handleMcp(request, env, ctx, caller),
  routes: async (request, env) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/probe")) return null;
    if (!env.PROBE_KV)
      return refuse("The measurement probe is not configured: PROBE_KV is unbound.", 503);
    // Every capture is a KV write anyone can trigger, so it is metered per address like /register. Its health answer
    // writes nothing and stays open.
    if (url.pathname !== "/probe/health") {
      const limit = await checkRateLimit(env.MCP_RATE_LIMIT, `probe:${clientIp(request)}`);
      if (!limit.allowed)
        return refuse("Rate limited.", 429, { "retry-after": String(limit.retryAfter) });
    }
    return handleProbe(request, { PROBE_KV: env.PROBE_KV }, url.origin);
  },
  checks: (env) => [
    {
      ...(env.PROBE_KV
        ? kvCheck("probe-kv", env.PROBE_KV)
        : { name: "probe-kv", run: async () => ({ ok: false, detail: "binding missing" }) }),
      level: "warn",
    },
  ],
});
