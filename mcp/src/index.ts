/**
 * dustinedwards-mcp: the operator MCP wrapper.
 *
 * THE LAW (Capsid capsid/mcp-wrapper-standard.md, ratified 2026-07-30). This
 * Worker contains NO policy, NO gates, and NO second write path. Every tool call
 * becomes an authenticated HTTP request to POST /api/operator on the
 * dustinedwards Worker, where all rules live. If this Worker vanished, nothing
 * about what is allowed would change.
 *
 * It is a SEPARATE Worker in its own repo for a structural reason, not a
 * stylistic one: the only path from here to the publish machinery IS the API.
 * Mounted as a route on the app Worker, the cheap path would be an in-process
 * call that silently skips operator authentication and the rate limiter. Here
 * that call is not merely discouraged, it is unreachable.
 *
 * Request routing, outermost first:
 *
 *   /mcp                   a foreign Origin is refused first; then
 *                          OAuthProvider validates a client-leg access token,
 *                          then apiHandler re-checks its audience and the admin
 *                          grant, rate limits (a refusal is a tool-call log
 *                          row), and hands off to the era router
 *   /authorize /callback   the consent flow and Access sign-in, login-handler.ts
 *   /owner                 the owner page: your grants with Revoke, the agent keys and the tool-call log
 *                          (site-runtime ./owner-page, mounted by the same login handler)
 *   /register              site-runtime's registrationLimited (per address and
 *                          per day), then the OAuth library, which refuses any
 *                          redirect URI not allowlisted
 *   /token                 served by the OAuth library
 *   /.well-known/*         ditto
 *   /probe/*               the client measurement instrument, probe.ts
 *   /health                liveness, the deployed commit and the tool-call log's check
 *   /.well-known/security.txt and /csp-report  answered by withMcpHeaders
 *
 * Every response, whichever route made it, leaves through site-runtime's withMcpHeaders.
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";

import { exportAuditLog, recordAudit, type AuditEnv } from "@dustinedwards/site-runtime/audit-log";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { DCR_CALLBACKS, isAdminUser, registrationLimited, registrationRefusal } from "@dustinedwards/site-runtime/mcp-login";
import {
  audienceRefusal,
  callerName,
  checkRateLimit,
  mcpOriginRefusal,
  refuse,
  withMcpHeaders,
} from "@dustinedwards/site-runtime/mcp-server";
import { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";
import { dustinedwardsMcp } from "@dustinedwards/site-runtime/sites";

import { agentPrincipal, agentScopes } from "@dustinedwards/site-runtime/agent-keys";

import { SCOPE_READ, SCOPES, type Caller, type Props } from "./auth";
import { defaultHandler, type LoginEnv } from "./login-handler";
import { handleMcp, MCP_ROUTE, SERVER } from "./mcp-handler";
import { handleProbe, type ProbeEnv } from "./probe";
import type { ApiEnv } from "./api-client";

/** The door's limiter. The class keeps its name, so the existing binding and migration stay as they are. */
export class OperatorRateLimit extends RateLimiter {}

export interface RateLimitEnv {
  OPERATOR_RATE_LIMIT: DurableObjectNamespace<OperatorRateLimit>;
}
export { ToolCallLog } from "@dustinedwards/site-runtime/audit-log";

export interface Env extends Partial<ApiEnv>, Partial<RateLimitEnv>, Partial<AuditEnv>, ProbeEnv, LoginEnv {
  OAUTH_KV: KVNamespace;
  /** The one public origin, https://admin-mcp.dustinedwards.info. Tokens are bound to its /mcp. */
  PUBLIC_ORIGIN?: string;
  /** Comma-separated redirect URIs a dynamically registered client may use, matched exactly. */
  DCR_REDIRECT_URIS?: string;
  /** Comma-separated agent principals that hold dei.write. */
  AGENT_WRITE?: string;
  /** The tool-call log's copies in R2 (the scheduled export below, checklist L6-L7). Nothing else is stored there. */
  AUDIT_BUCKET?: R2Bucket;
}

