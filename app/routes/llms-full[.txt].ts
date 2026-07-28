import { listBlogPostsFullText } from "~/db";
import { getEnv } from "~/lib/context";
import { PUBLIC_CACHE_CONTROL } from "~/lib/seo";
import type { Route } from "./+types/llms-full[.txt]";

/**
 * The full-text companion to llms.txt: every published post's markdown source in
 * one document, so a model can read the whole blog in a single fetch instead of
 * crawling it a page at a time.
 *
 * Composed from D1 at request time rather than emitted as a committed artifact.
 * That is a deliberate departure from how posts.json is handled, for one
 * concrete reason: this document depends on the clock. A post scheduled with a
 * future publish_at must be absent today and present next week. A committed
 * artifact cannot express that. It would either be generated with a timestamp,
 * in which case `check:content` starts failing the moment a scheduled post goes
 * live and the artifact is a booby trap, or it would ignore publish_at, in which
 * case it leaks unpublished writing.
 *
 * Composing here removes the drift rather than gating it: there is no second
 * copy that can disagree. The markdown itself is still gated, because it comes
 * from the same `posts.body` the generator wrote.
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
      "cache-control": PUBLIC_CACHE_CONTROL,
    },
  });
}
