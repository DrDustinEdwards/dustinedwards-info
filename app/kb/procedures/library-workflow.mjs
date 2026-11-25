/** Where a protocol sits in the phage workflow, and the calculators of its stage. */

import { mdLink } from "../md-link.mjs";
import { TOOLS } from "../../lib/phage-tools.mjs";
import { PHAGE_PIPELINE } from "./taxonomy.mjs";

/** @typedef {import("./library.mjs").LibraryItem} LibraryItem */

/**
 * A calculator as a link: its page and the name its form carries, both from the one registry. An id the registry does
 * not know is an error here, not a missing link.
 *
 * @param {string} id
 */
export function toolLink(id) {
  const tool = TOOLS[id];
  if (!tool)
    throw new Error(
      `the phage workflow names a calculator "${id}" that phage-tools.mjs does not define`,
    );
  return { id, label: tool.title, href: tool.path };
}

/**
 * Where a protocol sits in the phage workflow, drawn from the same stages the library's strip uses: its stage (the first
 * whose methods it carries out), the protocols of the nearest earlier and later stage that has any, and the calculators
 * of its stage. Nothing is typed per protocol: a protocol saved changes its neighbors' links. A protocol outside the
 * workflow (a PCR primer set) has none, and so does a stage with nothing before or after it.
 *
 * @param {LibraryItem[]} items every published library entry
 * @param {string} path the protocol's own path
 */
export function workflowContext(items, path) {
  const self = items.find((p) => p.path === path);
  if (!self) return null;
  const stageOf = (/** @type {LibraryItem} */ p) =>
    PHAGE_PIPELINE.findIndex((stage) => p.methods.some((m) => stage.methods.includes(m)));
  const at = stageOf(self);
  if (at === -1) return null;
  const link = (/** @type {LibraryItem} */ p) => ({ title: p.title, href: p.path });
  const others = items.filter((p) => p.path !== path);
  const nearest = (/** @type {number} */ step) => {
    for (let i = at + step; i >= 0 && i < PHAGE_PIPELINE.length; i += step) {
      const found = others.filter((p) => stageOf(p) === i);
      if (found.length > 0) return found.map(link);
    }
    return [];
  };
  const stage = /** @type {(typeof PHAGE_PIPELINE)[number]} */ (PHAGE_PIPELINE[at]);
  return {
    stage: stage.label,
    before: nearest(-1),
    after: nearest(1),
    tools: stage.tools.map(toolLink),
  };
}

/**
 * The same context as lines for the markdown twin, so an agent reads the neighbors a person sees.
 *
 * @param {ReturnType<typeof workflowContext>} context
 * @param {string} origin
 */
export function workflowMarkdown(context, origin) {
  if (!context) return "";
  const links = (/** @type {Array<{ title: string, href: string }>} */ list) =>
    list.map((p) => mdLink(p.title, origin + p.href)).join(", ");
  return [
    "## In the phage workflow",
    "",
    `Stage: ${context.stage}.`,
    ...(context.before.length > 0 ? ["", `Before this: ${links(context.before)}.`] : []),
    ...(context.after.length > 0 ? ["", `After this: ${links(context.after)}.`] : []),
    ...(context.tools.length > 0
      ? ["", `Calculators: ${links(context.tools.map((t) => ({ title: t.label, href: t.href })))}.`]
      : []),
  ].join("\n");
}
