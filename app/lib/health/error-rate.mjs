/**
 * WHETHER THIS SITE IS THROWING MORE THAN IT SHOULD, decided from numbers
 * Cloudflare keeps about the Worker rather than from anything the Worker says
 * about itself.
 *
 * The decision half of the watchdog's error-rate check. Pure, dependency-free,
 * never fetches: the same split `repair.mjs` and `alert-state.mjs` use, and for
 * the reason recorded there. A Cron Trigger fires unattended and the only
 * firings whose behavior matters are the ones nobody is watching, so the
 * judgment has to be exercisable by `check:tests`.
 *
 * ## WHY NOT ANALYTICS ENGINE, WHICH IS WHERE THIS WAS ASKED TO LOOK
 *
 * MEASURED 2026-09-07, and it refuted the premise. `ANALYTICS` cannot answer
 * this question at all. `recordTraffic` in `workers/app.ts` returns early on
 * `response.status !== 200` and on any non-HTML content type, and the row it
 * writes is `blobs: [path, refererHost, country, device]`. **There is no status
 * field and no non-200 row in `dustinedwards_traffic`, by construction**, so
 * the dataset holds a count of successful page views and nothing else.
 *
 * Workers Logs cannot answer it either: `invocation_logs` is `false` in
 * `wrangler.jsonc`, which is a deliberate privacy decision, so there is no
 * per-request status record there.
 *
 * What CAN answer it is Cloudflare's own `workersInvocationsAdaptive` GraphQL
 * dataset, which the platform populates independently of anything this Worker
 * writes. It reports the invocation OUTCOME rather than an HTTP status, which
 * is a real difference worth stating: a route that deliberately answers 503,
 * as `/api/health` does for a failing check, counts as `success` here. This
 * check is about the Worker CRASHING, not about routes reporting problems
 * correctly.
 *
 * ## THE THRESHOLD, AND THE THIRTY DAYS THAT CHOSE IT
 *
 * **A RATIO WITH A MINIMUM SAMPLE, NOT AN ABSOLUTE COUNT.** That is the whole
 * shape of this and it came from the traffic measurement rather than from
 * taste. Over the 30 days 2026-08-08 to 2026-09-07, across 1,296 fifteen-minute
 * buckets carrying traffic, the MEDIAN bucket carried 3 invocations (p25 = 1,
 * p75 = 13, p95 = 104, max = 453). At that volume:
 *
 * - An absolute threshold is blind. Twelve errors sits at the p99.9 of the
 *   measured error distribution, and a TOTAL outage in a median bucket produces
 *   three. The rule would sleep through the site being completely down.
 * - A bare ratio is noise. Eight buckets in those 30 days were `1/1`, a 100%
 *   error rate off a single request. A ratio with no floor under the
 *   denominator pages somebody every time one lonely request fails.
 *
 * So both, and the pair was chosen by replaying candidate rules over the real
 * 30 days rather than by picking round numbers:
 *
 *   total >= 20 and ratio >= 0.25   fired 2 times   <- CHOSEN
 *   total >= 20 and ratio >= 0.50   fired 0 times
 *   total >= 10 and ratio >= 0.50   fired 5 times
 *   total >= 10 and ratio >= 0.25   fired 8 times
 *
 * The chosen rule fires on 2 of 1,296 buckets, 0.15% of windows, and BOTH are
 * real: `2026-08-30T15:00Z` at 12/36 and `2026-08-27T00:00Z` at 59/180, each
 * roughly a third of all invocations failing. The 50% variants fire ZERO times
 * in 30 days, which is a rule nobody can prove works. The `total >= 10` variants
 * are dominated by near-empty buckets whose traffic WAS the defect (10/12,
 * 10/10), and those buckets stop existing once it is fixed.
 *
 * **RE-MEASURE THIS AFTER THIRTY DAYS OF CLEAN DATA, AND HERE IS WHY.** The
 * window above contains two defects that were both removed on 2026-09-07: an
 * hourly cron registered on a Worker with no `scheduled()` handler, which threw
 * 24 times a day from 08-23, and `/api/health` throwing from an unguarded
 * Durable Object call, 283 times in 7 days. The residual after those is
 * `loadShed`, which is Cloudflare shedding load rather than a fault in this
 * code. The expected steady state is therefore near zero and this threshold has
 * a lot of headroom; it is deliberately not tightened today, because tightening
 * against a distribution that is about to change would be fitting to noise.
 *
 * ## WHAT COUNTS AS AN ERROR
 *
 * `scriptThrewException` and `loadShed`. NOT `clientDisconnected`, which the
 * dataset itself reports with `errors: 0` and which means a reader closed the
 * tab. Counting it would make a mobile audience look like an outage.
 *
 * @see workers/watchdog.ts the I/O half
 * @see test/error-rate.test.mjs
 */

