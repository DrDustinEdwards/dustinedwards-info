import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HEALTH_SNAPSHOT_KEY } from "~/lib/health/snapshot.mjs";
import { readHealthTile } from "~/lib/health/snapshot.server";
import { storeHealthSnapshot } from "~/lib/health/snapshot-store.server";
import { HEALTH_CHECK_NAMES, runHealthChecks } from "~/lib/health/checks.server";
import { ORIGIN_REFUSAL } from "@dustinedwards/site-runtime/origin";
import { action as themeAction, loader as themeLoader } from "~/routes/theme";
import { loader as healthLoader } from "~/routes/health";

import { freezeAtWindowStart, routeContext } from "./route-helpers";

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
        referer: "https://example.com/writing/a-post",
      }),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("theme=dark");
    expect(response.headers.get("location")).toBe("/writing/a-post");
  });

  it("REFUSES A FOREIGN ORIGIN (measured 2026-08-27: it used to set the cookie)", async () => {
    const response = await themeAction({
      request: themePost("theme=dark", {
        origin: "https://evil.example",
        referer: "https://example.com/writing/a-post",
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

/* The health loader is the slowest thing here (0.98 to 2.01 s in production). Its time budget is
 * the suite default in `vitest.config.ts`, stated once there. */
describe("/health", () => {
  const healthRequest = (ip: string) =>
    new Request("https://example.com/health", { headers: { "cf-connecting-ip": ip } });

  it("reports drift as a warning, never a 503, in the network shape", async () => {
    /* Locally AI Search is absent, so ask-index-drift fails: /health warns. */
    const ctx = createExecutionContext();
    const response = await healthLoader({
      request: healthRequest("203.0.113.20"),
      context: routeContext(ctx),
      params: {},
    } as never);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/health+json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as {
      status: string;
      db: string;
      checks: Array<{ name: string; status: string; detail?: string }>;
    };
    expect(body).toMatchObject({ status: "warn", db: "up" });
    /* PUBLIC, so a drift check's detail is its two counts and nothing else: the run's own detail names R2 keys and
       FTS shadow tables. rows.mjs healthChecks reads the counts back for ship. */
    for (const check of body.checks.filter((c) => HEALTH_CHECK_NAMES.includes(c.name as never))) {
      if (check.detail !== undefined) expect(check.detail).toMatch(/^(\d+ of \d+)?$/);
    }
    const byName = Object.fromEntries(body.checks.map((c) => [c.name, c.status]));
    /* No cron has fired in a test database, so the cron check warns that CRON_JOBS never ran (site-runtime 0.54.0):
     * the same list the scheduled handler runs is the list /health expects. */
    expect(byName).toMatchObject({ db: "pass", cron: "warn", "ask-index-drift": "warn" });
    expect(byName).toHaveProperty("backup");
    /* /health names its drift checks before the run, from HEALTH_CHECK_NAMES: a check added to the run and not to
     * the list would never reach /health. */
    const run = await runHealthChecks(env as never);
    expect(run.checks.map((c) => c.name)).toEqual([...HEALTH_CHECK_NAMES]);
  });

  it("REFUSES past the per-IP rate, in the same shape and with a Retry-After", async () => {
    /* The limiter comes first because every check below it costs. Frozen: the limiter keys on a FIXED wall-clock
       window, and a boundary between the spend and the loader call would hand the loader a fresh allowance. */
    freezeAtWindowStart();
    const ip = "203.0.113.99";
    const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`health:${ip}`));
    let lastOk = true;
    for (let i = 0; i < 20; i += 1) lastOk = (await limiter.hit([{ limit: 20, windowSeconds: 60 }])).ok;
    expect(lastOk).toBe(true);

    const ctx = createExecutionContext();
    const refusal = await healthLoader({ request: healthRequest(ip), context: routeContext(ctx), params: {} } as never);
    await waitOnExecutionContext(ctx);

    expect(refusal.status).toBe(429);
    expect(refusal.headers.get("retry-after")).toBe("60");
    expect(refusal.headers.get("cache-control")).toBe("no-store");
    expect(await refusal.json()).toMatchObject({ status: "fail", checks: [{ name: "rate-limited", status: "fail" }] });
  });
});

describe("the colophon health tile", () => {
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

  it("is fresh once the health-snapshot job has run, with every check /health names", async () => {
    await env.APP_KV.delete(HEALTH_SNAPSHOT_KEY);
    await storeHealthSnapshot(env as never);
    const tile = await readHealthTile(env as never);
    expect(tile.state).toBe("fresh");
    expect(tile.state === "fresh" && tile.checks.map((c) => c.name)).toEqual(expect.arrayContaining(["db", ...HEALTH_CHECK_NAMES]));
  });
});
