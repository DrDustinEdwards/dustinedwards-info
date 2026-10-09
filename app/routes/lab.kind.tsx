import { catalogRedirect, parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";
import { data, redirect } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { LabPrimer, LabEquipment, LabPrimers, LabReagents, LabStrain, LabStrains } from "~/components/lab";
import { PageShell } from "~/components/page-shell";
import { listPhages } from "~/db/phages";
import { getRegistryItem, listRegistry } from "~/db/registry";
import { listPublishedLibraryRecords } from "~/db/procedures";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { EQUIPMENT_CATALOG, LAB_PATH, PRIMERS, REAGENTS, STRAINS, equipmentRows, hasItemPage, itemPath, kindFromSegment, kindPath, primerRow, primerRows, protocolsUsing, protocolsUsingStrain, reagentRows, strainRow, strainRows } from "~/kb/registry/catalog.mjs";
import { KINDS } from "~/kb/registry/kinds.mjs";
import type { EquipmentRow, PrimerRow, ReagentRow, StrainRow } from "~/kb/registry/catalog.mjs";
import { LAB_CACHE_TAGS } from "~/kb/registry/route";
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

type Used = Array<{ path: string; title: string }>;
/* Declared, not inferred: the router merges the shapes of a loader's separate returns, which would make every field optional. */
type Page =
  | { view: "kind"; kind: "primer"; primers: ReturnType<typeof primerRows>; search: string }
  | { view: "kind"; kind: "strain"; strains: StrainRow[]; search: string }
  | { view: "kind"; kind: "reagent"; reagents: ReagentRow[]; search: string }
  | { view: "kind"; kind: "equipment"; items: EquipmentRow[]; search: string }
  | { view: "item"; kind: "primer"; primer: PrimerRow; primers: PrimerRow[]; usedBy: Used; draft: boolean }
  | { view: "item"; kind: "strain"; strain: StrainRow; usedBy: Used; draft: boolean };

export async function loader({ request, params, context }: Route.LoaderArgs): Promise<{ page: Page }> {
  const env = getEnv(context);
  const url = new URL(request.url);
  const kind = kindFromSegment(params.kind);
  // Only the kinds with a view of their own are served; the others join as their changes land.
  if (kind !== "primer" && kind !== "strain" && kind !== "reagent" && kind !== "equipment") throw data(null, { status: 404 });

  if (params.id === undefined) {
    const canonical =
      kind === "primer"
        ? catalogRedirect(PRIMERS, url)
        : kind === "strain"
          ? catalogRedirect(STRAINS, url)
          : kind === "reagent"
            ? catalogRedirect(REAGENTS, url)
            : catalogRedirect(EQUIPMENT_CATALOG, url);
    if (canonical) throw redirect(canonical, 301);
    const published = await listRegistry(env, { kind, published: true });
    if (kind === "primer") return { page: { view: "kind", kind, primers: primerRows(published), search: url.search } };
    if (kind === "strain") return { page: { view: "kind", kind, strains: strainRows(published, await listPhages(env)), search: url.search } };
    if (kind === "reagent") return { page: { view: "kind", kind, reagents: reagentRows(published, await listPublishedLibraryRecords(env)), search: url.search } };
    return { page: { view: "kind", kind, items: equipmentRows(published, await listPublishedLibraryRecords(env)), search: url.search } };
  }

  // A kind that is one table has no page for an item, and no address is kept for one that had a page.
  if (kind === "reagent" || kind === "equipment" || !hasItemPage(kind)) throw data(null, { status: 404 });
  const item = await getRegistryItem(env, kind, params.id);
  if (!item) throw data(null, { status: 404 });
  // A draft is the signed-in admin's alone; that request carries a cookie, and the Worker never stores it.
  if (item.status === "draft" && !(await isAdminViewer(env, request))) throw data(null, { status: 404 });
  const draft = item.status === "draft";
  if (kind === "strain") {
    const [phages, protocols] = await Promise.all([listPhages(env), listPublishedLibraryRecords(env)]);
    const strain = strainRow(item, phages);
    return { page: { view: "item", kind, strain, usedBy: protocolsUsingStrain(strain, protocols), draft } };
  }
  const [others, protocols] = await Promise.all([listRegistry(env, { kind, published: true }), listPublishedLibraryRecords(env)]);
  const primer = primerRow(item);
  const primers = others.map(primerRow);
  return { page: { view: "item", kind, primer, primers, usedBy: protocolsUsing(primer, protocols), draft } };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const page = loaderData.page;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (page.view === "kind") {
    if (page.kind === "strain") {
      return pageMeta({
        title: "Strains: the bacterial hosts of the lab's phage work",
        description: `The ${plural(page.strains.length, "bacterial strain")} the lab's phages are isolated on, with each one's culture collection number and the phages counted from the phages table.`,
        path: kindPath(page.kind),
      });
    }
    if (page.kind === "equipment") {
      return pageMeta({
        title: "Equipment: the instruments and labware the lab's protocols use",
        description: `The ${plural(page.items.length, "item")} the lab's protocols list under Equipment, in one table: manufacturer, rotor where it matters, and the protocols that use each.`,
        path: kindPath(page.kind),
      });
    }
    if (page.kind === "reagent") {
      return pageMeta({
        title: "Reagents: what the lab's protocols use",
        description: `The ${plural(page.reagents.length, "reagent")} the lab's protocols use, in one table: supplier, catalog number, a link, and the protocols that use each. A reagent the lab prepares links its recipe.`,
        path: kindPath(page.kind),
      });
    }
    return pageMeta({
      title: "Primers: sequences, targets and melting temperatures",
      description: `The ${plural(page.primers.length, "primer")} the lab's protocols use, with each sequence as stored and its length and melting temperature computed.`,
      path: kindPath(page.kind),
    });
  }
  const noindex = page.draft ? [{ name: "robots", content: "noindex" }] : [];
  if (page.kind === "strain") {
    const { strain } = page;
    const facts = [strain.collection && strain.collectionNumber ? `${strain.collection} ${strain.collectionNumber}` : null, `${plural(strain.phages.length, "phage")} isolated on it`]
      .filter(Boolean)
      .join(", ");
    return [...pageMeta({ title: `${strain.name}: strain`, description: `${strain.organism ?? "Bacterial"} host strain, ${facts}.`, path: strain.path }), ...noindex];
  }
  const { primer } = page;
  const facts = [primer.direction ? `${primer.direction} primer` : "Primer", primer.target ? `for ${primer.target}` : null].filter(Boolean).join(" ");
  const sizes = [primer.length ? `${primer.length} nt` : null, primer.tm !== null ? `Tm ${primer.tm} °C` : null].filter(Boolean).join(", ");
  return [...pageMeta({ title: `${primer.name}: primer`, description: `${facts}${sizes ? `, ${sizes}` : ""}.`, path: primer.path }), ...noindex];
}

export default function LabKindRoute({ loaderData }: Route.ComponentProps) {
  const page = loaderData.page;
  const item = page.view === "item" ? (page.kind === "strain" ? page.strain : page.primer) : null;
  const trail: Array<[string, string]> = [
    ["Research", "/research"],
    ["Lab registry", LAB_PATH],
    [kindTitle(page.kind), kindPath(page.kind)],
    ...(item ? ([[item.name, itemPath(page.kind, item.id)]] as Array<[string, string]>) : []),
  ];
  const crumbs = (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd(SITE_ORIGIN, trail)) }} />
  );
  if (page.view === "item") {
    const draft = page.draft;
    return (
      <PageShell trail={crumbs}>
        <Breadcrumb trail={trail} />
        <h1 className="page-title" id="registry-title">
          {item?.name}
        </h1>
        {draft ? <p>Draft: only you can see this page.</p> : null}
        {page.kind === "strain" ? (
          <LabStrain strain={page.strain} usedBy={page.usedBy} />
        ) : (
          <LabPrimer primer={page.primer} primers={page.primers} usedBy={page.usedBy} />
        )}
      </PageShell>
    );
  }
  return (
    <PageShell trail={crumbs}>
      <Breadcrumb trail={trail} />
      <h1 className="page-title" id="registry-title">
        {kindTitle(page.kind)}
      </h1>
      {page.kind === "strain" ? (
        <LabStrains result={queryCatalog(STRAINS, page.strains, parseCatalogParams(STRAINS, page.search))} />
      ) : page.kind === "reagent" ? (
        <LabReagents result={queryCatalog(REAGENTS, page.reagents, parseCatalogParams(REAGENTS, page.search))} />
      ) : page.kind === "equipment" ? (
        <LabEquipment result={queryCatalog(EQUIPMENT_CATALOG, page.items, parseCatalogParams(EQUIPMENT_CATALOG, page.search))} />
      ) : (
        <LabPrimers result={queryCatalog(PRIMERS, page.primers, parseCatalogParams(PRIMERS, page.search))} />
      )}
      <Enhance module="catalog" />
    </PageShell>
  );
}
