import { Link } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { getCitationCounts } from "~/lib/citations.server";
import { getEnv } from "~/lib/context";
import { jsonLd } from "~/lib/json-ld.mjs";
import { paperJsonLd } from "~/lib/publications/article-json-ld.mjs";
import { buildCitationTags } from "~/lib/publications/citation-tags.mjs";
import { accessionLabel, accessionUrl } from "~/lib/publications/accessions.mjs";
import { publicationBySlug } from "~/lib/publications/by-slug";
import { TOPICS } from "~/lib/publications/topics.mjs";
import { decodeEntities } from "~/lib/publications/entities.mjs";
import { updateNoticeText } from "~/lib/publications/update-notice.mjs";
import {
  paperAskUrl,
  paperMarkdownPath,
  paperPath,
  paperPdfPath,
  PUBLICATIONS_CACHE_TAG,
  PUBLICATIONS_PATH,
} from "~/lib/publications/paths.mjs";
import { citedByFetchedAt, citedByFor } from "~/lib/publications/cited-by.mjs";
import citedByArtifact from "../../data/publications.cited-by.json";
import { italicizeOrganisms } from "~/lib/scientific-names";
import {
  breadcrumbJsonLd,
  isSiteOwner,
  pageMeta,
  personId,
  personNode,
  publicHtmlHeaders,
  SITE,
  SITE_ORIGIN,
} from "~/lib/seo";
import type { Route } from "./+types/publications.$slug";

import "~/styles/paper.css";

/**
 * The URL ends in a slash: `citation_pdf_url` must sit in the HTML abstract's subdirectory. The slug
 * is the DOI: a curated id could be re-chosen after Scholar indexed it.
 */

const TOPIC_LABEL = new Map(TOPICS.map((t) => [t.id, t.label]));

export function headers() {
  return publicHtmlHeaders(PUBLICATIONS_CACHE_TAG);
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const paper = await publicationBySlug(getEnv(context), params.slug);

  const { slug } = paper;
  const hosted = paper.access === "self-hosted" && paper.pdfPath !== null;

  // The last count shows while a stale one refreshes; a paper that never had one shows none, never a zero.
  const citations = paper.doi ? await getCitationCounts(context, [paper.doi]) : {};

  return {
    paper,
    slug,
    hosted,
    pagePath: paperPath(slug),
    pdfPath: hosted ? paperPdfPath(slug) : null,
    cited: (paper.doi ? citations[paper.doi] : null) ?? null,
    /* `total` and the list length are both carried: one paper exceeds the cap. */
    citedBy: paper.doi ? citedByFor(citedByArtifact, paper.doi) : null,
    citedByFetchedAt: citedByFetchedAt(citedByArtifact),
    topics: paper.topics.map((id) => ({ id, label: TOPIC_LABEL.get(id) ?? id })),
  };
}

/** Citation tags stay here, not in `pageMeta`: they are not social metadata. */
export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: `Publication, ${SITE.name}` }];

  const { paper, slug, pagePath, pdfPath } = loaderData;
  const title = decodeEntities(paper.title);
  const abstractUrl = `${SITE_ORIGIN}${pagePath}`;
  const pdfUrl = pdfPath ? `${SITE_ORIGIN}${pdfPath}` : null;

  const description = paper.abstract
    ? truncateAtWord(decodeEntities(paper.abstract), 155)
    : `${title}. ${decodeEntities(paper.journal ?? "")} ${paper.year}`.trim();

  return [
    ...pageMeta({
      title: `${title} | ${SITE.name}`,
      description,
      path: pagePath,
      ogType: "article",
    }),
    // A manuscript with no DOI has no registry record to cite, so it carries no Scholar tags.
    ...(paper.doi ? buildCitationTags(paper, { abstractUrl, pdfUrl }) : []),
    /* Every paper has a twin (the markdown route reads it from D1); the head is how an agent finds it. */
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${SITE_ORIGIN}${paperMarkdownPath(slug)}`,
    },
  ];
}

function truncateAtWord(text: string, limit: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}...`;
}

function Authors({ authors }: { authors: string[] }) {
  /* Every author visible: `citation_author` lists them, and Scholar penalizes content that disagrees with its meta tags. */
  return (
    <p className="paper-authors">
      {authors.map((name, i) => (
        <span key={`${name}-${i}`}>
          {i > 0 ? ", " : ""}
          {isSiteOwner(name) ? (
            <strong className="pub-author-me">{decodeEntities(name)}</strong>
          ) : (
            decodeEntities(name)
          )}
        </span>
      ))}
    </p>
  );
}

