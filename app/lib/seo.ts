// Relative, not `~/`: tsconfig.node.json also compiles this file and has no path mapping.
import { canonicalAuthor } from "./publications/authors.mjs";
import { decodeEntities } from "./publications/entities.mjs";

/**
 * Never derive absolute URLs from `request.url`: prerendering runs in Node with no request.
 * DNS cutover: change this with BETTER_AUTH_URL and the Google redirect URI.
 */
export const SITE_ORIGIN = "https://dustinedwards.dustin-edwards.workers.dev";

// Not the apex: until DNS moves, the apex is the legacy WordPress site.
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/dustin-edwards-og-image.png`;

// `role` and `affiliation` are structured data (jobTitle, worksFor), so they stay short and literal.
export const SITE = {
  name: "Dustin Edwards",
  role: "Professor",
  affiliation: "Tarleton State University",
  eyebrow: "Full-stack engineer",
  tagline: "Professor by training. I build on Cloudflare and publish the numbers.",
  description:
    "Dustin Edwards, professor and full-stack engineer. Building on Cloudflare Workers, D1, R2 and KV, with the measurements.",
} as const;

// Shared by the public route and the admin preview, so the preview cannot silently disagree.
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
    pageTitle: `${post.title} | ${SITE.name}`,
    description,
    socialTitle: post.ogTitle ?? post.title,
    socialDescription: post.ogDescription ?? description,
    image: socialImage ? `${SITE_ORIGIN}${socialImage}` : DEFAULT_OG_IMAGE,
    usingDefaultImage: socialImage === null,
  };
}

/**
 * `summary_large_image` always: the image falls back to the site mark, and a `twitter:card` without
 * an image renders as a bare link.
 */
export function pageMeta(page: {
  title: string;
  description: string;
  path: string;
  image?: string;
  ogType?: "website" | "article";
}) {
  const url = `${SITE_ORIGIN}${page.path}`;
  const image = page.image ?? DEFAULT_OG_IMAGE;
  return [
    { title: page.title },
    { name: "description", content: page.description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:title", content: page.title },
    { property: "og:description", content: page.description },
    { property: "og:url", content: url },
    { property: "og:type", content: page.ogType ?? "website" },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: image },
  ];
}

/**
 * Google truncates by pixel width (about 600px title, 920px description), so these approximate it;
 * the description field's own 160-character counter would show text the result clips.
 */
export const SERP_TITLE_LIMIT = 60;
export const SERP_DESCRIPTION_LIMIT = 155;

export function truncateForSerp(text: string, limit: number) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

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
    sameAs: OWNER_SAME_AS,
  };
}

/**
 * Needs no `Vary`: the theme is part of the cache key in `workers/app.ts`. Never add
 * must-revalidate, proxy-revalidate, no-cache or s-maxage: each disables stale-while-revalidate at
 * Cloudflare (RFC 9111 4.2.4). Browser max-age stays 0 because purges cannot reach a browser.
 */
export const SHARED_CACHE_CONTROL = "public, max-age=0";

/**
 * A day fresh is safe because every write purges by tag and every deploy starts cold. Never parse a
 * lifetime back out of a string: a failed parse has to substitute a false lifetime.
 */
const EDGE_FRESH_SECONDS = 86_400;
const EDGE_STALE_SECONDS = 604_800;

// Short because the home page's site-health tile age is the watchdog's liveness.
const HOME_EDGE_FRESH_SECONDS = 600;

const edgeCacheControl = (fresh: number) =>
  `max-age=${fresh}, stale-while-revalidate=${EDGE_STALE_SECONDS}`;

/**
 * Sent as `Cloudflare-CDN-Cache-Control`, not `s-maxage`: `s-maxage` implies proxy-revalidate, so
 * Cloudflare refuses to serve stale and every read past the lifetime blocks on a render.
 */
export const EDGE_CACHE_CONTROL = edgeCacheControl(EDGE_FRESH_SECONDS);
export const HOME_EDGE_CACHE_CONTROL = edgeCacheControl(HOME_EDGE_FRESH_SECONDS);

export const EDGE_CACHE_HEADER = "Cloudflare-CDN-Cache-Control";

// A misspelled tag is a purge that silently does nothing: `cache.purge` succeeds on an unmatched tag.
export function cacheTags(slug?: string): string {
  return slug ? `post:${slug},posts` : "posts";
}

export const PAGES_CACHE_TAG = "pages";

/**
 * The Renderer stamps `EDGE_CACHE_CONTROL` beside `SHARED_CACHE_CONTROL`; pass `edge` only to depart
 * from that default.
 */
export function publicHtmlHeaders(tag: string = PAGES_CACHE_TAG, edge?: string) {
  return {
    "Cache-Control": SHARED_CACHE_CONTROL,
    "Cache-Tag": tag,
    ...(edge ? { [EDGE_CACHE_HEADER]: edge } : {}),
  };
}

export const HTML_VARY_ACCEPT = "Accept";

/**
 * Also applied by `workers/app.ts` to any response with no `Cache-Control`, and to cookie-bearing
 * requests on the HTML routes.
 */
export const NO_STORE_CACHE_CONTROL = "private, no-store";

export type ArticleSeo = {
  slug: string;
  title: string;
  description: string | null;
  publishAt: Date | null;
  updatedAt: Date | null;
  coverImage: string | null;
  ogImage?: string | null;
  tags: string[];
};

// Derived once so the JSON-LD and Open Graph outputs cannot drift apart.
export function articleFacts(origin: string, post: ArticleSeo) {
  return {
    publishedTime: post.publishAt?.toISOString(),
    modifiedTime: (post.updatedAt ?? post.publishAt)?.toISOString(),
    authorName: SITE.name,
    authorUrl: origin,
    tags: post.tags,
  };
}

// An absent date yields no property: an empty `article:published_time` claims there is no date.
export function articleOpenGraph(origin: string, post: ArticleSeo) {
  const facts = articleFacts(origin, post);
  const tags: Array<{ property: string; content: string }> = [];
  if (facts.publishedTime) {
    tags.push({ property: "article:published_time", content: facts.publishedTime });
  }
  if (facts.modifiedTime) {
    tags.push({ property: "article:modified_time", content: facts.modifiedTime });
  }
  tags.push({ property: "article:author", content: facts.authorName });
  for (const tag of facts.tags) {
    tags.push({ property: "article:tag", content: tag });
  }
  return tags;
}

export function articleJsonLd(origin: string, post: ArticleSeo) {
  const facts = articleFacts(origin, post);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description ?? undefined,
    datePublished: facts.publishedTime,
    dateModified: facts.modifiedTime,
    image: postSocial({
      slug: post.slug,
      title: post.title,
      description: post.description,
      coverImage: post.coverImage,
      ogImage: post.ogImage ?? null,
    }).image,
    keywords: facts.tags.length > 0 ? facts.tags.join(", ") : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${origin}/blog/${post.slug}` },
    author: { "@type": "Person", name: facts.authorName, url: facts.authorUrl },
    publisher: { "@type": "Person", name: SITE.name, url: origin },
  };
}

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