/** The window the rate is measured over, in minutes. Matches the cron cadence. */
export const ERROR_WINDOW_MINUTES = 15;

/**
 * The minimum invocations in a window before a ratio means anything.
 *
 * Under this, the window is reported OK regardless of the ratio, and that is a
 * deliberate blind spot rather than an oversight: at a median of 3 invocations
 * per window there is no statistic to be had, and the site being unreachable is
 * what the external uptime monitors and `/api/health` are for. This check is
 * the one that answers "is a meaningful share of real traffic failing".
 */
export const ERROR_MIN_SAMPLE = 20;

/** The share of invocations that must fail before this is worth waking somebody. */
export const ERROR_RATIO_THRESHOLD = 0.25;

/**
 * Invocation outcomes that count as this Worker failing.
 *
 * `clientDisconnected` is deliberately absent: the GraphQL dataset reports it
 * with `errors: 0` because it is the READER going away, not the Worker
 * breaking.
 */
export const ERROR_STATUSES = /** @type {const} */ (["scriptThrewException", "loadShed"]);

/**
 * The GraphQL document and variables for one window.
 *
 * BUILT HERE SO IT IS TESTABLE. The Worker does the fetch; what is asked for is
 * a decision like any other and belongs on the pure side, so a change to the
 * filter shows up in `check:tests` rather than only in production.
 *
 * @param {{ accountId: string, scriptName: string, since: string, until: string }} args
 * @returns {{ query: string, variables: Record<string, unknown> }}
 */
export function errorRateQuery({ accountId, scriptName, since, until }) {
  return {
    query:
      "query WorkerErrors($account: String!, $script: String!, $since: Time!, $until: Time!) {" +
      " viewer { accounts(filter: {accountTag: $account}) {" +
      " workersInvocationsAdaptive(limit: 1000, filter: {" +
      " scriptName: $script, datetime_geq: $since, datetime_leq: $until" +
      " }) { sum { requests } dimensions { status } } } } }",
    variables: { account: accountId, script: scriptName, since, until },
  };
}

/**
 * The verdict for one window.
 *
 * TOLERANT OF SHAPE, STRICT ABOUT MEANING, the same stance `failingCheckNames`
 * takes. A body that does not parse into rows yields `ok: false` with a detail
 * saying so, because an error-rate check that cannot read its input has not
 * established that the error rate is fine. That is the fail-closed direction
 * and it is the opposite of what a `?? 0` would have done: summing an
 * unreadable response to zero errors would report perfect health for a
 * completely broken query.
 *
 * @param {unknown} rows the `workersInvocationsAdaptive` array
 * @param {{ minSample?: number, ratioThreshold?: number }} [options]
 * @returns {{ ok: boolean, detail: string, total: number, errors: number, ratio: number }}
 */
export function errorRateVerdict(rows, options = {}) {
  const minSample = options.minSample ?? ERROR_MIN_SAMPLE;
  const ratioThreshold = options.ratioThreshold ?? ERROR_RATIO_THRESHOLD;

  if (!Array.isArray(rows)) {
    return {
      ok: false,
      detail:
        "the invocations query returned no rows array, so the error rate is unknown. " +
        "An unreadable answer is not evidence of health.",
      total: 0,
      errors: 0,
      ratio: 0,
    };
  }

  let total = 0;
  let errors = 0;
  for (const row of rows) {
    const requests = Number(row?.sum?.requests);
    // NaN is skipped rather than coerced: a row whose count did not parse must
    // not silently become zero on either side of the ratio.
    if (!Number.isFinite(requests)) continue;
    total += requests;
    if (ERROR_STATUSES.includes(row?.dimensions?.status)) errors += requests;
  }

  const ratio = total > 0 ? errors / total : 0;
  const percent = (ratio * 100).toFixed(1);

  if (total < minSample) {
    return {
      ok: true,
      detail:
        `${total} invocation(s) in the last ${ERROR_WINDOW_MINUTES} minutes, under the ` +
        `${minSample} needed for a rate to mean anything (${errors} error(s)). Not judged.`,
      total,
      errors,
      ratio,
    };
  }

  if (ratio >= ratioThreshold) {
    return {
      ok: false,
      detail:
        `${errors} of ${total} invocations failed in the last ${ERROR_WINDOW_MINUTES} ` +
        `minutes (${percent}%), at or above the ${(ratioThreshold * 100).toFixed(0)}% ` +
        `threshold. Counted outcomes: ${ERROR_STATUSES.join(", ")}.`,
      total,
      errors,
      ratio,
    };
  }

  return {
    ok: true,
    detail:
      `${errors} of ${total} invocations failed in the last ${ERROR_WINDOW_MINUTES} ` +
      `minutes (${percent}%), under the ${(ratioThreshold * 100).toFixed(0)}% threshold.`,
    total,
    errors,
    ratio,
  };
}
