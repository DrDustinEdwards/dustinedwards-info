import { countOf, overviewSentence, type libraryOverview } from "~/lib/procedures/library.mjs";

/**
 * The library's overview (docs/PROCEDURES.md): its counts, the phage workflow and a tile for each method, all
 * counted from the same rows as the catalog beneath it. Plain links, so every tile is also an address of the
 * filtered library and the whole block works with no script.
 */
export function LibraryOverview({ overview }: { overview: ReturnType<typeof libraryOverview> }) {
  if (overview.total === 0) return null;
  return (
    <section className="library-overview" aria-labelledby="library-overview-title">
      <h2 id="library-overview-title" className="library-overview-title">
        In the library
      </h2>
      <p className="library-counts">{overviewSentence(overview)}</p>
      <h3 className="library-subtitle" id="library-pipeline-title">
        The phage workflow
      </h3>
      <ol className="library-pipeline" aria-labelledby="library-pipeline-title">
        {overview.stages.map((stage) => (
          <li key={stage.id} className="library-stage" data-empty={stage.href ? undefined : ""}>
            {stage.href ? (
              <a href={stage.href}>
                <span className="library-stage-name">{stage.label}</span>
                <span className="library-stage-n">{countOf(stage.count, ["protocol", "protocols"])}</span>
              </a>
            ) : (
              <span className="library-stage-name">{stage.label}</span>
            )}
            {stage.tools.length > 0 ? (
              <ul className="library-stage-tools" aria-label={`Calculators for ${stage.label}`}>
                {stage.tools.map((tool) => (
                  <li key={tool.id}>
                    <a href={tool.href}>{tool.label}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      {overview.browse.map((group) => (
        <div key={group.id} className="library-browse">
          <h3 className="library-subtitle" id={`library-browse-${group.id}`}>
            {group.title}
          </h3>
          <ul className="library-tiles" aria-labelledby={`library-browse-${group.id}`}>
            {group.tiles.map((tile) => (
              <li key={tile.id}>
                <a className="library-tile" href={tile.href}>
                  <span className="library-tile-name">{tile.label}</span>
                  <span className="library-tile-n">{countOf(tile.count, ["protocol", "protocols"])}</span>
                </a>
                {"about" in tile && typeof tile.about === "string" ? (
                  <a className="library-tile-about" href={tile.about}>
                    About the course
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
