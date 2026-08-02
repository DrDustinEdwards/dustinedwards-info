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

/**
 * The default social card, for any page without one of its own.
 *
 * Derived from SITE_ORIGIN rather than written out, so it names workers.dev
 * today and dustinedwards.info the moment the cutover changes the constant
 * above. Hardcoding the apex would point every scraper at the legacy WordPress
 * site until DNS moves, which is a broken card rather than a future-proof one.
 */
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

/**
 * The site's identity, in one place, split by the job each string does.
 *
 * `role` and `affiliation` are STRUCTURED DATA: they are the jobTitle and
 * worksFor a machine reads, so they stay short, literal and true. `eyebrow` and
 * `tagline` are the homepage's own words and are free to be sentences. They
 * were one field until 2026-07-29, when the hero copy stopped being a job
 * title, and a hero line pushed into jobTitle would have made the Person record
 * assert a sentence no schema consumer can use.
 */
export const SITE = {
  name: "Dustin Edwards",
  role: "Professor",
  affiliation: "Tarleton State University",
  eyebrow: "Full-stack engineer",
  tagline: "Professor by training. I build on Cloudflare and publish the numbers.",
  description:
    "Dustin Edwards, professor and full-stack engineer. Building on Cloudflare Workers, D1, R2 and KV, with the measurements.",
} as const;

/**
 * Everything a post's head tags are built from, in ONE place.
 *
 * Extracted from `blog.$slug.tsx`'s `meta()` on 2026-08-02, unchanged, when the
 * editor gained SERP and social-card previews. A preview whose job is to show
 * what the site emits cannot be allowed to compute it a second way: the moment
 * the two disagree the preview is lying, and it would lie silently, because
 * nothing renders both at once to compare them.
 *
 * So the public route and the admin preview call this and nothing else derives
 * a canonical URL, a page title or a card image. Same rule `records.mjs` and
 * `reading-time.mjs` live under.
 *
 * The precedence here is the ratified one and is not this function's to change:
 * a per-post cover wins, then the card `build:og` generated, then the site mark,
 * so a post whose card has not been built yet shares as the brand rather than
 * as nothing.
 */
export type PostSocialFields = {
  slug: string;
  title: string;
  description?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  coverImage?: string | null;
  ogImage?: string | null;
};

export function postSocial(post: PostSocialFields) {
  const canonical = `${SITE_ORIGIN}/blog/${post.slug}`;
  const description = post.description ?? SITE.description;
  const socialImage = post.coverImage ?? post.ogImage ?? null;
  return {
    canonical,
    /** The `<title>`, template included. */
    pageTitle: `${post.title} | ${SITE.name}`,
    description,
    socialTitle: post.ogTitle ?? post.title,
    socialDescription: post.ogDescription ?? description,
    image: socialImage ? `${SITE_ORIGIN}${socialImage}` : DEFAULT_OG_IMAGE,
    /**
     * True when the card fell all the way through to the site mark. The editor
     * shows this rather than a placeholder, because "no cover" is not a missing
     * preview, it is a real and correct outcome the author should see.
     */
    usingDefaultImage: socialImage === null,
  };
}

/**
 * Where a search result stops, which is NOT where the description field's own
 * counter stops.
 *
 * Google truncates by rendered PIXEL width, roughly 600px of title and 920px of
 * desktop description, so any character count is an approximation of a measure
 * this site cannot take. These are the usual approximations of those widths and
 * they are stated as such: a preview that cut at the field's 160-character
 * counter would show a full description in a result that will actually be
 * clipped, which is the one thing a SERP preview exists to prevent.
 */
export const SERP_TITLE_LIMIT = 60;
export const SERP_DESCRIPTION_LIMIT = 155;

/**
 * Cuts at the last WORD boundary before the limit, the way a search engine
 * does, rather than mid-word. Returns the text unchanged when it fits, so the
 * caller can tell truncation happened by comparing.
 */
export function truncateForSerp(text: string, limit: number) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

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
