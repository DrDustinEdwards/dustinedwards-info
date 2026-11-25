/** The version notice, version history and citation of a procedure page. */

import { Heading, html } from "~/components/procedure-materials";
import { bibtex, citationText, citeFacts, versionPath } from "~/kb/procedures/cite.mjs";
import type { ProcedureRecord } from "~/kb/procedures/render.mjs";
import { SITE, SITE_ORIGIN } from "~/lib/seo";

/**
 * What a frozen version's page says when it is not the one the site is at: which version is, and where. `current` is
 * the procedure's live page, with its version (null when none is assigned); null when the procedure is no longer
 * published.
 */
export function VersionNotice({
  record,
  current,
}: {
  record: ProcedureRecord;
  current: { path: string; version: string | null } | null;
}) {
  if (current && current.version === record.version) return null;
  const date = citeFacts(record)?.date;
  return (
    <p className="procedure-version-notice" role="note">
      This is version {record.version}
      {date ? (
        <>
          , dated <time dateTime={date}>{date}</time>
        </>
      ) : null}
      , kept as it was published.{" "}
      {current ? (
        <>
          {current.version ? (
            <>The current version is version {current.version}: </>
          ) : (
            <>The procedure has since moved on: </>
          )}
          <a href={current.path}>read the current page</a>.
        </>
      ) : (
        <>The procedure is no longer on the site, so there is no current version.</>
      )}
    </p>
  );
}

/** What changed in each version, newest first. Nothing is drawn until the file writes a history. */
export function VersionHistory({
  record,
  basePath,
  frozen,
}: {
  record: ProcedureRecord;
  basePath: string;
  frozen: string[];
}) {
  // A row compiled before histories existed has no `history` until the next sync rewrites it.
  if (!record.history?.length) return null;
  return (
    <section aria-labelledby="version-history">
      <Heading id="version-history">Version history</Heading>
      <ol className="procedure-history" reversed>
        {record.history.map((h) => (
          <li key={h.version}>
            <strong>
              {frozen.includes(h.version) ? (
                <a href={versionPath(basePath, h.version)}>Version {h.version}</a>
              ) : (
                <>Version {h.version}</>
              )}
            </strong>
            , <time dateTime={h.date}>{h.date}</time>:{" "}
            <span dangerouslySetInnerHTML={html(h.summaryHtml)} />
            {h.doi ? (
              <>
                {" "}
                <a href={`https://doi.org/${h.doi}`}>doi:{h.doi}</a>
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * How to cite this version, and the BibTeX for it. Drawn only for a version that has been assigned: a procedure with no
 * version cannot be cited, and a DOI is minted only for a version that is. The citation points at the version's frozen
 * copy, or its DOI once it has one. The Zenodo deposit metadata is not on the page; `npm run zenodo:metadata -- <slug>`
 * prints it from the same file.
 */
export function CiteBlock({ record }: { record: ProcedureRecord }) {
  const facts = citeFacts(record);
  if (!facts) return null;
  const where = {
    origin: SITE_ORIGIN,
    creator: { name: SITE.name, affiliation: SITE.affiliation },
  };
  return (
    <section aria-labelledby="cite-this-procedure">
      <Heading id="cite-this-procedure">Cite this procedure</Heading>
      <p className="procedure-cite">{citationText(record, facts, where)}</p>
      <details className="procedure-bibtex">
        <summary>BibTeX</summary>
        <pre>
          <code>{bibtex(record, facts, where)}</code>
        </pre>
      </details>
    </section>
  );
}