/** The canonical resource every grant and token is bound to: this server's /mcp, as the provider names it below. */
function mcpResource(env: Env): string {
  return `${(env.PUBLIC_ORIGIN ?? "").replace(/\/+$/, "")}${MCP_ROUTE}`;
}

const RATE_LIMITED =
  "Rate limited. This wrapper allows 30 requests per 60 seconds. The operator API applies its own " +
  "limit independently of this one.";

/**
 * A door's refusal for one caller over the limit, with its row in the tool-call log first (checklist L2), so a
 * burst shows up there and not only in the Worker log. The row names the caller, never a credential.
 */
async function rateLimited(env: Env, caller: Caller, retryAfter: number, clientId?: string): Promise<Response> {
  await recordAudit(env, {
    callId: crypto.randomUUID(),
    phase: "rate-limited",
    caller: callerName(caller),
    server: { name: SERVER.name, version: SERVER.version },
    ...(clientId ? { clientId } : {}),
  });
  return refuse(RATE_LIMITED, 429, { "retry-after": String(retryAfter) });
}

/**
 * The authenticated MCP surface.
 *
 * The OAuth library has already validated the access token by the time this runs.
 * The admin check runs AGAIN here as defense in depth: a grant is long lived, and
 * this is the boundary a request actually crosses, so re-checking costs one
 * comparison and removes a class of bug where a grant outlives its authority.
 */
const apiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { props, auth } = ctx as ExecutionContext & { props?: Props; auth?: { audience?: unknown; clientId?: string } };

    // The token must have been issued for this server (RFC 8707, rule 12.2): site-runtime's shared check, against
    // the resource this server expects rather than the one the provider was configured with.
    const wrongAudience = audienceRefusal(auth, mcpResource(env), [SCOPE_READ]);
    if (wrongAudience) return wrongAudience;

    if (!props || !isAdminUser(env, props)) {
      return refuse(
        "Forbidden. This is a single-operator server and this grant does not belong to its administrator.",
        403,
      );
    }

    // Both doors have locks. Keyed by the operator's verified email rather than
    // by IP, because the identity is known here and it is the thing worth
    // limiting. Fails closed if the binding is missing.
    // A grant minted before scopes existed carries none, and reads only.
    const scopes = Array.isArray(props.scopes) ? props.scopes : [SCOPE_READ];
    const limit = await checkRateLimit(env.OPERATOR_RATE_LIMIT, `operator:${props.email.toLowerCase()}`);
    if (!limit.allowed) return rateLimited(env, { kind: "admin", props, scopes }, limit.retryAfter, auth?.clientId);

    return handleMcp(request, env, ctx, { kind: "admin", props, scopes });
  },
};

/**
 * The agent-key surface: the same rate limit and the same handler, a different
 * door. Ruling 37.
 *
 * IT SHARES `handleMcp` WITH THE OAUTH PATH ON PURPOSE. Two handlers would be
 * two places for the tool surface to be defined, and the first time they
 * disagreed one door would offer something the other did not. There is one
 * MCP server here and two ways to be let in front of it.
 *
 * THE AUDIT LINE IS THE PRINCIPAL, and it is the only place the agent's name
 * appears. Worth stating plainly, because it is a real limit rather than an
 * oversight: the operator API downstream sees `OPERATOR_TOKEN` and records
 * `tokenLabel(token)`, which is the same eight hex characters for every agent
 * and for the human operator. So this log is where "grok did that" is written
 * down, and the site's own audit still says only "the operator did".
 * Distinguishing them THERE would mean the API accepting a caller-supplied
 * principal, which is a change to an auth surface and a decision for the seat.
 *
 * The line carries no key, no key length and no header, only the principal that
 * a comparison against a configured secret produced.
 */
