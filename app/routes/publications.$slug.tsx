import { Link } from "react-router";

import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { PUBLICATIONS, TOPICS, type Publication } from "~/data/publications";
import { getCitationCounts } from "~/lib/citations.server";
import { jsonLd } from "~/lib/json-ld.mjs";
import { paperJsonLd } from "~/lib/publications/article-json-ld.mjs";
import { buildCitationTags } from "~/lib/publications/citation-tags.mjs";
import { accessionLabel, accessionUrl } from "~/lib/publications/accessions.mjs";
import { decodeEntities } from "~/lib/publications/entities.mjs";
import { updateNoticeText } from "~/lib/publications/update-notice.mjs";
import {
  doiSlug,
  paperAskUrl,
  paperPath,
  paperPdfPath,
  PUBLICATIONS_PATH,
} from "~/lib/publications/paths.mjs";
import { citedByFetchedAt, citedByFor } from "~/lib/publications/cited-by.mjs";
import citedByArtifact from "../../data/publications.cited-by.json";
import { italicizeOrganisms } from "~/lib/scientific-names";
import {
  isSiteOwner,
  pageMeta,
  personId,
  personNode,
  publicHtmlHeaders,
  SITE,
  SITE_ORIGIN,
} from "~/lib/seo";
import type { Route } from "./+types/publications.$slug";

/*
 * NOT listing.css: this page renders none of its classes. The list it is reached from is the one
 * that draws a page label, filters and a pager; `.tracks` itself is root's.
 */
import "~/styles/paper.css";

/**
 * ONE PAGE PER PAPER, which is the whole reason this route exists: a browse page
 * listing many papers is explicitly not a unique URL for each.
 *
 * THE URL ENDS IN A SLASH, AND IT IS NOT A STYLE CHOICE. `citation_pdf_url` must
 * refer to a file in the same subdirectory as the HTML abstract, and only the
 * trailing-slash spelling puts the PDF there.
 *
 * THE SLUG IS THE DOI, NOT A CURATED ID: a name somebody chose can be chosen
 * again, and a publication URL that is re-decidable will be re-decided after
 * Scholar has indexed it.
 */

/** Built once at module scope. The corpus is a committed artifact, not a query. */
const BY_SLUG = new Map<string, Publication>(
  PUBLICATIONS.map((p) => [doiSlug(p.doi), p]),
);

const TOPIC_LABEL = new Map(TOPICS.map((t) => [t.id, t.label]));

export function headers() {
  return publicHtmlHeaders();
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const paper = BY_SLUG.get(params.slug ?? "");
  /*
   * 404 out of the loader. There is no database read to save: the map above is the
   * corpus, so an unknown slug is known to be unknown before anything is fetched.
   */
  if (!paper) throw new Response("Not found", { status: 404 });

  const slug = doiSlug(paper.doi);
  const hosted = paper.access === "self-hosted" && paper.pdfPath !== null;

  // Whatever KV already holds. Cold means no count rendered, never a zero.
  const citations = await getCitationCounts(context, [paper.doi]);

  return {
    paper,
    slug,
    hosted,
    pagePath: paperPath(slug),
    pdfPath: hosted ? paperPdfPath(slug) : null,
    cited: citations[paper.doi] ?? null,
    /*
     * From the committed artifact rather than from OpenAlex at request time, and it
     * carries the date it was read rather than pretending to be current.
     *
     * `total` and the list length are BOTH carried, because one paper exceeds the cap
     * and the page has to be able to say so.
     */
    citedBy: citedByFor(citedByArtifact, paper.doi),
    citedByFetchedAt: citedByFetchedAt(citedByArtifact),
    topics: paper.topics.map((id) => ({ id, label: TOPIC_LABEL.get(id) ?? id })),
  };
}

/**
 * `pageMeta` FOR THE SOCIAL HALF. Five pages once ended up with five different
 * partial social sets, each missing a different edge, and every one was a page
 * whose author thought it was special. The repair was to teach `pageMeta` the one
 * thing this page needed, not to take an exemption.
 *
 * The citation tags stay here: they are not social metadata and they are built by
 * a module `check:features` calls.
 *
 * THE DESCRIPTION IS THE ABSTRACT'S OPENING, cut at a word boundary. Hand-writing
 * 36 of them would produce 36 worse ones.
 */
export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: `Publication, ${SITE.name}` }];

  const { paper, pagePath, pdfPath } = loaderData;
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
    ...buildCitationTags(paper, { abstractUrl, pdfUrl }),
  ];
}

