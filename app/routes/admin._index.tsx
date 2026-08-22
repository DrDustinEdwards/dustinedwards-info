import { data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { CardGrid, Panel, StatCard } from "~/components/admin/panel";
import { overviewSource } from "~/lib/admin/sources.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin._index";

export function meta() {
  return [{ title: "Overview · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  /*
   * MARKED even though it is a STUB, and that is the point rather than an
   * oversight. `overviewSource` returns a literal with no I/O, so this should read
   * ~0ms forever. A mark that reads 0 is what makes the day it stops reading 0
   * visible: the whole finding behind this session is that three fixes landed
   * on 90ms because the expensive call was in the one loader nobody had marked.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const result = await timed(timings, "overview_source", () =>
    overviewSource.fetch(getEnv(context)),
  );
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });
  return data({ result });
}


export default function AdminOverview({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData;
  return (
    <Panel
      title="Overview"
      description="One card per signal the cockpit aggregates. Each goes live as its integration is wired."
      result={result}
    >
      <CardGrid>
        {(result.data ?? []).map((card) => (
          <StatCard
            key={card.id}
            label={card.label}
            value={card.value}
            hint={card.hint}
            status={card.status}
          />
        ))}
      </CardGrid>
    </Panel>
  );
}
