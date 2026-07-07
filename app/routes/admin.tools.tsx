import { Panel } from "~/components/admin/panel";
import { toolsSource } from "~/lib/admin/sources.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.tools";

export function meta() {
  return [{ title: "Tools · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return { result: await toolsSource.fetch(getEnv(context)) };
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
