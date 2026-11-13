import { data } from "react-router";

import { canonicalLink } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN, publicHtmlHeaders } from "~/lib/seo";
import { SYSTEMS_PATH, loadSystemModel, systemPath } from "~/lib/systems.mjs";
import { modelMarkdown, systemMarkdown } from "capsomer/behavior/system-model";

import type { Route } from "./+types/systems[.md]";

import rawModel from "../../data/system-model.json";

const MODEL = loadSystemModel(rawModel);
// Capsomer writes the twin; the site gives its address, its pages and its words.
const MARKDOWN = {
  origin: SITE_ORIGIN,
  pageHref: systemPath,
  intro: `The systems Dustin Edwards runs. Public model of ${MODEL.as_of}.`,
  rings: { core: "Runs everything", shared: "Shared parts", used: "What people use" },
};

/**
 * The markdown twins of /systems and of each /systems/<id>, drawn from the same model as the pages and holding every
 * fact they show, so an agent reads what a person does. An id the model lacks answers 404, as its page does.
 */
export function loader({ params }: Route.LoaderArgs) {
  const id = (params as { id?: string }).id;
  const body =
    id === undefined ? modelMarkdown(MODEL, MARKDOWN) : systemMarkdown(MODEL, id, MARKDOWN);
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
