import { data, Link } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { PageShell } from "~/components/page-shell";
import { PhageRoster } from "~/components/phage-roster";
import { contentPageMarkdownPath, contentPageTrail, protocolNeighbors } from "~/lib/content-pages.mjs";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { SITE, SITE_ORIGIN, breadcrumbJsonLd, pageMeta, publicHtmlHeaders } from "~/lib/seo";

import generated from "../../content/generated/pages.json";

import type { Route } from "./+types/content-page";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "~/styles/prose.css";

/**
 * Every Research and Teaching page (app/lib/content-pages.mjs): the research/* splat, and /teaching through
 * routes/teaching.tsx. The HTML is rendered at build time from repo markdown with the URL allowlist
 * already applied, so the Worker carries no markdown renderer and nothing third-party reaches the page.
 * The markdown twin is a static asset at the page path plus `.md` (build:content), not a second copy in
 * this bundle: pages.json keeps only what the route renders.
 */
type ContentPage = {
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  html: string;
  /** Set on the Software pages. Research and Teaching pages omit it. */
  schemaType?: string;
  productUrl?: string;
  codeRepository?: string;
  applicationCategory?: string;
};

/** The type comes from the page, so a WebSite is not emitted as an application. */
function pageJsonLd(page: ContentPage) {
  if (!page.schemaType) return null;
  return {
    "@context": "https://schema.org",
    "@type": page.schemaType,
    name: page.title,
    description: page.description,
    url: page.productUrl ?? `${SITE_ORIGIN}${page.path}`,
    author: { "@type": "Person", name: SITE.name },
    ...(page.codeRepository ? { codeRepository: page.codeRepository } : {}),
    ...(page.applicationCategory ? { applicationCategory: page.applicationCategory } : {}),
  };
}

const PAGES = new Map((generated.pages as ContentPage[]).map((page) => [page.path, page]));

export function headers() {
  return new Headers(publicHtmlHeaders());
}

export function loader({ request }: Route.LoaderArgs) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  const page = PAGES.get(pathname);
  // Registered only for listed paths, and the build refuses a missing file, so this is a broken build.
  if (!page) throw data(null, { status: 404 });
  return { page };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { page } = loaderData;
  return [
    ...pageMeta({ title: page.seoTitle, description: page.description, path: page.path }),
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${SITE_ORIGIN}${contentPageMarkdownPath(page.path)}`,
    },
  ];
}

export default function ContentPageRoute({ loaderData }: Route.ComponentProps) {
  const { page } = loaderData;
  const titleOf = (path: string) => PAGES.get(path)?.title;
  const trail = contentPageTrail(page, titleOf);
  const neighbors = protocolNeighbors(page.path);
  const schema = pageJsonLd(page);
  return (
    <PageShell
      trail={
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd(breadcrumbJsonLd(SITE_ORIGIN, trail)),
            }}
          />
          {schema ? (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
            />
          ) : null}
        </>
      }
    >
      <Breadcrumb trail={trail} />
      <h1 className="page-title">{page.title}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: page.html }} />
      {neighbors ? (
        <nav className="protocol-neighbors" aria-label="Protocols">
          {neighbors.previous ? (
            <Link to={neighbors.previous}>Previous: {titleOf(neighbors.previous)}</Link>
          ) : null}
          {neighbors.next ? <Link to={neighbors.next}>Next: {titleOf(neighbors.next)}</Link> : null}
        </nav>
      ) : null}
      {page.path === "/teaching/phage-discovery" ? (
        <div className="prose">
          <PhageRoster />
        </div>
      ) : null}
    </PageShell>
  );
}
