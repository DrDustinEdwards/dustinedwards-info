import { EmptyState, Panel } from "~/components/admin/panel";
import { contentSource } from "~/lib/admin/sources.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.content";

export function meta() {
  return [{ title: "Content · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return { result: await contentSource.fetch(getEnv(context)) };
}

export default function AdminContent({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData;
  return (
    <Panel
      title="Content"
      description="Blog, protocols and CV for this site. Each list fills in once its editor exists."
      result={result}
    >
      <div className="content-sections">
        {(result.data ?? []).map((section) => (
          <section key={section.id} className="content-section">
            <header>
              <h3>{section.label}</h3>
              <span className="chip">
                {section.count === null ? "no data" : `${section.count} items`}
              </span>
            </header>
            <p className="muted">{section.description}</p>
            <EmptyState
              title="Nothing here yet"
              hint="Entries appear once this area is wired to D1."
            />
          </section>
        ))}
      </div>
    </Panel>
  );
}