async function agentHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  principal: string,
): Promise<Response> {
  console.log(
    JSON.stringify({
      audit: "agent-key-accepted",
      principal,
      // Present so a reader can tell a tools/call from a handshake without the
      // body. Never the Authorization header, and never any part of the key.
      method: request.method,
      rights: "operator",
    }),
  );

  /*
   * KEYED BY THE PRINCIPAL, not by IP and not shared with the operator. The
   * OAuth path limits `operator:<email>`; an agent gets its own bucket, so
   * one agent exhausting its allowance cannot rate limit Dustin out of his own
   * server, and vice versa. Fails closed when the binding is missing, exactly
   * as the other door does.
   */
  const scopes = agentScopes(env, principal, SCOPES);
  const limit = await checkRateLimit(env.OPERATOR_RATE_LIMIT, `agent:${principal}`);
  if (!limit.allowed) return rateLimited(env, { kind: "agent", principal, scopes }, limit.retryAfter);

  return handleMcp(request, env, ctx, { kind: "agent", principal, scopes });
}

/**
 * The provider, built once per isolate from its env, because three of its
 * settings are configuration: the canonical resource, and the registration
 * allowlist the DCR callback reads. The env is fixed for an isolate's life, so
 * building it on first use is the same object every later request gets.
 */
let provider: OAuthProvider<Env> | null = null;
function oauthProvider(env: Env): OAuthProvider<Env> {
  if (provider) return provider;
  const origin = (env.PUBLIC_ORIGIN ?? "").replace(/\/+$/, "");
  const built = new OAuthProvider<Env>({
    apiRoute: MCP_ROUTE,
    apiHandler,
    defaultHandler: defaultHandler as unknown as ExportedHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    /*
     * AUDIENCE BINDING. Rule 12.2, RFC 8707. Naming the resource pins every
     * grant and every access token to exactly this server's /mcp: a token
     * issued for any other resource, by this provider or by another server,
     * is refused, and an authorization that names no resource is bound to this
     * one. Nothing is passed through: the API leg uses OPERATOR_TOKEN, never the
     * client's token.
     */
    resourceMetadata: {
      resource: `${origin}${MCP_ROUTE}`,
      authorization_servers: [origin],
      resource_name: "Dustin Edwards Admin",
    },
    /*
     * EVERY SCOPE IN THE PROTECTED RESOURCE METADATA (checklist A1, RFC 9728). The provider publishes
     * requiredScopes as the resource's scopes_supported and as the 401's scope, so both name dei.read and
     * dei.write, as Foxhound Admin's do. Least scope first still holds where it is decided: every grant holds
     * read, write only when the consent page's box is ticked (loginHandler), and a tool needing write without
     * it gets the 403 step-up. The authorization server's catalog, scopesSupported, lists both too.
     */
    requiredScopes: SCOPES.all,
    scopesSupported: SCOPES.all,
    // BOTH client identity paths. Rule 13.
    //
    // CIMD for Claude, Claude Code and ChatGPT. Measured 2026-07-30: claude.ai
    // sends its client_id as the URL https://claude.ai/oauth/mcp-oauth-client-metadata
    // and never calls a registration endpoint.
    //
    // DCR, TIGHTENED, for Grok and Gemini, which still require RFC 7591 as of
    // 2026-10-09. registrationRefusal allows only redirect URIs listed exactly in
    // the shared DCR_CALLBACKS or DCR_REDIRECT_URIS, the route is rate limited
    // before the provider sees it, and a registration
    // grants nothing: a grant still comes only from the consent page, the Access
    // sign-in and isAdminUser. Remove when Grok and Gemini support CIMD, at the
    // latest when the specification removes DCR.
    clientIdMetadataDocumentEnabled: true,
    clientRegistrationEndpoint: "/register",
    clientRegistrationCallback: ({ clientMetadata }) => {
      const why = registrationRefusal([...DCR_CALLBACKS, env.DCR_REDIRECT_URIS ?? ""].join(","), clientMetadata);
      if (!why) return undefined;
      console.log(JSON.stringify({ audit: "registration-refused", why }));
      return { code: "invalid_redirect_uri", description: why };
    },
  });
  provider = built;
  return built;
}

