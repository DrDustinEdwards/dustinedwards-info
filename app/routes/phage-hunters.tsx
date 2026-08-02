import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { SITE } from "~/lib/seo";

/**
 * Roster. Names, by year, and nothing else.
 *
 * The page this replaces carried two intro paragraphs, a CollectionPage JSON-LD
 * node and a description constant. All three are deliberately absent: the page
 * is the roster. Its URL is unchanged at /phage-hunters, because those nine
 * photo assets live under that prefix and other people's citations point at it.
 *
 * The alternating photo-left layout the old page used is gone with it. It
 * depended on `.page-inner-wide` and the `.phage-*` rules, which were removed
 * when the page was, and a bare roster does not need a layout that elaborate.
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
