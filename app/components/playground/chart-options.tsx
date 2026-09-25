import { Form } from "react-router";

import playgroundData from "../../../content/playground.json";
import { DemoHeader, Problem } from "~/components/playground/demo-parts";
import { CHART_TYPES } from "~/lib/content/chart-types.mjs";
import type { chartOptionsDemo } from "~/lib/playground/chart-options";
import { PLAYGROUND_URL, demoAnchor } from "~/lib/playground-page.mjs";

const DATASETS = playgroundData.datasets;
type DatasetKey = keyof typeof DATASETS;

const MARKS = CHART_TYPES;

type Props = Awaited<ReturnType<typeof chartOptionsDemo>> & {
  /** The other demos' state as hidden fields, so submitting this form keeps their results. */
  carry: React.ReactNode;
};

export function ChartOptionsDemo({ chartHtml, chartRenderError, chartError, mark, dataset, datasetNote, datasetLabel, carry }: Props) {
  return (
    <section id={demoAnchor("chart-options")} className="playground-demo">
      <DemoHeader slug="chart-options" />

      <Form method="get" action={PLAYGROUND_URL} className="playground-form">
        {carry}
        <fieldset className="playground-fieldset">
          <legend>Mark type</legend>
          {MARKS.map((m) => (
            <label key={m} className="playground-radio">
              <input type="radio" name="mark" value={m} defaultChecked={m === mark} />
              {m}
            </label>
          ))}
        </fieldset>
        <fieldset className="playground-fieldset">
          <legend>Dataset</legend>
          {(Object.keys(DATASETS) as DatasetKey[]).map((k) => (
            <label key={k} className="playground-radio">
              <input type="radio" name="data" value={k} defaultChecked={k === dataset} />
              {DATASETS[k].label}
            </label>
          ))}
        </fieldset>
        <button type="submit">Render</button>
        <p className="playground-cap">
          Enum inputs only. There is no free-text chart specification here:
          arbitrary input into the renderer is a compute surface this page
          does not open.
        </p>
      </Form>

      {chartError && <Problem>{chartError}</Problem>}
      {chartRenderError && <Problem>{chartRenderError}</Problem>}

      {chartHtml && (
        <div className="playground-result">
          {/* Pipeline output from data committed in this file; no third-party input, so it can be injected. */}
          <figure
            className="chart-figure"
            dangerouslySetInnerHTML={{ __html: chartHtml }}
          />
          <p className="playground-note">
            {datasetLabel}: {datasetNote}
          </p>
          <p className="playground-note">
            One render serves both themes. The series colors in that SVG
            are <code>var(--chart-cadet)</code> and its siblings, not
            literals, so the bytes are identical in light and dark and the
            browser resolves them per theme. Use the theme switch in the
            header and watch this chart recolor without a new request:
            that is the proof, and it is why there is no theme control
            here to press.
          </p>
        </div>
      )}
    </section>
  );
}
