import { getSetting } from "~/db";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/llms";

/**
 * Kept byte-identical to the `llms.txt` row in `settings`. The row is what the
 * route actually serves; this is the fallback for a database that has not been
 * seeded. If you change one, change the other.
 */
const FALLBACK = `# dustinedwards.info

Personal site of Dustin Edwards.

## About

Writing, projects, and notes.

## Blog

Posts are listed at /blog and can be filtered by tag at /blog?tag=<tag>.
Every post has a plain markdown twin at /blog/<slug>.md, which is the source
the page was rendered from. Requesting /blog/<slug> with an
Accept: text/markdown header returns the same markdown. The feed is at
/blog/rss.xml.

## Full text

/llms-full.txt carries every published post in markdown in one document.

## Contact

https://dustinedwards.info
`;

export async function loader({ context }: Route.LoaderArgs) {
  const value = await getSetting(getEnv(context), "llms.txt");

  return new Response(value ?? FALLBACK, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Served for language models, kept out of the search index.
      "x-robots-tag": "noindex",
      "cache-control": "public, max-age=3600",
    },
  });
}
