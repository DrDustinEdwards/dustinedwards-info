// Reads Cloudflare's workersInvocationsAdaptive: the ANALYTICS dataset records only 200 HTML views and
// invocation logs are off. It reports the outcome, not the HTTP status, so a deliberate 503 is success.

/** The window the rate is measured over, in minutes. Matches the cron cadence. */
export const ERROR_WINDOW_MINUTES = 15;

/**
 * Measured over 30 days: the median 15-minute bucket held 3 invocations, so a bare ratio pages on one
 * failed request. Below this the window is not judged; total >= 20 at ratio >= 0.25 fired on 2 of
 * 1,296 buckets, both real outages, where the 0.50 variants never fired.
 */
export const ERROR_MIN_SAMPLE = 20;

const ERROR_RATIO_THRESHOLD = 0.25;

/** Not clientDisconnected: the dataset reports it with errors: 0, since it is the reader leaving. */
const ERROR_STATUSES = /** @type {const} */ (["scriptThrewException", "loadShed"]);

/**
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
 * An unparseable body is ok: false: summing an unreadable answer to zero would report perfect health.
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
    // NaN is skipped, not coerced: an unparsed count must not become zero on either side of the ratio.
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
