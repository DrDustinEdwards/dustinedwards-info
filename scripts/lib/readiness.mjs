/**
 * @typedef {{ name?: string, ok?: boolean, expected?: number, present?: number }} HealthCheckRow
 */

/**
 * @typedef {(
 *   | { ok: true, checks: HealthCheckRow[], deferredFailing?: string[] }
 *   | { ok: false, why: string, remedy: string, checks: HealthCheckRow[] }
 * )} ReadinessVerdict
 */

const NOTHING_SYNCED =
  "The deploy landed and is serving; this refuses BEFORE the sync, so D1 and the " +
  "indexes still describe the previous build. NOTHING WAS SYNCED.";

/**
 * Fails closed in every uncertain direction: the endpoint can be rate limited, replaced by a 404
 * page, or fronted by a proxy, and "could not tell" must never read as healthy.
 *
 * @param {number} status
 * @param {string} text
 * @param {string} path
 * @param {string[]} deferred
 * @returns {ReadinessVerdict}
 */
export function readinessVerdict(status, text, path = "/api/health", deferred = []) {
  if (status === 429) {
    return {
      ok: false,
      why: `${path} answered 429: this address is rate limited`,
      remedy: `That is the limiter working, not the site failing. Wait a minute and run ship again. ${NOTHING_SYNCED}`,
      checks: [],
    };
  }

  /** @type {unknown} */
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return {
      ok: false,
      why: `${path} answered ${status} with a body that is not JSON`,
      remedy: `A health endpoint that cannot be parsed cannot be trusted. ${NOTHING_SYNCED} First 200 characters: ${text.slice(0, 200)}`,
      checks: [],
    };
  }

  if (!body || typeof body !== "object") {
    return {
      ok: false,
      why: `${path} answered ${status} with JSON that is not an object`,
      remedy: `${NOTHING_SYNCED} Body: ${text.slice(0, 200)}`,
      checks: [],
    };
  }

  const value = /** @type {{ ok?: unknown, checks?: unknown }} */ (body);
  const checks = Array.isArray(value.checks)
    ? /** @type {HealthCheckRow[]} */ (value.checks)
    : [];

  // Any JSON on the origin can carry an `ok` field by accident; only a health report has checks.
  if (checks.length === 0) {
    return {
      ok: false,
      why: `${path} answered ${status} with no checks in its body`,
      remedy: `${NOTHING_SYNCED} Body: ${text.slice(0, 200)}`,
      checks: [],
    };
  }

  const deferredNames = Array.isArray(deferred) ? deferred.filter((n) => typeof n === "string") : [];
  const failed = checks.filter((c) => !c.ok).map((c) => c.name ?? "(unnamed)");
  const gatingFailed = failed.filter((name) => !deferredNames.includes(name));

  // Not the endpoint's own `ok`: that is false when any check fails, deferred ones included.
  if (gatingFailed.length > 0) {
    return {
      ok: false,
      why: `${path} reports the site is not healthy (${status}), failing: ${gatingFailed.join(", ")}`,
      remedy: `Repair the failing check, or run the sync by hand if it is the repair. ${NOTHING_SYNCED}`,
      checks,
    };
  }

  if (value.ok !== true && failed.length === 0) {
    return {
      ok: false,
      why: `${path} reports the site is not healthy (${status}), failing: (ok is not true but no check is marked failing)`,
      remedy: `Repair the failing check, or run the sync by hand if it is the repair. ${NOTHING_SYNCED}`,
      checks,
    };
  }

  return { ok: true, checks, deferredFailing: failed.filter((n) => deferredNames.includes(n)) };
}

/**
 * @param {HealthCheckRow[]} checks
 * @returns {string[]}
 */
export function readinessLines(checks) {
  return checks.map((check) => {
    const counts =
      typeof check.expected === "number" && typeof check.present === "number"
        ? `  expected ${check.expected}, present ${check.present}`
        : "";
    return `  ${check.ok ? "ok  " : "FAIL"}  ${check.name ?? "(unnamed)"}${counts}`;
  });
}

/**
 * Read after the repair steps: a failing deferred check here means the repair ran and did not work.
 * The detail string is absent because the public body drops it on purpose (row counts, unauthenticated).
 *
 * @param {HealthCheckRow[]} checks
 * @param {Record<string, string>} deferred
 * @param {string} [path]
 * @returns {{ misses: string[], converged: string[] }}
 */
export function deferredMisses(checks, deferred, path = "/api/health") {
  /** @type {string[]} */
  const misses = [];
  /** @type {string[]} */
  const converged = [];

  for (const [name, repairedBy] of Object.entries(deferred ?? {})) {
    const row = checks.find((check) => check.name === name);
    if (!row) {
      misses.push(`${path} reported no ${name} check, so nothing was proven`);
      continue;
    }
    if (row.ok === true) {
      converged.push(name);
      continue;
    }
    const counts =
      typeof row.expected === "number" && typeof row.present === "number"
        ? ` (expected ${row.expected}, present ${row.present})`
        : "";
    misses.push(
      `${name} is STILL failing after ${repairedBy}${counts}. The endpoint withholds ` +
        `its detail on purpose; the why is in Workers Logs under alert=health-check-failed`,
    );
  }

  return { misses, converged };
}

/**
 * Readiness gates only on checks whose repair is not a later ship step: refusing before its own
 * remedy is a deadlock. Each value names the repairing step.
 */
/** @type {Record<string, string>} */
export const DEFERRED_CHECKS = {
  "content-drift": "the D1 sync",
  "ask-index-drift": "the Ask converge",
  "media-index-drift": "the media converge",
};
