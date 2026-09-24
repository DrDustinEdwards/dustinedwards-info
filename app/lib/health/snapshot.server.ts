// A reader that could write would turn a cache miss on the busiest page back into a health run.

import {
  HEALTH_SNAPSHOT_KEY,
  healthTile,
  snapshotFromBody,
  type HealthTile,
} from "./snapshot.mjs";

/**
 * Never throws: bookkeeping must not cost the health endpoint its verdict. Awaited, not waitUntil, so
 * a caller reading this then the home page sees a consistent pair. No expiry: an aging "stale" beats
 * a "missing" that reads as misconfiguration.
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

/** A throw is treated as absence: the home page must render whatever KV is doing. */
export async function readHealthTile(env: Env): Promise<HealthTile> {
  let stored: unknown = null;
  try {
    stored = await env.APP_KV.get(HEALTH_SNAPSHOT_KEY, "json");
  } catch {
    stored = null;
  }
  return healthTile(stored, Date.now());
}
