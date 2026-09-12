import { Link } from "react-router";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { PUBLICATIONS, TOPICS, type Publication } from "~/data/publications";
import { getCitationCounts } from "~/lib/citations.server";
import { jsonLd } from "~/lib/json-ld.mjs";
import { paperJsonLd } from "~/lib/publications/article-json-ld.mjs";
import { buildCitationTags } from "~/lib/publications/citation-tags.mjs";
import { decodeEntities } from "~/lib/publications/entities.mjs";
import { doiSlug, paperPath, paperPdfPath, PUBLICATIONS_PATH } from "~/lib/publications/paths.mjs";
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

import "~/styles/publications.css";

/**
 * ONE PAGE PER PAPER, which is the whole reason this route exists.
 *
 * Google Scholar's technical guidelines: "Each paper must have its own unique
 * URL in order for it to be included in Google Scholar", and a browse page
 * listing many papers is explicitly not that. The July build had a good index
 * and no per-paper page, so none of these were indexable from this site: they
 * are in Scholar through their publishers, and what this adds is a clean
 * self-hosted record, not a ranking change. That expectation is ruling 63's and
 * is worth keeping in view before anybody measures this against Scholar.
 *
 * ## THE URL ENDS IN A SLASH, AND IT IS NOT A STYLE CHOICE
 *
 * `citation_pdf_url` "must refer to a file in the same subdirectory as the HTML
 * abstract". `/publications/<slug>` has the subdirectory `/publications/`;
 * `/publications/<slug>/` has `/publications/<slug>/`, which is where the PDF
 * sits. Only the second satisfies the rule. The slashless spelling redirects in
 * the gateway so there is one URL rather than two. Grounds on `paths.mjs`.
 *
 * ## THE SLUG IS THE DOI, NOT THE CURATED ID
 *
 * `edwards-2025-godfather` would read better than `10-1128-mra-00888-24`. It is
 * also a name somebody chose, and a name can be chosen again: the July rename
 * plan retitled these twice before freezing. A publication URL that is
 * re-decidable will eventually be re-decided, after Scholar has indexed it, and
 * a correction takes six to nine months. A DOI cannot be re-decided.
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
   * 404 out of the loader, which is the ordinary shape here. There is no
   * database read to save: the map above is the corpus, so an unknown slug is
   * known to be unknown before anything is fetched.
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
     * WHO CITES THIS, from the committed artifact rather than from OpenAlex at
     * request time. The grounds are in scripts/fetch-cited-by.mjs: the list is
     * 55 KB across the corpus, it needs a 10-credit filter query where a count
     * needs a 1-credit lookup, and it is evidence, so it carries the date it was
     * read rather than pretending to be current.
     *
     * `total` and the list length are BOTH carried, because one paper here has
     * 52 citing works against a cap of 50 and the page has to be able to say so.
     */
    citedBy: citedByFor(citedByArtifact, paper.doi),
    citedByFetchedAt: citedByFetchedAt(citedByArtifact),
    topics: paper.topics.map((id) => ({ id, label: TOPIC_LABEL.get(id) ?? id })),
  };
}

