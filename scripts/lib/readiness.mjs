/**
 * Ship's readiness verdict: does the health endpoint say this deploy is healthy.
 *
 * BOUNDARY: the decision only, pure, so `node:test` can drive every branch and a refusal path is
 * not one that has never been executed. The reading itself is ship's.
 */

/**
 * @typedef {{ name?: string, ok?: boolean, expected?: number, present?: number }} HealthCheckRow
 */

/**
 * @typedef {(
 *   | { ok: true, checks: HealthCheckRow[], deferredFailing?: string[] }
 *   | { ok: false, why: string, remedy: string, checks: HealthCheckRow[] }
 * )} ReadinessVerdict
 */

/** The remedy every refusal here shares. Stated once. */
const NOTHING_SYNCED =
  "The deploy landed and is serving; this refuses BEFORE the sync, so D1 and the " +
  "indexes still describe the previous build. NOTHING WAS SYNCED.";

/**
 * Reads a readiness verdict out of a response.
 *
 * FAILS CLOSED IN EVERY UNCERTAIN DIRECTION, and the list is long because this arrives over a
 * network from an endpoint that can be rate limited, replaced by a 404 page, or fronted by a
 * proxy: "I could not tell" and "it is healthy" must never take the same branch on the last step
 * before a production write. DEFERRED CHECKS name the ones this step REPORTS but does not gate
 * on, because asserting them here blocks the very step that repairs them: a ship once refused at
 * readiness on a drift the later sync converges. A deferred check is still printed.
 *
 * @param {number} status the HTTP status
 * @param {string} text the raw body
 * @param {string} path the path asked, for the messages
 * @param {string[]} deferred check names this step reports but does not gate on
 * @returns {ReadinessVerdict}
 */
export function readinessVerdict(status, text, path = "/api/health", deferred = []) {
  /*
   * A rate-limited answer IS CALLED OUT SEPARATELY: "rate limited" and "unhealthy" need completely
   * different repairs, and collapsing them sends somebody to look for a drifted index that is fine.
   */
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

  /*
   * NO CHECKS IS A REFUSAL: any JSON document on the origin can carry a verdict field by accident,
   * and only a health report carries a checks array. Requiring it is what stops this passing on the
   * wrong URL.
   */
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

  /*
   * A GATING CHECK DECIDES THIS STEP, and the endpoint's own verdict field is deliberately NOT the
   * subject: it reports failure when ANY check fails, deferred ones included.
   */
  if (gatingFailed.length > 0) {
    return {
      ok: false,
      why: `${path} reports the site is not healthy (${status}), failing: ${gatingFailed.join(", ")}`,
      remedy: `Repair the failing check, or run the sync by hand if it is the repair. ${NOTHING_SYNCED}`,
      checks,
    };
  }

  /*
   * The verdict is false and nothing is marked failing: an endpoint disagreeing with itself, which
   * cannot be trusted on the last step before a write.
   */
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
 * One printable line per check, so a refusal and a pass show the same table. The counts print only
 * when the endpoint sent them, which it does for a FAILING drift check and nothing else.
 *
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
 * The verdict on the DEFERRED checks, read after their repair steps have run. A function rather
 * than inline, so the plant that proves a body passes readiness and then fails HERE by name is
 * writable at all.
 *
 * THE MEANING INVERTS BETWEEN THE TWO SITES, which is the whole design: at readiness a failing
 * deferred check means the index is behind, the ordinary state of a corpus just committed; here it
 * means THE REPAIR RAN AND DID NOT WORK. A MISSING ROW IS A MISS, NOT A PASS. THE DETAIL STRING
 * IS NOT IN THESE MESSAGES because it is not on the wire: the public body drops it DELIBERATELY,
 * those strings carrying row counts on an unauthenticated endpoint.
 *
 * @param {HealthCheckRow[]} checks every row the endpoint returned
 * @param {Record<string, string>} deferred check name to the step that repairs it
 * @param {string} [path] for the messages
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
 * CHECKS THE READINESS STEP REPORTS BUT DOES NOT GATE ON, each with the step that repairs it.
 * THE RULE: readiness gates only on checks whose repair is NOT a later ship step, since a step
 * that refuses before its own remedy is a deadlock. Two checks forced it in turn, the second
 * costing two deploys that both landed, both refused here, and both synced nothing. A VALUE PER
 * KEY, naming the step, which is the test to apply before adding another.
 */
/** @type {Record<string, string>} */
export const DEFERRED_CHECKS = {
  "content-drift": "the D1 sync",
  "ask-index-drift": "the Ask converge",
  "media-index-drift": "the media converge",
};
