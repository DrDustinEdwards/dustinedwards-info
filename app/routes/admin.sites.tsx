import { Panel, StatusDot } from "~/components/admin/panel";
import { sitesSource } from "~/lib/admin/sources.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.sites";

export function meta() {
  return [{ title: "Sites · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return { result: await sitesSource.fetch(getEnv(context)) };
}

export default function AdminSites({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData;
  return (
    <Panel
      title="Sites"
      description="Portfolio health at a glance. Statuses are placeholders until per-site checks are wired."
      result={result}
    >
      <div className="card-grid">
        {(result.data ?? []).map((site) => (
          <article key={site.id} className="site-card">
            <header>
              <h3>{site.name}</h3>
              <StatusDot status={site.status} />
            </header>
            <p className="muted">{site.blurb}</p>
            <p className="site-card-meta">
              <span className="chip">{site.platform}</span>
            </p>
            <p className="site-card-summary muted">{site.summary}</p>
            {site.url ? (
              <a
                className="site-card-link"
                href={site.url}
                target="_blank"
                rel="noreferrer"
              >
                Visit
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </Panel>
  );
}
