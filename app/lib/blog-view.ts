import type { getBlogPost, listSeriesParts } from "~/db";

/**
 * The loader payload one post page renders from, built in ONE place.
 *
 * Two routes render a post: `/blog/:slug` and `/preview/:token`. They differ in
 * exactly one respect, which is the row they are allowed to fetch; everything
 * after that is identical, and this is the "identical" written down.
 *
 * It exists because the alternative is two projections of the same row that
 * agree today. The preview's whole claim is that a reviewer sees what a reader
 * would see, and a second projection would let that claim go quietly false: a
 * column added to the public page and not to this one would show up as a
 * section missing from the preview, which is precisely the class of drift a
 * preview is supposed to make impossible.
 *
 * Pure, and it reads no clock and no environment, so the two routes cannot
 * differ by timing either.
 */

/** A neighbouring post in the reading order, or the end of it. */
type Neighbour = { slug: string; title: string } | null;

/**
 * A blog row as either reader hands it over.
 *
 * The neighbours are WIDENED to nullable here rather than taken as `getBlogPost`
 * infers them. That function's `previous ?? null` narrows back to non-null,
 * because the array destructure it comes from is not index-checked, so its
 * inferred type says a post always has a neighbour. Every post at either end of
 * the corpus disproves that, and a draft preview has neither by design.
 */
type LoadedPost = Omit<
  NonNullable<Awaited<ReturnType<typeof getBlogPost>>>,
  "previous" | "next"
> & { previous: Neighbour; next: Neighbour };

type SeriesParts = Awaited<ReturnType<typeof listSeriesParts>>;

/**
 * JSON columns. A malformed one costs a section, never the page.
 *
 * Moved here with the projection rather than left behind, because a parser that
 * lives beside one caller is a parser the other caller writes again.
 */
function parseJson(value: string | null, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** @param post a blog row with its tags and neighbours @param seriesParts */
export function blogPostView(post: LoadedPost, seriesParts: SeriesParts) {
  /** @see drizzle/0003_post_toc.sql */
  let toc: Array<{ depth: number; id: string; text: string }> = [];
  if (post.toc) {
    try {
      toc = JSON.parse(post.toc);
    } catch {
      // A malformed toc costs the reader a contents list, not the page.
      toc = [];
    }
  }

  return {
    toc,
    seriesParts,
    post: {
      slug: post.slug,
      title: post.title,
      description: post.description,
      html: post.html ?? "",
      publishAt: post.publishAt,
      updatedAt: post.updatedAt,
      coverImage: post.coverImage,
      coverAlt: post.coverAlt,
      ogImage: post.ogImage,
      readingTimeMinutes: post.readingTimeMinutes,
      tags: post.tags,
      previous: post.previous,
      next: post.next,
      series: post.series,
      part: post.part,
      ogTitle: post.ogTitle,
      ogDescription: post.ogDescription,
      related: parseJson(post.related, []) as Array<{
        slug: string;
        title: string;
        /**
         * OPTIONAL, and that is the migration rather than sloppiness. The field
         * was added to the stored blob on 2026-09-03; rows written before that
         * carry none until the next sync or save rewrites them. The renderer
         * shows it only when present, so an old row degrades to the bare title
         * it always was instead of rendering "undefined".
         */
        description?: string | null;
      }>,
      furtherReading: parseJson(post.furtherReading, []) as Array<{
        title: string;
        url: string;
      }>,
    },
  };
}
