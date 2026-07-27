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
        <div className="page-inner page-inner-wide">
          <h1 className="page-title">Phage Hunters</h1>
          <p className="page-intro">
            Cohorts of Tarleton State University students in the SEA-PHAGES
            program isolate bacteriophages from soil and surfaces across north
            and central Texas, and work samples from elsewhere in Texas,
            out-of-state archival isolates, and partner-lab genomes when they
            advance the work. They purify what they find, image it, and sequence
            the genomes worth sequencing. The groups below are those cohorts,
            newest first.
          </p>

          {PHAGE_YEARS.map((entry, index) => (
            <section
              key={entry.year}
              // Which side the photo takes is set here from the index, not by a
              // nth-child rule, so adding a year cannot silently reflow the page.
              className={`phage-year ${
                index % 2 === 0 ? "phage-year-roster-left" : "phage-year-photo-left"
              }`}
              aria-labelledby={`year-${entry.year}`}
            >
              <h2 id={`year-${entry.year}`} className="phage-year-heading">
                {entry.year}
              </h2>
              {entry.photo ? (
                <figure className="phage-figure">
                  <img
                    className="phage-photo"
                    src={entry.photo.src}
                    width={entry.photo.width}
                    height={entry.photo.height}
                    alt={entry.photo.alt}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </figure>
              ) : null}
              {entry.researchers.length > 0 ? (
                <ul className="roster phage-year-roster">
                  {entry.researchers.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted phage-year-roster">Roster to be added.</p>
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
