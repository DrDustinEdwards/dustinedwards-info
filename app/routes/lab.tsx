import { catalogRedirect, parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";
import { redirect } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { LabInventory } from "~/components/lab";
import { PageShell } from "~/components/page-shell";
import { listPhages } from "~/db/phages";
import { listRegistry } from "~/db/registry";
import { getEnv } from "~/lib/context";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { INVENTORY, LAB_PATH, inventoryRows, kindLabel } from "~/kb/registry/catalog.mjs";
import { LAB_CACHE_TAGS } from "~/kb/registry/route";
import { SITE_ORIGIN, breadcrumbJsonLd, pageMeta, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/lab";

// Route-scoped: the catalog's tokens and components are Capsomer's, and only the registry pages use them.
import "capsomer/tokens.css";
import "capsomer/field.css";
import "capsomer/button.css";
import "capsomer/table.css";
import "capsomer/chips.css";
import "capsomer/empty.css";
import "capsomer/pagination.css";
import "capsomer/catalog.css";
import "~/styles/prose.css";
import "~/styles/site-catalog.css";
import "~/styles/library.css";
import "~/styles/registry.css";

/**
 * The lab registry's master inventory at /research/lab (docs/REGISTRY.md): every published item of every kind, and the
 * phages read from their own table, in one catalog filtered by kind. The rows are D1's, so an item saved through
 * Carrel appears at the next request with no deploy. A GET form, so with script off every control works and every
 * state is an address.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(LAB_CACHE_TAGS));
}

const TITLE = "Lab registry";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  // A state written in another order, or with a default spelled out, goes to its one address.
  const canonical = catalogRedirect(INVENTORY, url);
  if (canonical) throw redirect(canonical, 301);
  const [items, phages] = await Promise.all([listRegistry(env, { published: true }), listPhages(env)]);
  return { rows: inventoryRows(items, phages), search: url.search };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const kinds = [...new Set(loaderData.rows.map((row) => row.kind))].map((kind) => `${kindLabel(kind).toLowerCase()}s`);
  return pageMeta({
    title: `${TITLE}: ${kinds.join(", ")}`,
    description: `The lab's reference catalog: ${kinds.join(" and ")}, each with its own facts.`,
    path: LAB_PATH,
  });
}

export default function LabRoute({ loaderData }: Route.ComponentProps) {
  const { rows, search } = loaderData;
  const trail: Array<[string, string]> = [
    ["Research", "/research"],
    [TITLE, LAB_PATH],
  ];
  const result = queryCatalog(INVENTORY, rows, parseCatalogParams(INVENTORY, search));
  return (
    <PageShell
      trail={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(SITE_ORIGIN, trail)) }} />}
    >
      <Breadcrumb trail={trail} />
      <h1 className="page-title" id="registry-title">
        {TITLE}
      </h1>
      <LabInventory rows={rows} result={result} />
      <Enhance module="catalog" />
    </PageShell>
  );
}
