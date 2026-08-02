import { getSetting } from "~/db";
import { getEnv } from "~/lib/context";
// THE source of truth, inlined at build. See the note on FALLBACK below.
import llmsTxt from "../../content/llms.txt?raw";
import type { Route } from "./+types/llms";

/**
 * What to serve when the `llms.txt` settings row is absent.
 *
 * This used to be a 60-line template literal carrying a hand-maintained copy of
 * the row, under a comment reading "If you change one, change the other". It had
 * already drifted: measured 2026-08-02, the literal was byte-identical to the
 * live row EXCEPT that it carried 62 CRs, because this .ts file is CRLF on a
 * Windows checkout while the D1 row is LF. The site therefore served different
 * bytes depending on whether the row existed, and nothing could see it.
 *
 * It is now the content file itself, inlined by Vite at build time, so the
 * fallback cannot drift from what the sync writes. `content/llms.txt` is pinned
 * to LF in .gitattributes, which is what keeps the inlined copy and the row
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
