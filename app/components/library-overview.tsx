import { countOf, overviewSentence, type libraryOverview } from "~/kb/procedures/library.mjs";

/**
 * The library's overview (docs/PROCEDURES.md): the phage workflow as a line of stations, then the ways in, all
 * counted from the same rows as the catalog beneath it. Set in the manual theme: numbered parts, the start-here
 * protocols on a dark panel, each browse group as a dotted-leader index. Plain links, so every entry is also an
 * address of the filtered library and the whole block works with no script.
 */
export function LibraryOverview({ overview }: { overview: ReturnType<typeof libraryOverview> }) {
  if (overview.total === 0) return null;
  return (
    <>
      <section className="cap-part library-part" aria-labelledby="library-pipeline-title">
        <h2 className="cap-part-title" id="library-pipeline-title">
          The phage workflow
        </h2>
        <p className="cap-part-lead">From soil sample to annotated genome. A filled station has a protocol here.</p>
        <ol className="library-pipeline">
          {overview.stages.map((stage, i) => (
            <li key={stage.id} className="library-stage" data-empty={stage.href ? undefined : ""}>
              <span className="library-stage-dot" aria-hidden="true">
                {i + 1}
              </span>
              {stage.href ? (
                <a className="library-stage-name" href={stage.href}>
                  {stage.label}
                </a>
              ) : (
                <span className="library-stage-name">{stage.label}</span>
              )}
              <span className="library-stage-n">
                {stage.count > 0 ? countOf(stage.count, ["protocol", "protocols"]) : "No protocol yet"}
              </span>
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
      </section>

      <section className="cap-part library-part" aria-labelledby="library-overview-title">
        <h2 className="cap-part-title" id="library-overview-title">
          In the library
        </h2>
        <p className="cap-part-lead">{overviewSentence(overview)}</p>
        <div className="library-browse-grid">
          {overview.start.length > 0 ? (
            <ol className="library-start" aria-label="Start here">
              {overview.start.map((p) => (
                <li key={p.slug}>
                  <span className="library-start-mark">Start here</span>
                  <a className="library-start-title" href={p.href}>
                    {p.title}
                  </a>
                  <span className="library-start-why">{p.description}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {overview.browse.map((group) => (
            <div key={group.id} className="library-browse">
              <h3 className="library-subtitle" id={`library-browse-${group.id}`}>
                {group.title}
              </h3>
              <ul className="cap-leader-index" aria-labelledby={`library-browse-${group.id}`}>
                {group.tiles.map((tile) => (
                  <li key={tile.id}>
                    <a className="cap-leader-index-link" href={tile.href}>
                      <span className="cap-leader-index-name">{tile.label}</span>
                      <span className="cap-leader-index-dots" aria-hidden="true" />
                      <span className="cap-leader-index-fact">{tile.count}</span>
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
        </div>
      </section>
    </>
  );
}
