import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { personJsonLd, SITE, SITE_ORIGIN, webSiteJsonLd } from "~/lib/seo";

export function meta() {
  return [
    { title: SITE.name },
    { name: "description", content: SITE.description },
  ];
}

export default function Home() {
  const jsonLd = [personJsonLd(SITE_ORIGIN), webSiteJsonLd(SITE_ORIGIN)];

  return (
    <>
      <SiteHeader />
      <main className="hero">
        <div className="hero-inner">
          <p className="eyebrow">{SITE.affiliation}</p>
          <h1 className="hero-name">{SITE.name}</h1>
          <p className="hero-role">{SITE.role}</p>
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
