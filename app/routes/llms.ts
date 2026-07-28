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
/blog/rss.xml and /blog/feed.json.

## Search

/search?q=<query> searches the whole site and returns a normal HTML page.

The same URL returns JSON when requested with Accept: application/json. It is
the same query against the same index, not a separate API, and the response
varies on Accept. Parameters: q, type, tag, year, page. Operators inside q:
tag:<tag>, type:<type>, "quoted phrases", and a bare four-digit year, which is
read as a date filter rather than as text.

Results are section-grained: a hit carries the heading it was found under and a
url with that anchor, so a citation can point at the passage rather than the
page. Each result reports what it matched on (title, tag, body, or filter, the
last meaning the query was a bare year or tag with no text to match).

For programmatic use prefer the JSON form. It is keyword search over an FTS5
index: deterministic, the same query returning the same results, with no model
in the path and no per-request cost.

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
