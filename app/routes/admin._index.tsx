import { CardGrid, Panel, StatCard } from "~/components/admin/panel";
import { overviewSource } from "~/lib/admin/sources.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin._index";

export function meta() {
  return [{ title: "Overview · Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  return { result: await overviewSource.fetch(getEnv(context)) };
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
