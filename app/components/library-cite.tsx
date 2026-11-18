import type { catalogDownloads } from "capsomer/behavior/catalog";

import type { libraryCitation } from "~/kb/procedures/library.mjs";

/**
 * Download and cite (docs/PROCEDURES.md): the CSV and JSON of the view shown, the markdown of the whole library, and how
 * to cite it, all from the same functions the markdown twin uses, so a person and a machine read the same address and
 * the same citation. Plain links and text: it works with no script.
 */
export function LibraryCite({
  downloads,
  citation,
}: {
  downloads: ReturnType<typeof catalogDownloads>;
  citation: ReturnType<typeof libraryCitation>;
}) {
  return (
    <section className="cap-part library-cite" aria-labelledby="library-cite-title">
      <h2 id="library-cite-title" className="cap-part-title">
        Download and cite
      </h2>
      <p>
        <a href={downloads.csv}>CSV</a> <a href={downloads.json}>JSON</a>{" "}
        <a href={downloads.markdown}>Markdown</a>
      </p>
      <p className="library-cite-text">{citation.library}</p>
      <p>{citation.access}</p>
      <p>{citation.protocol}</p>
    </section>
  );
}