/**
 * The head: the site's social set, plus the citation tags.
 *
 * ## `pageMeta` FOR THE SOCIAL HALF, AND WHY THAT WAS NOT THE FIRST ATTEMPT
 *
 * This was written as a hand-assembled array, on the reasoning that a paper
 * page needs a repeated `citation_author` tag and `pageMeta` has no business
 * knowing about those. `check:invariants` section 13 refused it, and the
 * section is right: five pages once ended up with five different partial
 * social sets, each missing a different edge, and every one of them was a page
 * whose author thought it was special. The repair was to teach `pageMeta` the
 * one thing this page actually needed differently, `og:type: article`, rather
 * than to take an exemption.
 *
 * The citation tags stay here. They are not social metadata, no other page has
 * them, and they are built by a module `check:features` calls, so the tag set
 * on the page and the tag set the gate asserts cannot come apart.
 *
 * ## THE DESCRIPTION IS THE ABSTRACT'S OPENING
 *
 * Not a written line. A paper's own first sentences are the best short
 * description of it that exists, and hand-writing 36 of them would produce 36
 * worse ones. Cut at a word boundary, the way a search engine cuts.
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
   * EVERY AUTHOR, VISIBLE, with no collapse. The index collapses around the
   * owner because it shows 33 records at once; this page shows one, and the
   * author list of a paper is part of the record rather than a detail to hide.
   * It is also what `citation_author` asserts, and a page whose visible content
   * disagrees with its own meta tags is the thing Scholar penalises.
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
  const citation = [
    decodeEntities(paper.journal ?? ""),
    paper.volume ? `volume ${paper.volume}` : null,
    paper.issue ? `issue ${paper.issue}` : null,
    paper.pages ? `pages ${paper.pages}` : null,
    String(paper.year),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="page-inner">
          <p className="paper-breadcrumb">
            <Link to={PUBLICATIONS_PATH}>Publications</Link>
          </p>

          {/* The H1 is the TITLE. Scholar reads the first heading as the
              paper's title, and a page whose H1 said "Publication" would be
              asking it to guess. */}
          <h1 className="paper-title">{italicizeOrganisms(decodeEntities(paper.title))}</h1>

          <Authors authors={paper.authors} />

          <p className="paper-meta">
            {citation}
            {paper.isOpenAccess ? <span className="pub-badge">Open access</span> : null}
          </p>

          <p className="pub-links paper-links">
            {hosted && pdfPath ? <a href={pdfPath}>PDF</a> : null}
            <a href={`https://doi.org/${paper.doi}`}>DOI</a>
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
          </p>

          {/* The count, LABELLED with its source and the date it was read.
              A bare number is a claim with no provenance and no age, and this
              one moves without a deploy. Rendered only at 1 or more, so a cold
              cache shows nothing rather than a zero that looks measured. */}
          {cited && cited.count >= 1 ? (
            <p className="paper-cited">
              {cited.url ? (
                <a href={cited.url}>Cited by {cited.count}</a>
              ) : (
                <>Cited by {cited.count}</>
              )}{" "}
              <span className="muted">OpenAlex, read {cited.fetchedAt}</span>
            </p>
          ) : null}

          {/*
            WHO CITES THIS, under the count, which is where ruling 63 puts it.

            Newest first and capped, and the cap is STATED when it bites: one
            paper here has 52 citing works against a cap of 50, and a list that
            silently showed 50 would be claiming completeness it does not have.

            A plain list rather than a table. Each entry is a sentence (title,
            venue, year) and a link where a DOI exists; three of the 263 have no
            DOI, which is why the link is conditional rather than assumed.
          */}
          {citedBy && citedBy.citing.length > 0 ? (
            <section className="paper-citedby" aria-labelledby="citedby-heading">
              <h2 id="citedby-heading">
                Cited by{" "}
                {citedBy.total > citedBy.citing.length
                  ? `${citedBy.citing.length} of ${citedBy.total}`
                  : citedBy.total}
              </h2>
              <p className="muted paper-citedby-source">
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
                    {w.venue ? <span className="muted">, {w.venue}</span> : null}
                    {w.year ? <span className="muted">, {w.year}</span> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* VISIBLE, never inside a details element. The index collapses
              abstracts because it lists 33 of them; this page exists to BE the
              abstract, and a crawler that has to open a disclosure to find the
              text is a crawler that does not find it. */}
          {paper.abstract ? (
            <section className="paper-abstract" aria-labelledby="abstract-heading">
              <h2 id="abstract-heading">Abstract</h2>
              <p>{italicizeOrganisms(decodeEntities(paper.abstract))}</p>
            </section>
          ) : null}

          {topics.length > 0 ? (
            <p className="paper-topics">
              {topics.map((t) => (
                <Link key={t.id} to={`${PUBLICATIONS_PATH}?topic=${t.id}`} className="pub-chip">
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
      <SiteFooter />
    </>
  );
}
