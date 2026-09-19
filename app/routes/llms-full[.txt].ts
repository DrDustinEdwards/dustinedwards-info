import { listBlogPostsFullText } from "~/db";
import { getEnv } from "~/lib/context";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/llms-full[.txt]";

/**
 * The full-text companion to llms.txt: every published post's markdown in one document, so a model
 * can read the whole blog in a single fetch.
 *
 * COMPOSED FROM D1 AT REQUEST TIME rather than emitted as an artifact, because THIS DOCUMENT DEPENDS
 * ON THE CLOCK: a post scheduled with a future publish_at must be absent today and present next week.
 * A generated document would either carry a timestamp, whose byte gate fails the moment a scheduled
 * post goes live, or ignore publish_at and leak unpublished writing. Composing here removes the
 * drift rather than gating it.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const posts = await listBlogPostsFullText(getEnv(context));

  const sections = posts.map((post) =>
    [
      `# ${post.title}`,
      "",
      `URL: /blog/${post.slug}`,
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
    "Each post is also served individually at /blog/<slug>.md, and the same",
    "content is returned from /blog/<slug> with an Accept: text/markdown header.",
    "",
    "---",
    "",
    sections.join("\n\n---\n\n"),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Served for language models, kept out of the search index, same as
      // llms.txt.
      "x-robots-tag": "noindex",
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
