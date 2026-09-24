import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { watchdogActions } from "~/lib/health/repair.mjs";
import watchdog, { readHealth } from "../../workers/watchdog";

/**
 * The watchdog keeps the reason a health fetch failed, and the alert says it.
 *
 * ## The defect this replays
 *
 * Measured in the pre-cutover audit 2026-09-11 (P2-07). `readHealth` caught
 * every transport failure as `catch { return { status: 0, body: null } }`, so
 * DNS failure, a timeout and a Cloudflare 1042 all arrived at the decision
 * layer as the same reading. That reading names no failing check, so
 * `repairPlan` correctly refused to repair, and the mail that woke somebody
 * said "no failing check was named, so there is nothing to repair" about a
 * request that never happened.
 *
 * Those are different pages. A timeout says the site is slow or wedged. A
 * 1042 says this Worker's service binding is pointed somewhere it may not go,
 * which is a deploy problem and not a site problem at all. The person reading
 * the mail at 2am gets one sentence, and it was the wrong one.
 *
 * `repair` in the same file has always kept `error.message`, which is what
 * made the omission legible as an inconsistency rather than a decision.
 *
 * ## Why a stub and not a real failure
 *
 * There is no way to make a live service binding throw on demand. A stub is
 * the only instrument that reaches the catch, and what it stubs is exactly
 * one method: `env.SITE.fetch`. Nothing else about the reading is simulated,
 * so what runs here is the real function and the real decision module.
 *
 * ## Both halves, because either alone would pass against the defect
 *
 * The old code also returned `status: 0`, and the old `watchdogActions` also
 * returned exactly one notify action. A test asserting either of those would
 * have been green the whole time. What discriminates is the MESSAGE surviving
 * the catch, and then reaching the reason string a human reads.
 */
describe("the watchdog's health reading", () => {
  /** A `SITE` binding whose fetch throws, and nothing else. */
  const throwingSite = (message: string) =>
    ({
      SITE: {
        fetch: () => {
          throw new Error(message);
        },
      },
    }) as never;

  it("does not throw, because the handler must live to send the mail", async () => {
    /* The property the catch existed for in the first place, asserted so the
     * change above cannot have traded it away. */
    await expect(readHealth(throwingSite("boom"))).resolves.toBeTruthy();
  });

  it("names a non-Error throw in the alert rather than losing it", async () => {
    /* `instanceof Error` is false for a string throw, so this is the arm a reader
     * never sees until the day it matters. */
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
    /* And it no longer says the thing that was wrong: a fetch that did not
     * happen is not a run that named no failing check. */
    expect(reason).not.toContain("no failing check was named");
    expect(reason).toContain("could not be reached");
  });

  it("still alerts, and says so, when the reading carries no cause at all", async () => {
    /* A reading assembled by something other than `readHealth`, or by a future
     * edit that drops the message again. Alert-only is still correct, and the
     * reason names the gap rather than pretending there was none. */
    const actions = watchdogActions({ status: 0, body: null }, { hasToken: true });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("notify");
    expect(actions.some((a) => a.type === "repair")).toBe(false);
    expect((actions[0] as { reason: string }).reason.trim()).not.toBe("");
  });

  it("leaves a real HTTP reading alone, so the branch is the transport one", async () => {
    /* THE NEGATIVE. A `status === 0` branch written as `!status` or placed
     * above the healthy check would swallow real readings, and every
     * assertion above would still pass. */
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
