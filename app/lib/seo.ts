export const SITE = {
  name: "Dustin Edwards",
  role: "Professor",
  affiliation: "Tarleton State University",
  description:
    "Personal site of Dustin Edwards. Writing, projects, and notes.",
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
 * The sameAs array is the point of this node. There is another academic with
 * the same name, so naming the ORCID, the Scholar profile and the faculty page
 * gives a consumer three ways to tell the two apart without guessing from a
 * name string.
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
