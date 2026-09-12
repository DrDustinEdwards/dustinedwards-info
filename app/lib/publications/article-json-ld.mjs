/**
 * `ScholarlyArticle` and friends for one paper, matching what the page shows.
 *
 * ## THE TYPE IS NOT `ScholarlyArticle` FOR EVERYTHING
 *
 * The corpus carries a closed, curated `type` vocabulary and three of its five
 * members have a real schema.org type of their own. Emitting `ScholarlyArticle`
 * for all of them would tell a consumer that a book chapter is a journal
 * article and that a teaching resource is a paper, which is a wrong statement
 * rather than a coarse one.
 *
 * Mapped from the CURATED field rather than sniffed from the journal name. A
 * journal-name rule would be a second, undeclared vocabulary living in a string
 * comparison, and it would silently reclassify a record the day a publisher
 * renames a journal.
 *
 * ## WHAT IS DELIBERATELY NOT MODELLED
 *
 * Twelve of the thirty articles are genome announcements in Microbiology
 * Resource Announcements, and schema.org has no type or genre for that.
 * Inventing one, or deriving it from the journal title, would be asserting a
 * classification this corpus does not carry as data. The subject matter is
 * carried by `about` instead, from the curated topics, which is the property
 * schema.org actually has for it.
 *
 * ## THE AUTHOR ARRAY IS THE EXPENSIVE PART AND IT IS WORTH IT
 *
 * Only the owner's entry becomes an `@id` reference to the Person node.
 * Replacing the whole array with a single reference would drop 99 co-authors
 * from one record and misstate authorship on every other, and this corpus has
 * records with 100 and 144 names.
 */

import { decodeEntities } from "./entities.mjs";

/**
 * The curated `type` to a schema.org type.
 *
 * `abstract` maps to `ScholarlyArticle` because a conference abstract IS a
 * scholarly work with a DOI; the reason those three do not appear on the site
 * is the showcase allowlist, which is an editorial decision and not a claim
 * about what they are.
 */
const SCHEMA_TYPE = {
  article: "ScholarlyArticle",
  review: "ScholarlyArticle",
  abstract: "ScholarlyArticle",
  chapter: "Chapter",
  "teaching-resource": "LearningResource",
};

/** @param {string} type @returns {string} */
export function schemaTypeFor(type) {
  /*
   * Falls back rather than throwing, and the fallback is the honest one: an
   * unrecognised type is still a scholarly work, and the closed vocabulary is
   * enforced by the TypeScript union on `PublicationType` and by
   * `check:publications`, not here. A throw would take down a page render over
   * a data question a gate already answers.
   */
  return SCHEMA_TYPE[/** @type {keyof typeof SCHEMA_TYPE} */ (type)] ?? "ScholarlyArticle";
}

/**
 * The fields of a record this builder reads. Spelled out rather than typed as
 * `object`, because `checkJs` is on and an `object` parameter makes every
 * property access an error; and spelled as its OWN shape rather than importing
 * `Publication`, so this module stays `.mjs` and importable by the build
 * scripts without dragging a `.ts` type graph behind it.
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
    /*
     * The date at its deposited precision, which is what `publishedDate` is
     * for. `datePublished` accepts a partial ISO date, so a record that only
     * ever said 2011 says 2011 here rather than claiming a January morning.
     */
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
    /*
     * `isAccessibleForFree` is the OA statement, and it is the Unpaywall answer
     * rather than "we host a PDF". Those are different facts: this site hosts
     * copies of papers that are not open access, which is the owner's call, and
     * saying a closed paper is free to access because a copy sits here would be
     * a false claim in a machine-readable field.
     */
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

  // The Person node first, so the `@id` the authors reference is defined in the
  // same graph rather than dangling.
  return [context.personNode, article];
}
