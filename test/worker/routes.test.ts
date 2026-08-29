import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { cloudflareContext } from "~/lib/context";
import { HEALTH_SNAPSHOT_KEY } from "~/lib/health/snapshot.mjs";
import { ORIGIN_REFUSAL } from "~/lib/origin.mjs";
import { action as themeAction, loader as themeLoader } from "~/routes/theme";
import { loader as healthLoader } from "~/routes/api.health";

/**
 * Two route modules driven DIRECTLY: `/theme` and `/api/health`.
 *
 * ## WHY DIRECTLY RATHER THAN THROUGH THE WORKER
 *
 * These are the route modules the real router would call, with the real
 * bindings in the real runtime. What is not exercised is the routing itself,
 * which is `virtual:react-router/server-build`, a build artifact this layer
 * deliberately does not build. Every claim below is about the module's own
 * behaviour, which is where both of the defects they replay actually lived.
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

  it("KEEPS THE HASH, so a scriptless reader lands where they were reading", async () => {
    /*
     * It was dropped, so the no-script toggle returned a reader to the TOP of
     * whatever they were reading. On a long post that is the worst possible
     * place to land, and the cost fell entirely on the readers the fallback
     * exists for: the scripted path never navigates.
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
     * no `Origin`, and refusing it would break the fallback hard rule 9
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

  it("falls back to `system` for anything unrecognised, and to `/` for a foreign referer", async () => {
    const response = await themeAction({
      request: themePost("theme=chartreuse", {
        origin: "https://example.com",
        referer: "https://elsewhere.example/somewhere",
      }),
    } as never);
    expect(response.headers.get("set-cookie")).toContain("theme=system");
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
});

/**
 * A budget for a case that drives the health loader.
 *
 * ## VITEST'S 5s DEFAULT IS NOT A STATEMENT ABOUT THIS ENDPOINT
 *
 * MEASURED THE HARD WAY, 2026-08-29: three of these cases failed inside `ship`
 * at 5065ms, 5777ms and 5218ms, which is the default timeout and not a defect
 * in anything they assert. Every one of them was green minutes earlier on an
 * idle machine. `ship` runs the whole offline tier, so the machine underneath
 * these is the busiest it ever gets, and that is exactly when they must not
 * lie.
 *
 * One call to this loader runs five checks against D1, R2 and AI Search;
 * production measured 0.98 to 2.01 seconds for the same work. A 5s budget is
 * therefore 2.5x headroom on an idle machine and none at all on a loaded one,
 * which is the same collapsed-margin shape `check:browser`'s readiness bound
 * had on the same day.
 *
 * 30s, and it costs nothing: a budget is only ever paid by a case that HANGS,
 * and a case that hangs is a failure either way. What it buys is that a slow
 * machine reports what the code did rather than how long the machine took.
 */
const HEALTH_CASE_TIMEOUT = 30_000;

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
  }, HEALTH_CASE_TIMEOUT);

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
  }, HEALTH_CASE_TIMEOUT);

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
  }, HEALTH_CASE_TIMEOUT);

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
  }, HEALTH_CASE_TIMEOUT);

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
  }, HEALTH_CASE_TIMEOUT);
});
