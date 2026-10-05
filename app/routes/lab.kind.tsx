import { catalogRedirect, parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";
import { data, redirect } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { LabPrimer, LabPrimers } from "~/components/lab";
import { PageShell } from "~/components/page-shell";
import { getRegistryItem, listRegistry } from "~/db/registry";
import { listPublishedLibraryRecords } from "~/db/procedures";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { LAB_PATH, PRIMERS, itemPath, kindFromSegment, kindPath, primerRow, primerRows, protocolsUsing } from "~/lib/registry/catalog.mjs";
import { KINDS } from "~/lib/registry/kinds.mjs";
import { LAB_CACHE_TAGS } from "~/lib/registry/route";
import { SITE_ORIGIN, breadcrumbJsonLd, pageMeta, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/lab.kind";

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
 * A kind's own page and one item of it, under /research/lab (docs/REGISTRY.md): /research/lab/primers is the kind's
 * catalog, with the columns made for it, and /research/lab/primers/lco1490 is the item. One module because the item
 * is the kind's own optional segment. A kind with no view here answers 404 until its change adds one.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(LAB_CACHE_TAGS));
}

const kindTitle = (kind: string) => {
  const plural = KINDS[kind]?.plural ?? kind;
  return plural.charAt(0).toUpperCase() + plural.slice(1);
};

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const kind = kindFromSegment(params.kind);
  // Only the kinds with a view of their own are served; the others join as their changes land.
  if (kind !== "primer") throw data(null, { status: 404 });

  if (params.id === undefined) {
    const canonical = catalogRedirect(PRIMERS, url);
    if (canonical) throw redirect(canonical, 301);
    const primers = primerRows(await listRegistry(env, { kind, published: true }));
    return { view: "kind" as const, kind, primers, search: url.search };
  }

  const item = await getRegistryItem(env, kind, params.id);
  if (!item) throw data(null, { status: 404 });
  // A draft is the signed-in admin's alone; that request carries a cookie, and the Worker never stores it.
  if (item.status === "draft" && !(await isAdminViewer(env, request))) throw data(null, { status: 404 });
  const [others, protocols] = await Promise.all([listRegistry(env, { kind, published: true }), listPublishedLibraryRecords(env)]);
  const primer = primerRow(item);
  const primers = others.map(primerRow);
  return { view: "item" as const, kind, primer, primers, usedBy: protocolsUsing(primer, protocols), draft: item.status === "draft" };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  if (loaderData.view === "kind") {
    const n = loaderData.primers.length;
    return pageMeta({
      title: "Primers: sequences, targets and melting temperatures",
      description: `The ${n} primer${n === 1 ? "" : "s"} the lab's protocols use, with each sequence as stored and its length and melting temperature computed.`,
      path: kindPath(loaderData.kind),
    });
  }
  const { primer, draft } = loaderData;
  const facts = [primer.direction ? `${primer.direction} primer` : "Primer", primer.target ? `for ${primer.target}` : null].filter(Boolean).join(" ");
  const sizes = [primer.length ? `${primer.length} nt` : null, primer.tm !== null ? `Tm ${primer.tm} °C` : null].filter(Boolean).join(", ");
  return [
    ...pageMeta({ title: `${primer.name}: primer`, description: `${facts}${sizes ? `, ${sizes}` : ""}.`, path: primer.path }),
    ...(draft ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

export default function LabKindRoute({ loaderData }: Route.ComponentProps) {
  const trail: Array<[string, string]> = [
    ["Research", "/research"],
    ["Lab registry", LAB_PATH],
    [kindTitle(loaderData.kind), kindPath(loaderData.kind)],
    ...(loaderData.view === "item" ? ([[loaderData.primer.name, itemPath(loaderData.kind, loaderData.primer.id)]] as Array<[string, string]>) : []),
  ];
  const crumbs = (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(SITE_ORIGIN, trail)) }} />
  );
  if (loaderData.view === "item") {
    const { primer, primers, usedBy, draft } = loaderData;
    return (
      <PageShell trail={crumbs}>
        <Breadcrumb trail={trail} />
        <h1 className="page-title" id="registry-title">
          {primer.name}
        </h1>
        {draft ? <p>Draft: only you can see this page.</p> : null}
        <LabPrimer primer={primer} primers={primers} usedBy={usedBy} />
      </PageShell>
    );
  }
  const result = queryCatalog(PRIMERS, loaderData.primers, parseCatalogParams(PRIMERS, loaderData.search));
  return (
    <PageShell trail={crumbs}>
      <Breadcrumb trail={trail} />
      <h1 className="page-title" id="registry-title">
        {kindTitle(loaderData.kind)}
      </h1>
      <LabPrimers result={result} />
      <Enhance module="catalog" />
    </PageShell>
  );
}
