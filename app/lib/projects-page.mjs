/**
 * Roster metrics for content/projects.json. The public Software pages are markdown in
 * content/pages/, and their search records come from the content-page indexer. check:features
 * computes a derived metric through metricValue, so the roster and the gate share one derivation.
 */

export const PROJECTS_URL = "/software";

/**
 * A derived metric carries no date: a date on a value recomputed every build would be a claim
 * about when a human last looked.
 *
 * @type {Record<string, (inputs: any) => string>}
 */
export const METRIC_DERIVATIONS = {
  "gate-count": (inputs) => String(inputs.stack.gates.length),
};

/**
 * Called by the gate, so the gate never computes the expected value its own way.
 *
 * @param {any} metric
 * @param {{ stack: any, phageYears: any[] }} inputs
 * @returns {string}
 */
export function metricValue(metric, inputs) {
  if (!metric.derived) return metric.value;
  const derive = METRIC_DERIVATIONS[metric.derived];
  if (!derive) {
    throw new Error(
      `content/projects.json names the derivation "${metric.derived}", which ` +
        `METRIC_DERIVATIONS in app/lib/projects-page.mjs does not implement. ` +
        `Known: ${Object.keys(METRIC_DERIVATIONS).join(", ")}.`,
    );
  }
  return derive(inputs);
}
