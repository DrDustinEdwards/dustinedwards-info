import { Form } from "react-router";

import { DemoHeader, Problem } from "~/components/playground/demo-parts";
import { QUERY_CAP } from "~/lib/playground/limits";
import type { searchAnatomyDemo } from "~/lib/playground/search-anatomy";
import { PLAYGROUND_URL, demoAnchor } from "~/lib/playground-page.mjs";

type Props = Awaited<ReturnType<typeof searchAnatomyDemo>> & {
  /** The other demos' state as hidden fields, so submitting this form keeps their results. */
  carry: React.ReactNode;
};

export function SearchAnatomyDemo({ anatomy, anatomyError, qRaw, carry }: Props) {
  return (
    <section id={demoAnchor("search-anatomy")} className="playground-demo">
      <DemoHeader slug="search-anatomy" />

      <Form method="get" action={PLAYGROUND_URL} className="playground-form">
        {carry}
        <div className="playground-field playground-field-wide">
          <label htmlFor="pg-q">Query</label>
          <input
            id="pg-q" name="q" type="search"
            maxLength={QUERY_CAP} defaultValue={qRaw}
            aria-describedby="pg-q-cap"
          />
        </div>
        <button type="submit">Run</button>
        <p id="pg-q-cap" className="playground-cap">
          Up to {QUERY_CAP} characters. Nothing you type is stored.
        </p>
      </Form>

      {anatomyError && <Problem>{anatomyError}</Problem>}

      {anatomy && anatomy.total === 0 && (
        <p className="playground-note">
          No rows matched, so there is nothing to fuse. Try a word that
          appears in an article, like <code>fusion</code> or{" "}
          <code>durable</code>.
        </p>
      )}

      {anatomy && anatomy.browse && (
        <p className="playground-note">
          That query has filters but no matchable text, so it took the
          browse path: a plain filtered listing with no ranking and
          therefore no fusion to show.
        </p>
      )}

      {anatomy?.explain && anatomy.total > 0 && (
        <div className="playground-result">
{/* No timing: a wall-clock value would make one result URL render differently on each fetch. */}
          <p className="playground-note">
            {anatomy.explain.identityCount} row(s) from{" "}
            <code>search_identity</code>, {anatomy.explain.proseCount} from{" "}
            <code>search_prose</code>.
          </p>
          <div className="playground-table-scroll">
            <table className="playground-table">
              <caption>
                Within each layer, ordering comes from bm25. Values from
                differently tokenized indexes are not comparable, so
                reciprocal rank fusion combines the ranks rather than the
                scores. That is why there is no score column: each row
                contributes 1/(k + rank) from every layer it appeared in,
                with k = {anatomy.explain.k}, and the totals are what sort
                the results.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Result</th>
                  <th scope="col">Identity rank</th>
                  <th scope="col">Prose rank</th>
                  <th scope="col">Identity 1/(k+rank)</th>
                  <th scope="col">Prose 1/(k+rank)</th>
                  <th scope="col">Fused total</th>
                </tr>
              </thead>
              <tbody>
                {anatomy.explain.rows.slice(0, 10).map((row) => (
                  <tr key={row.uid}>
                    <th scope="row">
                      <a href={row.url}>{row.title}</a>
                      {row.docTitle && row.docTitle !== row.title && (
                        <span className="playground-row-parent">
                          in {row.docTitle}
                        </span>
                      )}
                    </th>
                    <td>{row.identityRank ?? "not returned"}</td>
                    <td>{row.proseRank ?? "not returned"}</td>
                    <td>
                      {row.identityContribution === null
                        ? "0"
                        : row.identityContribution.toFixed(5)}
                    </td>
                    <td>
                      {row.proseContribution === null
                        ? "0"
                        : row.proseContribution.toFixed(5)}
                    </td>
                    <td>
                      <strong>{row.score.toFixed(5)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
