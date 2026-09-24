import { getBlogPostMarkdown } from "~/db";
import { getEnv } from "~/lib/context";
import { markdownResponse } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/blog.$slug[.md]";

export async function loader({ params, context }: Route.LoaderArgs) {
  const post = await getBlogPostMarkdown(getEnv(context), params.slug);

  if (!post) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  /* Publicly cached: this URL has one representation, unlike the negotiated `/blog/:slug`. */
  return markdownResponse(params.slug, post.body, SHARED_CACHE_CONTROL);
}
