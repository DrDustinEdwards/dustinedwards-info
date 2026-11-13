import { pictureProps } from "@dustinedwards/site-runtime/image";

import { Picture } from "capsomer/react/picture";
import { images, mediaContentVersion } from "~/lib/media/images.mjs";
import type { Cohort } from "~/lib/roster/compile.mjs";

/**
 * The year-by-year roster, each cohort a Capsomer split (capsomer/split.css): names beside the photo, sides
 * alternating by year (even years names left), stacked on a phone, drawn from the roster table
 * (docs/ROSTER.md). Photos and names only. The heading's id is the /phage-discovery anchor (ROSTER_ANCHOR in app/lib/roster/compile.mjs, a literal here because
 * check:links reads the static id).
 */
export function PhageRoster({ cohorts }: { cohorts: Cohort[] }) {
  return (
    <section aria-labelledby="roster" className="phage-roster" data-cap="lightbox">
      <h2 id="roster">Roster</h2>
      {cohorts.map((entry) => (
        <section
          key={entry.year}
          aria-labelledby={`year-${entry.year}`}
          className="cap-split"
          data-flip={entry.year % 2 === 0 ? undefined : ""}
        >
          <h3 id={`year-${entry.year}`} className="cap-split-head">
            {entry.year}
          </h3>
          {entry.researchers.length > 0 ? (
            <ul className="cap-split-text" data-list="names">
              {entry.researchers.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : (
            <p className="cap-split-text muted">Roster to be added.</p>
          )}
          {entry.photo ? (
            <figure className="cap-split-media">
              {/* Below the page's prose, so none is the LCP: every photo loads lazily, through /media's sizes. A click opens the full-size file in Prelum's lightbox (the roster island). */}
              <a
                className="image-link"
                href={entry.photo.src}
                aria-label={`View the ${entry.year} cohort photo full size`}
              >
                <Picture
                  picture={pictureProps(
                    images.attributes(
                      {
                        src: entry.photo.src,
                        width: entry.photo.width,
                        height: entry.photo.height,
                        version: mediaContentVersion(entry.photo.src),
                      },
                      "content",
                    ),
                    { alt: entry.photo.alt },
                  )}
                />
              </a>
            </figure>
          ) : null}
        </section>
      ))}
    </section>
  );
}
