import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import { watchdogActions } from "~/lib/health/repair.mjs";
import watchdog, { readErrorRate, readHealth } from "../../workers/watchdog";

describe("the watchdog's health reading", () => {
  const throwingSite = (message: string) =>
    ({
      SITE: {
        fetch: () => {
          throw new Error(message);
        },
      },
    }) as never;

  it("does not throw, because the handler must live to send the mail", async () => {
    await expect(readHealth(throwingSite("boom"))).resolves.toEqual({
      status: 0,
      body: null,
      error: "boom",
    });
  });

  it("names a non-Error throw in the alert rather than losing it", async () => {
    const site = {
      SITE: {
        fetch: () => {
          throw "network is unreachable";
        },
      },
    } as never;

    const actions = watchdogActions(await readHealth(site), { hasToken: true });
    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("notify");
    expect((actions[0] as { reason: string }).reason).toContain("network is unreachable");
  });

  it("puts the cause in the alert a human reads", async () => {
    const reading = await readHealth(throwingSite("connect ETIMEDOUT"));
    const actions = watchdogActions(reading, { hasToken: true });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("notify");
    const reason = (actions[0] as { reason: string }).reason;
    expect(reason).toContain("connect ETIMEDOUT");
    expect(reason).not.toContain("no failing check was named");
    expect(reason).toContain("could not be reached");
  });

  it("still alerts, and says so, when the reading carries no cause at all", async () => {
    const actions = watchdogActions({ status: 0, body: null }, { hasToken: true });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("notify");
    expect(actions.some((a) => a.type === "repair")).toBe(false);
    expect((actions[0] as { reason: string }).reason.trim()).not.toBe("");
  });

  it("leaves a real HTTP reading alone, so the branch is the transport one", async () => {
    /* A `status === 0` branch written as `!status` would swallow real readings. */
    const healthy = watchdogActions(
      { status: 200, body: { ok: true, checks: [] } },
      { hasToken: true },
    );
    expect(healthy).toEqual([]);

    const drifted = watchdogActions(
      { status: 503, body: { ok: false, checks: [{ name: "ask-index-drift", ok: false }] } },
      { hasToken: true },
    );
    expect(drifted.some((a) => a.type === "repair")).toBe(true);
  });
});

describe("the watchdog's repair loop", () => {
  it("puts the operator's refusal sentence in the alert and runs no later repair", async () => {
    const refusal =
      'unknown directive ":swatch" on line 12. Known directives: chart, diagram, figure, footnote.';
    const tools: string[] = [];
    const sent: Array<{ subject: string; text: string }> = [];

    const site = {
      fetch: async (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/operator")) {
          tools.push(JSON.parse(String(init?.body)).tool);
          return Response.json(
            { ok: false, error: refusal, detail: { field: null, line: 12 } },
            { status: 422 },
          );
        }
        return Response.json(
          {
            ok: false,
            checks: [
              { name: "content-drift", ok: false },
              { name: "ask-index-drift", ok: false },
            ],
          },
          { status: 503 },
        );
      },
    };

    /* The last poll was green, so this one opens an alert rather than setting a baseline. */
    await env.APP_KV.put(
      "watchdog:alert-state",
      JSON.stringify({ red: false, since: "2026-09-01T00:00:00.000Z", checks: [] }),
    );
    await watchdog.scheduled({} as ScheduledController, {
      SITE: site,
      EMAIL: { send: async (message: { subject: string; text: string }) => void sent.push(message) },
      ALERT_EMAIL: "alerts@example.com",
      OPERATOR_TOKEN: "a-token",
      APP_KV: env.APP_KV,
    } as never);

    /* sync_ask reads the search_docs that sync_posts just failed to rewrite. */
    expect(tools).toEqual(["sync_posts"]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain(refusal);
    /* No API token here, so the rate read "ok" without being read; the mail must say so. */
    expect(sent[0]?.text).toContain("error rate NOT CHECKED");
  });
});

describe("the watchdog's error-rate reading", () => {
  const configured = { CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "a-token" } as never;
  const invocations = (pairs: Array<[string, number]>) =>
    pairs.map(([status, requests]) => ({ sum: { requests }, dimensions: { status } }));

  /** Answers only a script-filtered query: unfiltered, the watchdog's own invocations would count. */
  const analyticsApi = (rows: unknown) =>
    vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const { query, variables } = JSON.parse(String(init?.body));
      const filtered = query.includes("scriptName: $script") && variables.script === "dustinedwards";
      return Response.json(
        filtered
          ? { data: { viewer: { accounts: [{ workersInvocationsAdaptive: rows }] } } }
          : { data: null, errors: [{ message: "invocations are not filtered on the site's script" }] },
      );
    });

  it("reads the site's invocations through a script-filtered query", async () => {
    const api = analyticsApi(invocations([["success", 40]]));
    vi.stubGlobal("fetch", api);

    const reading = await readErrorRate(configured);
    expect(reading).toMatchObject({ ok: true, configured: true });
    expect(reading.detail).toContain("0 of 40");
    expect(api).toHaveBeenCalledTimes(1);
    expect(String(api.mock.calls[0]?.[0])).toBe("https://api.cloudflare.com/client/v4/graphql");
  });

  it("reports a window over the threshold as not ok", async () => {
    vi.stubGlobal("fetch", analyticsApi(invocations([["success", 121], ["scriptThrewException", 59]])));
    const reading = await readErrorRate(configured);
    expect(reading).toMatchObject({ ok: false, configured: true });
    expect(reading.detail).toContain("59 of 180");
  });

  it("fails closed on a 200 that carries GraphQL errors", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ data: null, errors: [{ message: "not authorized for this account" }] }),
    );
    const reading = await readErrorRate(configured);
    expect(reading).toMatchObject({ ok: false, configured: true });
    expect(reading.detail).toContain("GraphQL errors");
    expect(reading.detail).toContain("not authorized for this account");
  });

  it("fails closed on a non-200 answer", async () => {
    vi.stubGlobal("fetch", async () => new Response("rate limited", { status: 429 }));
    const reading = await readErrorRate(configured);
    expect(reading).toMatchObject({ ok: false, configured: true });
    expect(reading.detail).toContain("HTTP 429");
  });

  it("fails closed when the query does not complete", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("connect ETIMEDOUT");
    });
    const reading = await readErrorRate(configured);
    expect(reading).toMatchObject({ ok: false, configured: true });
    expect(reading.detail).toContain("connect ETIMEDOUT");
  });

  it("names the missing credential and reaches for nothing when unconfigured", async () => {
    /* The setup's refusing fetch stays installed, so any network call here would throw. */
    const reading = await readErrorRate({ CLOUDFLARE_ACCOUNT_ID: "acct" } as never);
    expect(reading).toMatchObject({ ok: true, configured: false });
    expect(reading.detail).toContain("CLOUDFLARE_API_TOKEN");
  });
});
