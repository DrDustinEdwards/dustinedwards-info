import { getFrozenVersion } from "~/db/procedure-versions";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import { withLineage } from "~/kb/procedures/lineage.mjs";
import { lineageFor } from "~/kb/procedures/lineage.server";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/procedure.version[.md]";

/**
 * The markdown twin of a frozen version, at `<page>/v/<version>.md`: exactly the twin the version had when it was
 * published, so an agent reads the same words a person does on the version's page. The canonical is the plain twin.
 * A variant's "Based on" line is read out as its parent's title and address, as the version's page shows it (P3).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const found = /^(.*)\/v\/([^/]+?)\.md$/.exec(new URL(request.url).pathname);
  const frozen = found ? await getFrozenVersion(env, found[1] ?? "", decodeURIComponent(found[2] ?? "")) : null;
  if (!frozen) {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(withLineage(frozen.markdown, frozen.record, await lineageFor(env, frozen.record), SITE_ORIGIN), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": PROCEDURES_CACHE_TAG,
      "x-robots-tag": "noindex",
      link: canonicalLink(frozen.path),
    },
  });
}
