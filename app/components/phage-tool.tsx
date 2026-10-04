import { Fragment, type ReactNode } from "react";

import { Enhance } from "~/components/enhance";
import { TOOLS, resultView, runTool, textParts, toolValues, toolsOnPage, type ViewNode } from "~/lib/phage-tools.mjs";

import "~/styles/phage-tools.css";

/** A view node from app/lib/phage-tools.mjs as React, the same markup app/enhance/tools.ts builds. */
function renderNode(node: ViewNode | string, key: number): ReactNode {
  if (typeof node === "string") return <Fragment key={key}>{node}</Fragment>;
  const Tag = node.tag;
  return (
    <Tag key={key} className={node.className}>
      {node.children.map(renderNode)}
    </Tag>
  );
}

/**
 * One calculator's form and its result. `instance` keys the ids and the status regions, so the same
 * calculator can sit under several steps of one page (a page of its own uses the tool's id). `embedded`
 * is a calculator inside a procedure step: its form still submits to the tool's own page, which answers
 * with script off, and app/enhance/tools.ts leaves the address bar alone.
 */
export function ToolBody({
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
  const view = resultView(runTool(id, values));
  return (
    <div className="phage-tool-body">
      <form
        className="phage-tool-form"
        method="get"
        action={tool.path}
        data-tool={id}
        data-tool-instance={instance}
        data-tool-embedded={embedded ? "" : undefined}
      >
        {tool.fields.map((field) => {
          const inputId = `${instance}-${field.name}`;
          const hintId = `${inputId}-hint`;
          const described = field.hint || field.source;
          return (
            <div className="phage-tool-field" key={field.name}>
              <label htmlFor={inputId}>
                {field.label}
                {field.unit ? <span className="phage-tool-unit"> ({field.unit})</span> : null}
              </label>
              <input
                id={inputId}
                name={field.name}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                defaultValue={values[field.name]}
                aria-describedby={described ? hintId : undefined}
              />
              {described ? (
                <p id={hintId} className="phage-tool-hint">
                  {field.hint
                    ? textParts(field.hint).map((part, i) =>
                        part.sup ? <sup key={i}>{part.text}</sup> : <Fragment key={i}>{part.text}</Fragment>,
                      )
                    : null}
                  {field.hint && field.source ? " " : null}
                  {field.source ? (
                    <>
                      Lab default: <a href={field.source.href}>{field.source.label}</a>.
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          );
        })}
        <button type="submit" className="phage-tool-submit">
          Calculate
        </button>
      </form>
      <div className="phage-tool-output">
        <div className="phage-tool-status" role="status" data-tool-status={instance}>
          {view.summary.map(renderNode)}
        </div>
        <div className="phage-tool-detail" data-tool-detail={instance}>
          {view.detail.map(renderNode)}
        </div>
      </div>
    </div>
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
            <ToolBody id={id} values={toolValues(id, params)} />
          </section>
        );
      })}
      <Enhance module="tools" />
    </>
  );
}

/**
 * The calculators a procedure step names (`> CALC: webbed-plate`), each folded under the step it serves
 * with the lab's worked example in its fields, except any value the step itself states. The caller adds the
 * "tools" enhancement once per page.
 */
export function StepCalculators({ calculators, scope }: { calculators: Array<{ id: string; values: Record<string, string> }>; scope: string }) {
  return (
    <>
      {calculators.map(({ id, values }) => {
        const tool = TOOLS[id];
        if (!tool) throw new Error(`No calculator named ${id}.`);
        return (
          <details key={id} className="phage-tool phage-tool-step">
            <summary>
              Calculator: {tool.title}
            </summary>
            <p className="phage-tool-hint">The fields start on the lab&apos;s worked example{Object.keys(values).length ? ", except what this step states" : ""}. Enter your own numbers.</p>
            <ToolBody id={id} instance={`${scope}-${id}`} values={{ ...toolValues(id), ...values }} embedded />
            <p className="phage-tool-more">
              <a href={tool.path}>Open the {tool.title.toLowerCase()} on its own page</a>
            </p>
          </details>
        );
      })}
    </>
  );
}
