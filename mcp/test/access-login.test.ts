/**
 * The Cloudflare Access sign-in: endpoints from settings, and the ID token
 * checks, against a key pair made here and a fake token endpoint.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { accessSaas, authorizationUrl, finishSignIn, verifyIdToken, type KeySource } from "../src/access-login.ts";

const ENV = {
  ACCESS_TEAM_DOMAIN: "https://sample.cloudflareaccess.com/",
  ACCESS_SAAS_CLIENT_ID: "client-1",
  ACCESS_SAAS_CLIENT_SECRET: "secret-1",
};
const saas = accessSaas(ENV)!;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encode = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

const pair = (await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
)) as CryptoKeyPair;
const other = (await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
)) as CryptoKeyPair;
const publicJwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1" };
const keys: KeySource = async (kid) => (kid === "k1" ? publicJwk : undefined);

const now = Math.floor(Date.now() / 1000);
const claims = (over: Record<string, unknown> = {}) => ({
  iss: saas.issuer,
  aud: saas.clientId,
  exp: now + 300,
  nonce: "n1",
  email: "admin@example.com",
  ...over,
});

async function sign(payload: unknown, key = pair.privateKey, header: Record<string, unknown> = { alg: "RS256", kid: "k1" }) {
  const input = `${encode(header)}.${encode(payload)}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

describe("accessSaas", () => {
  test("derives every endpoint from the team domain and client id", () => {
    assert.equal(saas.issuer, "https://sample.cloudflareaccess.com/cdn-cgi/access/sso/oidc/client-1");
    assert.equal(saas.tokenUrl, `${saas.issuer}/token`);
    assert.equal(saas.jwksUrl, `${saas.issuer}/jwks`);
  });

  test("PLANT: any missing setting keeps the door shut", () => {
    assert.equal(accessSaas({ ...ENV, ACCESS_SAAS_CLIENT_SECRET: " " }), null);
    assert.equal(accessSaas({ ...ENV, ACCESS_TEAM_DOMAIN: undefined }), null);
    assert.equal(accessSaas({}), null);
  });

  test("the authorization URL carries PKCE S256, the nonce and the state", async () => {
    const url = new URL(
      await authorizationUrl(saas, { redirectUri: "https://admin-mcp.test/callback", state: "s1", verifier: "v".repeat(64), nonce: "n1" }),
    );
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("nonce"), "n1");
    assert.equal(url.searchParams.get("state"), "s1");
    assert.notEqual(url.searchParams.get("code_challenge"), "v".repeat(64));
  });
});

describe("verifyIdToken", () => {
  const expect = { issuer: saas.issuer, audience: saas.clientId };

  test("accepts a token signed by the app's key, for this client", async () => {
    const payload = await verifyIdToken(await sign(claims()), keys, expect);
    assert.equal(payload?.email, "admin@example.com");
  });

  test("PLANT: a token signed by another key is refused", async () => {
    assert.equal(await verifyIdToken(await sign(claims(), other.privateKey), keys, expect), null);
  });

  test("PLANT: wrong issuer, wrong audience or expired is refused", async () => {
    assert.equal(await verifyIdToken(await sign(claims({ iss: "https://evil.example" })), keys, expect), null);
    assert.equal(await verifyIdToken(await sign(claims({ aud: "another-client" })), keys, expect), null);
    assert.equal(await verifyIdToken(await sign(claims({ exp: now - 3600 })), keys, expect), null);
  });

  test("PLANT: alg none, an unknown kid or a malformed token is refused", async () => {
    assert.equal(await verifyIdToken(await sign(claims(), pair.privateKey, { alg: "none", kid: "k1" }), keys, expect), null);
    assert.equal(await verifyIdToken(await sign(claims(), pair.privateKey, { alg: "RS256", kid: "k9" }), keys, expect), null);
    assert.equal(await verifyIdToken("not.a.jwt", keys, expect), null);
  });

  test("an unknown kid refetches once, so a rotated key still works", async () => {
    const asked: boolean[] = [];
    const rotating: KeySource = async (kid, fresh) => {
      asked.push(fresh);
      return fresh && kid === "k1" ? publicJwk : undefined;
    };
    assert.ok(await verifyIdToken(await sign(claims()), rotating, expect));
    assert.deepEqual(asked, [false, true]);
  });
});

describe("finishSignIn", () => {
  const realFetch = globalThis.fetch;
  let idToken = "";
  let sent: URLSearchParams | undefined;
  beforeEach(() => {
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent = new URLSearchParams(String(init.body));
      return new Response(JSON.stringify({ id_token: idToken }), { headers: { "content-type": "application/json" } });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const input = { code: "c1", redirectUri: "https://admin-mcp.test/callback", verifier: "v1", nonce: "n1" };

  test("returns the verified email, and sends the PKCE verifier", async () => {
    idToken = await sign(claims());
    assert.deepEqual(await finishSignIn(saas, input, keys), { ok: true, email: "admin@example.com" });
    assert.equal(sent?.get("code_verifier"), "v1");
  });

  test("PLANT: a nonce from another sign-in is refused", async () => {
    idToken = await sign(claims({ nonce: "n2" }));
    assert.deepEqual(await finishSignIn(saas, input, keys), { ok: false, reason: "nonce-mismatch" });
  });

  test("PLANT: an unverified or missing email is refused", async () => {
    idToken = await sign(claims({ email_verified: false }));
    assert.deepEqual(await finishSignIn(saas, input, keys), { ok: false, reason: "email-not-verified" });
    idToken = await sign(claims({ email: undefined }));
    assert.deepEqual(await finishSignIn(saas, input, keys), { ok: false, reason: "no-email" });
  });
});
