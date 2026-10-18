/**
 * The consent step: upstream sign-in through Cloudflare Access.
 *
 * `@cloudflare/workers-oauth-provider` makes this Worker an OAuth 2.1
 * authorization server for MCP clients. It does not know WHO the human is, so
 * this handler answers that by sending them to Cloudflare Access for SaaS
 * (access-login.ts) and checking the returning email against the single
 * configured administrator (ADMIN_EMAIL).
 *
 * Access, the same door Capsid, Carrel and Foxing Admin use, so one login covers
 * every server. It keeps the wrapper's identity independent of
 * dustinedwards.info's own Better Auth setup, so a change to the site's Google
 * project cannot affect operator access here.
 */

import { accessSaas, authorizationUrl, finishSignIn, newSignIn, type AccessEnv } from "./access-login";
import { isAdminUser, SCOPE_READ, SCOPE_WRITE, type Props } from "./auth";

export interface LoginEnv extends AccessEnv {
  ADMIN_EMAIL?: string;
  OAUTH_PROVIDER: {
    parseAuthRequest(request: Request): Promise<AuthRequest>;
    completeAuthorization(options: {
      request: AuthRequest;
      userId: string;
      metadata: Record<string, unknown>;
      scope: string[];
      props: Props;
    }): Promise<{ redirectTo: string }>;
    lookupClient(clientId: string): Promise<{ clientName?: string } | null>;
  };
}

interface AuthRequest {
  clientId: string;
  redirectUri: string;
  scope: string[];
  state: string;
  [key: string]: unknown;
}

const STATE_COOKIE = "mcp_oauth_state";
/**
 * Binds the consent POST to the consent page this server rendered. The page
 * sets it as a SameSite=Strict cookie and repeats it in a hidden field, and the
 * POST must carry both, equal. A cross-site form cannot read the field and its
 * request carries no Strict cookie, so another site cannot submit consent on
 * the administrator's behalf and skip the page (the confused-deputy path).
 */
const CONSENT_COOKIE = "mcp_consent";