export default function Paper({ loaderData }: Route.ComponentProps) {
  const { paper, slug, hosted, pagePath, pdfPath, cited, citedBy, citedByFetchedAt, topics } =
    loaderData;
  const pageUrl = `${SITE_ORIGIN}${pagePath}`;
  // One trail for the visible breadcrumb and its BreadcrumbList, so the two cannot disagree.
  const trail: Array<[string, string]> = [
    ["Research", "/research"],
    ["Publications", PUBLICATIONS_PATH],
    [decodeEntities(paper.title), pagePath],
  ];

  return (
    <>
      <SiteHeader />
      <main id="main" className="tracks paper-tracks" tabIndex={-1}>
        <header className="paper-head">
          <Breadcrumb trail={trail} />

          {/* The H1 is the title: Scholar reads the first heading as the paper title. */}
          <h1 className="paper-title">{italicizeOrganisms(decodeEntities(paper.title))}</h1>

          <Authors authors={paper.authors} />
        </header>

        <div className="paper-rail u-rail">
          <p className="paper-machine">
            <b>{paper.year}</b>
            {paper.stage === "submitted" ? "submitted" : "published"}
            {paper.journal ? (
              <>
                <b className="paper-machine-venue">{decodeEntities(paper.journal)}</b>
                {[
                  paper.volume ? `volume ${paper.volume}` : null,
                  paper.issue ? `issue ${paper.issue}` : null,
                  paper.pages ? `pages ${paper.pages}` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </>
            ) : null}
            {paper.doi ? (
              <>
                <b>
                  <a href={`https://doi.org/${paper.doi}`}>{paper.doi}</a>
                </b>
                doi
              </>
            ) : null}
            {paper.type !== "article" ? (
              <>
                <b>{paper.type}</b>
                kind
              </>
            ) : null}
            {paper.isOpenAccess ? (
              <>
                <b>open access</b>
                license
              </>
            ) : null}
          </p>
        </div>

        <div className="paper-text">
          <p className="paper-links">
            {hosted && pdfPath ? <a href={pdfPath}>PDF</a> : null}
            {paper.pmcUrl ? <a href={paper.pmcUrl}>PMC</a> : null}
            {paper.preprintDoi ? (
              <a href={`https://doi.org/${paper.preprintDoi}`}>Preprint</a>
            ) : null}
            {paper.externalUrl ? <a href={paper.externalUrl}>Resource</a> : null}
            <a href={`${PUBLICATIONS_PATH}/${slug}.bib`}>BibTeX</a>
            <a href={`${PUBLICATIONS_PATH}/${slug}.ris`}>RIS</a>
            {/* The quoted title alone, because the classic index ANDs its terms. */}
            <a href={paperAskUrl(decodeEntities(paper.title))}>Ask about this paper</a>
          </p>

          {/* Only at 1 or more: a cold cache shows nothing rather than a zero that looks measured. */}
          {cited && cited.count >= 1 ? (
            <p className="paper-cited">
              {cited.url ? (
                <a href={cited.url}>Cited by {cited.count}</a>
              ) : (
                <>Cited by {cited.count}</>
              )}{" "}
              <span className="paper-provenance">OpenAlex, read {cited.fetchedAt}</span>
            </p>
          ) : null}

          {/* `role="status"`, not `alert`, which interrupts a screen reader mid-sentence. */}
          {paper.updateNotice ? (
            <aside className="paper-update-notice" role="status">
              <strong>{updateNoticeText(paper.updateNotice).label}.</strong>{" "}
              {updateNoticeText(paper.updateNotice).sentence}{" "}
              <a href={updateNoticeText(paper.updateNotice).url}>Read the notice</a>
            </aside>
          ) : null}

          {paper.summary ? (
            <p className="paper-summary">{italicizeOrganisms(paper.summary)}</p>
          ) : null}

          {/* Visible, never in a `details`: a crawler that must open a disclosure does not find the abstract. */}
          {paper.abstract ? (
            <section className="paper-abstract" aria-labelledby="abstract-heading">
              <h2 id="abstract-heading">Abstract</h2>
              <p>{italicizeOrganisms(decodeEntities(paper.abstract))}</p>
            </section>
          ) : null}

          {/* `accessionUrl` refuses a kind with no registry: a wrong registry is a 404 that looks like a working link. */}
          {paper.accessions.length > 0 ? (
            <section className="paper-data" aria-labelledby="data-heading">
              <h2 id="data-heading">Data</h2>
              <p className="paper-links">
                {paper.accessions.map((accession) => (
                  <a key={accession.id} href={accessionUrl(accession)}>
                    {accessionLabel(accession.kind)} {accession.id}
                  </a>
                ))}
              </p>
            </section>
          ) : null}

          {citedBy && citedBy.citing.length > 0 ? (
            <section className="paper-citedby" aria-labelledby="citedby-heading">
              <h2 id="citedby-heading">
                Cited by{" "}
                {citedBy.total > citedBy.citing.length
                  ? `${citedBy.citing.length} of ${citedBy.total}`
                  : citedBy.total}
              </h2>
              <p className="paper-provenance paper-citedby-source">
                OpenAlex, read {citedByFetchedAt ?? "an unrecorded date"}. Newest first.
              </p>
              <ol className="paper-citedby-list">
                {citedBy.citing.map((w, i) => (
                  <li key={`${w.doi ?? w.title}-${i}`}>
                    {w.doi ? (
                      <a href={`https://doi.org/${w.doi}`}>{w.title ?? w.doi}</a>
                    ) : (
                      (w.title ?? "Untitled")
                    )}
                    {w.venue ? <span className="paper-provenance">, {w.venue}</span> : null}
                    {w.year ? <span className="paper-provenance">, {w.year}</span> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {topics.length > 0 ? (
            <p className="paper-topics">
              {topics.map((t) => (
                <Link key={t.id} to={`${PUBLICATIONS_PATH}?topic=${t.id}`}>
                  {t.label}
                </Link>
              ))}
            </p>
          ) : null}
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd([
              ...paperJsonLd(paper, {
                origin: SITE_ORIGIN,
                pageUrl,
                pdfUrl: pdfPath ? `${SITE_ORIGIN}${pdfPath}` : null,
                isOwner: isSiteOwner,
                personId: personId(SITE_ORIGIN),
                personNode: personNode(SITE_ORIGIN),
                topics,
              }),
              breadcrumbJsonLd(SITE_ORIGIN, trail),
            ]),
          }}
        />
      </main>
      <ShellFooter />
    </>
  );
}
