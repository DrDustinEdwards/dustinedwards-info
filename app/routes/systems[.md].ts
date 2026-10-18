import { canonicalLink } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN, publicHtmlHeaders } from "~/lib/seo";
import { SYSTEMS_PATH, loadSystemModel, systemsMarkdown } from "~/lib/systems.mjs";

import rawModel from "../../data/system-model.json";

const MODEL = loadSystemModel(rawModel);

/**
 * The markdown twin of /systems, drawn from the same model as the page and holding every system's
 * facts, so an agent reads what a person does (CLAUDE.md, machines and people). The old
 * /systems/<id>.md twins answer a 301 here (app/lib/path-moves.mjs).
 */
export function loader() {
  return new Response(systemsMarkdown(MODEL, SITE_ORIGIN), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      // The page's own tag, so one purge reaches the page and its twin.
      "cache-tag": publicHtmlHeaders()["Cache-Tag"],
      "x-robots-tag": "noindex",
      link: canonicalLink(SYSTEMS_PATH),
    },
  });
}
