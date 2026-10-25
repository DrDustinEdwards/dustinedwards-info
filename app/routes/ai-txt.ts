import { aiTxt } from "@drdustinedwards/site-helpers/robots";

import { HOURLY_CACHE_CONTROL, ROBOTS_DISALLOW, SITE_ORIGIN } from "~/lib/seo";

/*
 * The family's AI usage policy, from Prelum: answer engines may cite and link, training rights are reserved (the TDMRep
 * header in workers/security-headers.mjs says the same) and licensed on request. The disallow list is robots.txt's.
 */
export function loader() {
  const body = aiTxt({
    origin: SITE_ORIGIN,
    name: "Dustin Edwards",
    contact: "contact@dustinedwards.info",
    disallow: ROBOTS_DISALLOW,
  });
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": HOURLY_CACHE_CONTROL,
    },
  });
}
