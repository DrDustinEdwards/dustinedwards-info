/**
 * THE CV'S CHARTS, behind one small interface: the stacked timeline of output per year and the three
 * headline sparklines, drawn by Enarratio (the site's charts package, built on Observable Plot). The
 * route renders them into the page, so they are in the HTML with script off, and /cv/charts.json
 * renders them again for app/enhance/cv.ts when a filter changes. Both get markup back.
 *
 * The timeline is Enarratio's figure in Capsomer's chart frame, styled by Capsomer's token mapping
 * (capsomer/tokens.css) and Enarratio's base.css. With script off each bar is a link to its year's
 * filtered page; its enhancement layer (enarratio/enhance) turns the bars into keyboard filter buttons
 * and reports a selection as an `enarratio:select` event, which app/enhance/cv.ts turns into a year range.
 */

import { frameHtml, noDataHtml } from "capsomer/behavior/chart-frame";
import { dataTableBlock, sparkline } from "enarratio";
import { barChart } from "enarratio/plot";

import { TIMELINE_ID } from "./view.mjs";

type TimelineSeries = { key: string; label: string; values: number[] };

export type TimelineInput = {
  years: number[];
  series: TimelineSeries[];
  /** The year range the filters select, drawn at full strength; the rest is faded. Null: all. */
  selected: [number, number] | null;
  /** The chart's accessible name. */
  label: string;
  /** Where a bar links with script off: the page filtered to that year. */
  hrefForYear: (year: number) => string;
  /** What to say when there is nothing to chart (see timelineEmptyText); the chart is not drawn then. */
  emptyText?: string | null;
  /** Drawing width in CSS pixels; the browser passes its container's, so type is drawn at size. */
  width?: number;
};

export type SparklineInput = {
  years: number[];
  values: number[];
  /** What is counted, for the table's column and name: "Publications". */
  name: string;
  label: string;
};

const TIMELINE = { width: 640, height: 220 };

const TIMELINE_TITLE = "Output by year";

const NOTHING_TO_CHART = "There is nothing to chart for these filters.";

/**
 * One row per counted entry, which is the shape Enarratio counts. The bars outside the selected range
 * are marked with an attribute for the stylesheet to fade, found by the year Enarratio writes on each
 * bar as `data-enarratio-x`. Its `data-enarratio-key` is opaque JSON.
 */
export function timelineSvg(input: TimelineInput): string {
  const { years, series, selected } = input;
  const rows = series.flatMap((s) =>
    years.flatMap((year, i) => Array.from({ length: s.values[i] ?? 0 }, () => ({ year, type: s.label }))),
  );
  // Enarratio throws "data is empty" for no rows, which would be a 500 for a filter that selects nothing chartable;
  // the frame's no-data state (data-state="nodata") stands in its place, which app/enhance/cv.ts looks for.
  if (rows.length === 0) return noDataHtml(TIMELINE_TITLE, input.emptyText ?? NOTHING_TO_CHART);
  const width = Math.max(280, Math.round(input.width ?? TIMELINE.width));
  const markup = barChart({
    id: TIMELINE_ID,
    title: TIMELINE_TITLE,
    data: rows,
    x: "year",
    series: "type",
    filterBy: "x",
    href: (year) => input.hrefForYear(Number(year)),
    // Every year where there is room, every other year on a laptop, every fifth on a phone.
    maxXTicks: width < 520 ? 5 : width < 1000 ? 11 : years.length,
    xDomain: years,
    seriesDomain: series.map((s) => s.label),
    xLabel: null,
    yLabel: "Entries",
    alt: input.label,
    width,
    height: TIMELINE.height,
  });
  return frameHtml(fadeOutside(markup, selected));
}

/**
 * A range wider than one year fades the bars outside it. One year is Enarratio's own filter, shown by
 * the enhancement with setFilter, so the two dimmings never stack.
 */
function fadeOutside(markup: string, selected: [number, number] | null) {
  if (!selected || selected[0] === selected[1]) return markup;
  return markup.replace(/data-enarratio-x="(\d{4})"/g, (match, year: string) =>
    Number(year) < selected[0] || Number(year) > selected[1] ? `data-cv-out="" ${match}` : match,
  );
}

/**
 * A line of per-year values beside its count (a chart in a sentence, so no frame), with its numbers by
 * year behind "Show data".
 */
export function sparklineSvg(input: SparklineInput): string {
  const svg = sparkline({ values: input.values, alt: input.label, area: true, inline: true });
  const table = { columns: ["Year", input.name], rows: input.years.map((year, i) => [String(year), String(input.values[i] ?? 0)]) };
  return svg + dataTableBlock(table, `${input.name} per year`);
}
