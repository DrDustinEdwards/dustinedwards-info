import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { getDb } from "~/db";
import { zeroResultQueries } from "~/db/schema";
import type { Actor } from "~/lib/editor/publish-policy.mjs";
import { runTool } from "~/lib/operator/api.server";
import { ZERO_RESULT_RETENTION_SECONDS } from "~/lib/search/zero-result.mjs";
import { isZeroResultPurgeWindow, purgeZeroResultsDaily } from "../../workers/watchdog";

import { testEnv } from "./test-env";

const OPERATOR: Actor = { kind: "operator", id: "test-operator" };
const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];

/* Raw D1, not the drizzle builder: the column is `mode: "timestamp"`, so the builder wants a Date and
   this helper wants to plant an exact epoch second, the same way test/worker/seed.ts seeds received_at. */
async function seedZeroResult(query: string, lastSeen: number) {
  await testEnv.DB.prepare(
    `INSERT INTO zero_result_queries (query, count, first_seen, last_seen) VALUES (?1, 1, ?2, ?3)`,
  )
    .bind(query, lastSeen, lastSeen)
    .run();
}

describe("the purge_zero_results operator tool", () => {
  it("removes exactly the rows past the retention cutoff, which is the button's old rule", async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedZeroResult("an old unanswered question", now - ZERO_RESULT_RETENTION_SECONDS - 10);
    await seedZeroResult("a recent unanswered question", now - 10);

    const result = await runTool(operatorEnv(), OPERATOR, "purge_zero_results", {});
    expect(result).toMatchObject({ ok: true, data: { purged: 1 } });

    const remaining = await getDb(testEnv).select().from(zeroResultQueries);
    expect(remaining.map((row) => row.query)).toEqual(["a recent unanswered question"]);
  });

  it("purges nothing, and reports 0, when every row is still live demand", async () => {
    await seedZeroResult("a live question", Math.floor(Date.now() / 1000));
    const result = await runTool(operatorEnv(), OPERATOR, "purge_zero_results", {});
    expect(result).toMatchObject({ ok: true, data: { purged: 0 } });
  });
});

describe("the watchdog's daily zero-result purge", () => {
  const day = Date.UTC(2026, 9, 4, 4, 0);

  it("falls in one firing of the fifteen-minute cron a day, every day", () => {
    expect(isZeroResultPurgeWindow(day)).toBe(true);
    expect(isZeroResultPurgeWindow(day + 14 * 60_000)).toBe(true);
    expect(isZeroResultPurgeWindow(day + 15 * 60_000)).toBe(false);
    expect(isZeroResultPurgeWindow(day - 15 * 60_000)).toBe(false);
    /* Daily, unlike the weekly citation refresh: the same window the next day is also a hit. */
    expect(isZeroResultPurgeWindow(day + 24 * 60 * 60_000)).toBe(true);
    expect(isZeroResultPurgeWindow(Number.NaN)).toBe(false);
  });

  it("calls purge_zero_results through the site binding, and raises what the tool refused", async () => {
    const calls: unknown[] = [];
    const site = (status: number, payload: unknown) =>
      ({
        SITE: {
          fetch: async (_url: string, init: RequestInit) => {
            calls.push(JSON.parse(String(init.body)));
            return new Response(JSON.stringify(payload), { status });
          },
        },
      }) as never;

    expect(await purgeZeroResultsDaily(site(200, { data: { purged: 3 } }), "tok", day)).toBeNull();
    expect(calls).toEqual([{ tool: "purge_zero_results", args: {} }]);
    /* Outside the window, no call at all. */
    expect(await purgeZeroResultsDaily(site(200, {}), "tok", day + 60 * 60_000)).toBeNull();
    expect(calls).toHaveLength(1);

    const failed = await purgeZeroResultsDaily(site(500, { error: "D1 is unavailable" }), "tok", day);
    expect(failed).toContain("D1 is unavailable");
    expect(await purgeZeroResultsDaily(site(200, {}), "", day)).toContain("OPERATOR_TOKEN");
  });
});
