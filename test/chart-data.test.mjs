/* `:::chart{src}` reads its CSV from the media library (checklist E3): the post records the file it cites, and a src
 * outside the media library refuses the build rather than drawing nothing. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { renderBody } from "../app/lib/content/pipeline.mjs";

const csv = "year,count\n2024,3\n2025,5\n";
const read = async (/** @type {string} */ key) => (key === "sample-counts.csv" ? csv : null);
const chart = (/** @type {string} */ src) =>
  [`:::chart{type="bar" x="year" y="count" title="Counts by year" alt="Counts rose from 3 in 2024 to 5 in 2025." src="${src}"}`, ":::", ""].join("\n");
const draw = (/** @type {string} */ src) =>
  renderBody({ file: "test.md", body: chart(src), resolveImage: async () => null, readChartData: read });

await test("a chart drawn from a media-library CSV records the file as used", async () => {
  const { html, mediaRefs } = await draw("/media/sample-counts.csv");
  assert.match(html, /<svg\b/);
  assert.ok(mediaRefs.some((ref) => ref.key === "sample-counts.csv" && ref.detail === "chart data"));
});

await test("a chart src outside the media library refuses the render", async () => {
  await assert.rejects(draw("https://example.com/counts.csv"));
  await assert.rejects(draw("/media/missing.csv"));
});
