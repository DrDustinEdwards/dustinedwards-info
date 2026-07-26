import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { PHAGE_HUNTERS_DESCRIPTION, phageHuntersJsonLd, SITE } from "~/lib/seo";
import type { Route } from "./+types/phage-hunters";

export function meta() {
  return [
    { title: `Phage Hunters, ${SITE.name}` },
    { name: "description", content: PHAGE_HUNTERS_DESCRIPTION },
  ];
}

export function loader({ request }: Route.LoaderArgs) {
  return { origin: new URL(request.url).origin };
}

export default function PhageHunters({ loaderData }: Route.ComponentProps) {
  const { origin } = loaderData;
  const jsonLd = phageHuntersJsonLd(origin, PHAGE_YEARS);

  return (
    <>
      <SiteHeader />
      <main className="page">
        <div className="page-inner">
          <h1 className="page-title">Phage Hunters</h1>
          <p className="page-intro">
            Each year a cohort of Tarleton State University students joins the
            SEA-PHAGES program, isolating bacteriophages from local soil on the
            host <i>Microbacterium foliorum</i> NRRL B-24224. They purify what
            they find, image it, and sequence the genomes worth sequencing. The
            groups below are those cohorts, newest first.
          </p>

          {PHAGE_YEARS.map((entry, index) => (
            <section
              key={entry.year}
              className="phage-year"
              aria-labelledby={`year-${entry.year}`}
            >
              <h2 id={`year-${entry.year}`} className="phage-year-heading">
                {entry.year}
              </h2>
              {entry.photo ? (
                <img
                  className="phage-photo"
                  src={entry.photo.src}
                  width={entry.photo.width}
                  height={entry.photo.height}
                  alt={entry.photo.alt}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              ) : null}
              {entry.researchers.length > 0 ? (
                <ul className="roster">
                  {entry.researchers.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Roster to be added.</p>
              )}
            </section>
          ))}
        </div>
        <script
          type="application/ld+json"
          // schema.org data for search and language models
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
