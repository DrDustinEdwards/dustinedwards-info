import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { SITE } from "~/lib/seo";

/**
 * Roster. Names, by year, and nothing else.
 *
 * The page this replaces carried two intro paragraphs, a CollectionPage JSON-LD
 * node and a description constant. All three are deliberately absent: the page
 * is the roster.
 *
 * **The URL is /phage-discovery, and that is a deliberate choice rather than a
 * leftover.** It is the legacy WordPress URL, indexed and carrying whatever
 * inbound links and search equity this content has, so the Worker takes it over
 * at DNS cutover instead of redirecting it. The legacy page at that address is
 * also WRONG: it lists the 2022 roster twice, once under a 2024 heading, so the
 * real 2024 cohort appears nowhere on it. This page is the correction.
 *
 * The nine photo assets stay at `/phage-hunters/*` and do NOT follow the page.
 * Those object URLs are cited in other people's published work and are frozen
 * by the repo's hard rule 7, so the page prefix and the asset prefix differ on
 * purpose. Do not "tidy" them into agreement.
 */

export function meta() {
  return [
    { title: `Roster, ${SITE.name}` },
    { name: "description", content: "Year-by-year roster, 2017 to 2025." },
  ];
}

export default function Roster() {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main">
        <div className="page-inner">
          <h1 className="page-title">Roster</h1>

          {PHAGE_YEARS.map((entry, index) => (
            <section
              key={entry.year}
              className="roster-year"
              aria-labelledby={`year-${entry.year}`}
            >
              <h2 id={`year-${entry.year}`} className="roster-heading">
                {entry.year}
              </h2>

              {entry.photo ? (
                <figure className="roster-figure">
                  <img
                    className="roster-photo"
                    src={entry.photo.src}
                    width={entry.photo.width}
                    height={entry.photo.height}
                    alt={entry.photo.alt}
                    // The first photo is above the fold on every viewport; the
                    // rest are not, so only it is worth blocking on.
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </figure>
              ) : null}

              {entry.researchers.length > 0 ? (
                <ul className="roster-names">
                  {entry.researchers.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                // Kept deliberately, and it is not dead. Each October a new year
                // lands with a photo before its roster does.
                <p className="muted">Roster to be added.</p>
              )}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
