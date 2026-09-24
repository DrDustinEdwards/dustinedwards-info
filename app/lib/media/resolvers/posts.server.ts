import { listPostSourcesForCitations } from "~/db";

import type { MediaCitation, ReferenceResolver } from "../resolvers.server";

// Detected by SUBSTRING and only then classified, so an unknown syntax still counts (as `other`).
// It cannot see runtime-assembled references or citations from outside the post corpus.
export const postsResolver: ReferenceResolver = async (env, keys) => {
  const out = new Map<string, MediaCitation[]>(keys.map((key) => [key, []]));
  if (keys.length === 0) return out;

  // Deliberately not caught: the failure must reach `resolveCitations` so a delete fails closed.
  const posts = await listPostSourcesForCitations(env);

  for (const post of posts) {
    const slug = post.slug;
    const title = post.title || slug;
    const markdown = post.body ?? "";
    const coverSrc = post.coverImage ?? "";

    for (const key of keys) {
      const url = `/media/${key}`;
      const found = out.get(key);
      if (!found) continue;

      if (coverSrc === url || coverSrc === key) {
        found.push({ type: "post", id: slug, title, form: "frontmatter-cover", detail: "cover image" });
      }

      let at = markdown.indexOf(url);
      while (at !== -1) {
        found.push({
          type: "post",
          id: slug,
          title,
          form: classify(markdown, at),
          detail: `line ${lineOf(markdown, at)}`,
        });
        at = markdown.indexOf(url, at + url.length);
      }
    }
  }

  return out;
};

// A lookbehind, not a parse: a wrong guess downgrades the label, never the detection.
function classify(source: string, at: number): MediaCitation["form"] {
  const before = source.slice(Math.max(0, at - 120), at);
  if (/:::figure\{[^}]*src="?$/.test(before) || /:::figure\{[^}]*src=$/.test(before)) {
    return "figure-directive";
  }
  if (/src\s*=\s*["']?$/.test(before) && /<[a-z]+[^>]*$/i.test(before)) return "html";
  if (/!\[[^\]]*\]\($/.test(before)) return "markdown-image";
  if (/\[[^\]]*\]\($/.test(before)) return "link";
  return "other";
}

function lineOf(source: string, at: number) {
  let line = 1;
  for (let i = 0; i < at; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}
