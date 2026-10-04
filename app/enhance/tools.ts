import { resultView, runTool, TOOLS, type ViewNode } from "~/lib/phage-tools.mjs";

/*
 * The phage lab calculators, live. The server already rendered each form and its result from the
 * query string (app/components/phage-tool.tsx), so this only recomputes on input with the same module
 * and writes the values to the query string, so a copied URL shows the same calculation.
 */

function build(node: ViewNode | string): Node {
  if (typeof node === "string") return document.createTextNode(node);
  const el = document.createElement(node.tag);
  if (node.className) el.className = node.className;
  for (const child of node.children) el.appendChild(build(child));
  return el;
}

for (const form of document.querySelectorAll<HTMLFormElement>("form[data-tool]")) {
  const id = form.dataset.tool ?? "";
  const instance = form.dataset.toolInstance ?? id;
  /* A calculator inside a procedure step: several share a page, so none writes the address bar. */
  const embedded = form.hasAttribute("data-tool-embedded");
  const tool = TOOLS[id];
  const status = document.querySelector(`[data-tool-status="${instance}"]`);
  const detail = document.querySelector(`[data-tool-detail="${instance}"]`);
  if (!tool || !status || !detail) {
    throw new Error(`tools: the calculator "${id}" has no definition, status region or detail region.`);
  }

  const update = () => {
    const data = new FormData(form);
    const values: Record<string, string> = {};
    for (const field of tool.fields) values[field.name] = String(data.get(field.name) ?? "");
    const view = resultView(runTool(id, values));
    status.replaceChildren(...view.summary.map(build));
    detail.replaceChildren(...view.detail.map(build));

    if (embedded) return;
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(values)) url.searchParams.set(name, value);
    window.history.replaceState(window.history.state, "", url);
  };

  form.addEventListener("input", update);
  // Enter or the button recomputes in place rather than reloading the page.
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    update();
  });
}
