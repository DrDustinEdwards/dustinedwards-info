// :::chart draws through Enarratio: every type renders, and each keeps its accessible name and data table.

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildChartModel, renderChartHast } from "../app/lib/content/chart.mjs";
import { CHART_TYPES } from "../app/lib/content/chart-types.mjs";
import { toHtml } from "hast-util-to-html";

const CSV = "run,a,b\n1,3,4\n2,5,2\n3,6,9";

/** The directive's own figure node, rendered the way rehypeModelMarker does. */
function render(attrs, csv, caption = []) {
  const model = buildChartModel(attrs, csv);
  const figure = { type: "element", tagName: "figure", properties: { className: ["chart-figure"] }, children: [] };
  figure.children = renderChartHast(model, caption, figure);
  return toHtml(figure);
}

for (const type of CHART_TYPES) {
  for (const y of ["a", "a,b"]) {
    test(`${type} with y=${y} renders through Enarratio with its name and data table`, () => {
      const html = render(
        { type, x: "run", y, labels: y === "a" ? undefined : "Alpha,Beta", alt: "What it shows." },
        CSV,
      );
      assert.match(html, /^<figure class="chart-figure enarratio"/);
      assert.match(html, /data-enarratio="/);
      assert.match(html, /<svg[^>]* role="img"/);
      assert.match(html, /aria-label="What it shows\."/);
      assert.match(html, /<details class="enarratio-data"><summary>Data table<\/summary><table>/);
      // Every x value is in the table: as the row header, or as a cell for a scatter's numbered points.
      const table = html.slice(html.indexOf("<table>"));
      for (const x of ["1", "2", "3"]) assert.match(table, new RegExp(`<t[hd][^>]*>${x}</t[hd]>`));
      assert.doesNotMatch(html, /var\(--chart-/);
    });
  }
}

test("the author's caption sits above the data table, once", () => {
  const html = render(
    { type: "bar", x: "run", y: "a", alt: "Alt." },
    CSV,
    [{ type: "text", value: "Measured twice." }],
  );
  assert.equal(html.match(/<figcaption/g)?.length, 1);
  assert.ok(html.indexOf("Measured twice.") < html.indexOf("<details"));
});

test("a title renders above the chart", () => {
  const html = render({ type: "line", x: "run", y: "a", title: "Runs", alt: "Alt." }, CSV);
  assert.match(html, /<p class="enarratio-title">Runs<\/p>/);
});

test("validation still refuses bad attributes and data", () => {
  const ok = { type: "bar", x: "run", y: "a", alt: "Alt." };
  assert.throws(() => buildChartModel({ ...ok, alt: "" }, CSV), /requires an alt/);
  assert.throws(() => buildChartModel({ ...ok, type: "pie" }, CSV), /not one of/);
  assert.throws(() => buildChartModel({ ...ok, y: "zzz" }, CSV), /not in the data/);
  assert.throws(() => buildChartModel(ok, "run,a\n1,x"), /not a number/);
  assert.throws(() => buildChartModel({ ...ok, type: "dot" }, "run,a\none,1\ntwo,2"), /numeric x/);
});
