// Written only by /api/health, which the watchdog polls, so the tile's AGE is the watchdog's liveness:
// nothing else may stamp this key. Measured: running the suite in the home loader cost about 1.2 s.

/** One key, not a prefix: a prefix would invite a second writer. */
export const HEALTH_SNAPSHOT_KEY = "health:snapshot";

/** Restates the watchdog cron in wrangler.watchdog.jsonc, which a Worker cannot read. Change both together. */
export const HEALTH_POLL_INTERVAL_SECONDS = 15 * 60;

/** Three intervals: a Cron Trigger is best effort, and a tile that flaps on one missed poll gets muted. */
export const HEALTH_SNAPSHOT_STALE_AFTER_SECONDS = 3 * HEALTH_POLL_INTERVAL_SECONDS;

/**
 * @typedef {{ ok: boolean, total: number, failed: number, readAt: string }} HealthSnapshot
 */

/**
 * @typedef {(
 *   | { state: "fresh", ok: boolean, total: number, failed: number, readAt: string, ageSeconds: number }
 *   | { state: "stale", ok: boolean, total: number, failed: number, readAt: string, ageSeconds: number }
 *   | { state: "missing" }
 * )} HealthTile
 */

/**
 * Fails to "missing" in every uncertain direction, including a FUTURE timestamp: this is untyped KV JSON,
 * and a cached page presenting a bad value as a verdict would be lying.
 *
 * @param {unknown} snapshot the parsed KV value, or null
 * @param {number} nowMs
 * @returns {HealthTile}
 */
export function healthTile(snapshot, nowMs) {
  if (!snapshot || typeof snapshot !== "object") return { state: "missing" };

  const value = /** @type {Record<string, unknown>} */ (snapshot);
  const { ok, total, failed, readAt } = value;

  if (typeof readAt !== "string") return { state: "missing" };
  if (typeof ok !== "boolean") return { state: "missing" };
  if (!Number.isFinite(total) || !Number.isFinite(failed)) return { state: "missing" };

  const takenMs = Date.parse(readAt);
  if (!Number.isFinite(takenMs)) return { state: "missing" };

  const ageSeconds = Math.floor((nowMs - takenMs) / 1000);
  if (ageSeconds < 0) return { state: "missing" };

  return {
    state: ageSeconds > HEALTH_SNAPSHOT_STALE_AFTER_SECONDS ? "stale" : "fresh",
    ok,
    total: /** @type {number} */ (total),
    failed: /** @type {number} */ (failed),
    readAt,
    ageSeconds,
  };
}

/**
 * No seconds: on a fifteen minute schedule "47 seconds ago" claims a precision the arrangement lacks.
 *
 * @param {number} ageSeconds
 * @returns {string}
 */
export function formatAge(ageSeconds) {
  if (ageSeconds < 60) return "under a minute ago";
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Counts only: per-check details carry an R2 key and shadow table names, and the home page is public.
 *
 * @param {{ ok: boolean, checks: Array<{ ok: boolean }> }} body
 * @param {string} readAt an ISO 8601 timestamp
 * @returns {HealthSnapshot}
 */
export function snapshotFromBody(body, readAt) {
  return {
    ok: body.ok,
    total: body.checks.length,
    failed: body.checks.filter((c) => !c.ok).length,
    readAt,
  };
}
