import { getBlogPostMarkdown } from "~/db";
import { getEnv } from "~/lib/context";
import { markdownResponse } from "~/lib/markdown-twin";
import type { Route } from "./+types/blog.$slug[.md]";

/**
 * The markdown twin of a post. Serves the exact source the page was rendered
 * from, so an agent can read the prose without parsing markup.
 *
 * Reads through the same visibility gate as the HTML route, so a draft is not
 * quietly readable here.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const post = await getBlogPostMarkdown(getEnv(context), params.slug);

  if (!post) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return markdownResponse(params.slug, post.body);
}
