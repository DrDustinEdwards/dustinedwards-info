import { getEnv } from "~/lib/context";
import { blogFeed, feedResponse } from "~/lib/feed-response";
import type { Route } from "./+types/blog.rss[.xml]";

export async function loader({ context }: Route.LoaderArgs) {
  return feedResponse(getEnv(context), "rss", blogFeed);
}
