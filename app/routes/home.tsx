import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import {
  HTML_VARY,
  PUBLIC_CACHE_CONTROL,
  DEFAULT_OG_IMAGE,
  personJsonLd,
  SITE,
  SITE_ORIGIN,
  webSiteJsonLd,
} from "~/lib/seo";

/**
 * Publicly cacheable for COOKIELESS readers only.
 *
 * This route had no `headers` export and reached `private, no-store` through the
 * hard rule 8 default. That default STAYS and still covers everything unlisted;
 * this route now opts in, and `workers/app.ts` downgrades it right back whenever
 * the request carries a cookie. Grounds on HTML_VARY in seo.ts.
 */
export function headers() {
  return { "Cache-Control": PUBLIC_CACHE_CONTROL, Vary: HTML_VARY };
}

export function meta() {
  return [
    { title: SITE.name },
    { name: "description", content: SITE.description },
    { property: "og:image", content: DEFAULT_OG_IMAGE },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export default function Home() {
  const jsonLd = [personJsonLd(SITE_ORIGIN), webSiteJsonLd(SITE_ORIGIN)];

  return (
    <>
      <SiteHeader />
      <main className="hero" id="main">
        <div className="hero-inner">
          <p className="eyebrow">{SITE.eyebrow}</p>
          <h1 className="hero-name">{SITE.name}</h1>
          <p className="hero-role">{SITE.tagline}</p>
        </div>
        {jsonLd.map((data, i) => (
          <script
            key={i}
            type="application/ld+json"
            // schema.org data for search and language models
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
