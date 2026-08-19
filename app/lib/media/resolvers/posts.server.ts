import { loadArtifact } from "~/lib/editor/publish.server";

import type { MediaCitation, ReferenceResolver } from "../resolvers.server";

/**
 * The POSTS resolver. The one registered content type today.
 *
 * It reads the committed artifact, which is the source of truth for content on
 * this site and the thing `check:content` gates, then scans each post's
 * markdown for each key. D1 is derived from the artifact, so scanning rows
 * instead would be scanning a copy.
 *
 * ## Coverage, stated rather than assumed (ruling 5)
 *
 * The scan looks for the literal `/media/<key>` substring, then classifies each
 * hit by looking at the text around it. Detection is by SUBSTRING and
 * classification is by pattern, which is the right way round: a form this
 * module has never heard of is still detected, and merely lands in the `other`
 * bucket. The alternative, parsing only known syntaxes, would report an
 * unrecognised citation as no citation, and an "unused" label that is wrong is
 * worse than no label at all.
 *
 * **Detected and classified:**
 *   - `markdown-image`   `![alt](/media/posts/2026/x-1234.png)`
 *   - `figure-directive` `:::figure{src="/media/..." alt="..."}`
 *   - `frontmatter-cover` the post's `cover.src`
 *   - `link`             `[the chart](/media/...)`
 *   - `html`             `<img src="/media/...">` written raw in a post
 *   - `other`            any other text containing the URL, counted as a
 *                        citation even though the form is unrecognised
 *
 * Absolute URLs are caught too, because `https://host/media/<key>` contains
 * `/media/<key>`.
 *
 * **What it would MISS**, which is the part that matters for a delete:
 *   - a reference assembled at runtime from pieces. Nothing in this corpus does
 *     that and the markdown pipeline could not render it, but it is not
 *     detectable in principle
 *   - a citation from OUTSIDE the post corpus: another site, an already
 *     scraped social card, an email, a printed link. Nothing in this repo can
 *     know about those. That is precisely why deletion is a considered act
 *     rather than hygiene, and why ruling 2 exists
 *   - a post present in D1 but absent from the committed artifact. The artifact
 *     is gated, so this is repo corruption rather than a routine case
 *   - the `og/` social cards, which are not scanned because they are not
 *     listed: they are build output keyed by a content hash and no post cites
 *     them by name, so a usage scan would call every one unused
 */
export const postsResolver: ReferenceResolver = async (env, keys, loadPosts) => {
  const out = new Map<string, MediaCitation[]>(keys.map((key) => [key, []]));
  if (keys.length === 0) return out;

  // Deliberately NOT caught: a failure here must reach `resolveCitations`, which
  // reports it, so the delete action can fail closed. Swallowing it would turn
  // "we could not check" into "nothing cites it".
  // The caller's memo when it has one, its own read when it does not. Falling
  // back rather than requiring one keeps this resolver usable from the operator
  // path and from anywhere else that holds only an env.
  const posts = (await (loadPosts ? loadPosts() : loadArtifact(env))) as Array<{
    slug?: string;
    title?: string;
    markdown?: string;
    cover?: { src?: string } | null;
  }>;

  for (const post of posts) {
    const slug = post.slug ?? "";
    if (!slug) continue;
    const title = post.title || slug;
    const markdown = post.markdown ?? "";
    const coverSrc = post.cover?.src ?? "";

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

/**
 * Which syntax the hit sits inside, from the text immediately before it.
 *
 * A short lookbehind rather than a parse. It only has to distinguish forms for
 * a human-readable refusal; getting it wrong downgrades the label, never the
 * detection, because the citation was already recorded by the substring match.
 */
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

/** 1-indexed line number of an offset. */
function lineOf(source: string, at: number) {
  let line = 1;
  for (let i = 0; i < at; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}
