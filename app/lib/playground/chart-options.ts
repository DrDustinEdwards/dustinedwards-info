import type { RootContent } from "hast";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

import playgroundData from "../../../content/playground.json";
import { CHART_TYPES } from "~/lib/content/chart-types.mjs";
import { errorMessage } from "~/lib/error-message.mjs";

const DATASETS = playgroundData.datasets;
type DatasetKey = keyof typeof DATASETS;

const MARKS = CHART_TYPES;
type MarkKey = string;

const serialize = (children: RootContent[]) =>
  unified().use(rehypeStringify).stringify({ type: "root", children });

/** The chart demo's share of the playground loader: an enum mark and dataset through the chart renderer. */
export async function chartOptionsDemo(params: URLSearchParams) {
  const markParam = params.get("mark");
  const dataParam = params.get("data");
  const mark: MarkKey = markParam && MARKS.includes(markParam) ? markParam : "bar";
  const dataset: DatasetKey =
    dataParam && Object.hasOwn(DATASETS, dataParam)
      ? (dataParam as DatasetKey)
      : "limiter";
  const chartError =
    (markParam && markParam !== mark ? `Unknown mark type "${markParam}", showing ${mark}. ` : "") +
    (dataParam && dataParam !== dataset ? `Unknown dataset "${dataParam}", showing ${dataset}.` : "");

  const d = DATASETS[dataset];
  let chartHtml = "";
  let chartRenderError: string | null = null;
  try {
    const { buildChartModel, renderChartHast } = await import("~/lib/content/chart.mjs");
    // `renderChartHast` returns the figure's children, so the wrapper is this route's: without
    // `.chart-figure` no chart rules apply.
    const model = buildChartModel(
      {
        type: mark,
        x: d.x,
        y: d.y,
        ...(d.labels ? { labels: d.labels } : {}),
        title: d.title,
        alt: `${mark} chart. ${d.alt}`,
      },
      d.csv,
    );
    chartHtml = serialize(renderChartHast(model, []));
  } catch (error) {
    chartRenderError = errorMessage(error);
  }

  return {
    chartHtml,
    chartRenderError,
    chartError: chartError.trim(),
    mark,
    dataset,
    datasetNote: d.note,
    datasetLabel: d.label,
  };
}
