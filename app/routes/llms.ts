import { getSetting } from "~/db";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import { LLMS_CACHE_TAG, LLMS_SETTING_KEY } from "~/lib/llms/validate.mjs";
import llmsTxt from "../../content/llms.txt?raw";
import type { Route } from "./+types/llms";

/**
 * The content file itself, inlined by Vite, so the fallback cannot drift from what the sync writes.
 * .gitattributes pins it to LF, so the inlined copy and the row are byte-identical on every platform.
 */
const FALLBACK = llmsTxt;

export async function loader({ context }: Route.LoaderArgs) {
  const value = await getSetting(getEnv(context), LLMS_SETTING_KEY);

  return new Response(value ?? FALLBACK, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex",
      // The site it describes: a crawler that lands here is pointed at the page people read.
      link: canonicalLink("/"),
      "cache-control": "public, max-age=3600",
      // A save through Carrel purges this tag, so the edge serves the edit without waiting out the hour.
      "cache-tag": LLMS_CACHE_TAG,
    },
  });
}
