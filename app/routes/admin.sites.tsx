import { data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { Panel, StatusDot } from "~/components/admin/panel";
import { sitesSource } from "~/lib/admin/sources.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.sites";

export function meta() {
  return [{ title: "Sites · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  /*
   * MARKED even though it is a STUB, and that is the point rather than an
   * oversight. `sitesSource` returns a literal with no I/O, so this should read
   * ~0ms forever. A mark that reads 0 is what makes the day it stops reading 0
   * visible: the whole finding behind this session is that three fixes landed
   * on 90ms because the expensive call was in the one loader nobody had marked.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const result = await timed(timings, "sites_source", () =>
    sitesSource.fetch(getEnv(context)),
  );
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ result });
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
