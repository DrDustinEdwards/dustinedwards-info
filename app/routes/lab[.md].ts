import { listPhages } from "~/db/phages";
import { listPublishedLibraryRecords } from "~/db/procedures";
import { listRegistry } from "~/db/registry";
import { getEnv } from "~/lib/context";
import { canonicalLink } from "~/lib/markdown-twin";
import {
  LAB_PATH,
  inventoryMarkdown,
  inventoryRows,
  itemPath,
  kindFromSegment,
  kindPath,
  primerMarkdown,
  primerRow,
  primersMarkdown,
  protocolsUsing,
  tmNote,
} from "~/lib/registry/catalog.mjs";
import { LAB_CACHE_TAGS } from "~/lib/registry/route";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";

import type { Route } from "./+types/lab[.md]";

/**
 * The registry's markdown twins: /research/lab.md, /research/lab/primers.md and /research/lab/primers/<id>.md, drawn from
 * the same rows as the pages, so an agent reads the facts a person does. One module for the three addresses; each route
 * entry names it, and the params say which. Published items only: a draft has no twin.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const { kind: segment, id } = params as { kind?: string; id?: string };
  const notFound = () => new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const respond = (body: string, canonical: string) =>
    new Response(body, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": SHARED_CACHE_CONTROL,
        "cache-tag": LAB_CACHE_TAGS,
        "x-robots-tag": "noindex",
        link: canonicalLink(canonical),
      },
    });

  if (segment === undefined) {
    const [items, phages] = await Promise.all([listRegistry(env, { published: true }), listPhages(env)]);
    const rows = inventoryRows(items, phages);
    return respond(
      `# Lab registry\n\nThe lab's reference catalog, with the phages it has isolated. It records what a thing is, never how much of it the lab has or where it sits.\n\n${inventoryMarkdown(rows, SITE_ORIGIN)}\n`,
      LAB_PATH,
    );
  }

  const kind = kindFromSegment(segment);
  if (kind !== "primer") return notFound();
  const primers = (await listRegistry(env, { kind, published: true })).map(primerRow);

  if (id === undefined) {
    return respond(
      `# Primers\n\nThe primers the lab's protocols use, with each sequence as stored. Length, GC content and melting temperature are computed from the sequence. A product size is shown only where a protocol states one.\n\n${primersMarkdown(primers, SITE_ORIGIN)}\n\n${tmNote().statement} ${tmNote().annealing}\n`,
      kindPath(kind),
    );
  }

  const primer = primers.find((p) => p.id === id);
  if (!primer) return notFound();
  const usedBy = protocolsUsing(primer, await listPublishedLibraryRecords(env));
  return respond(primerMarkdown(primer, primers, usedBy, SITE_ORIGIN), itemPath(kind, primer.id));
}
