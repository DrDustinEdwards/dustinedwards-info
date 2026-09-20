import { getSetting } from "~/db";
import { getEnv } from "~/lib/context";
// THE source of truth, inlined at build. See the note on FALLBACK below.
import llmsTxt from "../../content/llms.txt?raw";
import type { Route } from "./+types/llms";

/**
 * What to serve when the `llms.txt` settings row is absent.
 *
 * THE CONTENT FILE ITSELF, inlined by Vite at build time, so the fallback cannot drift from what the
 * sync writes. A hand-maintained copy under a "change both" comment had already drifted invisibly,
 * by its line endings alone, so the site served different bytes depending on whether the row existed.
 *
 * `content/llms.txt` is pinned to LF in .gitattributes, which keeps the inlined copy and the row
 * byte-identical on every platform.
 */
const FALLBACK = llmsTxt;

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
