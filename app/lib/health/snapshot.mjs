/**
 * The health SNAPSHOT: what the home page reads instead of running the suite.
 *
 * `.mjs` and dependency-free for the reason `verdicts.mjs` is: the decision
 * "is this snapshot still worth showing" is pure arithmetic over a timestamp,
 * and it is the half that has to be tested. The KV read and write live in
 * `snapshot.server.ts`, which imports this.
 *
 * ## WHY THIS EXISTS
 *
 * `home.tsx` called `runHealthChecks` in its loader. Its docblock argued that
 * this was affordable because it is paid on a cache MISS only, and that
 * argument was wrong about the cost rather than about the frequency.
 *
 * MEASURED 2026-08-26 against a control, unthrottled, six samples each:
 *
 *   `/` origin render        1.07 to 3.48 s   (median ~2.27 s)
 *   `/blog` origin render    0.32 to 0.90 s   (median ~0.55 s)
 *   `/api/health` alone      0.98 to 2.01 s   (median ~1.18 s)
 *
 * The gap between the home page and the control is the health suite, and the
 * endpoint measured alone accounts for essentially all of it. On a throttled
 * mobile profile that arrived as an LCP of 3.8 to 5.2 seconds against 1.4 for
 * every other page. A cache miss is not rare: `s-maxage` is 600 and the entry
 * is per location, so every colo pays it every ten minutes, and the first
 * reader in each window pays all of it.
 *
 * ## THE SNAPSHOT IS A BYPRODUCT, NEVER ITS OWN JOB
 *
 * Nothing runs the suite in order to fill this. `/api/health` runs it because
 * that is what it is for, and writes the verdict on the way out; the scheduled
 * poll every fifteen minutes goes through that same endpoint, so the schedule
 * is what keeps the snapshot fresh without a second timer existing. If the
 * endpoint stops being polled the snapshot ages and the tile says so, which is
 * the honest failure and is strictly better than a page that recomputes.
 *
 * ## WHY AGE IS SHOWN RATHER THAN HIDDEN
 *
 * Unchanged from the old design and it is the part worth keeping: this page is
 * `public, s-maxage=600`, so any verdict rendered into it is already old when
 * it is read. "All 5 checks passed at 14:32 UTC" is true when read at 14:41.
 * "All 5 checks passed" is not. The snapshot adds one more hop of age and the
 * tile now reports the whole of it, measured from the snapshot's own timestamp
 * rather than from the moment the page rendered.
 */

/**
 * The one KV key. A single key rather than a prefix: there is one site and one
 * verdict, and a prefix would invite a second writer.
 */
export const HEALTH_SNAPSHOT_KEY = "health:snapshot";

/**
 * How often the snapshot is expected to be refreshed, in seconds.
 *
 * The SECOND statement of the schedule in `.github/workflows/health.yml`, and
 * it cannot be derived at runtime because a Worker cannot read the workflow
 * file. Rule 17 is satisfied by binding rather than by deletion:
 * `check:invariants` section 25 parses the cron out of that workflow and
 * fails if it no longer means this many seconds.
 */
export const HEALTH_POLL_INTERVAL_SECONDS = 15 * 60;

/**
 * How old a snapshot may be before the tile stops presenting it as a verdict.
 *
 * THREE intervals, not one. A single missed poll is normal: GitHub's scheduled
 * runs are documented as best-effort and are routinely late under load, which
 * `health.yml` already says in its own note (2). Alarming on one late poll
 * would make the tile flap for a reason that has nothing to do with the site's
 * health, which is the noise that gets monitors muted.
 */
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
 * Turns a stored snapshot into what the tile renders.
 *
 * FAILS TO "missing" IN EVERY UNCERTAIN DIRECTION, and the list is long on
 * purpose because this value arrives from KV as untyped JSON: absent, not an
 * object, a timestamp that does not parse, a timestamp in the FUTURE, or a
 * verdict whose counts are not numbers. Presenting any of those as a verdict
 * would be the cached page telling a lie, which is the one thing the old
 * design got right and this must not lose.
 *
 * A future timestamp is refused rather than clamped: it means the writer's
 * clock or the shape is wrong, and neither is a state to render a green tile
 * from.
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
 * The age, for a person, in the shortest form that is still honest.
 *
 * Whole minutes below an hour and whole hours above it. Seconds are omitted
 * deliberately: the snapshot is refreshed on a fifteen minute schedule and a
 * page that reports "read 47 seconds ago" claims a precision the arrangement
 * does not have.
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
 * The snapshot to store, built from a finished run.
 *
 * Takes the SAME shape `publicHealthBody` produces rather than a `HealthRun`,
 * so the endpoint stores exactly what it answered with and the two cannot
 * disagree about how many checks there were. Nothing but counts and a
 * timestamp is stored: the per-check detail strings carry an R2 object key and
 * shadow table names, and the home page is as public as the endpoint is.
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
