import { initialValues } from "capsomer/behavior/calculator";
import { Calculator, type CalculatorField } from "capsomer/react/calculator";
import { Disclosure } from "capsomer/react/disclosure";

import { TOOLS, runTool, toolValues, toolsOnPage } from "~/lib/phage-tools.mjs";

import "capsomer/field.css";
import "capsomer/calculator.css";
import "capsomer/disclosure.css";
import "~/styles/phage-tools.css";

/** A calculator's fields as Capsomer's Calculator takes them: a lab default names its source as one. */
function fieldsOf(id: string): CalculatorField[] {
  const tool = TOOLS[id];
  if (!tool) throw new Error(`No calculator named ${id}.`);
  return tool.fields.map((field) =>
    field.source ? { ...field, sourceLead: "Lab default:" } : field,
  );
}

/**
 * One calculator, Capsomer's (capsomer/react/calculator). `instance` keys the ids, so the same calculator
 * can sit under several steps of one page (a page of its own uses the tool's id). `embedded` is a calculator
 * inside a procedure step: its form still submits to the tool's own page, which answers with script off,
 * and the page's enhance call (app/enhance/tools.ts) leaves the address bar alone.
 */
function ToolBody({
  id,
  instance = id,
  values,
  embedded = false,
}: {
  id: string;
  instance?: string;
  values: Record<string, string>;
  embedded?: boolean;
}) {
  const tool = TOOLS[id];
  if (!tool) throw new Error(`No calculator named ${id}.`);
  return (
    <Calculator
      id={instance}
      calculator={id}
      action={tool.path}
      fields={fieldsOf(id)}
      values={values}
      run={(v) => runTool(id, v)}
      embedded={embedded}
    />
  );
}

/**
 * The calculators on a /research/tools page, computed on the server from the query string (or the
 * worked example when there is none), so the page reads complete with script off and the Calculate
 * button works as a plain GET. app/enhance/tools.ts recomputes on every input with the same module.
 */
export function PhageTools({ path, search }: { path: string; search: string }) {
  const ids = toolsOnPage(path);
  if (ids.length === 0) return null;
  const params = new URLSearchParams(search);
  return (
    <>
      {ids.map((id) => {
        const tool = TOOLS[id];
        if (!tool) throw new Error(`No calculator named ${id}.`);
        const titleId = `tool-${id}-title`;
        return (
          <section key={id} className="phage-tool" aria-labelledby={titleId}>
            <h2 id={titleId} className="phage-tool-title">
              {tool.title}
            </h2>
            <ToolBody id={id} values={initialValues(tool.fields, params)} />
          </section>
        );
      })}
      <template data-island="tools" />
    </>
  );
}

/**
 * The calculators a procedure step names (`> CALC: webbed-plate`), each folded under the step it serves
 * with the lab's worked example in its fields, except any value the step itself states. The caller adds the
 * "tools" enhancement once per page.
 */
export function StepCalculators({
  calculators,
  scope,
}: {
  calculators: Array<{ id: string; values: Record<string, string> }>;
  scope: string;
}) {
  return (
    <>
      {calculators.map(({ id, values }) => {
        const tool = TOOLS[id];
        if (!tool) throw new Error(`No calculator named ${id}.`);
        return (
          <Disclosure
            key={id}
            className="phage-tool-step"
            summary={`Calculator: ${tool.title}`}
            variant="inline"
            marker="sign"
            print="hide"
          >
            <p className="phage-tool-hint">
              The fields start on the lab&apos;s worked example
              {Object.keys(values).length ? ", except what this step states" : ""}. Enter your own
              numbers.
            </p>
            <ToolBody
              id={id}
              instance={`${scope}-${id}`}
              values={{ ...toolValues(id), ...values }}
              embedded
            />
            <p className="phage-tool-more">
              <a href={tool.path} data-link="next">
                Open the {tool.title.toLowerCase()} on its own page
              </a>
            </p>
          </Disclosure>
        );
      })}
    </>
  );
}
