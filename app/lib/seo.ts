/**
 * The canonical public origin. Every absolute URL the site emits (canonical,
 * OG, JSON-LD, RSS, sitemap, robots) derives from this and never from
 * `request.url`.
 *
 * Why a module constant rather than a wrangler var or a binding: prerendering
 * runs in Node at build time, with no request and no Worker env, so anything
 * read off the request context is unavailable there. Deriving from the request
 * is also what baked `http://localhost:<port>` into the prerendered JSON-LD
 * when prerendering was measured on 2026-07-27.
 *
 * A canonical URL should name the canonical origin regardless of which host
 * served the response, so this being fixed is correct rather than a limitation.
 *
 * DNS cutover item: change this to https://dustinedwards.info at the same time
 * as BETTER_AUTH_URL and the Google redirect URI.
 */
export const SITE_ORIGIN = "https://dustinedwards.dustin-edwards.workers.dev";

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

/**
 * Cache policy for public blog surfaces. Ten minutes at the edge, then a day of
 * serving stale while revalidating, so a deploy or a content sync propagates
 * quickly without every reader paying for an origin hit.
 */
export const PUBLIC_CACHE_CONTROL =
  "public, s-maxage=600, stale-while-revalidate=86400";

export type ArticleSeo = {
  slug: string;
  title: string;
  description: string | null;
  publishAt: Date | null;
  updatedAt: Date | null;
  coverImage: string | null;
  tags: string[];
};

/** schema.org Article for one post. */
export function articleJsonLd(origin: string, post: ArticleSeo) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description ?? undefined,
    datePublished: post.publishAt?.toISOString(),
    dateModified: (post.updatedAt ?? post.publishAt)?.toISOString(),
    image: post.coverImage ? `${origin}${post.coverImage}` : undefined,
    keywords: post.tags.length > 0 ? post.tags.join(", ") : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${origin}/blog/${post.slug}` },
    author: { "@type": "Person", name: SITE.name, url: origin },
    publisher: { "@type": "Person", name: SITE.name, url: origin },
  };
}

/** schema.org BreadcrumbList for a trail of [name, path] pairs. */
export function breadcrumbJsonLd(origin: string, trail: Array<[string, string]>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${origin}${path}`,
    })),
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
