import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Actor } from "~/lib/editor/publish-policy.mjs";
import { runTool } from "~/lib/operator/api.server";
import { ZERO_RESULT_RETENTION_SECONDS } from "~/lib/search/zero-result.mjs";

import { testEnv } from "./test-env";

const OPERATOR: Actor = { kind: "operator", id: "test-operator" };
const CTX = { waitUntil: () => undefined, passThroughOnException: () => undefined } as never;
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

/* Raw D1 for the read too: testEnv's type is not the app's Env (it lacks OPENALEX_API_KEY), so it
   cannot be handed to getDb, and no other worker test does. */
async function remainingQueries(): Promise<string[]> {
  const { results } = await testEnv.DB.prepare(
    `SELECT query FROM zero_result_queries ORDER BY query`,
  ).all<{
    query: string;
  }>();
  return results.map((row) => row.query);
}

describe("the purge-zero-results job, run now through run_job", () => {
  it("removes exactly the rows past the retention cutoff, which is the button's old rule", async () => {
    const now = Math.floor(Date.now() / 1000);
    await seedZeroResult("an old unanswered question", now - ZERO_RESULT_RETENTION_SECONDS - 10);
    await seedZeroResult("a recent unanswered question", now - 10);

    const result = await runTool(
      operatorEnv(),
      OPERATOR,
      "run_job",
      { job: "purge-zero-results" },
      CTX,
    );
    expect(result).toMatchObject({
      ok: true,
      data: { runs: [{ job: "purge-zero-results", status: "ok", result: { purged: 1 } }] },
    });

    expect(await remainingQueries()).toEqual(["a recent unanswered question"]);
  });

  it("purges nothing, and reports 0, when every row is still live demand", async () => {
    await seedZeroResult("a live question", Math.floor(Date.now() / 1000));
    const result = await runTool(
      operatorEnv(),
      OPERATOR,
      "run_job",
      { job: "purge-zero-results" },
      CTX,
    );
    expect(result).toMatchObject({
      ok: true,
      data: { runs: [{ job: "purge-zero-results", status: "ok", result: { purged: 0 } }] },
    });
  });
});
