import { robotsDocument } from "@drdustinedwards/site-helpers/robots";

import { getEnv } from "~/lib/context";
import { HOURLY_CACHE_CONTROL, ROBOTS_DISALLOW, SITE_ORIGIN } from "~/lib/seo";
import { isWorkerPreview } from "~/lib/worker-preview";
import type { Route } from "./+types/robots";

/*
 * Advisory only. The real controls: `X-Robots-Tag` and `no-store` on /preview, and POST-only on
 * /search/ask, which is disallowed because every answer is billed. A Worker Preview is a PR's draft
 * of the site, so every crawler is told `Disallow: /`; the gateway's X-Robots-Tag: noindex is the
 * real control there.
 */
export function loader({ context }: Route.LoaderArgs) {
  const preview = isWorkerPreview(getEnv(context));
  const body = robotsDocument({
    origin: SITE_ORIGIN,
    disallow: ROBOTS_DISALLOW,
    notes: [`AI usage policy: ${SITE_ORIGIN}/ai.txt`, `LLM guide: ${SITE_ORIGIN}/llms.txt`],
    preview,
  });
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": preview ? "no-store" : HOURLY_CACHE_CONTROL,
    },
  });
}
