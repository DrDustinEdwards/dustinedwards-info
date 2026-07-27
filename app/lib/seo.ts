export const SITE = {
  name: "Dr. Dustin Edwards",
  role: "Professor of Virology",
  affiliation: "Tarleton State University",
  description:
    "Dr. Dustin Edwards is a Professor of Virology at Tarleton State University. Research and teaching in virology, with writing and lab notes.",
} as const;

/** schema.org Person for the site owner. */
export function personJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE.name,
    jobTitle: SITE.role,
    description: SITE.description,
    url: origin,
    worksFor: {
      "@type": "CollegeOrUniversity",
      name: SITE.affiliation,
    },
  };
}

/** schema.org WebSite for the domain. */
export function webSiteJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    description: SITE.description,
    url: origin,
  };
}

/** schema.org CollectionPage for the Phage Hunters cohorts, one item per year. */
export function phageHuntersJsonLd(
  origin: string,
  years: { year: number; photo: { src: string; alt: string } | null }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Phage Hunters",
    description: PHAGE_HUNTERS_DESCRIPTION,
    url: `${origin}/phage-hunters`,
    isPartOf: { "@type": "WebSite", name: SITE.name, url: origin },
    about: {
      "@type": "ResearchProject",
      name: "SEA-PHAGES",
      parentOrganization: {
        "@type": "CollegeOrUniversity",
        name: SITE.affiliation,
      },
    },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: years.length,
      itemListElement: years.map((y, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "CreativeWork",
          name: `${y.year} phage discovery research group`,
          ...(y.photo
            ? {
                image: {
                  "@type": "ImageObject",
                  contentUrl: origin + y.photo.src,
                  caption: y.photo.alt,
                },
              }
            : {}),
        },
      })),
    },
  };
}

export const PHAGE_HUNTERS_DESCRIPTION =
  "Year-by-year rosters and group photos of the SEA-PHAGES phage discovery research cohort at Tarleton State University, 2017 to 2025.";

/** Authority records that identify the site owner, for schema.org sameAs. */
export const OWNER_ORCID = "https://orcid.org/0000-0001-6409-8041";
export const OWNER_SCHOLAR =
  "https://scholar.google.com/citations?user=lfzCCXwAAAAJ";
export const OWNER_FACULTY_PAGE = "https://faculty.tarleton.edu/dcedwards";

/** Stable node id for the owner, referenced by @id rather than repeated. */
export function personId(origin: string) {
  return `${origin}/#dustin-edwards`;
}

/**
 * schema.org Person for the site owner, carrying the authority links.
 *
 * The sameAs array is the point of this node. There is another academic named
 * Dustin Edwards working in writing and rhetoric, and OpenAlex has already
 * merged seven of his works into this author record. Naming the ORCID, the
 * Scholar profile and the faculty page gives a consumer three ways to tell
 * the two apart without guessing from a name string.
 */
export function personNode(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": personId(origin),
    name: SITE.name,
    jobTitle: SITE.role,
    affiliation: {
      "@type": "CollegeOrUniversity",
      name: SITE.affiliation,
    },
    url: origin,
    sameAs: [OWNER_ORCID, OWNER_SCHOLAR, OWNER_FACULTY_PAGE],
  };
}

/**
 * Match the site owner in an author list.
 *
 * He is last author on some papers and 14th of 108 on others, and the
 * registries return three spellings of his name, so this keys on surname plus
 * a D initial rather than an exact string.
 */
export function isSiteOwner(name: string) {
  const parts = name.trim().split(/\s+/);
  const surname = parts[parts.length - 1] ?? "";
  const given = parts[0] ?? "";
  return surname.toLowerCase() === "edwards" && given.toUpperCase().startsWith("D");
}

/**
 * One Person node followed by a ScholarlyArticle per publication.
 *
 * Co-authors stay as plain Person objects; only the owner's entry becomes an
 * `@id` reference to the Person node. Replacing the whole author array with a
 * single reference would drop 107 co-authors from one record and misstate
 * authorship on every other.
 *
 * Built from the filtered list, so the structured data always describes what
 * the page actually renders.
 */
export function publicationsJsonLd(
  origin: string,
  items: {
    title: string;
    authors: string[];
    year: number;
    journal: string | null;
    doi: string;
    pdfPath: string | null;
  }[],
) {
  const id = personId(origin);
  return [
    personNode(origin),
    ...items.map((p) => ({
      "@context": "https://schema.org",
      "@type": "ScholarlyArticle",
      headline: p.title,
      author: p.authors.map((name) =>
        isSiteOwner(name) ? { "@id": id } : { "@type": "Person", name },
      ),
      datePublished: String(p.year),
      ...(p.journal
        ? { isPartOf: { "@type": "Periodical", name: p.journal } }
        : {}),
      sameAs: `https://doi.org/${p.doi}`,
      ...(p.pdfPath ? { url: origin + p.pdfPath } : {}),
    })),
  ];
}

export const PUBLICATIONS_DESCRIPTION =
  "Peer-reviewed publications of Dr. Dustin Edwards on human and simian retroviruses, avian retroviruses, bacteriophage genomics, and science education, with full text hosted here.";
