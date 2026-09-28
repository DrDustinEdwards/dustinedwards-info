/**
 * THE CV'S CHARTS, behind one small interface: the stacked timeline of output per year and the three
 * headline sparklines. The route renders them on the server (so they are in the HTML with script off)
 * and app/enhance/cv.ts renders them again in the browser when a filter changes. Both sides call these
 * two functions with a `Document` of their own (linkedom on the server, the page's in the browser) and
 * get SVG markup back.
 *
 * TEMPORARY IMPLEMENTATION: Observable Plot, the renderer the post charts use (app/lib/content/chart.mjs).
 * The CV's charts are to be built on Abscissa, the site's own charts package, once it is published;
 * this file is the only one that changes then, and the Plot code here goes.
 */

import * as Plot from "@observablehq/plot";

export type TimelineSeries = { key: string; label: string; token: string; values: number[] };

export type TimelineInput = {
  years: number[];
  series: TimelineSeries[];
  /** The year range the filters select, drawn at full strength; the rest is faded. Null: all. */
  selected: [number, number] | null;
  /** Where clicking a year's bar goes: the page with that year as the range. */
  hrefForYear: (year: number) => string;
  /** The chart's accessible name. */
  label: string;
  /** Drawing width in CSS pixels; the browser passes its container's, so type is drawn at size. */
  width?: number;
};

export type SparklineInput = {
  years: number[];
  values: number[];
  selected: [number, number] | null;
  label: string;
};

const TIMELINE = { width: 640, height: 190, top: 10, right: 6, bottom: 24, left: 30 };
const SPARK = { width: 120, height: 32 };

const SVG_NS = "http://www.w3.org/2000/svg";

function inRange(selected: [number, number] | null, year: number) {
  return !selected || (year >= selected[0] && year <= selected[1]);
}

/** Plot's inline <style> carries color literals, and its group labels are unreachable inside the chart. */
function tidy(svg: Element) {
  svg.querySelector("style")?.remove();
  for (const group of svg.querySelectorAll("[aria-label]")) {
    group.setAttribute("data-plot-mark", group.getAttribute("aria-label") ?? "");
    group.removeAttribute("aria-label");
    group.setAttribute("aria-hidden", "true");
  }
  svg.removeAttribute("class");
}

function describeYear(year: number, series: TimelineSeries[], index: number) {
  const parts = series
    .map((s) => ({ label: s.label.toLowerCase(), n: s.values[index] ?? 0 }))
    .filter((p) => p.n > 0)
    .map((p) => `${p.n} ${p.n === 1 ? p.label.replace(/s$/, "") : p.label}`);
  return `${year}: ${parts.length ? parts.join(", ") : "nothing listed"}`;
}

/**
 * Stacked bars, one per year, each wrapped in a link that sets the year range: a plain link, so the
 * click works with script off, and the enhancement takes it over for an instant filter.
 */
export function timelineSvg(doc: Document, input: TimelineInput): string {
  const { years, series, selected } = input;
  const points = series.flatMap((s) =>
    years.map((year, i) => ({ year, key: s.key, value: s.values[i] ?? 0 })),
  );
  const totals = years.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const top = Math.max(1, ...totals);
  const width = Math.max(280, Math.round(input.width ?? TIMELINE.width));
  // Every fifth year where there is room, every tenth on a phone.
  const every = width < 480 ? 10 : 5;

  const svg = Plot.plot({
    document: doc,
    width,
    height: TIMELINE.height,
    marginTop: TIMELINE.top,
    marginRight: TIMELINE.right,
    marginBottom: TIMELINE.bottom,
    marginLeft: TIMELINE.left,
    style: { fontSize: "12px" },
    x: {
      type: "band",
      domain: years,
      padding: 0.18,
      label: null,
      tickSize: 0,
      ticks: years.filter((y) => y % every === 0),
      tickFormat: (y: number) => String(y),
    },
    y: { domain: [0, top], label: null, grid: true, ticks: Math.min(top, 4), tickFormat: "d" },
    color: { domain: series.map((s) => s.key), range: series.map((s) => s.token) },
    marks: [
      Plot.barY(points, {
        x: "year",
        y: "value",
        fill: "key",
        order: series.map((s) => s.key),
        fillOpacity: (d: { year: number }) => (inRange(selected, d.year) ? 1 : 0.28),
      }),
      Plot.ruleY([0]),
    ],
  }) as unknown as SVGSVGElement & { scale: (name: string) => { apply: (v: unknown) => number; bandwidth?: number; step?: number } };

  tidy(svg);

  const x = svg.scale("x");
  const step = x.step ?? x.bandwidth ?? 0;
  const bandwidth = x.bandwidth ?? step;
  const hits = doc.createElementNS(SVG_NS, "g");
  hits.setAttribute("class", "cv-chart-hits");
  years.forEach((year, i) => {
    if ((totals[i] ?? 0) === 0) return;
    const link = doc.createElementNS(SVG_NS, "a");
    link.setAttribute("href", input.hrefForYear(year));
    link.setAttribute("data-cv-year", String(year));
    const current = selected !== null && selected[0] === year && selected[1] === year;
    link.setAttribute(
      "aria-label",
      `${describeYear(year, series, i)}. ${current ? "Show every year" : `Show ${year} only`}`,
    );
    const rect = doc.createElementNS(SVG_NS, "rect");
    const left = x.apply(year) - (step - bandwidth) / 2;
    rect.setAttribute("x", String(Math.round(left * 100) / 100));
    rect.setAttribute("y", String(TIMELINE.top));
    rect.setAttribute("width", String(Math.round(step * 100) / 100));
    rect.setAttribute("height", String(TIMELINE.height - TIMELINE.top - TIMELINE.bottom));
    rect.setAttribute("fill", "transparent");
    link.appendChild(rect);
    hits.appendChild(link);
  });
  svg.appendChild(hits);

  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", input.label);
  svg.setAttribute("class", "cv-timeline-svg");
  return svg.outerHTML;
}

/** A line of per-year values with the selected range shaded; the number beside it carries the value. */
export function sparklineSvg(doc: Document, input: SparklineInput): string {
  const points = input.years.map((year, i) => ({ year, value: input.values[i] ?? 0 }));
  const top = Math.max(1, ...input.values);
  const first = input.years[0] ?? 0;
  const last = input.years[input.years.length - 1] ?? first;
  const marks = [];
  if (input.selected) {
    marks.push(
      Plot.rectX([{ x1: input.selected[0] - 0.5, x2: input.selected[1] + 0.5 }], {
        x1: "x1",
        x2: "x2",
        fill: "var(--tint-brand)",
      }),
    );
  }
  marks.push(
    Plot.areaY(points, { x: "year", y: "value", fill: "var(--brand)", fillOpacity: 0.12, curve: "monotone-x" }),
    Plot.lineY(points, { x: "year", y: "value", stroke: "var(--brand)", strokeWidth: 1.5, curve: "monotone-x" }),
  );
  const svg = Plot.plot({
    document: doc,
    width: SPARK.width,
    height: SPARK.height,
    margin: 2,
    axis: null,
    x: { domain: [first - 0.5, last + 0.5] },
    y: { domain: [0, top] },
    marks,
  }) as unknown as SVGSVGElement;
  tidy(svg);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", input.label);
  svg.setAttribute("class", "cv-spark-svg");
  return svg.outerHTML;
}
