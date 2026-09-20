import { getBlogPostMarkdown } from "~/db";
import { getEnv } from "~/lib/context";
import { markdownResponse } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
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

  /*
   * PUBLICLY CACHED. This URL has exactly one representation, so there is nothing for a Cookie
   * dimension to collapse against; the negotiated representation under `/blog/:slug` genuinely must
   * not be stored, and the grounds are on `markdownResponse`.
   */
  return markdownResponse(params.slug, post.body, SHARED_CACHE_CONTROL);
}
