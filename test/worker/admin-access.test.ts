import { createLocalJWKSet } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { accessIdentity } from "~/lib/access.server";
import { adminActorContext } from "~/lib/admin-actor.server";
import { SITE_ORIGIN } from "~/lib/seo";
import { middleware as adminMiddleware } from "~/routes/admin";

import { routeContext, throughMiddleware } from "./route-helpers";

const TEAM = "team.cloudflareaccess.com";
const AUD = "app-tag-0123";
const VARS = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const json = (value: unknown) => b64(new TextEncoder().encode(JSON.stringify(value)));

async function signer() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const jwks = { keys: [{ kid: "k1", kty: jwk.kty!, n: jwk.n!, e: jwk.e! }] };
  const mint = async (claims: Record<string, unknown> = {}) => {
    const head = json({ alg: "RS256", kid: "k1", typ: "JWT" });
    const now = Math.floor(Date.now() / 1000);
    const body = json({ iss: `https://${TEAM}`, aud: [AUD], exp: now + 600, ...claims });
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${b64(sig)}`;
  };
  return { jwks, mint };
}

const request = (token?: string, url = `${SITE_ORIGIN}/admin`) =>
  new Request(url, { headers: token ? { "cf-access-jwt-assertion": token } : {} });

afterEach(() => vi.restoreAllMocks());

describe("accessIdentity", () => {
  it("names the person a verified token carries, lowercased", async () => {
    const { jwks, mint } = await signer();
    const env = { ...VARS } as unknown as Env;
    expect(await accessIdentity(env, request(await mint({ email: "Dustin@Example.com" })), () => createLocalJWKSet(jwks))).toEqual({
      kind: "human",
      email: "dustin@example.com",
    });
  });

  it("reads a service token as a service, never as a person", async () => {
    const { jwks, mint } = await signer();
    const env = { ...VARS } as unknown as Env;
    expect(await accessIdentity(env, request(await mint({ common_name: "ci.access" })), () => createLocalJWKSet(jwks))).toEqual({
      kind: "service",
      id: "ci.access",
    });
  });

  it("refuses a token for another application, and a header with no token is simply absent", async () => {
    const { jwks, mint } = await signer();
    const env = { ...VARS } as unknown as Env;
    expect(await accessIdentity(env, request(await mint({ email: "a@b.c", aud: ["other"] })), () => createLocalJWKSet(jwks))).toEqual({
      kind: "refused",
      reason: "audience",
    });
    expect(await accessIdentity(env, request(), () => createLocalJWKSet(jwks))).toEqual({ kind: "absent" });
  });

  it("treats a Worker with no Access configuration as having no identity, whatever header arrives", async () => {
    const { jwks, mint } = await signer();
    const token = await mint({ email: "a@b.c" });
    expect(await accessIdentity({} as Env, request(token), () => createLocalJWKSet(jwks))).toEqual({ kind: "absent" });
  });
});

describe("the admin layout with Cloudflare Access", () => {
  async function through(req: Request, overrides: object) {
    let actor: unknown;
    const context = routeContext(undefined, overrides);
    try {
      await throughMiddleware(
        adminMiddleware,
        ((args: { context: typeof context }) => {
          actor = args.context.get(adminActorContext);
          return null;
        }) as never,
        { request: req, context, params: {} } as never,
      );
    } catch (thrown) {
      return { thrown, actor };
    }
    return { thrown: null, actor };
  }

  it("admits the person a verified token names, and records them as the actor", async () => {
    const { jwks, mint } = await signer();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(jwks));
    const { thrown, actor } = await through(request(await mint({ email: "wife@example.com" })), VARS);
    expect(thrown).toBeNull();
    expect(actor).toEqual({ kind: "admin", email: "wife@example.com" });
  });

  it("answers 401 to a token that does not verify, rather than a login page", async () => {
    const { jwks, mint } = await signer();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(jwks));
    const { thrown } = await through(request(await mint({ email: "a@b.c", aud: ["other"] })), VARS);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
  });

  it("does not admit a forged header on a Worker where Access is not configured", async () => {
    const { jwks, mint } = await signer();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(jwks));
    const { thrown, actor } = await through(request(await mint({ email: "a@b.c" })), {
      ACCESS_TEAM_DOMAIN: "",
      ACCESS_AUD: "",
    });
    expect(actor).toBeUndefined();
    expect(thrown).toBeInstanceOf(Response);
  });
});
