import assert from "node:assert/strict";
import test from "node:test";

import { verifyAccessJwt } from "../app/lib/access-jwt.mjs";

const ISSUER = "https://team.cloudflareaccess.com";
const AUD = "app-tag";
const NOW = 1_800_000_000;

const b64 = (bytes) => Buffer.from(bytes).toString("base64url");
const json = (value) => b64(new TextEncoder().encode(JSON.stringify(value)));

async function keypair(kid) {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { pair, jwks: { keys: [{ kid, kty: jwk.kty, n: jwk.n, e: jwk.e }] } };
}

async function mint(pair, { kid = "k1", alg = "RS256", claims = {} } = {}) {
  const head = json({ alg, kid, typ: "JWT" });
  const body = json({ iss: ISSUER, aud: [AUD], exp: NOW + 600, nbf: NOW - 5, email: "a@example.com", ...claims });
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64(sig)}`;
}

const check = (token, jwks) => verifyAccessJwt(token, jwks, { issuer: ISSUER, audience: AUD, now: NOW });

test("a token signed by a published key for this application verifies", async () => {
  const { pair, jwks } = await keypair("k1");
  const verdict = await check(await mint(pair), jwks);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.claims.email, "a@example.com");
});

test("a token signed by a key Access did not publish is refused, even with the right claims", async () => {
  const { jwks } = await keypair("k1");
  const stranger = await keypair("k1");
  const verdict = await check(await mint(stranger.pair), jwks);
  assert.deepEqual(verdict, { ok: false, reason: "signature" });
});

test("another application's audience, another issuer and an expired token are each refused", async () => {
  const { pair, jwks } = await keypair("k1");
  assert.equal((await check(await mint(pair, { claims: { aud: ["other"] } }), jwks)).reason, "audience");
  assert.equal((await check(await mint(pair, { claims: { iss: "https://evil.example" } }), jwks)).reason, "issuer");
  assert.equal((await check(await mint(pair, { claims: { exp: NOW - 3600 } }), jwks)).reason, "expired");
  assert.equal((await check(await mint(pair, { claims: { nbf: NOW + 3600 } }), jwks)).reason, "not-yet-valid");
});

test("alg none, an unknown kid and a malformed token are refused", async () => {
  const { pair, jwks } = await keypair("k1");
  assert.equal((await check(await mint(pair, { alg: "none" }), jwks)).reason, "algorithm");
  assert.equal((await check(await mint(pair, { kid: "other" }), jwks)).reason, "unknown-key");
  assert.equal((await check("not.a", jwks)).reason, "malformed");
  assert.equal((await check("a.b.c", jwks)).reason, "malformed");
});

test("a string audience is read as well as an array", async () => {
  const { pair, jwks } = await keypair("k1");
  assert.equal((await check(await mint(pair, { claims: { aud: AUD } }), jwks)).ok, true);
});
