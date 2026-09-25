import { getEnv } from "~/lib/context";
import { blogFeed, feedResponse } from "~/lib/feed-response";
import type { Route } from "./+types/blog.feed[.json]";

export async function loader({ context }: Route.LoaderArgs) {
  return feedResponse(getEnv(context), "json", blogFeed);
}
