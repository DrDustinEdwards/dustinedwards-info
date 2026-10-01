import { readCv } from "~/db/cv";
import { getEnv } from "~/lib/context";
import { cvFacts } from "~/lib/cv/entries.mjs";
import { renderCvCharts } from "~/lib/cv/render-charts";
import { CV_CACHE_TAG } from "~/lib/cv/route";
import { parseState } from "~/lib/cv/view.mjs";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

import type { Route } from "./+types/cv.charts[.json]";

/*
 * The CV's charts for one filter state, as the markup /cv renders them, for app/enhance/cv.ts to swap
 * in when a filter changes. Drawn here rather than in the browser so the page does not download a
 * chart renderer: Enarratio draws with Observable Plot and linkedom, about 480 KB of script, and its
 * browser layer (enarratio/enhance) needs only the markup. A function of the query string and the CV
 * alone, so it is shared-cached like the page, and carries the CV's tag so a CV save purges it.
 */

/** Widths come in 40px steps between a phone and a wide screen, so the cache sees a few dozen keys. */
function widthParam(raw: string | null) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(1600, Math.max(280, Math.round(n / 40) * 40));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const facts = cvFacts((await readCv(getEnv(context))).entries);
  const url = new URL(request.url);
  const charts = renderCvCharts(facts, parseState(url.searchParams), { width: widthParam(url.searchParams.get("w")) });
  return new Response(JSON.stringify(charts), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": CV_CACHE_TAG,
      "x-robots-tag": "noindex",
    },
  });
}
