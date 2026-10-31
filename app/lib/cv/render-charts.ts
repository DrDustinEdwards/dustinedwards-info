import { sparklineSvg, timelineSvg } from "./charts";
import {
  sparkData,
  sparkLabel,
  timelineData,
  timelineEmptyText,
  timelineLabel,
  yearHref,
  type CvState,
  type Facts,
} from "./view.mjs";

export type CvCharts = { timeline: string; papers: string; grants: string; students: string };

/**
 * Every chart on the CV for one filter state, as markup. The route and app/enhance/cv.ts both call
 * it, so a shared URL and a live filter draw the same.
 */
export function renderCvCharts(all: Facts[], state: CvState, options: { width?: number } = {}): CvCharts {
  const timeline = timelineData(all, state);
  const spark = sparkData(all, state);
  const line = (name: string, what: string, values: number[]) =>
    sparklineSvg({ years: spark.years, values, name, label: sparkLabel(what, spark.years, values) });
  return {
    timeline: timelineSvg({
      years: timeline.years,
      series: timeline.series.map((s) => ({ key: s.key, label: s.label, values: s.values })),
      selected: timeline.selected,
      label: timelineLabel(timeline),
      emptyText: timelineEmptyText(timeline),
      hrefForYear: (year) => `/cv${yearHref(state, year) || "?"}`,
      width: options.width,
    }),
    papers: line("Publications", "publications", spark.papers),
    grants: line("Grants", "grants", spark.grants),
    students: line("Students", "students in one-year cohorts", spark.students),
  };
}
