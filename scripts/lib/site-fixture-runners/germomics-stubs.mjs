// The two germomics modules the sitemap loader reads data through, replaced with fixed rows. Only data access is stubbed:
// the loader's own code, and the XML it builds, run as germomics wrote them.

export const getEnv = () => ({});

const posts = [
  { slug: "why-phages-win", publishedAt: "2026-06-21 09:30:00", updatedAt: "2026-07-01 12:00:00" },
  { slug: "its-alive", publishedAt: "2026-05-02T08:00:00Z", updatedAt: null },
  { slug: "no-date", publishedAt: null, updatedAt: null },
];

export const listPosts = async () => posts;
export const listSeasons = async () => [1, 2];
