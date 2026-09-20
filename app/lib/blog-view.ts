import type { getBlogPost, listSeriesParts } from "~/db";
import { htmlHasMath } from "~/lib/content/math.mjs";

/**
 * The loader payload one post page renders from, built in ONE place.
 *
 * Two routes render a post and differ in exactly one respect, the row they are allowed to fetch.
 * This is the "identical" written down.
 *
 * THE PREVIEW'S WHOLE CLAIM is that a reviewer sees what a reader would see, and a second projection
 * would let that claim go quietly false: a column added to the public page and not to this one shows
 * up as a section missing from the preview.
 *
 * Pure, and it reads no clock and no environment, so the two cannot differ by timing either.
 */

/** A neighbouring post in the reading order, or the end of it. */
type Neighbour = { slug: string; title: string } | null;

/**
 * A blog row as either reader hands it over.
 *
 * The neighbours are WIDENED to nullable here rather than taken as `getBlogPost` infers them: its
 * `previous ?? null` narrows back to non-null, because the array destructure it comes from is not
 * index-checked, so the inferred type says a post always has a neighbour. Every post at either end
 * of the corpus disproves that, and a draft preview has neither by design.
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
    /*
     * AT THE TOP LEVEL OF THE PAYLOAD, not inside `post`, because root reads it with
     * `useRouteLoaderData` and a nested field would make root know the shape of this route's `post` as
     * well as its own name for the flag. The name is the contract between the two files and NOTHING TYPES
     * IT: root casts what the hook returns, so `check:page-payload` asserts both spellings against each
     * other.
     *
     * Derived from the html rather than stored, so nothing has to migrate, sync or stay true.
     */
    hasMath: htmlHasMath(post.html),
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
      /*
       * The posts on this site that link here. An empty array rather than null: the renderer asks
       * for `.length`, and the loader below filters it against the live rows exactly as it filters
       * `related`, in the same query.
       */
      backlinks: parseJson(post.backlinks, []) as Array<{
        slug: string;
        title: string;
      }>,
      related: parseJson(post.related, []) as Array<{
        slug: string;
        title: string;
        /**
         * OPTIONAL, and that is the migration rather than sloppiness. Rows written before the field was
         * added to the stored blob carry none until the next sync or save rewrites them, and the renderer
         * shows it only when present, so an old row degrades to the bare title it always was instead of
         * rendering "undefined".
         */
        description?: string | null;
      }>,
      furtherReading: parseJson(post.furtherReading, []) as Array<{
        title: string;
        url: string;
      }>,
      /*
       * The three optional head blocks, passed through as stored. NULL stays null: absent is the
       * normal case and the renderer shows each only when present, so a row written before these
       * columns existed degrades to the post it already was rather than to empty furniture.
       */
      writingStatus: post.writingStatus ?? null,
      assumedAudience: post.assumedAudience ?? null,
      keyTakeaways: parseJson(post.keyTakeaways, null) as string[] | null,
      /*
       * The post history, passed through as stored. The 24-hour threshold that decides whether it
       * is shown at all lives on the route beside the Updated line it already governs, so there is
       * one comparison and not two.
       */
      changelog: parseJson(post.changelog, null) as Array<{
        date: string;
        note: string;
      }> | null,
    },
  };
}
