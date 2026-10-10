import { getProcedureByPath, getPublishedProcedureMarkdown, listPublishedLibraryRecords } from "~/db/procedures";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import { libraryItems, workflowContext, workflowMarkdown } from "~/kb/procedures/library.mjs";
import { withLineage } from "~/kb/procedures/lineage.mjs";
import { lineageFor } from "~/kb/procedures/lineage.server";
import { proofMarkdown } from "~/kb/procedures/proof.mjs";
import { proofFor } from "~/kb/procedures/proof.server";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/procedure[.md]";

/**
 * A procedure's markdown twin at `<page>.md`, generated from the same file as the page
 * (app/kb/procedures/render.mjs), so an agent reads the facts a person does. Drafts answer 404.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const path = new URL(request.url).pathname.replace(/\.md$/, "");
  const env = getEnv(context);
  const stored = await getPublishedProcedureMarkdown(env, path);
  if (stored === null) {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  // A protocol's place in the phage workflow depends on the other protocols, so it is added here, not stored in the row.
  const workflow = workflowMarkdown(workflowContext(libraryItems(await listPublishedLibraryRecords(env)), path), SITE_ORIGIN);
  // Proof of use is slugs in the file; the twin gives the papers' titles and the phages' names, as the page does.
  const row = await getProcedureByPath(env, path);
  const proof = proofMarkdown(await proofFor(env, row?.record.proofOfUse ?? null), SITE_ORIGIN);
  const extra = [workflow, proof].filter(Boolean).join("\n\n");
  // A variant's parent by its title and address, as the page's "Based on" (P3).
  const named = row ? withLineage(stored, row.record, await lineageFor(env, row.record), SITE_ORIGIN) : stored;
  const markdown = extra ? `${named.trimEnd()}\n\n${extra}\n` : named;
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      "cache-tag": PROCEDURES_CACHE_TAG,
      // As every other page twin (public/_headers): the HTML page is the one to index.
      "x-robots-tag": "noindex",
      link: canonicalLink(path),
    },
  });
}
