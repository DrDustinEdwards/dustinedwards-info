import { data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { Panel } from "~/components/admin/panel";
import { toolsSource } from "~/lib/admin/sources.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.tools";

export function meta() {
  return [{ title: "Tools · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  /*
   * MARKED even though it is a STUB, and that is the point rather than an
   * oversight. `toolsSource` returns a literal with no I/O, so this should read
   * ~0ms forever. A mark that reads 0 is what makes the day it stops reading 0
   * visible: the whole finding behind this session is that three fixes landed
   * on 90ms because the expensive call was in the one loader nobody had marked.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const result = await timed(timings, "tools_source", () =>
    toolsSource.fetch(getEnv(context)),
  );
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ result });
}


export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData;
  return (
    <Panel
      title="Tools"
      description="Admin-side controls. Each activates when its backing API is wired."
      result={result}
    >
      <ul className="tool-list">
        {(result.data ?? []).map((tool) => (
          <li key={tool.id} className="tool-row">
            <div>
              <p className="tool-row-label">
                {tool.label} <span className="chip">{tool.provider}</span>
              </p>
              <p className="muted">{tool.description}</p>
            </div>
            <button type="button" className="btn-ghost" disabled={!tool.ready}>
              {tool.ready ? "Run" : "Not wired"}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
