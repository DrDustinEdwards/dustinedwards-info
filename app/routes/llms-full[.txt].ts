import { listBlogPostsFullText, nextScheduledPublishAt } from "~/db";
import { getEnv } from "~/lib/context";
import { EDGE_CACHE_HEADER, SHARED_CACHE_CONTROL, scheduledEdgeCacheControl } from "~/lib/seo";
import type { Route } from "./+types/llms-full[.txt]";

/**
 * Composed from D1 at request time, not a build artifact: it depends on the clock, since a post
 * scheduled for next week must be absent today and present then.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [posts, nextPublishAt] = await Promise.all([
    listBlogPostsFullText(env),
    nextScheduledPublishAt(env),
  ]);

  const sections = posts.map((post) =>
    [
      `# ${post.title}`,
      "",
      `URL: /writing/${post.slug}`,
      post.publishAt
        ? `Published: ${new Date(post.publishAt).toISOString().slice(0, 10)}`
        : null,
      post.tags.length > 0 ? `Tags: ${post.tags.join(", ")}` : null,
      "",
      post.body.trim(),
    ]
      .filter((line) => line !== null)
      .join("\n"),
  );

  const body = [
    "# dustinedwards.info, full post text",
    "",
    "Every published post on this site, in markdown, newest first.",
    "Each post is also served individually at /writing/<slug>.md, and the same",
    "content is returned from /writing/<slug> with an Accept: text/markdown header.",
    "",
    "---",
    "",
    sections.join("\n\n---\n\n"),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": SHARED_CACHE_CONTROL,
      [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt),
    },
  });
}
