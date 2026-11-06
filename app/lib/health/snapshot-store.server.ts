// The health snapshot's one writer: the site Worker's health-snapshot cron job (workers/app.ts, every fifteen
// minutes). It runs the same answer /health serves (response.server.ts) and stores each check's name and status for
// the colophon, so the tile's age is the cron's liveness, which /health's cron check also watches.

import { HEALTH_SNAPSHOT_KEY, snapshotFromBody } from "./snapshot.mjs";
import { siteHealthResponse } from "./response.server";

/**
 * Throws when nothing was stored, so runJobs records the job failed and /health's cron check names it. A body that
 * is not a /health answer is not stored, so the snapshot ages into `stale` rather than lying.
 */
export async function storeHealthSnapshot(env: Env, now = new Date()): Promise<void> {
  const response = await siteHealthResponse(env);
  const body: unknown = await response.json().catch(() => null);
  const snapshot = snapshotFromBody(body, now.toISOString());
  if (!snapshot)
    throw new Error(
      `the health answer (HTTP ${response.status}) named no checks, so no snapshot was stored`,
    );
  await env.APP_KV.put(HEALTH_SNAPSHOT_KEY, JSON.stringify(snapshot));
}
