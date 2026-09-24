import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudflareContext } from "~/lib/context";
import { HEALTH_SNAPSHOT_KEY } from "~/lib/health/snapshot.mjs";
import { ORIGIN_REFUSAL } from "~/lib/origin.mjs";
import { action as themeAction, loader as themeLoader } from "~/routes/theme";
import { colorSchemeMeta, themeAttribute, themeFromRequest } from "~/lib/theme";
import { action as healthAction, loader as healthLoader } from "~/routes/api.health";

/**
 * Two route modules driven DIRECTLY: `/theme` and `/api/health`.
 *
 * ## WHY DIRECTLY RATHER THAN THROUGH THE WORKER
 *
 * These are the route modules the real router would call, with the real
 * bindings in the real runtime. What is not exercised is the routing itself,
 * which is `virtual:react-router/server-build`, a build artifact this layer
 * deliberately does not build. Every claim below is about the module's own
 * behavior, which is where both of the defects they replay actually lived.
 *
 * ## THE TWO DEFECTS THESE REPLAY
 *
 * `/theme` had NO origin check: measured 2026-08-27, a POST carrying
 * `Origin: https://evil.example` set the theme cookie.
 *
 * `/api/health` was unauthenticated and UNRATED while being the most expensive
 * thing an anonymous caller could ask this site to do, sitting next to
 * `/api/csp-report`, which only writes a log line and carries three limits.
 *
 * Both were established by probing production. Both are seconds of offline work
 * here.
 */

/** The `context` a loader or action receives, carrying the bindings. */
function routeContext(ctx: ExecutionContext, overrides: Record<string, unknown> = {}) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: { ...env, ...overrides } as never, ctx });
  return context;
}

/**
 * The instant the rate case freezes at. On a minute boundary, so the window
 * arithmetic under test is the limiter's rather than this fixture's.
 */
const WINDOW_START = Date.UTC(2026, 8, 4, 12, 0, 0);

