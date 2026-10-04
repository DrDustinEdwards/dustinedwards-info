import { Catalog } from "capsomer/react/catalog";
import { Link, redirect } from "react-router";

import { Enhance } from "~/components/enhance";
import { EvidenceRow } from "~/components/evidence-row";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { listPublishedPublications } from "~/db/publications";
import { getCitationCounts, type CitationEntry } from "~/lib/citations.server";
import { getEnv } from "~/lib/context";
import { jsonLd } from "~/lib/json-ld.mjs";
import { coinsTitle } from "~/lib/publications/coins.mjs";
import { decodeEntities } from "~/lib/publications/entities.mjs";
import { PUBLICATIONS, legacyAddress, publicationListing, venue } from "~/lib/publications/listing.mjs";
import { PUBLICATIONS_CACHE_TAG, PUBLICATIONS_PATH, paperPath } from "~/lib/publications/paths.mjs";
import type { Publication, TopicId } from "~/lib/publications/types";
import { italicizeOrganisms } from "~/lib/scientific-names";
import {
  isSiteOwner,
  pageMeta,
  publicationsJsonLd,
  publicHtmlHeaders,
  PUBLICATIONS_DESCRIPTION,
  PUBLICATIONS_URL,
  SITE,
  SITE_ORIGIN,
} from "~/lib/seo";
import type { Route } from "./+types/publications";

// Route-scoped: the catalog's tokens and components are Capsomer's, mapped onto the site's palette in site-catalog.css.
import "capsomer/tokens.css";
import "capsomer/field.css";
import "capsomer/button.css";
import "capsomer/table.css";
import "capsomer/chips.css";
import "capsomer/empty.css";
import "capsomer/pagination.css";
import "capsomer/catalog.css";
import "~/styles/evidence-row.css";
import "~/styles/listing.css";
import "~/styles/site-catalog.css";
import "~/styles/publications.css";

const TOPIC_META: Record<TopicId, { title: string; description: string }> = {
  "human-simian-retroviruses": {
    title: "Human and simian retroviruses",
    description:
      "How the HTLV-1 accessory proteins p12, p8 and p30 support infection and persistence, plus the auxiliary proteins of simian T-lymphotropic virus type 3.",
  },
  "avian-retroviruses": {
    title: "Avian retroviruses",
    description:
      "Molecular surveillance and genome sequencing of reticuloendotheliosis virus in wild turkeys, ducks, and an endangered Attwater's prairie chicken.",
  },
  bacteriophages: {
    title: "Bacteriophages",
    description:
      "Complete genomes of Microbacterium, Mycobacterium and Arthrobacter bacteriophages, plus a study of how healthcare providers view phage therapy.",
  },
  "science-education": {
    title: "Science education",
    description:
      "Course-based undergraduate research as a way to teach science: classroom assessment, faculty identity, the iREC model, and scientific writing rubrics.",
  },
};

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.pageTitle ?? `Publications, ${SITE.name}`;
  const description = loaderData?.pageDescription ?? PUBLICATIONS_DESCRIPTION;

  return [
    ...pageMeta({
      title,
      description,
      path: loaderData?.canonicalPath ?? PUBLICATIONS_URL,
    }),
    ...(loaderData?.noindex ? [{ name: "robots", content: "noindex, follow" }] : []),
  ];
}

/** Without headers the gateway stamps `private, no-store`, making the most static page uncacheable. */
export function headers() {
  return publicHtmlHeaders(PUBLICATIONS_CACHE_TAG);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  // A link written in the page's old parameters (?sort=year-asc, ?selected=true) is sent once to the same view.
  const moved = legacyAddress(url);
  if (moved) throw redirect(moved, 301);

  const publications = await listPublishedPublications(getEnv(context));
  const { soleTopic, items } = publicationListing(url.searchParams, publications);

  /* A path, not an absolute URL: deriving it from `url.origin` is how a preview host becomes canonical. */
  const canonicalPath = soleTopic
    ? `${PUBLICATIONS_URL}?topic=${soleTopic}`
    : PUBLICATIONS_URL;
  const pageTitle = soleTopic
    ? `${TOPIC_META[soleTopic].title}, ${SITE.name}`
    : `Publications, ${SITE.name}`;
  const pageDescription = soleTopic
    ? TOPIC_META[soleTopic].description
    : PUBLICATIONS_DESCRIPTION;
  const noindex = items.length === 0;

  // D1 only: a stale count shows and refreshes after the response, so the page never waits on OpenAlex.
  const citations = await getCitationCounts(context, items.flatMap((p) => (p.doi ? [p.doi] : [])));

  return {
    /* The canonical origin, never the request's: this page is shared-cached, so a preview host's JSON-LD would be served to everyone. */
    origin: SITE_ORIGIN,
    citations,
    // Every paper, with the address's query: the catalog is computed from them where it is drawn, because its
    // result holds functions and a loader's data does not.
    publications,
    search: url.search,
    canonicalPath,
    pageTitle,
    pageDescription,
    noindex,
  };
}

function AuthorName({ name }: { name: string }) {
  return isSiteOwner(name) ? <strong className="pub-author-me">{name}</strong> : <>{name}</>;
}

function Names({ names }: { names: string[] }) {
  return (
    <>
      {names.map((name, i) => (
        <span key={name + i}>
          {i > 0 ? ", " : ""}
          <AuthorName name={name} />
        </span>
      ))}
    </>
  );
}

