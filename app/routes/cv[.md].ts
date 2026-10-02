import { readCv } from "~/db/cv";
import { getEnv } from "~/lib/context";
import { CV_PAGE } from "~/lib/cv/entries.mjs";
import { cvTwin } from "~/lib/cv/markdown.mjs";
import { CV_CACHE_TAG } from "~/lib/cv/route";
import { canonicalLink } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

import type { Route } from "./+types/cv[.md]";

/**
 * The CV's markdown twin at /cv.md, made from the same rows and the same resolved entries as the page
 * (app/lib/cv/markdown.mjs), so an agent reads the facts a person does and a CV save reaches both at once. It
 * was a static file under public/ until the CV moved to D1 (docs/CV.md); a static file at this address would
 * win over this route, so build:content deletes any left from an earlier build.
 */
export async function loader({ context }: Route.LoaderArgs) {
  return new Response(cvTwin(await readCv(getEnv(context))), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": CV_CACHE_TAG,
      // As every other page twin: the HTML page is the one to index.
      "x-robots-tag": "noindex",
      link: canonicalLink(CV_PAGE.path),
    },
  });
}
