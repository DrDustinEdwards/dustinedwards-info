// The foxhound modules that need Cloudflare bindings or a database, replaced with fixed rows. Only data access is stubbed: the
// feed and sitemap loaders, their templates and their escaping run as foxhound wrote them.

export const getDb = () => ({});
export const cloudflareContext = Symbol("cloudflareContext");

const posts = [
  {
    slug: "recovering-failed-payments",
    title: `Recovering failed payments: what works & what "doesn't"`,
    excerpt: "A summary with <angle> brackets & an ampersand.",
    publishedAt: new Date("2026-08-01T12:00:00.000Z"),
    updatedAt: new Date("2026-08-05T09:30:00.000Z"),
    author: "Foxhound Team",
    tags: ["recovery", "stripe"],
  },
  {
    slug: "dispute-evidence",
    title: "Dispute evidence, drafted",
    excerpt: "Second summary.",
    publishedAt: new Date("2026-07-10T08:00:00.000Z"),
    updatedAt: null,
    author: "Foxhound Team",
    tags: ["disputes"],
  },
  {
    slug: "undated",
    title: "An undated draft",
    excerpt: "No date.",
    publishedAt: null,
    updatedAt: null,
    author: "Foxhound Team",
    tags: [],
  },
];

export const getAllPublishedPosts = async () => posts;
export const getPublishedTagSet = async () => ["recovery", "stripe"];
