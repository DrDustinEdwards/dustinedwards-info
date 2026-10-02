import type { Cohort } from "~/lib/roster/compile.mjs";

/**
 * The year-by-year roster, drawn from the roster table (docs/ROSTER.md). Photos and names only. The heading's id
 * is the /phage-discovery anchor (ROSTER_ANCHOR in app/lib/roster/compile.mjs, a literal here because
 * check:links reads the static id).
 */
export function PhageRoster({ cohorts }: { cohorts: Cohort[] }) {
  return (
    <section aria-labelledby="roster">
      <h2 id="roster">Roster</h2>
      {cohorts.map((entry, index) => (
        <section key={entry.year} aria-labelledby={`year-${entry.year}`}>
          <h3 id={`year-${entry.year}`}>{entry.year}</h3>
          {entry.photo ? (
            <figure>
              <img
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
            <ul>
              {entry.researchers.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Roster to be added.</p>
          )}
        </section>
      ))}
    </section>
  );
}
