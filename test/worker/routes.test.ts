import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudflareContext } from "~/lib/context";
import { HEALTH_SNAPSHOT_KEY } from "~/lib/health/snapshot.mjs";
import { readHealthTile } from "~/lib/health/snapshot.server";
import { ORIGIN_REFUSAL } from "~/lib/origin.mjs";
import { action as themeAction, loader as themeLoader } from "~/routes/theme";
import { colorSchemeMeta, themeAttribute, themeFromRequest } from "~/lib/theme";
import { action as healthAction, loader as healthLoader } from "~/routes/api.health";

function routeContext(ctx: ExecutionContext, overrides: Record<string, unknown> = {}) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: { ...env, ...overrides } as never, ctx });
  return context;
}

/* On a minute boundary, so the window arithmetic under test is the limiter's, not this fixture's. */
const WINDOW_START = Date.UTC(2026, 8, 4, 12, 0, 0);

/* Restored for every case: a case that fails mid-assertion never reaches its own cleanup, and a
 * frozen clock would fail whatever ran next. */
afterEach(() => {
  vi.useRealTimers();
});

const themePost = (body: string, headers: HeadersInit = {}) =>
  new Request("https://example.com/theme", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body,
  });

describe("/theme", () => {
  it("stores the choice and returns the reader to where they were", async () => {
    const response = await themeAction({
      request: themePost("theme=dark", {
        origin: "https://example.com",
        referer: "https://example.com/blog/a-post",
      }),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("theme=dark");
    expect(response.headers.get("location")).toBe("/blog/a-post");
  });

  it("REFUSES A FOREIGN ORIGIN (measured 2026-08-27: it used to set the cookie)", async () => {
    const response = await themeAction({
      request: themePost("theme=dark", {
        origin: "https://evil.example",
        referer: "https://example.com/blog/a-post",
      }),
    } as never);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe(ORIGIN_REFUSAL);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("ALLOWS AN ABSENT ORIGIN, because that is the no-script form post", async () => {
    /* A scriptless form post carries no `Origin`, and refusing it would break the no-script
     * fallback. The literal string "null" is a different thing and is refused. */
    const allowed = await themeAction({
      request: themePost("theme=dark", { referer: "https://example.com/" }),
    } as never);
    expect(allowed.status).toBe(303);
    expect(allowed.headers.get("set-cookie")).toContain("theme=dark");

    const refused = await themeAction({
      request: themePost("theme=dark", { origin: "null", referer: "https://example.com/" }),
    } as never);
    expect(refused.status).toBe(403);
  });

  it("sends a reader with a foreign referer to `/` rather than off the site", async () => {
    const response = await themeAction({
      request: themePost("theme=dark", {
        origin: "https://example.com",
        referer: "https://elsewhere.example/somewhere",
      }),
    } as never);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
  });

  it("refuses a protocol-relative referer path", async () => {
    /* `new URL("https://site//evil.com")` has pathname `//evil.com`, and
     * `Location: //evil.com` is resolved against another HOST. The origin check
     * does not catch it, because the origin really is ours. */
    const response = await themeAction({
      request: themePost("theme=dark", {
        origin: "https://example.com",
        referer: "https://example.com//evil.com",
      }),
    } as never);
    expect(response.headers.get("location")).toBe("/");
  });

  it("answers a GET with a redirect, because there is nothing to show", () => {
    const response = themeLoader();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
  });

  it("REFUSES a value no button posts, rather than substituting a default", async () => {
    /* An unrecognized value is refused, not defaulted: a default would turn a malformed request
     * into a silent theme change. */
    for (const value of ["system", "", "chartreuse"]) {
      const response = await themeAction({
        request: themePost(`theme=${value}`, {
          origin: "https://example.com",
          referer: "https://example.com/",
        }),
      } as never);
      expect(response.status).toBe(400);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("the default theme, and the legacy cookie that means the same thing", () => {
  /* A legacy `theme=system` cookie means "follow the machine", which is what no cookie means,
   * so both readers must receive the same document. */
  it("resolves a legacy system cookie to exactly the no-cookie state", () => {
    const cookieless = themeFromRequest(new Request("https://example.com/"));
    const legacy = themeFromRequest(
      new Request("https://example.com/", { headers: { cookie: "theme=system" } }),
    );
    expect(legacy).toBe(cookieless);

    /* THE ATTRIBUTE IS ABSENT FOR BOTH, which is what makes the two documents
     * byte-identical and lets them share one cache entry. */
    expect(themeAttribute(legacy)).toBeUndefined();
    expect(themeAttribute(cookieless)).toBeUndefined();

    /* And the meta still says the document supports both, which is the honest
     * answer for a reader who has chosen nothing. */
    expect(colorSchemeMeta(legacy)).toBe("light dark");
  });

  it("keeps THREE resolved states, because the cache key still carries them", () => {
    /* `workers/app.ts` keys its cache on this value, so light, dark and the default must stay
     * three distinct answers. */
    const dark = themeFromRequest(
      new Request("https://example.com/", { headers: { cookie: "theme=dark" } }),
    );
    const light = themeFromRequest(
      new Request("https://example.com/", { headers: { cookie: "theme=light" } }),
    );
    const none = themeFromRequest(new Request("https://example.com/"));
    expect(new Set([dark, light, none]).size).toBe(3);
    expect(themeAttribute(dark)).toBe("dark");
    expect(themeAttribute(light)).toBe("light");
  });

  it("treats junk in the cookie as the default, never as the page failing", () => {
    const junk = themeFromRequest(
      new Request("https://example.com/", { headers: { cookie: "theme=%%%bogus" } }),
    );
    expect(themeAttribute(junk)).toBeUndefined();
  });
});

/* The health loader is the slowest thing here (0.98 to 2.01 s in production). Its time budget is
 * the suite default in `vitest.config.ts`, stated once there. */
describe("/api/health", () => {
  const healthRequest = (ip = "203.0.113.1") =>
    new Request("https://example.com/api/health", {
      headers: { "cf-connecting-ip": ip },
    });

  it("is NEVER cacheable, on every verdict", async () => {
    /* A cached health check answers "healthy" from an old entry whether the Worker is fine or
     * not. The route states the header itself so a later `headers` export cannot drop it unseen. */
    const ctx = createExecutionContext();
    const response = await healthLoader({
      request: healthRequest("203.0.113.10"),
      context: routeContext(ctx),
      params: {},
    } as never);
    await waitOnExecutionContext(ctx);

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    /* THE STATUS LINE IS THE ALERT. A 200 carrying `{"ok": false}` is read by
     * `curl --fail` as health and the alert is never sent. */
    const body = (await response.json()) as { ok: boolean };
    expect(response.status).toBe(body.ok ? 200 : 503);
  });

  it("WRITES A SNAPSHOT for both verdicts, and it is what was answered with", async () => {
    await env.APP_KV.delete(HEALTH_SNAPSHOT_KEY);

    const ctx = createExecutionContext();
    const response = await healthLoader({
      request: healthRequest("203.0.113.11"),
      context: routeContext(ctx),
      params: {},
    } as never);
    const body = (await response.json()) as { ok: boolean; checks: Array<{ ok: boolean }> };
    await waitOnExecutionContext(ctx);

    const stored = await env.APP_KV.get(HEALTH_SNAPSHOT_KEY, "json");
    expect(stored).toBeTruthy();
    /* What is stored is what was answered, so the home tile cannot keep showing the last good
     * answer while the site fails. This run fails locally (no AI Search), hence the useful case. */
    expect(stored).toMatchObject({
      ok: body.ok,
      total: body.checks.length,
      failed: body.checks.filter((c) => !c.ok).length,
    });
  });

  it("REFUSES past the per-IP rate, with the same body shape and a Retry-After", async () => {
    /* The limiter is gate 0 because every check below it costs. The budget is spent directly
     * through the route's Durable Object, so the one loader call is the subject and must be the
     * first refusal. The limiter is keyed per IP, so this case has an address of its own. */
    /* Frozen: the limiter keys on a FIXED wall-clock window, and a boundary between the spend
     * and the loader call would hand the loader a fresh allowance. Only `Date` is faked. */
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WINDOW_START);

    const ip = "203.0.113.99";
    const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`health:${ip}`));
    /* The route's own numbers, which it deliberately does not export: 20 per
     * 60 seconds. Spent to the edge, so the next call is the first refusal. */
    let lastOk = true;
    for (let i = 0; i < 20; i += 1) lastOk = (await limiter.hit(20, 60)).ok;
    /* The allowance was real: if `hit` had refused early, the assertion below would pass
     * against a limiter this case did not exhaust. */
    expect(lastOk).toBe(true);

    const ctx = createExecutionContext();
    const refusal = await healthLoader({
      request: healthRequest(ip),
      context: routeContext(ctx),
      params: {},
    } as never);
    await waitOnExecutionContext(ctx);

    expect(refusal.status).toBe(429);
    expect(refusal.headers.get("retry-after")).toBe("60");
    expect(refusal.headers.get("cache-control")).toBe("no-store");
    /* THE SAME BODY SHAPE AS EVERY OTHER ANSWER, so the watching workflow's
     * parse succeeds and reports a named cause rather than "body did not
     * parse". */
    expect(await refusal.json()).toMatchObject({
      ok: false,
      checks: [{ name: "rate-limited", ok: false }],
    });
  });

  it("does NOT serve at all when the limiter is missing", async () => {
    /* A missing `ASK_BUDGET` is a broken deployment, and 503 is how this endpoint reports one,
     * so the monitor alerts rather than quietly losing its guard. */
    const ctx = createExecutionContext();
    const response = await healthLoader({
      request: healthRequest("203.0.113.12"),
      context: routeContext(ctx, { ASK_BUDGET: undefined }),
      params: {},
    } as never);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      ok: false,
      checks: [{ name: "rate-limiter-unavailable", ok: false }],
    });
  });

  it("carries NO detail string, and a failing check carries only its two counts", async () => {
    /* Every `detail` is dropped: they carry an R2 key and FTS shadow table names, and this route
     * is unauthenticated. A failing check carries only `expected` and `present`. Both shapes are
     * asserted, or an implementation leaking detail on every check would pass. */
    const ctx = createExecutionContext();
    const response = await healthLoader({
      request: healthRequest("203.0.113.13"),
      context: routeContext(ctx),
      params: {},
    } as never);
    await waitOnExecutionContext(ctx);

    const body = (await response.json()) as {
      checks: Array<Record<string, unknown> & { ok: boolean }>;
    };
    expect(body.checks.length).toBeGreaterThan(0);
    for (const check of body.checks) {
      expect(check).not.toHaveProperty("detail");
      expect(Object.keys(check).sort()).toEqual(
        check.ok ? ["name", "ok"] : expect.arrayContaining(["name", "ok"]),
      );
      if (!check.ok) {
        /* Only ever the two counts beside the name, never a string. */
        for (const key of Object.keys(check)) {
          expect(["name", "ok", "expected", "present"]).toContain(key);
        }
      }
    }
  });

  it("answers a non-GET as a METHOD error, not as a framework crash", async () => {
    /* React Router's default for a loader-only route answers a POST with 405, a "server error"
     * body and no `Allow`. The status alone would pass against that, so the header, the body
     * shape and `no-store` are what discriminate. */
    const response = await healthAction();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    /* The SAME contract every other answer here uses, so the health workflow's
     * parse succeeds and names a cause rather than falling into its "body did
     * not parse" branch. */
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as { ok: boolean; checks: Array<{ name: string; ok: boolean }> };
    expect(body.ok).toBe(false);
    expect(body.checks).toEqual([{ name: "method-not-allowed", ok: false }]);
    /* Asserted by absence: the scaffold body carried a `message` field this route never
     * produces. */
    expect(body).not.toHaveProperty("message");
  });
});

describe("the home health tile", () => {
  it("reads a FAILED KV read as unreadable, not as a missing snapshot", async () => {
    const brokenKv = {
      get: async () => {
        throw new Error("planted KV read failure");
      },
    };
    const tile = await readHealthTile({ ...env, APP_KV: brokenKv } as never);
    expect(tile.state).toBe("unreadable");
  });

  it("still reads an absent snapshot as missing", async () => {
    await env.APP_KV.delete(HEALTH_SNAPSHOT_KEY);
    const tile = await readHealthTile(env as never);
    expect(tile.state).toBe("missing");
  });
});
