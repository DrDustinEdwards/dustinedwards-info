/**
 * Chart rendering for the `:::chart` directive.
 *
 * Pure, and imported by `pipeline.mjs`, so the two writers (the Node build and
 * the Worker's save/preview path) render charts through exactly one definition.
 * Nothing here touches `node:fs`, `node:path` or the network, for the same
 * reason the rest of the pipeline does not: it has to run inside a Worker.
 *
 * Observable Plot renders into a linkedom document. That pairing was chosen by
 * measurement rather than preference (ruling: Capsid `dustinedwards/chart-stack.md`):
 * domino is disqualified because `domino/lib/sloppy.js` uses `with` statements,
 * which are illegal in a strict-mode ESM bundle and fail the Workers build; and
 * Vega-Lite is disqualified because vega-runtime compiles expressions from
 * strings, which workerd refuses with "Code generation from strings disallowed".
 *
 * Two properties this module exists to guarantee:
 *
 *   1. **Deterministic.** The SVG is a pure function of the markdown, so
 *      `check:content`'s double-render pass compares it like everything else,
 *      and the two writers' render hashes agree. Plot's default
 *      class name is a fixed constant and standard marks generate no ids, so
 *      there is nothing random to suppress. `check:content` renders the
 *      corpus twice and fails if the two differ.
 *   2. **Accessible by construction.** A chart that cannot be named or tabulated
 *      fails the build instead of failing an audit later.
 */

import * as Plot from "@observablehq/plot";
import { parseHTML } from "linkedom";

import { CHART_TYPES } from "./chart-types.mjs";

export { CHART_TYPES };

/**
 * Series colors, in the ratified ladder order from `dustinedwards/design-tokens.md`.
 *
 * Tokens only, never hexes. One render has to serve both themes: the custom
 * property passes into the SVG verbatim and resolves per theme in the browser,
 * so there is no second render and nothing to flash. No hex literal may reach
 * chart output.
 *
 * The sixth (rust) is the EXTENDED slot. design-tokens.md calls core-5 the
 * unlabeled-safe default and requires direct labels beyond it; this directive
 * requires direct labels for every multi-series chart anyway, so the extended
 * slot is safe to use here.
 */
export const CHART_SERIES_TOKENS = [
  "var(--chart-cadet)",
  "var(--chart-purple)",
  "var(--chart-claret)",
  "var(--chart-sage)",
  "var(--chart-gold)",
  "var(--chart-rust)",
];

const DEFAULT_WIDTH = 700;
const DEFAULT_HEIGHT = 360;

/**
 * Parses the directive's inline CSV.
 *
 * Hand-written rather than pulled from a dependency: the grammar needed here is
 * one page of RFC 4180 (quoted fields, doubled quotes, no embedded newlines) and
 * the Worker bundle already carries Plot.
 *
 * @param {string} text
 * @returns {{ columns: string[], rows: string[][] }}
 */
function parseChartCsv(text) {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "");

  const header = lines[0];
  // The header is guarded by VALUE, not by the line count. Same refusal on
  // empty input, and it is what makes the parse below take a string.
  if (header === undefined) throw new Error("chart data is empty");

  const parseLine = (/** @type {string} */ line) => {
    /** @type {string[]} */
    const out = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        out.push(field.trim());
        field = "";
      } else {
        field += ch;
      }
    }
    out.push(field.trim());
    return out;
  };

  const columns = parseLine(header);
  const rows = lines.slice(1).map(parseLine);

  if (rows.length === 0) throw new Error("chart data has a header but no rows");

  columns.forEach((name, i) => {
    if (name === "") throw new Error(`chart data column ${i + 1} has an empty name`);
  });
  if (new Set(columns).size !== columns.length) {
    throw new Error("chart data has duplicate column names");
  }
  rows.forEach((row, i) => {
    if (row.length !== columns.length) {
      throw new Error(
        `chart data row ${i + 1} has ${row.length} fields, expected ${columns.length}`,
      );
    }
  });

  return { columns, rows };
}

/**
 * Validates the directive's attributes and data into a render-ready model.
 *
 * Every failure here is a build failure that names the problem. That is the
 * whole point of the directive: an unnamed chart, or one whose series cannot be
 * told apart without color vision, must not be publishable.
 *
 * @param {Record<string, string>} attrs
 * @param {string} csv
 */
