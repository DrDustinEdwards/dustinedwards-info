import { SiteFooter } from "~/components/site-footer";
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
 * No intro copy, no JSON-LD, no description constant. Dustin's instruction, and
 * the title is "for the time being", so treat the bare state as deliberate and
 * temporary rather than as something to helpfully fill in.
 *
 * **The URL is /phage-discovery.** It is the legacy WordPress address, indexed
 * and carrying whatever inbound links this content has, so the Worker takes it
 * over at DNS cutover instead of redirecting it. That also makes this page the
 * correction to a real error: the legacy page lists the 2022 roster twice, once
 * under a 2024 heading, so the actual 2024 cohort appears nowhere on it.
 *
 * **The photos are served from /phage-hunters/*, a static prefix, not a route.**
 * The page path and the asset path differ, which is a leftover rather than a
 * rule: the orphaned-assets rule that froze those object URLs was removed on
 * 2026-08-02. The photos are ordinary assets and are expected to move into R2
 * with the rest of the media, at which point the srcs in the data file change
 * and nothing here does.
 *
 * **Everything is styled by `.prose`, deliberately.** It already carries the
 * ratified treatment for h2, figure, img and ul, and check:contrast already
 * covers it, so this page needs no rules of its own. The alternative was a
 * `.roster-*` block in a 142 kB stylesheet for markup that prose describes
 * exactly. If the columned name list is wanted later, that is the moment to add
 * CSS, not before.
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
      <main className="page" id="main">
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
      <SiteFooter />
    </>
  );
}
