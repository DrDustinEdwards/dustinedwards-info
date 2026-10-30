import { aiTxtResponse } from "@drdustinedwards/site-helpers/robots";

import { ROBOTS_DISALLOW, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/ai-txt";

/*
 * The family's AI usage policy (Prelum's aiTxt, served whole by aiTxtResponse): answer engines may cite and link,
 * training rights are reserved (the TDMRep header says the same) and licensed on request. The disallow list is
 * robots.txt's.
 */
export function loader({ request }: Route.LoaderArgs) {
  return aiTxtResponse({
    origin: SITE_ORIGIN,
    request,
    name: "Dustin Edwards",
    contact: "contact@dustinedwards.info",
    disallow: ROBOTS_DISALLOW,
  });
}