/** Cuts at a word boundary, like a search engine does. */
function truncateAtWord(text: string, limit: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}...`;
}

function Authors({ authors }: { authors: string[] }) {
  /*
   * EVERY AUTHOR, VISIBLE. It is what `citation_author` asserts, and a page whose
   * visible content disagrees with its own meta tags is the thing Scholar
   * penalizes.
   */
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
  /* The citation line moved into the rail, which is where a venue, a volume and a year are
     machine data rather than prose, so nothing assembles them into a sentence here any more. */

  return (
    <>
      <SiteHeader />
      {/*
       * THE POST PAGE SHAPE, because a paper and a post are the same object to a reader: a
       * title, a rail of machine data beside it, and the text in the text track. The rail
       * PRECEDES the body in source, so at one column it lands above it in the order a reader
       * wants, which is what this is before what it says.
       */}
      <main id="main" className="tracks paper-tracks" tabIndex={-1}>
        <header className="paper-head">
          <p className="paper-breadcrumb">
            <Link to={PUBLICATIONS_PATH}>Publications</Link>
          </p>

          {/* The H1 is the TITLE. Scholar reads the first heading as the
              paper title, and a page whose H1 said "Publication" would be
              asking it to guess. */}
          <h1 className="paper-title">{italicizeOrganisms(decodeEntities(paper.title))}</h1>

          <Authors authors={paper.authors} />
        </header>

        {/*
         * THE RAIL: what a machine and a librarian both want, in the column the post page puts
         * its dates in. The DOI is the identifier, so it is the one that is a link.
         */}
        <div className="paper-rail u-rail">
          <p className="paper-machine">
            <b>{paper.year}</b>
            published
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
            <b>
              <a href={`https://doi.org/${paper.doi}`}>{paper.doi}</a>
            </b>
            doi
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
            {/* The citation exports, beside the links rather than behind a
                button, because they are URLs: a reference manager can be
                pointed at one and a reader can see what they are getting. */}
            <a href={`${PUBLICATIONS_PATH}/${slug}.bib`}>BibTeX</a>
            <a href={`${PUBLICATIONS_PATH}/${slug}.ris`}>RIS</a>
            {/*
             * ASK, AS A LINK. `/search` renders classic results from its loader and mounts
             * Ask as an enhancement, so a link with the query in `q` works with scripting and
             * without it. The query is the quoted title alone, because the classic index ANDs
             * its terms. `check:publications` asserts this route calls that function.
             */}
            <a href={paperAskUrl(decodeEntities(paper.title))}>Ask about this paper</a>
          </p>

          {/*
           * LABELLED with its source and the date it was read: a bare number is a claim
           * with no provenance and no age, and this one moves without a deploy. Rendered only
           * at 1 or more, so a cold cache shows nothing rather than a zero that looks
           * measured.
           */}
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

          {/*
           * ABOVE EVERYTHING IT APPLIES TO, because a reader who stops after the first
           * paragraph must not stop before this one. `role="status"` rather than `alert`:
           * an alert interrupts a screen reader mid-sentence. The link goes to the NOTICE,
           * not the landing page of the paper.
           */}
          {paper.updateNotice ? (
            <aside className="paper-update-notice" role="status">
              <strong>{updateNoticeText(paper.updateNotice).label}.</strong>{" "}
              {updateNoticeText(paper.updateNotice).sentence}{" "}
              <a href={updateNoticeText(paper.updateNotice).url}>Read the notice</a>
            </aside>
          ) : null}

          {/*
           * ABOVE THE ABSTRACT, because it is for the reader who will not read the
           * abstract. Not styled as a quotation: it is the author speaking plainly about his
           * own work, and a decorative frame would make it look lifted from somewhere else.
           */}
          {paper.summary ? (
            <p className="paper-summary">{italicizeOrganisms(paper.summary)}</p>
          ) : null}

          {/*
           * VISIBLE, never inside a `details`: this page exists to BE the abstract, and a
           * crawler that has to open a disclosure to find the text is a crawler that does not
           * find it.
           */}
          {paper.abstract ? (
            <section className="paper-abstract" aria-labelledby="abstract-heading">
              <h2 id="abstract-heading">Abstract</h2>
              <p>{italicizeOrganisms(decodeEntities(paper.abstract))}</p>
            </section>
          ) : null}

          {/*
           * Under the abstract rather than in the link row: the link row is where a reader
           * goes to READ the paper, this is where they go to check it. `accessionUrl`
           * refuses a kind it has no registry for rather than guessing one, because a wrong
           * registry is a 404 that looks like a working link.
           */}
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

          {/*
           * Newest first and capped, and the cap is STATED when it bites: a list that
           * silently showed 50 of 52 would be claiming completeness it does not have. The
           * link is conditional because a few records have no DOI.
           */}
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
            __html: jsonLd(
              paperJsonLd(paper, {
                origin: SITE_ORIGIN,
                pageUrl,
                pdfUrl: pdfPath ? `${SITE_ORIGIN}${pdfPath}` : null,
                isOwner: isSiteOwner,
                personId: personId(SITE_ORIGIN),
                personNode: personNode(SITE_ORIGIN),
                topics,
              }),
            ),
          }}
        />
      </main>
      <ShellFooter />
    </>
  );
}
