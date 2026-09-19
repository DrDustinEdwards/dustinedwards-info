import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { publicHtmlHeaders, SITE,
  pageMeta,
} from "~/lib/seo";

import "~/styles/prose.css";

/**
 * Publicly cacheable for COOKIELESS readers only. See home.tsx; same shape,
 * same downgrade in workers/app.ts.
 */
export function headers() {
  return publicHtmlHeaders();
}

/**
 * Roster. Photos and names, by year, and nothing else.
 *
 * No intro copy, no JSON-LD, no description constant. The bare state is deliberate
 * and temporary rather than something to helpfully fill in.
 *
 * THE URL IS /phage-discovery: the legacy WordPress address, indexed and carrying
 * whatever inbound links this content has, so the Worker takes it over at cutover
 * instead of redirecting it. That also makes this page the correction to a real
 * error in the legacy one.
 *
 * EVERYTHING IS STYLED BY `.prose`, deliberately: it already carries the ratified
 * treatment and `check:contrast` already covers it.
 */

export function meta() {
  return pageMeta({
    title: `Roster, ${SITE.name}`,
    description: "Year-by-year roster, 2017 to 2025.",
    path: "/phage-discovery",
  });
}

export default function Roster() {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <div className="page-inner">
          <h1 className="page-title">Roster</h1>

          <div className="prose">
            {PHAGE_YEARS.map((entry, index) => (
              <section key={entry.year} aria-labelledby={`year-${entry.year}`}>
                <h2 id={`year-${entry.year}`}>{entry.year}</h2>

                {entry.photo ? (
                  <figure>
                    <img
                      src={entry.photo.src}
                      width={entry.photo.width}
                      height={entry.photo.height}
                      alt={entry.photo.alt}
                      // The first photo is above the fold on every viewport;
                      // the rest are not, so only it is worth blocking on.
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  </figure>
                ) : null}

                {entry.researchers.length > 0 ? (
                  <ul>
                    {entry.researchers.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  // Kept deliberately, and it is not dead. Each October a new
                  // year lands with a photo before its roster does.
                  <p className="muted">Roster to be added.</p>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>
      <ShellFooter />
    </>
  );
}
