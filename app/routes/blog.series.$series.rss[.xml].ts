import { data } from "react-router";

import { getBlogSeries } from "~/db";
import { getEnv } from "~/lib/context";
import { feedResponse, seriesFeed } from "~/lib/feed-response";
import type { Route } from "./+types/blog.series.$series.rss[.xml]";

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const series = await getBlogSeries(env, params.series);
  if (!series) throw data("Not found", { status: 404 });
  return feedResponse(env, "rss", seriesFeed(series));
}