function cookie(request: Request, name: string): string | undefined {
  return request.headers
    .get("Cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

function html(body: string, status = 200, headers: HeadersInit = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

const NOT_CONFIGURED =
  "This wrapper is not configured for login: ACCESS_TEAM_DOMAIN, ACCESS_SAAS_CLIENT_ID or " +
  "ACCESS_SAAS_CLIENT_SECRET is unset. Not configured means not open.";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The consent screen.
 *
 * A real form with a real submit button, because consent has to be an act. The
 * client id is shown verbatim: with CIMD it is a URL, and a human approving
 * access to a publishing surface should see exactly which client is asking.
 */
async function handleAuthorizeGet(request: Request, env: LoginEnv): Promise<Response> {
  if (!accessSaas(env)) return text(NOT_CONFIGURED, 503);

  const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId).catch(() => null);
  const clientName = client?.clientName ?? oauthReq.clientId;
  // LEAST SCOPE FIRST (rule 12.3): the write box starts ticked only when the
  // client itself asked for dei.write, and the administrator decides either way.
  const wantsWrite = oauthReq.scope.includes(SCOPE_WRITE);
  const consentToken = crypto.randomUUID();

  return html(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Authorize Dustin Edwards Admin</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, sans-serif; max-width: 34rem; margin: 4rem auto; padding: 0 1.25rem; }
  h1 { font-size: 1.35rem; line-height: 1.3; }
  dl { margin: 1.5rem 0; }
  dt { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; opacity: .7; }
  dd { margin: .15rem 0 1rem; word-break: break-all; font-family: ui-monospace, monospace; font-size: .9rem; }
  ul { padding-left: 1.2rem; }
  button { font: inherit; padding: .6rem 1.2rem; border-radius: .4rem; cursor: pointer; }
</style>
</head><body>
<h1>Authorize Dustin Edwards Admin</h1>
<p>A client is asking to use the operator tools that run dustinedwards.info: site
health, drift repair, webmentions, media, registries, citations and procedures.
It cannot write posts; Carrel owns writing.</p>
<dl>
  <dt>Client</dt><dd>${escape(clientName)}</dd>
  <dt>Redirecting to</dt><dd>${escape(oauthReq.redirectUri)}</dd>
</dl>
<p>It will always be able to <strong>read</strong>. Changes (repairing drift,
deciding mentions, uploading and backing up media, refreshing citations, saving a
procedure) need the box below. It will <strong>not</strong> be able to publish a
procedure for the first time; that stays with you.</p>
<p>You will be sent to Cloudflare Access to sign in. Only the configured
administrator is accepted.</p>
<form method="post">
  <input type="hidden" name="consent" value="${consentToken}">
  <p><label><input type="checkbox" name="allow_write" value="1"${wantsWrite ? " checked" : ""}>
  Allow changes (dei.write)</label></p>
  <button type="submit">Continue to sign in</button>
</form>
</body></html>`, 200, {
    "Set-Cookie": `${CONSENT_COOKIE}=${consentToken}; HttpOnly; Secure; SameSite=Strict; Path=/authorize; Max-Age=600`,
  });
}

/**
 * Consent submitted. Stash the OAuth request, the PKCE verifier and the OIDC
 * nonce in a cookie and bounce to Access.
 *
 * The cookie is scoped to /callback, HttpOnly, Secure and SameSite=Lax: it exists
 * only to survive the round trip and nothing else should ever read it.
 */
async function handleAuthorizePost(request: Request, env: LoginEnv): Promise<Response> {
  const saas = accessSaas(env);
  if (!saas) return text(NOT_CONFIGURED, 503);
  const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const url = new URL(request.url);

  const form = await request.formData().catch(() => null);
  const presented = form?.get("consent");
  const expected = cookie(request, CONSENT_COOKIE);
  if (!expected || typeof presented !== "string" || presented !== expected) {
    return text("The consent form did not come from this server's consent page. Start the authorization again.", 403);
  }
  const scopes = form?.get("allow_write") === "1" ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];

  const state = crypto.randomUUID();
  const signIn = newSignIn();
  const payload = btoa(JSON.stringify({ state, req: oauthReq, scopes, ...signIn }));
  const location = await authorizationUrl(saas, { redirectUri: `${url.origin}/callback`, state, ...signIn });

  const headers = new Headers({ Location: location });
  headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=${payload}; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=600`,
  );
  return new Response(null, { status: 302, headers });
}

/** Back from Access. Verify state and the ID token, gate on the admin check. */
async function handleCallback(request: Request, env: LoginEnv): Promise<Response> {
  const saas = accessSaas(env);
  if (!saas) return text(NOT_CONFIGURED, 503);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  if (!code || !returnedState) return text("Missing code or state on the callback.", 400);

  const stateCookie = cookie(request, STATE_COOKIE);
  if (!stateCookie) return text("The login session expired. Start the authorization again.", 400);

  let stashed: { state: string; req: AuthRequest; scopes?: string[]; verifier?: string; nonce?: string };
  try {
    stashed = JSON.parse(atob(stateCookie));
  } catch {
    return text("The login session was unreadable. Start the authorization again.", 400);
  }
  // CSRF: the state Access returned must match the one we minted.
  if (stashed.state !== returnedState) {
    return text("State mismatch on the callback. The authorization was not completed.", 400);
  }

  if (!stashed.verifier || !stashed.nonce) {
    return text("The login session was unreadable. Start the authorization again.", 400);
  }

  const signedIn = await finishSignIn(saas, {
    code,
    redirectUri: `${url.origin}/callback`,
    verifier: stashed.verifier,
    nonce: stashed.nonce,
  });
  if (!signedIn.ok) return text(`Cloudflare Access did not confirm the sign-in (${signedIn.reason}).`, 502);

  if (!isAdminUser(env, signedIn)) {
    return text("Access denied. This is a single-operator server and this account is not its administrator.", 403);
  }

  const granted = (stashed.scopes ?? []).includes(SCOPE_WRITE) ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: stashed.req,
    userId: signedIn.email.toLowerCase(),
    metadata: { email: signedIn.email },
    // The grant is what the administrator ticked, never what the client asked.
    scope: granted,
    props: { email: signedIn.email, scopes: granted },
  });

  const headers = new Headers({ Location: redirectTo });
  headers.append("Set-Cookie", `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

/**
 * Everything the OAuth library does not claim.
 *
 * The library serves /token, /.well-known/oauth-authorization-server and
 * /.well-known/oauth-protected-resource itself. This handler owns the consent
 * flow and /health.
 */
export const defaultHandler = {
  async fetch(request: Request, env: LoginEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") return text("ok");
    if (pathname === "/authorize" && request.method === "GET") return handleAuthorizeGet(request, env);
    if (pathname === "/authorize" && request.method === "POST") return handleAuthorizePost(request, env);
    if (pathname === "/callback") return handleCallback(request, env);
    return text("Not found.", 404);
  },
};
