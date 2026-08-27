/**
 * Ship's readiness verdict: does `/api/health` say this deploy is healthy.
 *
 * Extracted for the reason `ci-status.mjs` and `ask-converge.mjs` are: the
 * decision is pure, `node:test` can drive every branch of it, and the
 * alternative is a branch that can only be exercised by running a real deploy.
 * A refusal path that has never been executed is not a refusal path.
 *
 * ## WHAT THIS IS FOR
 *
 * Ship polled `/colophon` for five 200s and never asked `/api/health`. Those
 * are different questions. Five 200s prove the Worker booted, the route table
 * resolves, and the rollout finished. They are blind to every invariant this
 * site actually watches: a drifted Ask index, a media index that lost its
 * rows, D1 out of step with the repository, an FTS index that is empty beside
 * a full content table. All four of those serve `/colophon` with a 200, and
 * all four are what `/api/health` reports.
 *
 * The scheduled workflow has read that endpoint every fifteen minutes and
 * alerted on it, so the deploy path was the only path that shipped without
 * consulting the instrument the site trusts the rest of the time.
 *
 * ## THE VERDICT COMES FROM THE BODY, NOT THE STATUS LINE
 *
 * They agree today: the endpoint answers 200 only when every check passed.
 * Reading the status alone would make this step depend on that agreement,
 * which lives in a different file and is not this module's to assume. The
 * endpoint's own docblock says the STATUS is the contract for the workflow,
 * which reads it with `curl --fail`; this reads a parsed body because it can,
 * and because naming the failing checks is most of the value of refusing.
 */

/**
 * @typedef {{ name?: string, ok?: boolean, expected?: number, present?: number }} HealthCheckRow
 */

/**
 * @typedef {(
 *   | { ok: true, checks: HealthCheckRow[] }
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
 * FAILS CLOSED IN EVERY UNCERTAIN DIRECTION, and the list is long because this
 * value arrives over a network from an endpoint that can be rate limited, can
 * be replaced by a 404 page, and can be behind an interception proxy. Every
 * shape that is not recognisably a health report refuses, because "I could not
 * tell" and "it is healthy" must never take the same branch on the last step
 * before a production write.
 *
 * @param {number} status the HTTP status
 * @param {string} text the raw body
 * @param {string} path the path asked, for the messages
 * @returns {ReadinessVerdict}
 */
export function readinessVerdict(status, text, path = "/api/health") {
  /*
   * 429 IS CALLED OUT SEPARATELY. Since the per-IP limit landed on the health
   * endpoint, a burst from this address can refuse the check, and "rate
   * limited" and "unhealthy" need completely different repairs. Collapsing
   * them would send somebody to look for a drifted index that is fine.
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
   * NO CHECKS IS A REFUSAL, and this is the case the plant points at. A body
   * carrying no verdicts is not a health report, so reading `ok` off it would
   * be trusting one field of a shape nothing recognises. Any JSON document on
   * the origin can carry `ok: true` by accident; only a health report carries
   * a checks array, and requiring it is what stops this step passing on the
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

  if (value.ok !== true) {
    const failed = checks.filter((c) => !c.ok).map((c) => c.name ?? "(unnamed)");
    return {
      ok: false,
      why:
        `${path} reports the site is not healthy (${status}), failing: ` +
        `${failed.join(", ") || "(ok is not true but no check is marked failing)"}`,
      remedy: `Repair the failing check, or run the sync by hand if it is the repair. ${NOTHING_SYNCED}`,
      checks,
    };
  }

  return { ok: true, checks };
}

/**
 * One printable line per check, so a refusal and a pass show the same table.
 *
 * The counts print only when the endpoint sent them, which it does for a
 * FAILING drift check and nothing else; that pair is the whole triage.
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
