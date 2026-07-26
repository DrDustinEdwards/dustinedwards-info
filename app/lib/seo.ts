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
