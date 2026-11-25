/** The CV's chart inputs: the timeline's series per year and the headline sparklines, over the same filter state as the list. */

import { listText } from "capsomer/behavior/hooks";
import { CHART_SERIES, matches, range } from "./view.mjs";

/** @typedef {import("./view.mjs").Facts} Facts */
/** @typedef {import("./view.mjs").CvState} CvState */

/**
 * The year axis every chart shares: the first charted year in the whole CV to the last. Fixed across
 * filters, so bars do not slide sideways when a filter changes.
 *
 * @param {Facts[]} all
 */
function chartYears(all) {
  const charted = new Set(CHART_SERIES.map(([id]) => /** @type {string} */ (id)));
  const years = all
    .filter((f) => f.year !== null && (charted.has(f.type) || (f.type === "mentoring" && f.cohort)))
    .map((f) => /** @type {number} */ (f.year));
  return range(Math.min(...years), Math.max(...years));
}

/**
 * The stacked timeline's input: output per start year by type, for entries matching every filter but
 * the year range, which the chart marks instead.
 *
 * @param {Facts[]} all
 * @param {CvState} state
 */
export function timelineData(all, state) {
  const years = chartYears(all);
  const shown = all.filter((f) => matches(f, state, { ignoreYears: true }));
  const series = CHART_SERIES.map(([key, label]) => ({
    key,
    label,
    values: years.map((y) => shown.filter((f) => f.type === key && f.year === y).length),
  }));
  return { years, series, selected: selectedRange(state, years), entries: shown.length };
}

/**
 * What the timeline says in place of a chart when the filters leave it nothing to draw: no entry matches at
 * all, or some do but none is a charted type (publications, grants, talks, awards), as with courses or
 * service. Null when there is something to draw. Enarratio refuses to chart no data, so the caller draws this
 * sentence instead and never calls it.
 *
 * @param {ReturnType<typeof timelineData>} data
 * @returns {string | null}
 */
export function timelineEmptyText(data) {
  if (data.series.some((s) => s.values.some((n) => n > 0))) return null;
  if (data.entries === 0) return "No entries match these filters, so there is nothing to chart.";
  const names = listText(data.series.map((s) => s.label.toLowerCase()));
  return `The timeline charts ${names}, and none of the entries these filters select is one of those.`;
}

/**
 * @param {CvState} state
 * @param {number[]} years
 * @returns {[number, number] | null}
 */
function selectedRange(state, years) {
  if (state.from === null && state.to === null) return null;
  const first = years[0] ?? 0;
  const last = years[years.length - 1] ?? 0;
  return [state.from ?? first, state.to ?? last];
}

/**
 * Per-year series for the three headline sparklines. Students count only the one-cohort lines: a
 * count spread over a decade (19 lab students, 2015 to 2026) has no honest per-year split.
 *
 * @param {Facts[]} all
 * @param {CvState} state
 */
export function sparkData(all, state) {
  const years = chartYears(all);
  const shown = all.filter((f) => matches(f, state, { ignoreYears: true }));
  const per = (/** @type {(f: Facts) => number} */ value) =>
    years.map((y) => shown.filter((f) => f.year === y).reduce((sum, f) => sum + value(f), 0));
  return {
    years,
    selected: selectedRange(state, years),
    papers: per((f) => (f.paper ? 1 : 0)),
    grants: per((f) => (f.type === "grant" ? 1 : 0)),
    students: per((f) => (f.type === "mentoring" && f.cohort ? (f.students ?? 0) : 0)),
  };
}
