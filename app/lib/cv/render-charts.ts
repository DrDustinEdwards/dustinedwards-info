import { sparklineSvg, timelineSvg } from "./charts";
import {
  sparkData,
  sparkLabel,
  timelineData,
  timelineLabel,
  yearHref,
  type CvState,
  type Facts,
} from "./view.mjs";

export type CvCharts = { timeline: string; papers: string; grants: string; students: string };

/**
 * Every chart on the CV for one filter state, as SVG markup. The route calls it with a linkedom
 * document and app/enhance/cv.ts with the page's, so a shared URL and a live filter draw the same.
 */
export function renderCvCharts(
  doc: Document,
  all: Facts[],
  state: CvState,
  path: string,
  options: { width?: number } = {},
): CvCharts {
  const timeline = timelineData(all, state);
  const spark = sparkData(all, state);
  const line = (what: string, values: number[]) =>
    sparklineSvg(doc, {
      years: spark.years,
      values,
      selected: spark.selected,
      label: sparkLabel(what, spark.years, values),
    });
  return {
    timeline: timelineSvg(doc, {
      years: timeline.years,
      series: timeline.series.map((s) => ({ key: s.key, label: s.label, token: s.token, values: s.values })),
      selected: timeline.selected,
      hrefForYear: (year) => `${path}${yearHref(state, year)}`,
      label: timelineLabel(timeline),
      width: options.width,
    }),
    papers: line("publications", spark.papers),
    grants: line("grants", spark.grants),
    students: line("students in one-year cohorts", spark.students),
  };
}
