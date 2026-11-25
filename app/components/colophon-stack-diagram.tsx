import { Link } from "react-router";

import { CAPSOMER_PAGE_PATH } from "~/lib/colophon-sections.mjs";
import stack from "../../content/generated/stack.json";

const STACK_GROUPS = [
  { label: "Data", kinds: ["d1", "r2", "kv", "durable_object"] },
  { label: "Queues", kinds: ["queue_producer", "queue_consumer"] },
  { label: "AI", kinds: ["ai", "ai_search"] },
  { label: "Media and files", kinds: ["images", "assets"] },
] as const;

/**
 * How a request moves through the stack, drawn from the same bindings data as the table below, so the
 * diagram cannot name a resource the Worker no longer holds. Plain HTML: an ordered list of layers.
 */
export function StackDiagram() {
  const grouped = new Set<string>(STACK_GROUPS.flatMap((group) => group.kinds));
  const groups = [
    ...STACK_GROUPS.map((group) => ({
      label: group.label,
      names: stack.bindings
        .filter((binding) => (group.kinds as readonly string[]).includes(binding.kind))
        .map((binding) => binding.name),
    })),
    {
      label: "Other",
      names: stack.bindings
        .filter((binding) => !grouped.has(binding.kind))
        .map((binding) => binding.name),
    },
  ].filter((group) => group.names.length > 0);
  return (
    <figure className="colophon-stack">
      <ol className="colophon-stack-layers" aria-label="Layers of the stack, top to bottom">
        <li>
          <span className="colophon-stack-tag">Callers</span>
          <ul className="colophon-stack-boxes">
            <li>Readers and their browsers</li>
            <li>
              <a href="#run">Carrel</a>, through <code>/api/carrel/v1</code>
            </li>
            <li>
              <a href="#run">Capsid</a> and the admin server, through <code>/api/operator</code>
            </li>
          </ul>
        </li>
        <li>
          <span className="colophon-stack-tag">Cloudflare edge</span>
          <ul className="colophon-stack-boxes">
            <li>Edge page cache</li>
          </ul>
        </li>
        <li>
          <span className="colophon-stack-tag">Worker</span>
          <ul className="colophon-stack-boxes">
            <li>React Router</li>
            <li>
              <a href="#run">Prelum, site-runtime, site-api</a>
            </li>
            <li>
              <Link to={CAPSOMER_PAGE_PATH}>Capsomer</Link>
            </li>
          </ul>
        </li>
        <li>
          <span className="colophon-stack-tag">
            <a href="#bindings">Bindings</a>
          </span>
          <ul className="colophon-stack-boxes">
            {groups.map((group) => (
              <li key={group.label}>
                <strong>{group.label}</strong>
                <span className="colophon-stack-names">{group.names.join(", ")}</span>
              </li>
            ))}
          </ul>
        </li>
      </ol>
    </figure>
  );
}
