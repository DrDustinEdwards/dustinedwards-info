/**
 * The consent step and the upstream sign-in through Cloudflare Access.
 *
 * `@cloudflare/workers-oauth-provider` makes this Worker an OAuth 2.1
 * authorization server for MCP clients. It does not know WHO the human is, so
 * after consent this handler sends them to Cloudflare Access for SaaS
 * (@dustinedwards/site-runtime/access-login) and checks the returning email
 * against the single configured administrator (ADMIN_EMAIL). Capsid, Carrel and
 * Foxing Admin sign in the same way, so one Access login covers every server.
 *
 * The consent handle and the upstream state are the provider's own helpers
 * (beginConsent, approveConsent, beginUpstream, finishUpstream), as Carrel and
 * Foxing Admin use them: each is bound to this browser by a cookie the library
 * sets and works once, so another site cannot submit consent or replay a
 * callback. The PKCE verifier and nonce travel in the upstream state,
 * server-side; until 2026-10-20 they rode in an unsigned cookie.
 *
 * Access rather than dustinedwards.info's own Better Auth: this server's
 * identity stays independent of the site's Google project, so a change there
 * cannot affect operator access here.
 */

import {
  AuthorizationError,
  CimdFetchError,
  type AuthRequest,
  type ClientInfo,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { accessSaas, authorizationUrl, finishSignIn, newSignIn, type AccessEnv } from "@dustinedwards/site-runtime/access-login";

import { isAdminUser, SCOPE_READ, SCOPE_WRITE, type Props } from "./auth";

export interface LoginEnv extends AccessEnv {
  ADMIN_EMAIL?: string;
  PUBLIC_ORIGIN?: string;
  OAUTH_PROVIDER: OAuthHelpers;
}

function text(body: string, status = 200, headers?: Headers): Response {
  const out = new Headers(headers);
  out.set("content-type", "text/plain; charset=utf-8");
  out.set("cache-control", "no-store");
  return new Response(body, { status, headers: out });
}

function redirect(location: string, headers?: Headers): Response {
  const out = new Headers(headers);
  out.set("location", location);
  out.set("cache-control", "no-store");
  return new Response(null, { status: 302, headers: out });
}

/** The OAuth error answer to the client, once its redirect URI is known good. */
function redirectError(request: AuthRequest, description: string, headers?: Headers): Response {
  const url = new URL(request.redirectUri);
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("error_description", description);
  url.searchParams.set("state", request.state);
  if (request.issuer) url.searchParams.set("iss", request.issuer);
  return redirect(url.href, headers);
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function origin(request: Request, env: LoginEnv): string {
  return (env.PUBLIC_ORIGIN?.trim() || new URL(request.url).origin).replace(/\/+$/, "");
}

/** The name a client is shown by: its own client_name, or the host that publishes its metadata. */
function clientLabel(client: ClientInfo | null, clientId: string): string {
  const name = client?.clientName?.trim();
  if (name) return name.slice(0, 100);
  try {
    return new URL(clientId).hostname;
  } catch {
    return "an unnamed client";
  }
}

/**
 * The consent page's one inline <style>, exported so security-headers.ts trusts it by hash. The
 * page renders this exact string between the tags, so the page and its policy cannot drift.
 */
export const CONSENT_STYLE = `
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, sans-serif; max-width: 34rem; margin: 4rem auto; padding: 0 1.25rem; }
  h1 { font-size: 1.35rem; line-height: 1.3; }
  label { display: inline-flex; gap: .5rem; align-items: center; min-height: 24px; }
  button { font: inherit; padding: .55rem 1.1rem; border-radius: .35rem; cursor: pointer; margin-right: .5rem; min-height: 24px; }
`;

/**
 * The consent page, shown on every authorization. Consent has to be an act, so
 * it is a real form. Everything from the client is escaped: a CIMD document's
 * name is chosen by whoever serves it, a registered client's by its registrant.
 */
function consentPage(client: ClientInfo | null, request: AuthRequest, handle: string): string {
  const name = escape(clientLabel(client, request.clientId));
  const redirectHost = escape(new URL(request.redirectUri).hostname);
  // LEAST SCOPE FIRST (rule 12.3): the write box starts ticked only when the
  // client asked for dei.write, and the administrator decides either way.
  const wantsWrite = request.scope.includes(SCOPE_WRITE);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Allow ${name} to use Dustin Edwards Admin?</title>
<style>${CONSENT_STYLE}</style>
</head><body>
<h1>Allow ${name} to use Dustin Edwards Admin?</h1>
<p>Its access will be sent to <strong>${redirectHost}</strong>.</p>
<p>Dustin Edwards Admin runs dustinedwards.info: site health, drift repair,
webmentions, media, registries, citations and procedures. It cannot write posts;
Carrel owns writing.</p>
<p>It will always be able to read. Changes (repairing drift, deciding mentions,
uploading and backing up media, refreshing citations, saving a procedure) need the
box below. It will not be able to publish a procedure for the first time; that
stays with you.</p>
<p>Next you sign in with Cloudflare Access. Only the configured administrator is accepted.</p>
<form method="post">
  <input type="hidden" name="handle" value="${escape(handle)}">
  <p><label><input type="checkbox" name="allow_write" value="1"${wantsWrite ? " checked" : ""}>
  Allow changes (dei.write)</label></p>
  <button name="decision" value="approve">Continue to sign in</button>
  <button name="decision" value="deny">Deny</button>
</form>
</body></html>`;
}

const NOT_CONFIGURED =
  "This server is not configured for sign-in: ACCESS_TEAM_DOMAIN, ACCESS_SAAS_CLIENT_ID or " +
  "ACCESS_SAAS_CLIENT_SECRET is unset. Not configured means not open.";

async function authorizeGet(request: Request, env: LoginEnv): Promise<Response> {
  if (!accessSaas(env)) return text(NOT_CONFIGURED, 503);
  const oauth = env.OAUTH_PROVIDER;
  const authRequest = await oauth.parseAuthRequest(request);
  const client = await oauth.lookupClient(authRequest.clientId);
  if (!client) return text("Unknown OAuth client.", 400);
  const consent = await oauth.beginConsent(authRequest);
  consent.headers.set("content-type", "text/html; charset=utf-8");
  // no-transform keeps Cloudflare from injecting anything into this page.
  consent.headers.set("cache-control", "no-store, no-transform");
  return new Response(consentPage(client, authRequest, consent.handle), { headers: consent.headers });
}

async function authorizePost(request: Request, env: LoginEnv): Promise<Response> {
  const saas = accessSaas(env);
  if (!saas) return text(NOT_CONFIGURED, 503);
  const oauth = env.OAUTH_PROVIDER;
  const form = await request.formData();
  const handle = String(form.get("handle") ?? "");
  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(request, handle);
    return redirect(denied.redirectTo, denied.headers);
  }
  // The grant is what the administrator ticked, never what the client asked.
  const scope = form.get("allow_write") === "1" ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
  const approved = await oauth.approveConsent(request, handle, { scope });
  // The verifier and nonce stay server-side, in the upstream state.
  const signIn = newSignIn();
  const { state, headers } = await oauth.beginUpstream({ ...approved.request, scope }, { data: signIn, headers: approved.headers });
  return redirect(await authorizationUrl(saas, { redirectUri: `${origin(request, env)}/callback`, state, ...signIn }), headers);
}

async function callback(request: Request, env: LoginEnv): Promise<Response> {
  const saas = accessSaas(env);
  if (!saas) return text(NOT_CONFIGURED, 503);
  const oauth = env.OAUTH_PROVIDER;
  const { request: original, data, headers } = await oauth.finishUpstream<{ verifier: string; nonce: string }>(request);
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return redirectError(original, "Sign-in with Cloudflare Access did not complete.", headers);

  const signedIn = await finishSignIn(saas, {
    code,
    redirectUri: `${origin(request, env)}/callback`,
    verifier: data.verifier,
    nonce: data.nonce,
  });
  if (!signedIn.ok) {
    console.warn(JSON.stringify({ door: "refused", reason: signedIn.reason }));
    return redirectError(original, "Cloudflare Access did not confirm the sign-in.", headers);
  }

  if (!isAdminUser(env, signedIn)) {
    console.warn(JSON.stringify({ door: "refused", reason: "not-the-administrator" }));
    return redirectError(original, "This account is not the administrator of Dustin Edwards Admin.", headers);
  }

  const granted = original.scope.includes(SCOPE_WRITE) ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
  const props: Props = { email: signedIn.email, scopes: granted };
  const { redirectTo } = await oauth.completeAuthorization({
    request: original,
    userId: signedIn.email.toLowerCase(),
    metadata: { email: signedIn.email },
    scope: granted,
    props,
  });
  return redirect(redirectTo, headers);
}

/** Everything the OAuth provider does not own: the consent flow and /health. */
export const defaultHandler = {
  async fetch(request: Request, env: LoginEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/health") return text("ok");
      if (pathname === "/authorize" && request.method === "GET") return await authorizeGet(request, env);
      if (pathname === "/authorize" && request.method === "POST") return await authorizePost(request, env);
      if (pathname === "/callback" && request.method === "GET") return await callback(request, env);
      return text("Not found.", 404);
    } catch (error) {
      // Redirect only to a validated client; render the rest.
      if (error instanceof AuthorizationError && error.redirectUri) {
        const url = new URL(error.redirectUri);
        url.searchParams.set("error", error.code);
        url.searchParams.set("error_description", error.description);
        if (error.state) url.searchParams.set("state", error.state);
        if (error.issuer) url.searchParams.set("iss", error.issuer);
        return redirect(url.href);
      }
      if (error instanceof AuthorizationError) {
        return text(`${error.description} Start the sign-in again from your MCP client.`, 400);
      }
      if (error instanceof CimdFetchError) {
        return text("This client could not be verified: its client metadata document could not be fetched.", 400);
      }
      throw error;
    }
  },
};
