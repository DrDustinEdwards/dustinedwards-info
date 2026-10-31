import { stubAccess } from "@dustinedwards/devkit/access";
import { afterEach, describe, expect, it, vi } from "vitest";

import { labIdentity } from "~/lab/access.server";
import { accessIdentity } from "~/lib/access.server";
import { adminActorContext } from "~/lib/admin-actor.server";
import { SITE_ORIGIN } from "~/lib/seo";
import { middleware as adminMiddleware } from "~/routes/admin";

import { routeContext, throughMiddleware } from "./route-helpers";

const TEAM = "team.cloudflareaccess.com";
const AUD = "app-tag-0123";
const VARS = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: "Dustin@Example.com, wife@example.com, a@b.c" };

async function signer() {
  const stub = await stubAccess({
    issuer: `https://${TEAM}`,
    audience: AUD,
    email: "unused@example.com",
    jwksUrl: `https://${TEAM}/cdn-cgi/access/certs`,
    claims: { aud: [AUD] },
    install: false,
  });
  // The team's key set as site-runtime/access's KeySource reads it, with no network.
  const keys = () => async (kid: string) => (kid === stub.jwk.kid ? stub.jwk : undefined);
  const mint = (claims: Record<string, unknown> = {}) => stub.token({ email: undefined, ...claims });
  return { keys, mint, fetch: stub.fetch };
}

const request = (token?: string, url = `${SITE_ORIGIN}/admin`) =>
  new Request(url, { headers: token ? { "cf-access-jwt-assertion": token } : {} });

afterEach(() => vi.restoreAllMocks());

describe("accessIdentity", () => {
  it("names the person a verified token carries, lowercased", async () => {
    const { keys, mint } = await signer();
    const env = { ...VARS } as unknown as Env;
    expect(await accessIdentity(env, request(await mint({ email: "Dustin@Example.com" })), keys)).toEqual({
      kind: "human",
      email: "dustin@example.com",
    });
  });

  it("reads a service token as a service, never as a person", async () => {
    const { keys, mint } = await signer();
    const env = { ...VARS } as unknown as Env;
    expect(await accessIdentity(env, request(await mint({ common_name: "ci.access" })), keys)).toEqual({
      kind: "service",
      id: "ci.access",
    });
  });

  it("refuses a token for another application, and a header with no token is simply absent", async () => {
    const { keys, mint } = await signer();
    const env = { ...VARS } as unknown as Env;
    expect(await accessIdentity(env, request(await mint({ email: "a@b.c", aud: ["other"] })), keys)).toEqual({
      kind: "refused",
      reason: "audience",
    });
    expect(await accessIdentity(env, request(), keys)).toEqual({ kind: "absent" });
  });

  it("treats a Worker with no Access configuration as having no identity, whatever header arrives", async () => {
    const { keys, mint } = await signer();
    const token = await mint({ email: "a@b.c" });
    expect(await accessIdentity({} as Env, request(token), keys)).toEqual({ kind: "absent" });
  });
});

describe("the site's reading of an Access verdict", () => {
  it("refuses a verified token that names neither a person nor a service token", async () => {
    const { keys, mint } = await signer();
    expect(await accessIdentity({ ...VARS } as unknown as Env, request(await mint()), keys)).toEqual({ kind: "refused", reason: "no-identity" });
  });

  it("passes the shared verifier's reason through for a token it refuses", async () => {
    const { keys, mint } = await signer();
    const env = { ...VARS } as unknown as Env;
    expect(await accessIdentity(env, request(await mint({ email: "a@b.c", exp: 1 })), keys)).toEqual({ kind: "refused", reason: "expired" });
    expect(await accessIdentity(env, request("not-a-token"), keys)).toEqual({ kind: "refused", reason: "malformed" });
  });

  it("reads the CF_Authorization cookie for /admin's identity, and never for /lab's", async () => {
    const { keys, mint } = await signer();
    const env = { ...VARS, ACCESS_LAB_AUD: AUD } as unknown as Env;
    const withCookie = new Request(`${SITE_ORIGIN}/admin`, { headers: { cookie: `CF_Authorization=${await mint({ email: "a@b.c" })}` } });
    expect(await accessIdentity(env, withCookie, keys)).toEqual({ kind: "human", email: "a@b.c" });
    expect(await labIdentity(env, withCookie, keys)).toEqual({ kind: "absent" });
  });

  it("checks /lab against its own audience, so an /admin token is refused there", async () => {
    const { keys, mint } = await signer();
    const env = { ...VARS, ACCESS_LAB_AUD: "lab-tag" } as unknown as Env;
    const adminToken = await mint({ email: "a@b.c" });
    expect(await labIdentity(env, request(adminToken), keys)).toEqual({ kind: "refused", reason: "audience" });
    expect(await labIdentity(env, request(await mint({ email: "a@b.c", aud: ["lab-tag"] })), keys)).toEqual({ kind: "human", email: "a@b.c" });
  });

  it("throws when the team's keys cannot be fetched, and never reads that as a refusal", async () => {
    const { mint } = await signer();
    const down = () => async () => {
      throw new Error("the Access keys answered 503");
    };
    await expect(accessIdentity({ ...VARS } as unknown as Env, request(await mint({ email: "a@b.c" })), down)).rejects.toThrow("503");
  });

  it("does not touch the keys when no token arrives", async () => {
    let asked = false;
    const keys = () => {
      asked = true;
      return async () => undefined;
    };
    expect(await accessIdentity({ ...VARS } as unknown as Env, request(), keys)).toEqual({ kind: "absent" });
    expect(asked).toBe(false);
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

  it("admits a person on ADMIN_EMAILS as the actor, and refuses one Access admitted who is not, or anyone when it is unset", async () => {
    const { mint, fetch } = await signer();
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);
    const admitted = await through(request(await mint({ email: "wife@example.com" })), VARS);
    expect(admitted.actor).toEqual({ kind: "admin", email: "wife@example.com" });
    const stranger = await through(request(await mint({ email: "stranger@example.com" })), VARS);
    expect(stranger.actor).toBeUndefined();
    expect((stranger.thrown as Response).status).toBe(403);
    const unset = await through(request(await mint({ email: "wife@example.com" })), { ...VARS, ADMIN_EMAILS: "" });
    expect(unset.actor).toBeUndefined();
    expect((unset.thrown as Response).status).toBe(403);
  });

  it("answers 401 to a token that does not verify, rather than a login page", async () => {
    const { mint, fetch } = await signer();
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);
    const { thrown } = await through(request(await mint({ email: "a@b.c", aud: ["other"] })), VARS);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
  });

  it("does not admit a forged header on a Worker where Access is not configured", async () => {
    const { mint, fetch } = await signer();
    vi.spyOn(globalThis, "fetch").mockImplementation(fetch);
    const { thrown, actor } = await through(request(await mint({ email: "a@b.c" })), {
      ACCESS_TEAM_DOMAIN: "",
      ACCESS_AUD: "",
    });
    expect(actor).toBeUndefined();
    expect(thrown).toBeInstanceOf(Response);
  });
});