export function webSiteJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    description: SITE.description,
    url: origin,
  };
}

export const PUBLICATIONS_URL = "/publications";

export const PUBLICATIONS_DESCRIPTION =
  "Peer-reviewed work by Dustin Edwards on retroviruses, bacteriophage genomics, and science education, with full text hosted here.";

export const OWNER_ORCID = "https://orcid.org/0000-0001-6409-8041";
export const OWNER_SCHOLAR =
  "https://scholar.google.com/citations?user=lfzCCXwAAAAJ";
export const OWNER_PUBMED =
  "https://pubmed.ncbi.nlm.nih.gov/?term=Edwards+Dustin%5BAuthor%5D&sort=date";
export const OWNER_FACULTY_PAGE = "https://faculty.tarleton.edu/dcedwards/";

export const GERMOMICS_URL = "https://germomics.com/";
export const GERMOMICS_X_URL = "https://x.com/Germomics";

// The footer's `rel="me"` profiles, in order. `check:machine-readable` reads this list.
export const OWNER_PROFILES = [OWNER_SCHOLAR, OWNER_ORCID, OWNER_PUBMED] as const;

export const OWNER_SAME_AS = [
  ...OWNER_PROFILES,
  OWNER_FACULTY_PAGE,
  GERMOMICS_URL,
  GERMOMICS_X_URL,
];

export function personId(origin: string) {
  return `${origin}/#person`;
}

/**
 * Another academic shares this name and citation graphs have merged some of his work, so sameAs is
 * what disambiguates. Not a duplicate of `personJsonLd`: this `@id` joins papers to a person.
 */
export function personNode(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": personId(origin),
    name: SITE.name,
    jobTitle: SITE.role,
    url: origin,
    worksFor: {
      "@type": "CollegeOrUniversity",
      name: SITE.affiliation,
    },
    sameAs: OWNER_SAME_AS,
  };
}

// Registries spell his name several ways, so this reads the exact alias table the exports use: a
// surname-plus-initial rule claimed any "D* Edwards" co-author as the owner in JSON-LD.
export function isSiteOwner(name: string) {
  return canonicalAuthor(name) === SITE.name;
}

// Only the owner's entry becomes an `@id` reference; replacing the whole array would drop co-authors.
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
      // Decoding is safe here: `jsonLd()` escapes `<` and `>` on the way into the script element.
      headline: decodeEntities(p.title),
      author: p.authors.map((name) =>
        isSiteOwner(name) ? { "@id": id } : { "@type": "Person", name: canonicalAuthor(name) },
      ),
      datePublished: String(p.year),
      ...(p.journal
        ? { isPartOf: { "@type": "Periodical", name: decodeEntities(p.journal) } }
        : {}),
      sameAs: `https://doi.org/${p.doi}`,
      ...(p.pdfPath ? { url: origin + p.pdfPath } : {}),
    })),
  ];
}
