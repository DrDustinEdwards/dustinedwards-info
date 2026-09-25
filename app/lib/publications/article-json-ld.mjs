// The schema type comes from the curated type field, never the journal name. Only the owner's author
// entry becomes an @id reference: replacing the array would drop up to 143 co-authors.

import { decodeEntities } from "./entities.mjs";

// abstract is still a ScholarlyArticle: hiding abstracts on the site is editorial, not a claim about them.
const SCHEMA_TYPE = {
  article: "ScholarlyArticle",
  review: "ScholarlyArticle",
  abstract: "ScholarlyArticle",
  chapter: "Chapter",
  "teaching-resource": "LearningResource",
};

/** @param {string} type @returns {string} */
function schemaTypeFor(type) {
  // Falls back, never throws: types and check:machine-readable enforce the vocabulary, and a throw
  // would fail a page render.
  return SCHEMA_TYPE[/** @type {keyof typeof SCHEMA_TYPE} */ (type)] ?? "ScholarlyArticle";
}

/**
 * Its own shape rather than Publication, so this stays .mjs for the build scripts; not `object`,
 * because checkJs rejects every property access on one.
 *
 * @typedef {object} PaperFacts
 * @property {string} title
 * @property {string[]} authors
 * @property {number | null} year
 * @property {string | null} [publishedDate]
 * @property {string | null} [journal]
 * @property {string | null} [volume]
 * @property {string | null} [issue]
 * @property {string | null} [firstPage]
 * @property {string | null} [lastPage]
 * @property {string | null} [abstract]
 * @property {string} doi
 * @property {string} type
 * @property {boolean} [isOpenAccess]
 * @property {string | null} [license]
 */

/**
 * @param {PaperFacts} paper
 * @param {object} context
 * @param {string} context.origin
 * @param {string} context.pageUrl absolute URL of this paper's page
 * @param {string | null} [context.pdfUrl] absolute URL of the hosted PDF
 * @param {(name: string) => boolean} context.isOwner
 * @param {string} context.personId
 * @param {unknown} context.personNode
 * @param {{ id: string, label: string }[]} [context.topics] resolved topic labels
 */
export function paperJsonLd(paper, context) {
  const authors = (paper.authors ?? []).map((/** @type {string} */ name) =>
    context.isOwner(name)
      ? { "@id": context.personId }
      : { "@type": "Person", name: decodeEntities(name) },
  );

  const article = {
    "@context": "https://schema.org",
    "@type": schemaTypeFor(paper.type),
    "@id": context.pageUrl,
    headline: decodeEntities(paper.title),
    name: decodeEntities(paper.title),
    author: authors,
    // Deposited precision: a partial ISO date, so a record that only said 2011 says 2011.
    datePublished: paper.publishedDate ?? (paper.year ? String(paper.year) : undefined),
    url: context.pageUrl,
    mainEntityOfPage: context.pageUrl,
    ...(paper.doi
      ? {
          identifier: { "@type": "PropertyValue", propertyID: "DOI", value: paper.doi },
          sameAs: `https://doi.org/${paper.doi}`,
        }
      : {}),
    ...(paper.journal
      ? {
          isPartOf: {
            "@type": "Periodical",
            name: decodeEntities(paper.journal),
            ...(paper.volume
              ? {
                  hasPart: {
                    "@type": "PublicationVolume",
                    volumeNumber: String(paper.volume),
                    ...(paper.issue
                      ? { hasPart: { "@type": "PublicationIssue", issueNumber: String(paper.issue) } }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(paper.firstPage ? { pageStart: paper.firstPage } : {}),
    ...(paper.lastPage ? { pageEnd: paper.lastPage } : {}),
    ...(paper.abstract ? { abstract: decodeEntities(paper.abstract) } : {}),
    // The Unpaywall OA answer, not whether a PDF is hosted here: some hosted copies are not open access.
    isAccessibleForFree: Boolean(paper.isOpenAccess),
    ...(paper.license ? { license: paper.license } : {}),
    ...(context.pdfUrl
      ? {
          encoding: {
            "@type": "MediaObject",
            encodingFormat: "application/pdf",
            contentUrl: context.pdfUrl,
          },
        }
      : {}),
    ...(context.topics && context.topics.length > 0
      ? { about: context.topics.map((t) => ({ "@type": "Thing", name: t.label })) }
      : {}),
  };

  // The Person node first, so the @id the authors reference is defined in the same graph.
  return [context.personNode, article];
}
