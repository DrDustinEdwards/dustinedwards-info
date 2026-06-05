import type { Metadata } from "next";

// Single source of metadata. No hardcoded metadata strings in pages.
const SITE = {
  name: "Dr. Dustin Edwards",
  url: "https://dustinedwards.info",
  description:
    "Professor of Virology at Tarleton State University. Molecular retrovirology, wildlife pathogen surveillance, and bacteriophage genomics.",
};

export function buildMetadata(overrides: Partial<Metadata> = {}): Metadata {
  const title = "Dr. Dustin Edwards, Professor of Virology";
  return {
    metadataBase: new URL(SITE.url),
    title: { default: title, template: `%s | ${SITE.name}` },
    description: SITE.description,
    openGraph: {
      title,
      description: SITE.description,
      url: SITE.url,
      siteName: SITE.name,
      type: "website",
    },
    ...overrides,
  };
}
