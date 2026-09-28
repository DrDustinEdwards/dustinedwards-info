import { PHAGE_YEARS } from "~/data/phage-hunters";

/** The year-by-year roster. Photos and names only. The heading's id is the /phage-discovery anchor. */
export function PhageRoster() {
  return (
    <section aria-labelledby="roster">
      <h2 id="roster">Roster</h2>
      {PHAGE_YEARS.map((entry, index) => (
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