/* RESTORED FOR EVERY CASE, not just the one that freezes: a case that fails
 * mid-assertion never reaches its own cleanup, and a clock left frozen would
 * surface as a failure in whatever ran next. */
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

  it("ECHOES A FRAGMENT when the referer carries one, which a browser never does", async () => {
    /*
     * THE FUNCTION'S CONTRACT, NOT THE WIRE'S BEHAVIOUR, and the difference is
     * the point of this comment.
     *
     * `safeReturnTo` echoes `url.hash`, and this case proves it does so through
     * the same origin and protocol-relative checks as everything else. What it
     * CANNOT prove is that a reader benefits, because the header below is
     * synthetic: `Referer` never carries a fragment, RFC 9110 requires it
     * stripped, and check:browser measured the real thing on 2026-08-29 and saw
     * the fragment gone.
     *
     * Kept, because the echo is real behavior worth pinning and this is the
     * only place that pins it. Renamed, because the old name claimed a reader
     * outcome that a constructed input cannot demonstrate. That gap between a
     * test's input and the world's is exactly what let the claim stand for a
     * day.
     */
    const response = await themeAction({
      request: themePost("theme=light", {
        origin: "https://example.com",
        referer: "https://example.com/blog/a-post?x=1#step-3-the-gate",
      }),
    } as never);

    expect(response.headers.get("location")).toBe("/blog/a-post?x=1#step-3-the-gate");
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
    /* NOTHING WAS SET. A 403 that still wrote the cookie would be a refusal in
     * name only. */
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("ALLOWS AN ABSENT ORIGIN, because that is the no-script form post", async () => {
    /*
     * The half that looks like a hole and is not. A scriptless form post carries
     * no `Origin`, and refusing it would break the fallback the progressive-enhancement rule
     * requires. The literal string "null" is a different thing and is refused.
     */
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
    /*
     * This case used to assert that an unrecognised theme fell back to a
     * default cookie. It does not any more: an unrecognised value is refused,
     * which the case below owns. What survives is the OTHER half it was
     * testing, the referer, and it needs a legal theme to reach that code at
     * all.
     */
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
    /*
     * The route substituted the default for anything it did not recognize,
     * which turned a malformed request into a silent theme change. Both of the
     * control's buttons carry a writable theme, so nothing legitimate arrives
     * here with anything else.
     *
     * `system` is the case worth naming: it used to be accepted, and a client
     * written against the old surface would still send it.
     */
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
  /*
   * ## THE COLLAPSE, ASSERTED RATHER THAN ASSUMED
   *
   * A `theme=system` cookie is still in readers' browsers, because the control
   * could write it for a year's max-age. It means "follow the machine", which
   * is what having no cookie means, so the resolver answers the same for both.
   *
   * The addendum asked for this to be checked before collapsing them: does a
   * legacy reader receive a different `data-theme` than a first-time one? These
   * cases are the answer, and they are permanent so it stays the answer.
   */
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
    /*
     * The control lost a button; the model did not lose a state. `light`,
     * `dark` and the default are three distinct answers, and `workers/app.ts`
     * keys its cache on this value, so a collapse to two here would merge two
     * documents that genuinely differ.
     */
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

/**
 * These cases drive the health loader, which is the slowest thing this file
 * touches: one call runs five checks against D1, R2 and AI Search, and
 * production measured 0.98 to 2.01 seconds for the same work.
 *
 * ## THE BUDGET THAT COVERS THEM IS THE SUITE DEFAULT, IN `vitest.config.ts`
 *
 * THE MEASUREMENT WAS TAKEN HERE, 2026-08-29: three of these cases failed
 * inside `ship` at 5065ms, 5777ms and 5218ms, which is vitest's default timeout
 * and not a defect in anything they assert. The repair then was a
 * `HEALTH_CASE_TIMEOUT` constant applied to five `it()` calls in this file.
 *
 * MOVED 2026-08-31, and the reason is what the per-case version could not see.
 * A budget attached to five cases grades the five cases somebody already
 * watched fail, and leaves every other case in the layer on the default,
 * including the shiki and WASM render paths in `publish.test.ts` and the R2
 * paths in `media.test.ts`, which do comparable work under the same load. The
 * constant was also a mirror: five sites carrying a value that could drift from
 * the default it sat beside, which is the one-owner rule.
 *
 * So the budget is stated once, where vitest reads it, and the grounds are
 * there. This comment records that the measurement happened at this endpoint
 * and deliberately carries no number, because it does not own one.
 */
describe("/api/health", () => {
  const healthRequest = (ip = "203.0.113.1") =>
    new Request("https://example.com/api/health", {
      headers: { "cf-connecting-ip": ip },
    });

  it("is NEVER cacheable, on every verdict", async () => {
    /*
     * A health check that can be served from cache is not a health check: it
     * would answer "healthy" from an entry written up to two hours earlier and
     * would answer that identically whether the Worker was fine or on fire.
     *
     * The route states the header itself rather than relying on the transport's
     * default, because a route whose correctness depends on a header must state
     * it or the next person to add a `headers` export removes the protection
     * without knowing it was load bearing.
     */
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
    /*
     * `body` RATHER THAN THE RUN, so what is stored is what was answered with.
     * A snapshot recording only healthy runs would let the home tile keep
     * showing the last good answer while the site was failing, which is the
     * exact lie the tile's timestamp exists to prevent. This run is a FAILING
     * one (no AI Search binding locally), which is why it is the useful case.
     */
    expect(stored).toMatchObject({
      ok: body.ok,
      total: body.checks.length,
      failed: body.checks.filter((c) => !c.ok).length,
    });
  });

  it("REFUSES past the per-IP rate, with the same body shape and a Retry-After", async () => {
    /*
     * GATE 0, AND IT IS FIRST BECAUSE EVERYTHING BELOW IT COSTS. This endpoint
     * runs checks against D1, R2 and AI Search; measured 2026-08-26 over four
     * samples at 0.98 to 2.01 seconds. It was unauthenticated and unrated,
     * which made it the most expensive thing an anonymous caller could ask this
     * site to do.
     *
     * ## THE BUDGET IS SPENT DIRECTLY, AND THAT IS THE POINT OF THE CASE
     *
     * This case used to call the loader in a loop until one answer came back
     * 429. It worked and it was WRONG in a way that only showed under load:
     * the limiter is gate 0, so the first twenty calls each ran the full
     * five-check suite before being allowed through, and only the
     * twenty-first refused. Twenty health runs to observe one refusal, at
     * roughly a second each. It timed out inside `ship` and took the deploy
     * with it.
     *
     * Spending the budget through the same Durable Object the route uses
     * leaves exactly ONE loader call to assert on, and that call is the
     * subject. It is also stronger: the loop only ever proved that SOME call
     * refused eventually, while this proves the refusal happens on the call
     * after the allowance is gone.
     *
     * The limiter is keyed per IP, so this case gets an address of its own and
     * no other case is affected.
     */
    /*
     * ## THE CLOCK IS FROZEN ACROSS THE SPEND AND THE ASSERTION BOTH
     *
     * The limiter keys its counter on
     * `Math.floor(Date.now() / 1000 / windowSeconds)`, a FIXED window on the
     * wall clock. The spend below and the loader call after it have to land in
     * the SAME window or the case asserts nothing: a minute boundary between
     * them drops the count and the loader is refused by nothing, having been
     * handed a fresh allowance.
     *
     * This is the same defect as the operator rate case, measured on
     * 2026-09-04, and it is worth naming that this case is exposed for a
     * narrower reason: the spend is fast, but the gap between the last `hit`
     * and the loader's own gate-0 call is where a boundary does the damage.
     *
     * Only `Date` is faked, so the loader's real async work is untouched.
     */
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WINDOW_START);

    const ip = "203.0.113.99";
    const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`health:${ip}`));
    /* The route's own numbers, which it deliberately does not export: 20 per
     * 60 seconds. Spent to the edge, so the next call is the first refusal. */
    let lastOk = true;
    for (let i = 0; i < 20; i += 1) lastOk = (await limiter.hit(20, 60)).ok;
    /* THE ALLOWANCE WAS REAL. If `hit` had refused early the assertion below
     * would pass for the wrong reason, against a limiter that was already
     * exhausted rather than one this case exhausted. */
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
    /*
     * A missing `ASK_BUDGET` is itself a broken deployment, and answering 503 is
     * exactly how this endpoint reports one, so the monitor alerts rather than
     * quietly losing its guard.
     */
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
    /*
     * Every `detail` is dropped by `publicHealthBody`, because they carry an R2
     * object key and the FTS shadow table names, and this route is
     * unauthenticated. The why lives in Workers Logs.
     *
     * A FAILING check does carry `expected` and `present`, since 2026-08-23: a
     * flap reported `ask-index-drift` false and could not be diagnosed, because
     * one record apart mid-sync and a hundred apart are the same alert and only
     * one is an incident. Two integers are not secrets; the strings still do
     * not travel. A PASSING check stays exactly as narrow as it was.
     *
     * BOTH SHAPES ARE ASSERTED, which is what makes this more than a spot
     * check: an implementation that leaked detail on every check would satisfy
     * a test that only looked at the passing ones.
     */
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
    /*
     * REPLAYS WHAT PRODUCTION DID, measured 2026-09-11:
     * `curl -X POST /api/health` returned 405 with `Content-Type:
     * application/json` and the body `{"message":"Unexpected Server Error"}`,
     * and no `Allow` header. That is React Router's default for a route with
     * a loader and no action, and it tells the caller the server broke when
     * the caller simply used the wrong verb.
     *
     * Four claims, because the old behavior already satisfied one of them:
     * the status was ALREADY 405, so a test asserting only the status would
     * have passed against the defect. The `Allow` header, the body shape and
     * the `no-store` are the three that discriminate.
     */
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
    /* The scaffold string is gone, and it is asserted by absence rather than
     * by the presence of its replacement: the defect was a body carrying a
     * `message` field this route never produces. */
    expect(body).not.toHaveProperty("message");
  });
});
