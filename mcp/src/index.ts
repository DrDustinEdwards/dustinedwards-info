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
 *   /mcp                   OAuthProvider validates a client-leg access token,
 *                          then apiHandler re-checks the admin grant, rate
 *                          limits, and hands off to the era router
 *   /authorize /callback   the consent flow and Access sign-in, login-handler.ts
 *   /register              rate limited per address, then the OAuth library,
 *                          which refuses any redirect URI not allowlisted
 *   /token                 served by the OAuth library
 *   /.well-known/*         ditto
 *   /probe/*               the client measurement instrument, probe.ts
 *   /health                liveness
 *   /csp-report            the CSP violation sink, csp-report.ts
 *
 * Every response, whichever route made it, leaves through withSecurityHeaders.
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";

import type { AuditEnv } from "@dustinedwards/site-runtime/audit-log";
import { isAdminUser, registrationRefusal } from "@dustinedwards/site-runtime/mcp-login";
import { checkRateLimit, refuse } from "@dustinedwards/site-runtime/mcp-server";
import { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

import { agentPrincipal, agentScopes, SCOPE_READ, SCOPES, type Props } from "./auth";
import { defaultHandler, type LoginEnv } from "./login-handler";
import { handleMcp, MCP_ROUTE } from "./mcp-handler";
import { handleProbe, type ProbeEnv } from "./probe";
import { CSP_REPORT_PATH, withSecurityHeaders } from "./security-headers";
import { handleCspReport } from "./csp-report";
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
    const props = (ctx as ExecutionContext & { props?: Props }).props;

    if (!props || !isAdminUser(env, props)) {
      return refuse(
        "Forbidden. This is a single-operator server and this grant does not belong to its administrator.",
        403,
      );
    }

    // Both doors have locks. Keyed by the operator's verified email rather than
    // by IP, because the identity is known here and it is the thing worth
    // limiting. Fails closed if the binding is missing.
    const limit = await checkRateLimit(env.OPERATOR_RATE_LIMIT, `operator:${props.email.toLowerCase()}`);
    if (!limit.allowed) {
      return refuse(
        "Rate limited. This wrapper allows 30 requests per 60 seconds. The operator API applies its own " +
          "limit independently of this one.",
        429,
        { "retry-after": String(limit.retryAfter) },
      );
    }

    // A grant minted before scopes existed carries none, and reads only.
    const scopes = Array.isArray(props.scopes) ? props.scopes : [SCOPE_READ];
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
  const limit = await checkRateLimit(env.OPERATOR_RATE_LIMIT, `agent:${principal}`);
  if (!limit.allowed) {
    return refuse(
      "Rate limited. This wrapper allows 30 requests per 60 seconds. The operator API applies its own " +
        "limit independently of this one.",
      429,
      { "retry-after": String(limit.retryAfter) },
    );
  }

  return handleMcp(request, env, ctx, { kind: "agent", principal, scopes: agentScopes(env, principal) });
}

/** How many registrations one address may make per minute. */
const REGISTRATIONS_PER_MINUTE = 5;

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
      scopes_supported: [SCOPE_READ],
      resource_name: "Dustin Edwards Admin",
    },
    scopesSupported: SCOPES.all,
    // BOTH client identity paths. Rule 13.
    //
    // CIMD for Claude, Claude Code and ChatGPT. Measured 2026-07-30: claude.ai
    // sends its client_id as the URL https://claude.ai/oauth/mcp-oauth-client-metadata
    // and never calls a registration endpoint.
    //
    // DCR, TIGHTENED, for Grok and Gemini, which still require RFC 7591 as of
    // 2026-10-09. registrationRefusal allows only redirect URIs listed exactly in
    // DCR_REDIRECT_URIS (none listed refuses every registration), the route is
    // rate limited per address before the provider sees it, and a registration
    // grants nothing: a grant still comes only from the consent page, the Access
    // sign-in and isAdminUser. Remove when Grok and Gemini support CIMD, at the
    // latest when the specification removes DCR.
    clientIdMetadataDocumentEnabled: true,
    clientRegistrationEndpoint: "/register",
    clientRegistrationCallback: ({ clientMetadata }) => {
      const why = registrationRefusal(env.DCR_REDIRECT_URIS, clientMetadata);
      if (!why) return undefined;
      console.log(JSON.stringify({ audit: "registration-refused", why }));
      return { code: "invalid_redirect_uri", description: why };
    },
  });
  provider = built;
  return built;
}

/**
 * Every request is routed here and every answer leaves through withSecurityHeaders
 * (security-headers.ts), the one place this Worker's security headers are set. A throw
 * becomes a logged 500 that carries them too, rather than Cloudflare's bare error page.
 */
async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  // Outside the provider: browsers send violation reports without credentials.
  if (url.pathname === CSP_REPORT_PATH) return handleCspReport(request, env);

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
    const principal = await agentPrincipal(
      env as unknown as Record<string, unknown>,
      request.headers.get("authorization"),
    );
    if (principal) return agentHandler(request, env, ctx, principal);
  }

  if (url.pathname === "/register") {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const limit = await checkRateLimit(env.OPERATOR_RATE_LIMIT, `register:${ip}`, REGISTRATIONS_PER_MINUTE);
    if (!limit.allowed) {
      return refuse(
        `Rate limited. This server allows ${REGISTRATIONS_PER_MINUTE} client registrations per minute per address.`,
        429,
        { "retry-after": String(limit.retryAfter) },
      );
    }
  }

  return oauthProvider(env).fetch(request, env, ctx);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let response: Response;
    try {
      response = await route(request, env, ctx);
    } catch (error) {
      console.error(
        JSON.stringify({ alert: "unhandled-error", detail: error instanceof Error ? error.message : String(error) }),
      );
      response = refuse("Internal error. The request was not completed.", 500);
    }
    return withSecurityHeaders(response, new URL(request.url).origin);
  },
} satisfies ExportedHandler<Env>;
