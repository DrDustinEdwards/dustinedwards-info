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
        const values = toolValues(id, params);
        const view = resultView(runTool(id, values));
        const titleId = `tool-${id}-title`;
        return (
          <section key={id} className="phage-tool" aria-labelledby={titleId}>
            <h2 id={titleId} className="phage-tool-title">
              {tool.title}
            </h2>
            <div className="phage-tool-body">
              <form className="phage-tool-form" method="get" action={path} data-tool={id}>
                {tool.fields.map((field) => {
                  const inputId = `${id}-${field.name}`;
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
                <div className="phage-tool-status" role="status" data-tool-status={id}>
                  {view.summary.map(renderNode)}
                </div>
                <div className="phage-tool-detail" data-tool-detail={id}>
                  {view.detail.map(renderNode)}
                </div>
              </div>
            </div>
          </section>
        );
      })}
      <Enhance module="tools" />
    </>
  );
}
