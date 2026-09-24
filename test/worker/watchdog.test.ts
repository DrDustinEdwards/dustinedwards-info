import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { watchdogActions } from "~/lib/health/repair.mjs";
import watchdog, { readHealth } from "../../workers/watchdog";

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
    await expect(readHealth(throwingSite("boom"))).resolves.toBeTruthy();
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
  });
});
