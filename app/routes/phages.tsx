import { Catalog } from "capsomer/react/catalog";
import { data } from "react-router";
import type { ReactNode } from "react";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { getPageByPath, getPublishedPageTitles } from "~/db/pages";
import { listPhages } from "~/db/phages";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { contentPageMarkdownPath, contentPageTrail } from "~/lib/content-pages.mjs";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { contentPageJsonLd } from "~/lib/pages/page-json-ld";
import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import { phagesDbUrl } from "~/lib/phage-table.mjs";
import { HOSTS, PHAGES_PAGE_PATH, phageSlug, type Phage } from "~/lib/phages/compile.mjs";
import { PHAGES, phageListing } from "~/lib/phages/catalog.mjs";
import { SITE_ORIGIN, pageMeta, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/phages";

// Route-scoped: the catalog's tokens and components are Capsomer's, and only the pages that draw one load them.
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
import "~/styles/phages.css";

/**
 * /research/phages (docs/PHAGES.md): the page's own prose and its phage-by-phage sections, as the page row holds them,
 * with the table between them drawn as Capsomer's catalog over the phage rows: search, facets with counts, sort and
 * the count, working with no script. The page row still holds the markdown table, so the markdown twin, the search
 * records and the page's invariants are the same as ever; only the HTML table is swapped for the catalog.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(CONTENT_PAGE_HTML_TAGS));
}

/** The page's table, as the markdown renderer wrote it: the one scroll wrapper around the one table. */
const TABLE = /<div class="table-scroll"[^>]*><table>[\s\S]*?<\/table><\/div>/g;

/** The page's HTML in two halves around its table, or an error that says why it could not be cut. */
function aroundTable(html: string): [string, string] {
  const found = [...html.matchAll(TABLE)];
  if (found.length !== 1 || found[0] === undefined || found[0].index === undefined) {
    throw new Error(
      `${PHAGES_PAGE_PATH}: expected exactly one table in the page's HTML, found ${found.length}. ` +
        "The catalog replaces it, so the page compile and this route disagree about the page's shape.",
    );
  }
  const at = found[0].index;
  return [html.slice(0, at), html.slice(at + found[0][0].length)];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const row = await getPageByPath(env, PHAGES_PAGE_PATH);
  if (!row) throw data(null, { status: 404 });
  if (row.status === "draft" && !(await isAdminViewer(env, request))) throw data(null, { status: 404 });
  const page = row.record;
  const [before, after] = aroundTable(page.html);
  const titles = await getPublishedPageTitles(env, ["/research"]);
  const trail = contentPageTrail(page, (path) => titles.get(path));
  return { page, before, after, trail, phages: await listPhages(env), search: url.search, draft: row.status === "draft" };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { page, draft } = loaderData;
  return [
    ...pageMeta({ title: page.seoTitle, description: page.description, path: page.path }),
    { tagName: "link", rel: "alternate", type: "text/markdown", href: `${SITE_ORIGIN}${contentPageMarkdownPath(page.path)}` },
    ...(draft ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

/** `*M. smegmatis* mc²155` as the table has always drawn it: the organism in italics. */
function hostCell(key: string): ReactNode {
  const host = (HOSTS as Record<string, { short: string }>)[key];
  if (!host) return key;
  return host.short.split("*").map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : part));
}

const cells = {
  host: (p: Phage) => (p.host ? hostCell(p.host) : ""),
  phagesdb: (p: Phage) => (p.phagesdb ? <a href={phagesDbUrl(p.phagesdb)}>PhagesDB</a> : ""),
  paper: (p: Phage) => (p.paper ? <a href={`/research/publications/${p.paper}/`}>Paper</a> : ""),
};

export default function PhagesRoute({ loaderData }: Route.ComponentProps) {
  const { page, before, after, trail, phages, search, draft } = loaderData;
  const result = phageListing(search, phages);
  return (
    <PageShell
      trail={
        <>
          {contentPageJsonLd(page, trail, null).map((block, i) => (
            <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }} />
          ))}
        </>
      }
    >
      <Breadcrumb trail={trail} />
      <h1 className="page-title" id="phages-title">
        {page.title}
      </h1>
      {draft ? <p>Draft: only you can see this page.</p> : null}
      <div className="prose" dangerouslySetInnerHTML={{ __html: before }} />
      <div className="phage-catalog site-catalog site-catalog-wide">
        <Catalog
          definition={PHAGES}
          result={result}
          labelledBy="phages-title"
          title={(p) => <a href={`#${phageSlug(p.name)}`}>{p.name}</a>}
          cells={cells}
          emptyText={{ noMatch: "No phages match this search." }}
        />
      </div>
      <div className="prose" dangerouslySetInnerHTML={{ __html: after }} />
      <Enhance module="catalog" />
    </PageShell>
  );
}
