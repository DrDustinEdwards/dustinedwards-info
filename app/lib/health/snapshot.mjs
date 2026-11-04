// /health's verdict, written only by the watchdog Worker after each read of /health, so the tile's AGE is
// the watchdog's liveness: nothing else may stamp this key, /health included (UptimeRobot, Capsid's watcher
// and Capsomer's network board read it every few minutes and would keep a dead watchdog looking alive).
// Measured: running the suite in a page loader cost about 1.2 s, so the colophon reads this instead.

import { healthChecks } from "./rows.mjs";

/** One key, not a prefix: a prefix would invite a second writer. */
export const HEALTH_SNAPSHOT_KEY = "health:snapshot";

/** Restates the watchdog cron in wrangler.watchdog.jsonc, which a Worker cannot read. Change both together. */
export const HEALTH_POLL_INTERVAL_SECONDS = 15 * 60;

/** Three intervals: a Cron Trigger is best effort, and a tile that flaps on one missed poll gets muted. */
export const HEALTH_SNAPSHOT_STALE_AFTER_SECONDS = 3 * HEALTH_POLL_INTERVAL_SECONDS;

/**
 * @typedef {{ name: string, status: "pass" | "warn" | "fail" }} SnapshotCheck
 * @typedef {{ ok: boolean, total: number, failed: number, readAt: string, checks: SnapshotCheck[] }} HealthSnapshot
 */

/**
 * @typedef {(
 *   | { state: "fresh", ok: boolean, total: number, failed: number, readAt: string, ageSeconds: number, checks: SnapshotCheck[] }
 *   | { state: "stale", ok: boolean, total: number, failed: number, readAt: string, ageSeconds: number, checks: SnapshotCheck[] }
 *   | { state: "missing" }
 *   | { state: "unreadable" }
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
  const { ok, total, failed, readAt, checks } = value;

  if (typeof readAt !== "string") return { state: "missing" };
  if (!Array.isArray(checks) || checks.length !== total) return { state: "missing" };
  const named = checks.filter(
    (c) => c && typeof c.name === "string" && (c.status === "pass" || c.status === "warn" || c.status === "fail"),
  );
  if (named.length !== checks.length) return { state: "missing" };
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
    checks: named.map((c) => ({ name: c.name, status: c.status })),
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
 * Each check's name and status, as public as /health itself, and no detail. Null for a body that is not a
 * /health answer, so a refusal or an error page is never stored as a verdict.
 *
 * @param {unknown} body the parsed /health body
 * @param {string} readAt an ISO 8601 timestamp
 * @returns {HealthSnapshot | null}
 */
export function snapshotFromBody(body, readAt) {
  const checks = healthChecks(body);
  if (checks.length === 0) return null;
  return {
    ok: checks.every((c) => c.ok),
    total: checks.length,
    failed: checks.filter((c) => !c.ok).length,
    readAt,
    checks: checks.map((c) => ({ name: c.name, status: c.status })),
  };
}
