import { getEnv } from "~/lib/context";
import { blogFeed, feedResponse } from "~/lib/feed-response";
import type { Route } from "./+types/blog.atom[.xml]";

export async function loader({ context }: Route.LoaderArgs) {
  return feedResponse(getEnv(context), "atom", blogFeed);
}