export function buildChartModel(attrs, csv) {
  const type = attrs.type;
  if (!type) throw new Error(":::chart requires a type attribute");
  if (!CHART_TYPES.includes(type)) {
    throw new Error(
      `:::chart type "${type}" is not one of ${CHART_TYPES.join(", ")}`,
    );
  }

  // WCAG 2.2 AA, and the same rule :::figure enforces for images. A chart with
  // no accessible name is an unlabelled graphic; the data table below is the
  // long description, not the name.
  const alt = (attrs.alt ?? "").trim();
  if (!alt) throw new Error(`:::chart "${attrs.title ?? type}" requires an alt attribute`);

  const { columns, rows } = parseChartCsv(csv);

  const x = attrs.x;
  if (!x) throw new Error(":::chart requires an x attribute naming a data column");
  if (!columns.includes(x)) {
    throw new Error(`:::chart x column "${x}" is not in the data (have ${columns.join(", ")})`);
  }

  if (!attrs.y) throw new Error(":::chart requires a y attribute naming a data column");
  const yColumns = attrs.y.split(",").map((s) => s.trim()).filter(Boolean);
  if (yColumns.length === 0) throw new Error(":::chart y attribute is empty");
  for (const column of yColumns) {
    if (!columns.includes(column)) {
      throw new Error(
        `:::chart y column "${column}" is not in the data (have ${columns.join(", ")})`,
      );
    }
  }

  // Series labels. design-tokens.md rule 3: hue is never the sole channel, and
  // multi-series charts label their series directly. Wide-format headers supply
  // the labels by default; `labels=` overrides them for display.
  let labels = yColumns;
  if (attrs.labels) {
    labels = attrs.labels.split(",").map((s) => s.trim());
    if (labels.length !== yColumns.length) {
      throw new Error(
        `:::chart has ${yColumns.length} series but ${labels.length} labels`,
      );
    }
  }
  if (yColumns.length > 1) {
    labels.forEach((label, i) => {
      if (!label) {
        throw new Error(
          `:::chart series ${i + 1} ("${yColumns[i]}") has an empty label; multi-series charts must label every series`,
        );
      }
    });
    if (new Set(labels).size !== labels.length) {
      throw new Error(":::chart series labels must be unique");
    }
  }
  if (yColumns.length > CHART_SERIES_TOKENS.length) {
    throw new Error(
      `:::chart has ${yColumns.length} series but the ratified palette has ${CHART_SERIES_TOKENS.length} chart colors`,
    );
  }

  const xIndex = columns.indexOf(x);

  // A column of numbers gets a numeric domain, so line, area and dot land on a
  // LINEAR scale rather than an ordinal point scale. Left as strings, Plot warns
  // ("strings that appear to be numbers") and spaces the points evenly, which
  // silently misplots any x that is not evenly sampled.
  /*
   * THE X CELL IS READ ONCE PER ROW AND REFUSED IF ABSENT.
   *
   * It used to be read twice, here and again inside the points loop, and both
   * reads were indexes into a row that a short CSV line makes shorter than the
   * header. A missing x cell is a data error worth naming by row, not a silent
   * `undefined` that Plot would place somewhere.
   */
  const prepared = rows.map((row, i) => {
    const xValue = row[xIndex];
    if (xValue === undefined) {
      throw new Error(`:::chart row ${i + 1} has no "${x}" cell`);
    }
    return { row, xValue };
  });
  const xValues = prepared.map((p) => p.xValue);
  const xIsNumeric = xValues.every((v) => v !== "" && Number.isFinite(Number(v)));
  const asX = (/** @type {string} */ v) => (xIsNumeric ? Number(v) : v);

  /** @type {Array<{ x: string | number, series: string, value: number }>} */
  const points = [];
  prepared.forEach(({ row, xValue }, rowIndex) => {
    yColumns.forEach((column, seriesIndex) => {
      const raw = row[columns.indexOf(column)];
      const value = Number(raw);
      if (raw === undefined || raw === "" || !Number.isFinite(value)) {
        throw new Error(
          `:::chart row ${rowIndex + 1} column "${column}" is "${raw}", which is not a number`,
        );
      }
      const series = labels[seriesIndex];
      // Unreachable: `labels` is derived from `yColumns`, which is what this
      // loop walks. Thrown rather than defaulted, because a point with an
      // invented series name would render as a real series.
      if (series === undefined) {
        throw new Error(`:::chart has no label for series ${seriesIndex + 1}`);
      }
      points.push({ x: asX(xValue), series, value });
    });
  });

  return {
    type,
    alt,
    title: (attrs.title ?? "").trim(),
    x,
    yColumns,
    labels,
    columns,
    rows,
    points,
    // Band-scale domains are sorted by Plot by default, which silently reorders
    // an author's rows. Locking the domain to first-appearance order keeps the
    // chart in the order the markdown reads.
    xDomain: [...new Set(xValues)].map(asX),
  };
}

