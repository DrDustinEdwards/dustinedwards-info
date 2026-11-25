import { env } from "cloudflare:test";
import { expect } from "vitest";

import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";

/* The shared steps of the sync_* cases: a content kind's sync tool, its drift check, and the three assertions every
 * case repeats (the first sync converges, a second one repairs nothing, the drift check names what moved). */

const operator = { kind: "operator", id: "test" } as const;

export function syncOf(tool: Parameters<typeof runTool>[2], check: string) {
  const sync = () => runTool(env as unknown as Parameters<typeof runTool>[0], operator, tool, {});
  const driftCheck = async () =>
    (await runHealthChecks(env as never)).checks.find((c) => c.name === check);
  return { sync, driftCheck };
}

type Sync = ReturnType<typeof syncOf>["sync"];
type Drift = ReturnType<typeof syncOf>["driftCheck"];

/** Run the sync and expect it to converge with these counts. */
export async function expectSynced(
  sync: Sync,
  counts: { repaired: number; removed: number; expected?: number },
) {
  const result = await sync();
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (result.ok)
    expect(result.data).toMatchObject({
      ...counts,
      ...(counts.expected === undefined ? {} : { present: counts.expected }),
      converged: true,
    });
}

/** A second sync finds nothing to repair. */
export const expectIdempotent = (sync: Sync) => expectSynced(sync, { repaired: 0, removed: 0 });

/** The drift check fails, and says what moved: `changed` rows differ from their file, `gone` rows have none. */
export async function expectDrift(driftCheck: Drift, moved: { changed?: number; gone?: number }) {
  const drifted = await driftCheck();
  expect(drifted?.ok).toBe(false);
  if (moved.changed) expect(drifted?.detail).toContain(`${moved.changed} sha-changed`);
  if (moved.gone) expect(drifted?.detail).toContain(`${moved.gone} row(s) with no file`);
}
