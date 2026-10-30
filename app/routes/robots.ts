import { robotsResponse } from "@drdustinedwards/site-helpers/robots";

import { ROBOTS_DISALLOW, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/robots";

/*
 * Advisory only. The real controls: `X-Robots-Tag` and `no-store` on /preview, and POST-only on
 * /search/ask, which is disallowed because every answer is billed. A request on any other origin (a
 * Worker Preview, a PR's draft of the site) tells every crawler `Disallow: /`, with no-store and
 * noindex; the gateway's X-Robots-Tag: noindex is the real control there. The notes are Prelum's
 * default, the ai.txt and llms.txt pointers.
 */
export function loader({ request }: Route.LoaderArgs) {
  return robotsResponse({ origin: SITE_ORIGIN, request, disallow: ROBOTS_DISALLOW });
}
