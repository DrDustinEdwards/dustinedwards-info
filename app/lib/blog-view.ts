import type { getBlogPost, listSeriesParts } from "~/db";
import { htmlHasMath } from "~/lib/content/math.mjs";
import { countWords } from "~/lib/content/reading-time.mjs";

// The public post and the draft preview both render this one projection, so the preview cannot
// quietly lose a section the public page has.

type Neighbour = { slug: string; title: string } | null;

// Neighbors widened to nullable: `getBlogPost`'s inferred type wrongly says a post always has one.
type LoadedPost = Omit<
  NonNullable<Awaited<ReturnType<typeof getBlogPost>>>,
  "previous" | "next"
> & { previous: Neighbour; next: Neighbour };

type SeriesParts = Awaited<ReturnType<typeof listSeriesParts>>;

// Counts rendered text, unlike the build's reading time, which counts markdown and must not move.
function bodyWordCount(html: string | null) {
  if (!html) return 0;
  return countWords(html.replace(/<[^>]*>/g, " "));
}

function parseJson(value: string | null, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function blogPostView(post: LoadedPost, seriesParts: SeriesParts) {
  let toc: Array<{ depth: number; id: string; text: string }> = [];
  if (post.toc) {
    try {
      toc = JSON.parse(post.toc);
    } catch {
      toc = [];
    }
  }

  return {
    toc,
    seriesParts,
    // Top level because root reads it by name through `useRouteLoaderData`, untyped.
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
      wordCount: bodyWordCount(post.html),
      sourceBlobSha: post.sourceBlobSha,
      tags: post.tags,
      previous: post.previous,
      next: post.next,
      series: post.series,
      part: post.part,
      ogTitle: post.ogTitle,
      ogDescription: post.ogDescription,
      backlinks: parseJson(post.backlinks, []) as Array<{
        slug: string;
        title: string;
      }>,
      related: parseJson(post.related, []) as Array<{
        slug: string;
        title: string;
        // Optional: rows stored before the field existed have none until the next sync.
        description?: string | null;
      }>,
      furtherReading: parseJson(post.furtherReading, []) as Array<{
        title: string;
        url: string;
      }>,
      writingStatus: post.writingStatus ?? null,
      assumedAudience: post.assumedAudience ?? null,
      keyTakeaways: parseJson(post.keyTakeaways, null) as string[] | null,
      changelog: parseJson(post.changelog, null) as Array<{
        date: string;
        note: string;
      }> | null,
    },
  };
}
