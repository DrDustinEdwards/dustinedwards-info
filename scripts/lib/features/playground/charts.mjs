// The chart options demo: every dataset in every mark type through the real chart renderer.

import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import {
  CHART_TYPES,
  buildChartModel,
  renderChartHast,
} from "../../../../app/lib/content/chart.mjs";

/** Serialized the way the content pipeline does, so this sees the artifact's HTML. */
const serializeHast = (/** @type {any[]} */ children) =>
  unified()
    .use(rehypeStringify)
    .stringify(/** @type {any} */ ({ type: "root", children }));

/** `line` and `area` both emit `<path>`, so the mark group label is asserted too. */
/** @type {Record<string, string>} */
const MARK_ELEMENT = { bar: "rect", line: "path", dot: "circle", area: "path" };

/** @param {import("./index.mjs").PlaygroundContext} p */
export function checkCharts({ ok, datasets }) {
  for (const [key, dataset] of Object.entries(datasets)) {
    for (const type of CHART_TYPES) {
      let svg = "";
      try {
        const model = buildChartModel(
          {
            type,
            x: dataset.x,
            y: dataset.y,
            ...(dataset.labels ? { labels: dataset.labels } : {}),
            title: dataset.title,
            alt: `${type} chart. ${dataset.alt}`,
          },
          dataset.csv,
        );
        svg = serializeHast(renderChartHast(model, []));
      } catch (error) {
        ok(
          `chart options: ${key}/${type} renders without throwing`,
          false,
          String(error instanceof Error ? error.message : error),
        );
        continue;
      }

      ok(`chart options: ${key}/${type} emits an svg`, /<svg[\s>]/.test(svg));
      ok(
        `chart options: ${key}/${type} labels the mark group "${type}"`,
        new RegExp(`<g[^>]*data-plot-mark="${type}"`).test(svg),
        "the requested mark type did not reach the renderer",
      );
      ok(
        `chart options: ${key}/${type} names nothing inside the svg but the svg itself`,
        !/<g[^>]*aria-label=/.test(svg),
        "an aria-label on a <g> has no role to belong to, and role=\"img\" hides it anyway",
      );
      const element = MARK_ELEMENT[type];
      ok(
        `chart options: ${key}/${type} draws a <${element}>`,
        new RegExp(`<${element}[\\s>]`).test(svg),
        `no <${element}> in the output`,
      );
      ok(
        `chart options: ${key}/${type} carries role="img" on the svg`,
        /<svg[^>]*role="img"/.test(svg),
        "the accessible role belongs on the svg, never on the figure",
      );
      ok(
        `chart options: ${key}/${type} carries a non-empty accessible name`,
        /<svg[^>]*aria-label="[^"]+"/.test(svg),
      );
      ok(
        `chart options: ${key}/${type} emits the data table`,
        /class="chart-data"/.test(svg) && /<table/.test(svg),
        "the text equivalent is mandatory for every chart",
      );
      // check:contrast never reads this SVG.
      ok(
        `chart options: ${key}/${type} contains no hex color literal`,
        !/#[0-9a-fA-F]{6}\b/.test(svg),
        `found ${(svg.match(/#[0-9a-fA-F]{6}\b/g) ?? []).join(", ")}`,
      );
      ok(
        `chart options: ${key}/${type} colors from chart tokens`,
        /var\(--chart-/.test(svg),
        "series colors must be custom properties so one render serves both themes",
      );
    }
  }
}
