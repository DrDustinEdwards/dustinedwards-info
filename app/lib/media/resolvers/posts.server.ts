import { listPostSourcesForCitations } from "~/db";

import type { MediaCitation, ReferenceResolver } from "../resolvers.server";

/**
 * The POSTS resolver. The one registered content type today. It scans every post's markdown out of
 * D1, drafts included, for each key.
 *
 * **Coverage, stated rather than assumed.** Detection is by SUBSTRING and classification is by
 * pattern, which is the right way round: a form this module has never heard of is still detected and
 * merely lands in `other`. Parsing only known syntaxes would report an unrecognised citation as NO
 * citation, and an "unused" label that is wrong is worse than no label.
 *
 * **What it would MISS**, which is the part that matters for a delete:
 *
 *   - a reference assembled at runtime from pieces, which is not detectable in principle
 *   - a citation from OUTSIDE the post corpus: another site, a scraped social card, an email, a
 *     printed link. That is why deletion is a considered act rather than hygiene, and why ruling 2
 *     exists
 *   - a citation committed from a clone and not yet synced, a window the scheduled health check
 *     bounds at its poll interval
 *   - the `og/` social cards, which are not listed: no post cites them by name, so a usage scan
 *     would call every one unused
 */
export const postsResolver: ReferenceResolver = async (env, keys) => {
  const out = new Map<string, MediaCitation[]>(keys.map((key) => [key, []]));
  if (keys.length === 0) return out;

  // Deliberately NOT caught: a failure here must reach `resolveCitations`, which
  // reports it, so the delete action can fail closed. Swallowing it would turn
  // "we could not check" into "nothing cites it".
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
