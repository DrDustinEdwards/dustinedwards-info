import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { publicHtmlHeaders, SITE,
  pageMeta,
} from "~/lib/seo";

import "~/styles/prose.css";

/** Publicly cacheable for cookieless readers only; workers/app.ts downgrades the rest. */
export function headers() {
  return publicHtmlHeaders();
}

/**
 * The bare state is deliberate and temporary, not something to fill in. The URL is the legacy
 * WordPress address, taken over at cutover rather than redirected.
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
                      // Only the first photo is above the fold on every viewport.
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
                  // Not dead: each October a new year lands with a photo before its roster does.
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
