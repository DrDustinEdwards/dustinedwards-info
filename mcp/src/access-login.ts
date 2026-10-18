/**
 * The upstream sign-in: Cloudflare Access for SaaS, as an OIDC provider, the
 * same door Capsid and Carrel use (Cloudflare's "Secure MCP servers" doc,
 * developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/secure-mcp-servers).
 *
 * Every endpoint is derived from the team domain and the SaaS app's client id,
 * as the Access dashboard shows them. Fails closed: a missing setting keeps the
 * door shut.
 *
 * The ID token is verified with WebCrypto against the app's published keys, so
 * this Worker carries no JWT library.
 */

export interface AccessEnv {
  /** https://<team>.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_SAAS_CLIENT_ID?: string;
  ACCESS_SAAS_CLIENT_SECRET?: string;
}

export type AccessSaas = {
  clientId: string;
  clientSecret: string;
  /** The SaaS app's issuer: https://<team>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client id> */
  issuer: string;
  authorizationUrl: string;
  tokenUrl: string;
  jwksUrl: string;
};

/** The Access for SaaS app's endpoints, or null while any setting is missing. */
export function accessSaas(env: AccessEnv): AccessSaas | null {
  const team = env.ACCESS_TEAM_DOMAIN?.trim().replace(/\/+$/, "");
  const clientId = env.ACCESS_SAAS_CLIENT_ID?.trim();
  const clientSecret = env.ACCESS_SAAS_CLIENT_SECRET?.trim();
  if (!team || !clientId || !clientSecret) return null;
  const issuer = `${team}/cdn-cgi/access/sso/oidc/${encodeURIComponent(clientId)}`;
  return {
    clientId,
    clientSecret,
    issuer,
    authorizationUrl: `${issuer}/authorization`,
    tokenUrl: `${issuer}/token`,
    jwksUrl: `${issuer}/jwks`,
  };
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** A fresh PKCE verifier and OIDC nonce for one sign-in. Kept server-side by beginUpstream. */
export function newSignIn(): { verifier: string; nonce: string } {
  return { verifier: `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, ""), nonce: crypto.randomUUID() };
}

/** Where the browser goes to sign in with Access. */
export async function authorizationUrl(
  saas: AccessSaas,
  input: { redirectUri: string; state: string; verifier: string; nonce: string },
): Promise<string> {
  const url = new URL(saas.authorizationUrl);
  url.searchParams.set("client_id", saas.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", await s256(input.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.href;
}

type Jwk = JsonWebKey & { kid?: string };
/** Finds the public key for a kid; `fresh` asks for a refetch past any cache. */
export type KeySource = (kid: string, fresh: boolean) => Promise<Jwk | undefined>;

const cachedKeys = new Map<string, Jwk[]>();

function remoteKeys(jwksUrl: string): KeySource {
  return async (kid, fresh) => {
    let keys = fresh ? undefined : cachedKeys.get(jwksUrl);
    if (!keys) {
      const response = await fetch(jwksUrl, { headers: { accept: "application/json" } });
      if (!response.ok) return undefined;
      const body = (await response.json().catch(() => ({}))) as { keys?: Jwk[] };
      keys = Array.isArray(body.keys) ? body.keys : [];
      cachedKeys.set(jwksUrl, keys);
    }
    return keys.find((key) => key.kid === kid);
  };
}

/**
 * The payload of an RS256 JWT signed by one of `keys`, issued by `issuer` for
 * `audience` and unexpired, or null. A kid not in the cached set refetches
 * once, so a key rotation does not lock the door.
 */
export async function verifyIdToken(
  token: string,
  keys: KeySource,
  expect: { issuer: string; audience: string; now?: number },
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[1])));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
  const jwk = (await keys(header.kid, false)) ?? (await keys(header.kid, true));
  if (!jwk || jwk.kty !== "RSA") return null;
  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      fromBase64url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return null;
  }
  if (!valid) return null;
  const now = Math.floor((expect.now ?? Date.now()) / 1000);
  const skew = 60;
  if (payload.iss !== expect.issuer) return null;
  const aud = payload.aud;
  if (!(aud === expect.audience || (Array.isArray(aud) && aud.includes(expect.audience)))) return null;
  if (typeof payload.exp !== "number" || payload.exp + skew < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf - skew > now) return null;
  return payload;
}

export type SignedIn = { ok: true; email: string } | { ok: false; reason: string };

/**
 * Exchanges Access's code for tokens and verifies the ID token: signed by the
 * SaaS app's keys, issued by it, for this client, carrying the nonce this
 * sign-in sent, and naming a verified email. Anything else is a refusal.
 */
export async function finishSignIn(
  saas: AccessSaas,
  input: { code: string; redirectUri: string; verifier: string; nonce: string },
  keys: KeySource = remoteKeys(saas.jwksUrl),
): Promise<SignedIn> {
  const response = await fetch(saas.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: saas.clientId,
      client_secret: saas.clientSecret,
      code_verifier: input.verifier,
    }),
  });
  if (!response.ok) return { ok: false, reason: `token-exchange-${response.status}` };
  const tokens = (await response.json().catch(() => ({}))) as { id_token?: unknown };
  if (typeof tokens.id_token !== "string") return { ok: false, reason: "no-id-token" };

  const payload = await verifyIdToken(tokens.id_token, keys, { issuer: saas.issuer, audience: saas.clientId });
  if (!payload) return { ok: false, reason: "invalid-id-token" };
  if (payload.nonce !== input.nonce) return { ok: false, reason: "nonce-mismatch" };
  if (payload.email_verified === false) return { ok: false, reason: "email-not-verified" };
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!email) return { ok: false, reason: "no-email" };
  return { ok: true, email };
}
