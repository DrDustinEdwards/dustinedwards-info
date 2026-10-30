import { llmsResponse } from "@drdustinedwards/site-helpers/llms";

import { getSetting } from "~/db";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import { LLMS_CACHE_TAG, LLMS_SETTING_KEY } from "~/lib/llms/validate.mjs";
import llmsTxt from "../../content/llms.txt?raw";
import { SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/llms";

/**
 * The content file itself, inlined by Vite, so the fallback cannot drift from what the sync writes.
 * .gitattributes pins it to LF, so the inlined copy and the row are byte-identical on every platform.
 */
const FALLBACK = llmsTxt;

/** Prelum's llmsResponse: text/plain, noindex, the hour's cache (no-store on a preview) and the TDMRep header. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const value = await getSetting(getEnv(context), LLMS_SETTING_KEY);

  return llmsResponse({
    origin: SITE_ORIGIN,
    request,
    body: value ?? FALLBACK,
    headers: {
      // The site it describes: a crawler that lands here is pointed at the page people read.
      Link: canonicalLink("/"),
      // A save through Carrel purges this tag, so the edge serves the edit without waiting out the hour.
      "Cache-Tag": LLMS_CACHE_TAG,
    },
  });
}
