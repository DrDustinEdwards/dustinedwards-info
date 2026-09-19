/**
 * The KV half of the health snapshot. Pure logic is in `snapshot.mjs`.
 *
 * ONE WRITER AND ONE READER, and the asymmetry is the design:
 *
 *   writer   `/api/health`, on every run, whoever asked for it. The scheduled
 *            poll goes through that endpoint, so the fifteen minute schedule
 *            is what keeps this fresh with no second timer in existence.
 *   reader   the home loader, which never writes and never computes.
 *
 * A reader that could write would turn a cache miss on the busiest page back
 * into a health run, which is the whole defect this replaces.
 */

import {
  HEALTH_SNAPSHOT_KEY,
  healthTile,
  snapshotFromBody,
  type HealthTile,
} from "./snapshot.mjs";

/**
 * Stores the verdict. NEVER throws.
 *
 * A failed snapshot write must not turn a healthy site into a 500 on the one endpoint the alerting
 * workflow reads, nor turn an unhealthy site into a different failure that hides which check broke.
 * Bookkeeping never costs a caller their response. THE CONSEQUENCE IS STATED RATHER THAN HIDDEN: if
 * KV is failing the snapshot ages, and the home tile reports it as stale.
 *
 * Awaited rather than deferred to `waitUntil`, so a caller that reads this endpoint and then reads
 * the home page sees a consistent pair.
 *
 * NO EXPIRY. A snapshot that expired would report `missing`, which reads as "something is
 * misconfigured"; one that ages reports `stale` WITH ITS AGE, which is the more useful sentence when
 * the poller has stopped.
 */
export async function writeHealthSnapshot(
  env: Env,
  body: { ok: boolean; checks: Array<{ ok: boolean }> },
  readAt: string,
): Promise<void> {
  try {
    await env.APP_KV.put(HEALTH_SNAPSHOT_KEY, JSON.stringify(snapshotFromBody(body, readAt)));
  } catch {
    /* A snapshot write must never cost the caller their health verdict. */
  }
}

/**
 * Reads the stored verdict and classifies it. ONE KV read, nothing else.
 *
 * A throw is treated as absence rather than propagated: the home page must
 * render whatever KV is doing, and "the tile could not be read" and "the tile
 * was never written" are the same sentence to a reader.
 */
export async function readHealthTile(env: Env): Promise<HealthTile> {
  let stored: unknown = null;
  try {
    stored = await env.APP_KV.get(HEALTH_SNAPSHOT_KEY, "json");
  } catch {
    stored = null;
  }
  return healthTile(stored, Date.now());
}
