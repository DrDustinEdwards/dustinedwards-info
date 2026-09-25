import { data } from "react-router";

import { getBlogTag } from "~/db";
import { getEnv } from "~/lib/context";
import { feedResponse, tagFeed } from "~/lib/feed-response";
import type { Route } from "./+types/blog.tags.$tag.rss[.xml]";

/** 404 on an unknown tag: a feed and its page must agree about whether a tag exists. */
export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const tag = await getBlogTag(env, params.tag);
  if (!tag) throw data("Not found", { status: 404 });
  return feedResponse(env, "rss", tagFeed(tag));
}
