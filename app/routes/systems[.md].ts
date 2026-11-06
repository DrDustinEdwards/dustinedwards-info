import { data } from "react-router";

import { canonicalLink } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN, publicHtmlHeaders } from "~/lib/seo";
import {
  SYSTEMS_PATH,
  loadSystemModel,
  systemPath,
  systemSectionMarkdown,
  systemsMarkdown,
} from "~/lib/systems.mjs";

import type { Route } from "./+types/systems[.md]";

import rawModel from "../../data/system-model.json";

const MODEL = loadSystemModel(rawModel);

/**
 * The markdown twins of /systems and of each /systems/<id>, drawn from the same model as the pages and holding every
 * fact they show, so an agent reads what a person does. An id the model lacks answers 404, as its page does.
 */
export function loader({ params }: Route.LoaderArgs) {
  const id = (params as { id?: string }).id;
  const body =
    id === undefined
      ? systemsMarkdown(MODEL, SITE_ORIGIN)
      : systemSectionMarkdown(MODEL, id, SITE_ORIGIN);
  if (body === null) throw data(null, { status: 404 });
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      // The pages' own tag, so one purge reaches every page and twin.
      "cache-tag": publicHtmlHeaders()["Cache-Tag"],
      "x-robots-tag": "noindex",
      link: canonicalLink(id === undefined ? SYSTEMS_PATH : systemPath(id)),
    },
  });
}
