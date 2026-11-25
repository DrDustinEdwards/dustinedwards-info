import { Fragment } from "react";

import { countsAsPaper, formatDollars, type CvEntry } from "~/lib/cv/entries.mjs";
import { areaLabel, roleLabel } from "~/lib/cv/view.mjs";
import { italicizeOrganisms } from "~/lib/scientific-names";
import { isSiteOwner } from "~/lib/seo";

const isOwner = (name: string) => isSiteOwner(name) || name === "D. Edwards";

function Names({ names }: { names: string[] }) {
  return (
    <>
      {names.map((name, i) => (
        <Fragment key={`${name}-${i}`}>
          {i > 0 ? ", " : ""}
          {isOwner(name) ? <strong className="cv-me">{name}</strong> : name}
        </Fragment>
      ))}
    </>
  );
}

/** The first three authors, and Dustin where he falls later; the full list is in the details below. */
function ShortAuthors({ authors }: { authors: string[] }) {
  if (authors.length <= 4) return <Names names={authors} />;
  const at = authors.findIndex(isOwner);
  const lead = authors.slice(0, 3);
  const owner = at >= 3 ? authors[at] : undefined;
  const rest = authors.length - lead.length - (owner ? 1 : 0);
  return (
    <>
      <Names names={lead} />
      {owner ? (
        <>
          , ... <strong className="cv-me">{owner}</strong>
        </>
      ) : null}{" "}
      and {rest} more
    </>
  );
}

function Tags({ entry }: { entry: CvEntry }) {
  const parts: string[] = [];
  if (entry.role) parts.push(roleLabel(entry.role));
  for (const area of entry.areas) parts.push(areaLabel(area));
  if (parts.length === 0) return null;
  return <p className="cv-tags">{parts.join(" · ")}</p>;
}

const COPY_NAMES = { plain: "Citation", bibtex: "BibTeX", ris: "RIS" } as const;

function CopyButton({
  kind,
  label,
  entry,
}: {
  kind: "plain" | "bibtex" | "ris";
  label: string;
  entry: CvEntry;
}) {
  const paper = entry.paper;
  if (!paper) return null;
  const src = kind === "bibtex" ? paper.bibtexPath : kind === "ris" ? paper.risPath : null;
  const name = COPY_NAMES[kind];
  // Capsomer's copy (components/copy): the bubble beside the button is the message and the live region.
  return (
    <span className="cap-copy" data-cv-copy-wrap="" hidden>
      <button
        type="button"
        className="cap-btn"
        data-variant="quiet"
        data-size="sm"
        data-cv-copy={kind}
        data-cv-src={src ?? undefined}
        data-cv-for={entry.id}
        data-cap-copied={`${name} copied`}
        data-cap-failed={`${name} not copied: use the file links`}
      >
        {label}
      </button>
      <span className="cap-copy-tip" role="status" />
    </span>
  );
}

function PaperDetails({ entry }: { entry: CvEntry }) {
  const paper = entry.paper;
  if (!paper) return null;
  const n = paper.authors.length;
  return (
    <details className="cv-paper-more">
      <summary>
        {paper.hasAbstract ? "Abstract, citation" : "Citation"} and{" "}
        {n === 1 ? "author" : `all ${n} authors`}
      </summary>
      <div className="cv-paper-panel">
        <ul className="cv-links">
          {paper.pagePath ? (
            <li>
              <a href={paper.pagePath}>{paper.hasAbstract ? "Abstract" : "Paper page"}</a>
            </li>
          ) : null}
          {entry.links.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
          {paper.pdfPath ? (
            <li>
              <a href={paper.pdfPath}>PDF</a>
            </li>
          ) : null}
        </ul>
        <p className="cv-panel-label">Citation</p>
        <p className="cv-cite" id={`${entry.id}-cite`}>
          {paper.citation}
        </p>
        {paper.bibtex ? <template id={`${entry.id}-bibtex`}>{paper.bibtex}</template> : null}
        {paper.ris ? <template id={`${entry.id}-ris`}>{paper.ris}</template> : null}
        <p className="cv-cite-actions">
          <CopyButton kind="plain" label="Copy citation" entry={entry} />
          <CopyButton kind="bibtex" label="Copy BibTeX" entry={entry} />
          <CopyButton kind="ris" label="Copy RIS" entry={entry} />
          {paper.bibtexPath ? <a href={paper.bibtexPath}>BibTeX file</a> : null}
          {paper.risPath ? <a href={paper.risPath}>RIS file</a> : null}
        </p>
        <p className="cv-panel-label">Authors</p>
        <p className="cv-authors-full">
          <Names names={paper.authors} />
        </p>
      </div>
    </details>
  );
}

function EntryBody({ entry }: { entry: CvEntry }) {
  if (entry.type === "publication" && entry.paper) {
    const paper = entry.paper;
    return (
      <>
        <p className="cv-title">
          {paper.pagePath ? (
            <a href={paper.pagePath}>{italicizeOrganisms(entry.title)}</a>
          ) : (
            italicizeOrganisms(entry.title)
          )}
        </p>
        <p className="cv-authors">
          <ShortAuthors authors={paper.authors} />
        </p>
        <p className="cv-meta cv-venue">{paper.venue}</p>
        <Tags entry={entry} />
        <PaperDetails entry={entry} />
      </>
    );
  }
  return (
    <>
      <p className="cv-title">
        {entry.type === "grant" && entry.amount !== null ? (
          <span className="cv-amount">{formatDollars(entry.amount)}</span>
        ) : null}
        {entry.title}
      </p>
      {entry.meta.map((line, i) => (
        <p className="cv-meta" key={i}>
          {line}
        </p>
      ))}
      {entry.note ? <p className="cv-meta cv-note">{entry.note}</p> : null}
      {entry.duties.length > 0 ? (
        <details className="cv-duties">
          <summary>Responsibilities</summary>
          {entry.duties.map((duty) => (
            <div key={duty.heading} className="cv-duty">
              <p className="cv-panel-label">{duty.heading}</p>
              <ul>
                {duty.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      ) : null}
      <Tags entry={entry} />
    </>
  );
}

/** One or two lines each: the long lists read as a list, and the papers keep the room. */
const COMPACT = new Set(["grant", "award", "course", "service", "development"]);

export function Entry({
  entry,
  hidden,
  order,
}: {
  entry: CvEntry;
  hidden: boolean;
  order: number;
}) {
  return (
    <li
      className={`cv-entry cv-entry-${entry.type}${COMPACT.has(entry.type) ? " cv-compact" : ""}`}
      id={entry.id}
      data-cv-entry=""
      data-order={order}
      data-type={entry.type}
      data-paper={countsAsPaper(entry) ? "" : undefined}
      data-section={entry.section ?? undefined}
      data-areas={entry.areas.join(" ")}
      data-role={entry.role ?? undefined}
      data-year={entry.year ?? undefined}
      data-end={entry.endYear ?? undefined}
      data-students={entry.students ?? undefined}
      data-cohort={entry.cohort ? "" : undefined}
      data-amount={entry.amount ?? undefined}
      hidden={hidden}
    >
      <span className="cv-when cap-timeline-mark">{entry.when}</span>
      <div className="cv-body">
        <EntryBody entry={entry} />
      </div>
    </li>
  );
}
