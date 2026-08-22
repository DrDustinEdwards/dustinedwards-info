import { data } from "react-router";

import { serverTiming, timed, timingsContext } from "~/lib/timing";
import { EmptyState, Panel } from "~/components/admin/panel";
import { contentSource } from "~/lib/admin/sources.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.content";

export function meta() {
  return [{ title: "Content · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  /*
   * MARKED even though it is a STUB, and that is the point rather than an
   * oversight. `contentSource` returns a literal with no I/O, so this should read
   * ~0ms forever. A mark that reads 0 is what makes the day it stops reading 0
   * visible: the whole finding behind this session is that three fixes landed
   * on 90ms because the expensive call was in the one loader nobody had marked.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const result = await timed(timings, "content_source", () =>
    contentSource.fetch(getEnv(context)),
  );
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return timings
    ? data({ result }, { headers: { "Server-Timing": serverTiming(timings) } })
    : data({ result });
}

/**
 * Carries the loader's `Server-Timing` to the response, and nothing else.
 *
 * Same shape as admin.tsx and admin.media._index: deliberately no
 * Cache-Control, because `workers/app.ts` applies `private, no-store` to any
 * response that did not set one and the cookie downgrade forces it for every
 * admin request anyway.
 */
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const headers = new Headers();
  const timing = loaderHeaders.get("Server-Timing");
  if (timing) headers.set("Server-Timing", timing);
  return headers;
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
