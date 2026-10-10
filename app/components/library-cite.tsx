import { countOf, type libraryCitation, type libraryDownloads } from "~/kb/procedures/library.mjs";

/**
 * Download and cite (docs/PROCEDURES.md): the CSV and JSON of the view shown, the markdown of the whole library, and how
 * to cite it, all from the same functions the markdown twin uses, so a person and a machine read the same address and
 * the same citation. Plain links and text: it works with no script.
 */
export function LibraryCite({
  count,
  downloads,
  citation,
  noun = ["protocol", "protocols"],
}: {
  count: number;
  /** What the library's entries are called: ["recipe", "recipes"]. */
  noun?: [string, string];
  downloads: ReturnType<typeof libraryDownloads>;
  citation: ReturnType<typeof libraryCitation>;
}) {
  return (
    <section className="library-cite" aria-labelledby="library-cite-title">
      <h2 id="library-cite-title" className="library-overview-title">
        Download and cite
      </h2>
      <p>
        Download the {countOf(count, noun)} shown as <a href={downloads.csv}>CSV</a> or{" "}
        <a href={downloads.json}>JSON</a>, with every fact the table shows, or the whole library as{" "}
        <a href={downloads.markdown}>markdown</a>.
      </p>
      <h3 className="library-subtitle">Cite the library</h3>
      <p className="library-cite-text">{citation.library}</p>
      <p>{citation.access}</p>
      <p>{citation.protocol}</p>
    </section>
  );
}