/**
 * Builds the Plot marks for a model.
 *
 * Multi-series charts get DIRECT labels rather than a legend: the label sits on
 * the series it names, so the reader never has to match a color to a key. That
 * is design-tokens.md rule 3, and it is why no legend is emitted anywhere here.
 *
 * @param {ReturnType<typeof buildChartModel>} model
 */
function marksFor(model) {
  const { type, points, labels } = model;
  const multi = labels.length > 1;
  const single = CHART_SERIES_TOKENS[0];

  if (!multi) {
    const options = { x: "x", y: "value" };
    if (type === "bar") return [Plot.barY(points, { ...options, fill: single })];
    if (type === "area") return [Plot.areaY(points, { ...options, fill: single })];
    if (type === "dot") return [Plot.dot(points, { ...options, fill: single })];
    return [Plot.line(points, { ...options, stroke: single })];
  }

  if (type === "bar") {
    // Grouped bars, faceted by the x value. The inner axis prints the series
    // name against its own bar, which IS the direct label for this mark type.
    return [
      Plot.barY(points, { fx: "x", x: "series", y: "value", fill: "series" }),
      Plot.ruleY([0]),
    ];
  }

  // The label rides the series it names, at its last point.
  const endLabel = (/** @type {any} */ options) =>
    Plot.text(points, Plot.selectLast(options));

  const base = { x: "x", y: "value", z: "series", text: "series", textAnchor: "start", dx: 6 };

  if (type === "area") {
    // Stacked, so the label has to be positioned on the STACKED y, not the raw
    // value, or every label lands at the wrong height.
    return [
      Plot.areaY(points, { x: "x", y: "value", fill: "series" }),
      endLabel(Plot.stackY(base)),
    ];
  }
  if (type === "dot") {
    return [
      Plot.dot(points, { x: "x", y: "value", fill: "series" }),
      endLabel({ ...base, fill: "series" }),
    ];
  }
  return [
    Plot.line(points, { x: "x", y: "value", stroke: "series" }),
    endLabel({ ...base, fill: "series" }),
  ];
}

/**
 * Axis scales, including the axis LABELS.
 *
 * The model reshapes every chart into `{x, series, value}` so one set of marks
 * serves both the single and multi-series case. Those internal names must not
 * reach the reader: left to itself Plot labels the axes "x" and "value", which
 * is the shape of the data structure rather than the name of the thing measured.
 * The labels are put back to the author's own column names here.
 *
 * A multi-series chart gets NO y label, because its series are directly labeled
 * and the columns they came from measure different things; inventing one name
 * for all of them would be a claim the data does not make.
 *
 * @param {ReturnType<typeof buildChartModel>} model
 */
function scalesFor(model) {
  const multi = model.labels.length > 1;
  const y = { label: multi ? null : model.yColumns[0] };

  if (model.type === "bar") {
    return multi
      // Grouped bars: the facet carries the x column, and the inner axis prints
      // the series names, which are the direct labels.
      ? { fx: { domain: model.xDomain, label: model.x }, x: { label: null }, y }
      : { x: { domain: model.xDomain, label: model.x }, y };
  }
  return { x: { label: model.x }, y };
}

/**
 * Converts a linkedom element into hast.
 *
 * The alternative was `allowDangerousHtml` on remark-rehype plus rehype-stringify,
 * which would have opened raw HTML in EVERY post to get one SVG through. A tree
 * walk keeps the chart a real node, so rehype-stringify escapes text the same
 * way it does for the rest of the document and no post gains an HTML escape
 * hatch it did not have before.
 *
 * `localName` rather than `tagName`: linkedom upper-cases `tagName`, which would
 * emit `<SVG>` and would break SVG's camelCase element names.
 *
 * @param {any} node
 * @returns {any}
 */