/** Author order varies, so when he falls outside the first three the summary shows two, an ellipsis, then his entry. */
function AuthorList({ authors }: { authors: string[] }) {
  if (authors.length === 0) return null;
  if (authors.length <= 3) {
    return (
      <p className="pub-authors">
        <Names names={authors} />
      </p>
    );
  }

  const ownerIndex = authors.findIndex(isSiteOwner);
  const ownerName = ownerIndex >= 3 ? authors[ownerIndex] : undefined;
  const lead = authors.slice(0, ownerName ? 2 : 3);
  const shown = lead.length + (ownerName ? 1 : 0);

  return (
    <details className="pub-authors pub-authors-more">
      <summary>
        <Names names={lead} />
        {ownerName ? (
          <>
            <span className="muted">, ... </span>
            <AuthorName name={ownerName} />
          </>
        ) : null}
        <span className="muted"> and {authors.length - shown} more</span>
      </summary>
      <p className="pub-authors-full">
        <Names names={authors} />
      </p>
    </details>
  );
}

function PaperCell({ p, cited }: { p: Publication; cited?: CitationEntry }) {
  const { slug } = p;
  return (
    <div className="paper-row">
      <p className="paper-marks">
        {p.type !== "article" ? <span className="paper-kind">{p.type}</span> : null}
        {p.isOpenAccess ? <span className="paper-open">open access</span> : null}
      </p>
      <div className="paper-body">
        {/* Display only. The stored title stays plain for search and JSON-LD. */}
        <h3 className="paper-row-title">
          <Link to={paperPath(slug)}>{italicizeOrganisms(decodeEntities(p.title))}</Link>
        </h3>
        <AuthorList authors={p.authors} />
        <p className="paper-row-links">
          {p.access === "self-hosted" && p.pdfPath ? <a href={p.pdfPath}>PDF</a> : null}
          {p.doi ? <a href={`https://doi.org/${p.doi}`}>DOI</a> : null}
          {p.pmcUrl ? <a href={p.pmcUrl}>PMC</a> : null}
          {p.externalUrl && (p.type === "teaching-resource" || p.type === "abstract") ? (
            <a href={p.externalUrl}>Resource</a>
          ) : null}
          {p.preprintDoi ? (
            <a href={`https://doi.org/${p.preprintDoi}`}>Preprint</a>
          ) : null}
          <a href={`${PUBLICATIONS_PATH}/${slug}.bib`}>BibTeX</a>
          <a href={`${PUBLICATIONS_PATH}/${slug}.ris`}>RIS</a>
          {cited && cited.count >= 1 && cited.url ? (
            <a
              className="paper-cited-link"
              href={cited.url}
              title={`OpenAlex, retrieved ${cited.fetchedAt}`}
            >
              Cited by {cited.count}
            </a>
          ) : null}
        </p>
        {/* COinS on the index only: Highwire `citation_*` tags describe the one document they sit in. */}
        <span className="Z3988" title={coinsTitle(p)} />
        {p.abstract ? (
          <details className="paper-abstract-peek">
            <summary>Abstract</summary>
            <p>{italicizeOrganisms(decodeEntities(p.abstract))}</p>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function bibliographyFacts(span: {
  papers: number;
  firstYear: number | null;
  lastYear: number | null;
  venues: number;
}) {
  return [
    `${span.papers} paper${span.papers === 1 ? "" : "s"}`,
    span.firstYear && span.lastYear
      ? span.firstYear === span.lastYear
        ? String(span.firstYear)
        : `${span.firstYear} to ${span.lastYear}`
      : null,
    span.venues > 0 ? `${span.venues} venue${span.venues === 1 ? "" : "s"}` : null,
  ];
}

export default function Publications({ loaderData }: Route.ComponentProps) {
  const { origin, publications, search, citations } = loaderData;
  const { items, result, span } = publicationListing(new URLSearchParams(search), publications);

  return (
    <>
      <SiteHeader />
      <main id="main" className="tracks list-tracks" tabIndex={-1}>
        <header className="list-head">
          <h1 className="list-label" id="publications-title">
            Publications
          </h1>
          <p className="list-dek">
            Peer-reviewed work on retroviruses, bacteriophage genomics, and how
            undergraduate research is taught. Full text is hosted here where I have the
            publisher version, with links out to the record of version otherwise.
          </p>
          <EvidenceRow facts={bibliographyFacts(span)} />
        </header>

        <div className="papers site-catalog">
          <Catalog
            definition={PUBLICATIONS}
            result={result}
            labelledBy="publications-title"
            title={(p) => <PaperCell p={p} cited={p.doi ? citations[p.doi] : undefined} />}
            cells={{ journal: (p) => <span className="paper-venue">{venue(p)}</span> }}
            emptyText={{ noMatch: "No publications match this filter." }}
            actions={
              /* Always the full list: a citation file carrying only the filtered subset is one nobody asked for. */
              <span className="paper-feeds">
                Export all <a href="/research/publications.bib">BibTeX</a>{" "}
                <a href="/research/publications.ris">RIS</a> <a href="/research/publications.json">CSL JSON</a>
              </span>
            }
          />
        </div>

        {/* `jsonLd`, not `JSON.stringify`: only `</script` ends a script element, and these strings come from third-party registries. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(publicationsJsonLd(origin, items)) }}
        />
        <Enhance module="catalog" />
      </main>
      <ShellFooter />
    </>
  );
}
