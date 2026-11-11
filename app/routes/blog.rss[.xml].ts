import { getEnv } from "~/lib/context";
import { blogFeed, scopedFeedResponse } from "~/lib/feed-response";
import type { Route } from "./+types/blog.rss[.xml]";

export async function loader({ context }: Route.LoaderArgs) {
  return scopedFeedResponse(getEnv(context), "rss", blogFeed);
}