function domToHast(node) {
  if (node.nodeType === 3) return { type: "text", value: node.data };
  /** @type {Record<string, string>} */
  const properties = {};
  for (const attribute of node.attributes) properties[attribute.name] = attribute.value;
  return {
    type: "element",
    tagName: node.localName,
    properties,
    children: [...node.childNodes]
      .filter((/** @type {any} */ child) => child.nodeType === 1 || child.nodeType === 3)
      .map(domToHast),
  };
}

/** @param {string} tagName @param {Record<string, any>} properties @param {any[]} children */
const h = (tagName, properties, children) => ({
  type: "element",
  tagName,
  properties,
  children,
});

/** @param {string} value */
const text = (value) => ({ type: "text", value });

/**
 * The equivalent data table, generated from the same inline data the chart drew.
 *
 * Generated rather than authored so it cannot drift from the chart, and printed
 * from the ORIGINAL CSV cells rather than the parsed numbers so it reproduces
 * what the author wrote instead of a float round-trip.
 *
 * It sits OUTSIDE the element carrying `role="img"`. That is load-bearing:
 * `role="img"` makes its descendants presentational, and the WAI-ARIA spec says
 * user agents SHOULD NOT expose them, so a table nested inside the named element
 * would be generated and then hidden from the readers it exists for.
 *
 * @param {ReturnType<typeof buildChartModel>} model
 */
function dataTable(model) {
  return h("details", { className: ["chart-data"] }, [
    h("summary", {}, [text("Data table")]),
    h("table", {}, [
      h("thead", {}, [
        h("tr", {}, model.columns.map((column) => h("th", { scope: "col" }, [text(column)]))),
      ]),
      h(
        "tbody",
        {},
        model.rows.map((row) =>
          h("tr", {}, row.map((cell, i) =>
            i === 0
              ? h("th", { scope: "row" }, [text(cell)])
              : h("td", {}, [text(cell)]),
          )),
        ),
      ),
    ]),
  ]);
}

/**
 * Renders a validated model into the hast children of the figure.
 *
 * @param {ReturnType<typeof buildChartModel>} model
 * @param {any[]} captionChildren hast for an author-written caption, may be empty
 */
export function renderChartHast(model, captionChildren) {
  const { document } = parseHTML("<!DOCTYPE html><html><body></body></html>");

  // Plot's return type is `(SVGSVGElement | HTMLElement) & Plot`, typed against
  // the DOM lib this project does not load, so the element API is reached
  // through a cast rather than by widening the whole module's types.
  const svg = /** @type {any} */ (Plot.plot({
    document,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    marginLeft: 56,
    marginBottom: 44,
    // A faceted bar chart prints the facet's tick labels AND the facet axis
    // label along the top, and they collide at the middle facet. The extra room
    // lifts the axis label clear of the group names.
    marginTop: model.type === "bar" && model.labels.length > 1 ? 44 : 20,
    marginRight: model.labels.length > 1 && model.type !== "bar" ? 96 : 24,
    style: { fontSize: "12px" },
    ...scalesFor(model),
    color: { range: CHART_SERIES_TOKENS.slice(0, model.labels.length) },
    marks: marksFor(model),
  }));

  // Plot injects a <style> block per chart carrying `--plot-background: white`,
  // the one color literal in its output and the only thing standing between
  // this pipeline and a tokens-only rule. The equivalent rules live once in
  // app.css under .chart-figure instead, which also stops N charts on a page
  // shipping N copies of the same stylesheet.
  svg.querySelector("style")?.remove();

  // The accessible name goes on the SVG, NOT on the figure. See dataTable():
  // naming the figure would make the caption and the table presentational.
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", model.alt);

  /** @type {any[]} */
  const children = [];
  if (model.title) {
    // A <p>, deliberately not a heading: rehypeCollectToc scans h2 and h3, so a
    // heading here would inject chart titles into the post's table of contents.
    children.push(h("p", { className: ["chart-title"] }, [text(model.title)]));
  }
  children.push(domToHast(svg));
  if (captionChildren.length > 0) {
    children.push(h("figcaption", {}, captionChildren));
  }
  children.push(dataTable(model));
  return children;
}