/** Every request is routed here; withMcpHeaders below sets every security header on the answer. */
async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  // The measurement instrument sits OUTSIDE the OAuth provider deliberately.
  // It exists to observe unauthenticated client behavior, so putting it behind
  // authentication would defeat it. It exposes one no-op tool and has no route
  // to the operator API.
  if (url.pathname.startsWith("/probe")) {
    // Every capture is a KV write anyone can trigger, so it is metered per address like /register
    // (Grok audit 2026-10-21, DE-5). Its health answer writes nothing and stays open.
    if (url.pathname !== "/probe/health") {
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      const limit = await checkRateLimit(env.OPERATOR_RATE_LIMIT, `probe:${ip}`);
      if (!limit.allowed) {
        return refuse("Rate limited.", 429, { "retry-after": String(limit.retryAfter) });
      }
    }
    return handleProbe(request, env, url.origin);
  }

  /*
   * THE AGENT KEY PATH. Ruling 37.
   *
   * BEFORE the provider, because the provider owns `/mcp` and answers 401 to
   * anything carrying a token it did not mint. An agent key is not one of
   * those, so it is recognized here or not at all.
   *
   * IT IS TRIED, NEVER REQUIRED. `agentPrincipal` returns null for a missing
   * header, a malformed one, a key matching nothing, and for a Worker with no
   * `AGENT_KEY_*` secret configured at all. Every one of those falls through
   * to the provider, which answers exactly as it did before. So this Worker's
   * behavior with no agent secret set is unchanged, and that is the state it
   * deploys in.
   *
   * SCOPED TO `/mcp`. The consent flow, the token endpoint, `/register` and
   * the metadata documents stay the provider's business: an agent key is an
   * alternative to HOLDING a grant, not to the protocol around one.
   */
  if (url.pathname === MCP_ROUTE) {
    // Before any token check, so a page on another origin learns nothing from
    // a 401 (DNS rebinding). No Origin, this origin and claude.ai pass.
    const foreign = mcpOriginRefusal(request, ["https://claude.ai"]);
    if (foreign) return foreign;
    const principal = await agentPrincipal(
      env as unknown as Record<string, unknown>,
      request.headers.get("authorization"),
    );
    if (principal) return agentHandler(request, env, ctx, principal);
  }

  if (url.pathname === "/register" && request.method === "POST") {
    const limited = await registrationLimited(request, env.OAUTH_KV);
    if (limited) return limited;
  }

  return oauthProvider(env).fetch(request, env, ctx);
}

export default {
  /*
   * The entry's full set, the consent page's hashed-style policy and the load-nothing policy for the rest, on every
   * response. It also answers security.txt (the site's contact and expiry, app/routes/security-txt.ts; renew both
   * together) and the CSP sink, metered per address because a page tripping ten rules sends ten reports. A throw
   * becomes a logged 500 that carries the set too, rather than Cloudflare's bare error page.
   */
  fetch: withMcpHeaders<Env>(
    async (request, env, ctx) => {
      try {
        return await route(request, env, ctx as ExecutionContext);
      } catch (error) {
        console.error(
          JSON.stringify({ alert: "unhandled-error", detail: error instanceof Error ? error.message : String(error) }),
        );
        return refuse("Internal error. The request was not completed.", 500);
      }
    },
    {
      site: dustinedwardsMcp,
      securityTxt: { contact: "security@dustinedwards.info", expires: "2027-09-28T00:00:00.000Z" },
      allowReport: async (request, env) =>
        (await checkRateLimit(env.OPERATOR_RATE_LIMIT, `csp:${request.headers.get("cf-connecting-ip") ?? "unknown"}`, 60)).allowed,
    },
  ),
  // The daily copy of the tool-call log to R2 and the 90-day prune of copied rows (checklist L6-L7). A failed write
  // throws, so the cron run shows failed, and /health's tool-call-log check alerts once rows go uncopied for two days.
  scheduled: async (_controller, env) => {
    if (!env.AUDIT_BUCKET) throw new Error("AUDIT_BUCKET is not bound; the tool-call log is not copied");
    const done = await exportAuditLog(env, env.AUDIT_BUCKET);
    logEvent("tool_call_log_exported", { exported: done.exported, pruned: done.pruned });
  },
} satisfies ExportedHandler<Env>;
