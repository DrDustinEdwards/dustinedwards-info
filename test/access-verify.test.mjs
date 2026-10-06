import assert from "node:assert/strict";
import test from "node:test";

import { SignJWT, createLocalJWKSet, errors, exportJWK, generateKeyPair } from "jose";

import { CLOCK_TOLERANCE_SECONDS, verifyAccessToken } from "../app/lib/access-verify.mjs";

/* The Access token verifier (app/lib/access-verify.mjs, jose): each way a token can be wrong is refused, with its reason, and a
 * good token passes. Tokens are minted here with jose against a key pair this file makes, so no network and no real key. */

const ISSUER = "https://team.cloudflareaccess.com";
const AUD = "app-tag";
const NOW = 1_800_000_000;

async function keys(kid = "k1") {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" };
  return { privateKey, getKey: createLocalJWKSet({ keys: [jwk] }) };
}

/** @param {import("jose").CryptoKey} privateKey @param {{ kid?: string, claims?: Record<string, unknown> }} [options] */
const mint = (privateKey, { kid = "k1", claims = {} } = {}) =>
  new SignJWT({ email: "a@example.com", iss: ISSUER, aud: [AUD], exp: NOW + 600, nbf: NOW - 5, ...claims })
    .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
    .sign(privateKey);

const check = (token, getKey, now = NOW) => verifyAccessToken(token, getKey, { issuer: ISSUER, audience: AUD, now });

test("a token signed by a published key for this application verifies, and its claims come back", async () => {
  const { privateKey, getKey } = await keys();
  const verdict = await check(await mint(privateKey), getKey);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.claims.email, "a@example.com");
});

test("a string audience is read as well as an array", async () => {
  const { privateKey, getKey } = await keys();
  assert.equal((await check(await mint(privateKey, { claims: { aud: AUD } }), getKey)).ok, true);
});

test("a token signed by a key Access did not publish is refused, even with the right claims", async () => {
  const { getKey } = await keys();
  const stranger = await keys();
  assert.deepEqual(await check(await mint(stranger.privateKey), getKey), { ok: false, reason: "signature" });
});

test("another application's audience is refused", async () => {
  const { privateKey, getKey } = await keys();
  assert.equal((await check(await mint(privateKey, { claims: { aud: ["other"] } }), getKey)).reason, "audience");
});

test("another issuer is refused", async () => {
  const { privateKey, getKey } = await keys();
  assert.equal((await check(await mint(privateKey, { claims: { iss: "https://evil.example" } }), getKey)).reason, "issuer");
});

test("an expired token is refused", async () => {
  const { privateKey, getKey } = await keys();
  assert.equal((await check(await mint(privateKey, { claims: { exp: NOW - 3600 } }), getKey)).reason, "expired");
});

test("a token not yet valid is refused", async () => {
  const { privateKey, getKey } = await keys();
  assert.equal((await check(await mint(privateKey, { claims: { nbf: NOW + 3600, exp: NOW + 7200 } }), getKey)).reason, "not-yet-valid");
});

test("the 60 second tolerance holds: a token a minute late or early is read, one beyond it is not", async () => {
  assert.equal(CLOCK_TOLERANCE_SECONDS, 60);
  const { privateKey, getKey } = await keys();
  const expiredBy = (seconds) => mint(privateKey, { claims: { exp: NOW - seconds } });
  assert.equal((await check(await expiredBy(59), getKey)).ok, true);
  assert.equal((await check(await expiredBy(61), getKey)).reason, "expired");
  const startsIn = (seconds) => mint(privateKey, { claims: { nbf: NOW + seconds } });
  assert.equal((await check(await startsIn(59), getKey)).ok, true);
  assert.equal((await check(await startsIn(61), getKey)).reason, "not-yet-valid");
});

test("alg none, an unknown kid and a malformed token are refused", async () => {
  const { privateKey, getKey } = await keys();
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ iss: ISSUER, aud: [AUD], exp: NOW + 600, email: "a@example.com" })}.`;
  assert.equal((await check(none, getKey)).reason, "algorithm");
  assert.equal((await check(await mint(privateKey, { kid: "other" }), getKey)).reason, "unknown-key");
  assert.equal((await check("not.a", getKey)).reason, "malformed");
  assert.equal((await check("a.b.c", getKey)).reason, "malformed");
});

test("a signing algorithm the token chooses is not trusted: an HS256 token signed with the public key is refused", async () => {
  const { getKey } = await keys();
  const secret = new TextEncoder().encode("a-secret-the-attacker-chose-for-hmac-0123456789");
  const forged = await new SignJWT({ iss: ISSUER, aud: [AUD], exp: NOW + 600, email: "a@example.com" })
    .setProtectedHeader({ alg: "HS256", kid: "k1" })
    .sign(secret);
  assert.equal((await check(forged, getKey)).reason, "algorithm");
});

test("a key set that cannot be reached is thrown, not read as a refused token", async () => {
  const { privateKey } = await keys();
  const down = async () => {
    throw new errors.JWKSTimeout();
  };
  const token = await mint(privateKey);
  await assert.rejects(() => check(token, down), errors.JWKSTimeout);
});
