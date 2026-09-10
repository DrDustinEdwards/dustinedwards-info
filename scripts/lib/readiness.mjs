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
 * FAILS CLOSED IN EVERY UNCERTAIN DIRECTION, and the list is long because this
 * value arrives over a network from an endpoint that can be rate limited, can
 * be replaced by a 404 page, and can be behind an interception proxy. Every
 * shape that is not recognisably a health report refuses, because "I could not
 * tell" and "it is healthy" must never take the same branch on the last step
 * before a production write.
 *
 * ## DEFERRED CHECKS, RULING 48
 *
 * `deferred` names checks that this step REPORTS but does not gate on, because
 * asserting them here would block the very step that repairs them. The case
 * that forced it, 2026-09-09: a ship refused at readiness on `content-drift`
 * (expected 16, present 14), and the D1 sync three steps later is exactly what
 * converges that drift. The deploy had already landed, so the refusal left
 * production serving a build whose index nothing had updated, and the only way
 * forward was to run the sync by hand.
 *
 * A deferred check is not ignored: it is printed with everything else, and ship
 * asserts it AFTER the sync, where a failure means the sync ran and did not
 * work, which is a real defect rather than a stale index. The other checks
 * still gate here, so a bad deploy still cannot reach a production write.
 *
 * @param {number} status the HTTP status
 * @param {string} text the raw body
 * @param {string} path the path asked, for the messages
 * @param {string[]} deferred check names this step reports but does not gate on
 * @returns {ReadinessVerdict}
 */
export function readinessVerdict(status, text, path = "/api/health", deferred = []) {
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

  const deferredNames = Array.isArray(deferred) ? deferred.filter((n) => typeof n === "string") : [];
  const failed = checks.filter((c) => !c.ok).map((c) => c.name ?? "(unnamed)");
  const gatingFailed = failed.filter((name) => !deferredNames.includes(name));

  /*
   * A GATING CHECK DECIDES THIS STEP. `value.ok` is deliberately NOT the
   * subject: the endpoint reports `ok: false` when ANY check fails, deferred
   * ones included, so reading it here would reinstate the refusal ruling 48
   * removed. The deferred names are subtracted from the failures first, and
   * what is left is what this step is entitled to refuse on.
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
   * `ok` IS FALSE AND NOTHING IS MARKED FAILING: an endpoint disagreeing with
   * itself. Refused, because the two halves of a health report that do not
   * agree cannot both be trusted, and this is the last step before a write.
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

/**
 * The verdict on the DEFERRED checks, read after their repair steps have run.
 *
 * ## WHY THIS IS HERE AND NOT INLINE IN SHIP
 *
 * The same reason `readinessVerdict` is: the decision is pure, `node:test` can
 * drive every branch of it, and the alternative is a branch that can only be
 * exercised by running a real deploy against a broken site. Ruling 56 asks for
 * a plant proving a body with `ask-index-drift` failing passes readiness and
 * then fails HERE by name, and that plant is only writable if this is a
 * function rather than forty lines in the middle of a script.
 *
 * ## THE MEANING INVERTS BETWEEN THE TWO SITES, which is the whole design
 *
 * At readiness a failing deferred check means "the index is behind", the
 * ordinary state of a corpus that has just been committed. Here, after its
 * repair step has run, the same row means THE REPAIR RAN AND DID NOT WORK.
 *
 * ## A MISSING ROW IS A MISS, NOT A PASS
 *
 * An endpoint that stopped reporting a check proves nothing about it, and
 * reading that as success is the "assertion that can pass by reading nothing"
 * this repo has already been bitten by. It is named rather than skipped.
 *
 * ## WHY THE `detail` STRING IS NOT IN THESE MESSAGES
 *
 * It is not on the wire. `publicHealthBody` rebuilds every row as name, ok and
 * the two counts, and drops each `detail` DELIBERATELY: they carry row counts
 * and an R2 object key, and `/api/health` is unauthenticated. That decision is
 * stated in `app/routes/api.health.ts`'s own docblock. The counts are what the
 * wire carries and they are the triage for a drift check; the pointer to
 * Workers Logs is where the rest lives.
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
 * CHECKS THE READINESS STEP REPORTS BUT DOES NOT GATE ON, each with the step
 * that repairs it. Ruling 48, generalised by ruling 56.
 *
 * THE RULE: readiness gates only on checks whose repair is NOT a later ship
 * step. A step that refuses before its own remedy is a deadlock, and the
 * remedy is the thing the refusal prevents from running.
 *
 * `content-drift` was the first instance and forced ruling 48. On 2026-09-09 a
 * ship deployed, refused at readiness on `expected 16, present 14`, and left
 * production serving a build whose index nothing had updated. The drift was
 * real and pre-existing, which is precisely the case the sync exists for.
 *
 * `ask-index-drift` was the second, and it cost two deploys on 2026-09-10.
 * Versions 8b4f0ae4 and ad7cb0fb both landed, both refused here, and both
 * synced nothing; the drift cleared itself within minutes each time. Its
 * repair is the Ask converge, which runs after readiness, so it was the same
 * deadlock wearing a different check's name. `media-index-drift` is the same
 * shape and is included before it costs a third.
 *
 * A VALUE PER KEY, naming the step, because the whole point of deferring is
 * that something later fixes it. A check with nothing to name does not belong
 * here, which is the test to apply before adding a fourth.
 *
 * STILL GATING, deliberately: `media-backup-drift` and `fts-equality`. Neither
 * has a ship step that repairs it, so under the rule above they gate. See the
 * note at the assertion step about `fts-equality`, which is the closest call.
 */
/** @type {Record<string, string>} */
export const DEFERRED_CHECKS = {
  "content-drift": "the D1 sync",
  "ask-index-drift": "the Ask converge",
  "media-index-drift": "the media converge",
};
