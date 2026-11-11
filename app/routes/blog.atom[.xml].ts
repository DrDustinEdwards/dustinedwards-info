import { getEnv } from "~/lib/context";
import { blogFeed, scopedFeedResponse } from "~/lib/feed-response";
import type { Route } from "./+types/blog.atom[.xml]";

export async function loader({ context }: Route.LoaderArgs) {
  return scopedFeedResponse(getEnv(context), "atom", blogFeed);
}
