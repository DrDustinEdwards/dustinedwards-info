import { countsByYearHtml, sparkHtml } from "capsomer/behavior/chart-presets";
import { describeSeries } from "capsomer/behavior/chart-frame";
import { listText } from "capsomer/behavior/hooks";

import {
  sparkData,
  timelineData,
  timelineEmptyText,
  TIMELINE_ID,
  yearHref,
  type CvState,
  type Facts,
} from "./view.mjs";

export type CvCharts = { timeline: string; papers: string; grants: string; students: string };

const capitalize = (text: string) => `${text[0]?.toUpperCase() ?? ""}${text.slice(1)}`;

/**
 * Every chart on the CV for one filter state, as markup. The route and app/enhance/cv.ts both call
 * it, so a shared URL and a live filter draw the same. The timeline is Capsomer's counts-by-year
 * chart: each bar links to its year's filtered page with script off, and Enarratio's enhancement
 * layer turns the bars into filter buttons (app/enhance/cv.ts).
 */
export function renderCvCharts(
  all: Facts[],
  state: CvState,
  options: { width?: number } = {},
): CvCharts {
  const timeline = timelineData(all, state);
  const spark = sparkData(all, state);
  const line = (name: string, what: string, values: number[]) =>
    sparkHtml({
      x: spark.years,
      values,
      name,
      alt: describeSeries({
        what: `${capitalize(what)} per year`,
        x: spark.years,
        values,
        empty: `No ${what} per year match the filters.`,
      }),
    });
  const names = listText(timeline.series.map((s) => s.label.toLowerCase()));
  return {
    timeline: countsByYearHtml({
      id: TIMELINE_ID,
      title: "Output by year",
      years: timeline.years,
      series: timeline.series,
      alt: describeSeries({
        what: `${capitalize(names)} per year`,
        x: timeline.years,
        values: timeline.series.map((s) => s.values),
        empty: `${capitalize(names)} per year: none match the filters.`,
      }),
      selected: timeline.selected,
      hrefForYear: (year) => `/cv${yearHref(state, year) || "?"}`,
      yLabel: "Entries",
      emptyText: timelineEmptyText(timeline) ?? "There is nothing to chart for these filters.",
      ...(options.width === undefined ? {} : { width: options.width }),
    }),
    papers: line("Publications", "publications", spark.papers),
    grants: line("Grants", "grants", spark.grants),
    students: line("Students", "students in one-year cohorts", spark.students),
  };
}
