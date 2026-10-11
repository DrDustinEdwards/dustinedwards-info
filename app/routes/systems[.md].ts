import { canonicalLink } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN, publicHtmlHeaders } from "~/lib/seo";
import { SYSTEMS_PATH, loadSystemModel, systemMarkdown, systemPath, systemsMarkdown } from "~/lib/systems.mjs";

import rawModel from "../../data/system-model.json";
import type { Route } from "./+types/systems[.md]";

const MODEL = loadSystemModel(rawModel);

/**
 * The markdown twins of /systems and /systems/<id>, drawn from the same model as the pages, so
 * an agent reads the facts a person does (CLAUDE.md, machines and people). One module for both
 * addresses; the params say which.
 */
export function loader({ params }: Route.LoaderArgs) {
  const id = (params as { system?: string }).system;
  const body = id === undefined ? systemsMarkdown(MODEL, SITE_ORIGIN) : systemMarkdown(MODEL, id, SITE_ORIGIN);
  if (body === null) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      // The pages' own tag, so one purge reaches a page and its twin.
      "cache-tag": publicHtmlHeaders()["Cache-Tag"],
      "x-robots-tag": "noindex",
      link: canonicalLink(id === undefined ? SYSTEMS_PATH : systemPath(id)),
    },
  });
}
