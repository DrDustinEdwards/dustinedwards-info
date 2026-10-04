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
          </li>
        ))}
      </ol>
      <h3 className="library-subtitle" id="library-browse-title">
        Browse by method
      </h3>
      <ul className="library-tiles" aria-labelledby="library-browse-title">
        {overview.tiles.map((tile) => (
          <li key={tile.id}>
            <a className="library-tile" href={tile.href}>
              <span className="library-tile-name">{tile.label}</span>
              <span className="library-tile-n">{countOf(tile.count, ["protocol", "protocols"])}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
