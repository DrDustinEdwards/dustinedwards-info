// Must run inside a Worker. Plot renders into linkedom because domino uses `with` (illegal in a
// strict-mode ESM bundle) and Vega compiles expressions from strings, which workerd refuses.

import * as Plot from "@observablehq/plot";
import { parseHTML } from "linkedom";

import { CHART_TYPES } from "./chart-types.mjs";
import { h, text } from "./hast.mjs";

export { CHART_TYPES };

// Tokens, never hexes: the custom property resolves per theme in the browser, so one render serves
// both themes. The sixth (extended) slot is safe because multi-series charts are directly labelled.
const CHART_SERIES_TOKENS = [
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
 * @param {string} text
 * @returns {{ columns: string[], rows: string[][] }}
 */
function parseChartCsv(text) {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "");

  const header = lines[0];
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
 * The y columns and the label each series is drawn and keyed under, refused unless every column
 * exists, every multi-series label is present and unique, and the palette has a color for each.
 *
 * @param {Record<string, string>} attrs
 * @param {string[]} columns
 * @returns {{ yColumns: string[], labels: string[] }}
 */
function resolveSeries(attrs, columns) {
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
  return { yColumns, labels };
}

/**
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

  // Required even with the data table: the table is the long description, not the accessible name.
  const alt = (attrs.alt ?? "").trim();
  if (!alt) throw new Error(`:::chart "${attrs.title ?? type}" requires an alt attribute`);

  const { columns, rows } = parseChartCsv(csv);

  const x = attrs.x;
  if (!x) throw new Error(":::chart requires an x attribute naming a data column");
  if (!columns.includes(x)) {
    throw new Error(`:::chart x column "${x}" is not in the data (have ${columns.join(", ")})`);
  }

  const { yColumns, labels } = resolveSeries(attrs, columns);

  const xIndex = columns.indexOf(x);

  // Numeric x gets a linear scale; left as strings, Plot spaces points evenly and misplots
  // any x that is not evenly sampled.
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
      // Thrown, not defaulted: a point with an invented series name would render as a real series.
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
    // Plot sorts band domains by default, which would reorder the author's rows.
    xDomain: [...new Set(xValues)].map(asX),
  };
}

/**
 * Direct labels, never a legend, so hue is never the only channel.
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
    // The inner axis prints each series name against its own bar: that is the direct label.
    return [
      Plot.barY(points, { fx: "x", x: "series", y: "value", fill: "series" }),
      Plot.ruleY([0]),
    ];
  }

  const endLabel = (/** @type {any} */ options) =>
    Plot.text(points, Plot.selectLast(options));

  const base = { x: "x", y: "value", z: "series", text: "series", textAnchor: "start", dx: 6 };

  if (type === "area") {
    // Stacked, so the label must use the stacked y or it lands at the wrong height.
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
 * Puts the author's column names back: Plot would label the reshaped axes x and value. Multi-series
 * gets no y label because its columns measure different things.
 *
 * @param {ReturnType<typeof buildChartModel>} model
 */
function scalesFor(model) {
  const multi = model.labels.length > 1;
  const y = { label: multi ? null : model.yColumns[0] };

  if (model.type === "bar") {
    return multi
      ? { fx: { domain: model.xDomain, label: model.x }, x: { label: null }, y }
      : { x: { domain: model.xDomain, label: model.x }, y };
  }
  return { x: { label: model.x }, y };
}

/**
 * A tree walk rather than allowDangerousHtml, which would open raw HTML in every post. localName
 * because linkedom upper-cases tagName, which breaks SVG's camelCase element names.
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

/**
 * Printed from the original CSV cells, not parsed numbers, to avoid a float round-trip. Must sit
 * OUTSIDE the role=img element: its descendants are presentational and hidden from assistive tech.
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
 * @param {ReturnType<typeof buildChartModel>} model
 * @param {any[]} captionChildren hast for an author-written caption, may be empty
 */
export function renderChartHast(model, captionChildren) {
  const { document } = parseHTML("<!DOCTYPE html><html><body></body></html>");

  // Cast: Plot's return type is written against the DOM lib, which this project does not load.
  const svg = /** @type {any} */ (Plot.plot({
    document,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    marginLeft: 56,
    marginBottom: 44,
    // A faceted bar chart's facet labels and axis label collide at the top without the extra room.
    marginTop: model.type === "bar" && model.labels.length > 1 ? 44 : 20,
    marginRight: model.labels.length > 1 && model.type !== "bar" ? 96 : 24,
    style: { fontSize: "12px" },
    ...scalesFor(model),
    color: { range: CHART_SERIES_TOKENS.slice(0, model.labels.length) },
    marks: marksFor(model),
  }));

  // Plot's per-chart <style> carries --plot-background: white, a color literal; the equivalent rules
  // live once in app.css under .chart-figure.
  svg.querySelector("style")?.remove();

  // The accessible name goes on the SVG, not the figure, or the caption and table become presentational.
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", model.alt);

  /** @type {any[]} */
  const children = [];
  if (model.title) {
    // A <p>, not a heading: rehypeCollectToc would put chart titles in the table of contents.
    children.push(h("p", { className: ["chart-title"] }, [text(model.title)]));
  }
  children.push(domToHast(svg));
  if (captionChildren.length > 0) {
    children.push(h("figcaption", {}, captionChildren));
  }
  children.push(dataTable(model));
  return children;
}
