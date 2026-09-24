import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { SITE, SITE_ORIGIN, pageMeta, personJsonLd, publicHtmlHeaders } from "~/lib/seo";

import about from "../../content/generated/about.json";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "~/styles/prose.css";

/**
 * The prose is markdown rendered at build time, so the Worker carries no markdown renderer.
 * The JSON-LD is the home page's: two Person objects for one person confuse machine readers.
 */
export function headers() {
  return new Headers(publicHtmlHeaders());
}

export function meta() {
  return pageMeta({
    title: `About | ${SITE.name}`,
    description: about.description,
    path: "/about",
  });
}

export default function About() {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <div className="page-inner">
          <header className="page-head">
            <h1>{about.title}</h1>
          </header>

          {/* Build-time HTML from repo markdown, URL allowlist already applied; no third-party input. */}
          <div className="prose" dangerouslySetInnerHTML={{ __html: about.html }} />
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd(SITE_ORIGIN)) }}
        />
      </main>
      <ShellFooter />
    </>
  );
}
