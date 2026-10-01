// Relative, not `~/`: tsconfig.node.json also compiles this file and has no path mapping.
import { canonicalAuthor } from "./publications/authors.mjs";
import { schemaTypeFor } from "./publications/article-json-ld.mjs";
import { decodeEntities } from "./publications/entities.mjs";
import { paperPath } from "./publications/paths.mjs";

/**
 * Never derive absolute URLs from `request.url`: prerendering runs in Node with no request.
 * DNS cutover: change this with BETTER_AUTH_URL and the Google redirect URI.
 */
export const SITE_ORIGIN = "https://dustinedwards.dustin-edwards.workers.dev";

// Not the apex: until DNS moves, the apex is the legacy WordPress site.
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/dustin-edwards-og-image.png`;

// `role` is the visible identity line; `jobTitle` is the Person record's, which also names the headship
// (Dustin, 2026-09-28). `affiliation` is structured data (worksFor), so it stays short and literal.
// The description names the department in full. It is a few characters over the 155 SERP estimate;
// the role and the university come first so a clip keeps them.
export const SITE = {
  name: "Dustin Edwards",
  role: "Professor and Virologist",
  jobTitle: "Virologist, Professor, and Department Head",
  affiliation: "Tarleton State University",
  department: "Department of Biological Sciences",
  eyebrow: "Professor and Virologist",
  tagline:
    "Professor and Virologist, Department of Biological Sciences, Tarleton State University.",
  description:
    "Professor and Virologist, Department of Biological Sciences, Tarleton State University. Research in retroviruses and bacteriophages; builds software on Cloudflare.",
} as const;

// Shared by the public route and the admin preview, so the preview cannot silently disagree.
type PostSocialFields = {
  slug: string;
  title: string;
  description?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  coverImage?: string | null;
  ogImage?: string | null;
};

export function postSocial(post: PostSocialFields) {
  const canonical = `${SITE_ORIGIN}/writing/${post.slug}`;
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

/** The home page's Person: the same node as `personNode`, joined to it by the shared `@id`. */
export function personJsonLd(origin: string) {
  return personNode(origin);
}

/**
 * The About page is a ProfilePage about the same Person the home page describes: the shared `@id` is
 * what makes the two one entity rather than two people with one name.
 */
export function profilePageJsonLd(origin: string, page: { path: string; description: string }) {
  const { "@context": context, ...person } = personNode(origin);
  return {
    "@context": context,
    "@type": "ProfilePage",
    "@id": `${origin}${page.path}`,
    url: `${origin}${page.path}`,
    name: `About ${SITE.name}`,
    description: page.description,
    mainEntity: person,
  };
}

/**
 * Needs no `Vary`: the theme is part of the cache key in `workers/app.ts`. Never add
 * must-revalidate, proxy-revalidate, no-cache or s-maxage: each disables stale-while-revalidate at
 * Cloudflare (RFC 9111 4.2.4). Browser max-age stays 0 because purges cannot reach a browser.
 */
export const SHARED_CACHE_CONTROL = "public, max-age=0";

/**
 * A day fresh is safe because every write purges by tag, every deploy starts cold, and a page that
 * lists posts expires at the next scheduled publish_at. Never parse a lifetime back out of a string:
 * a failed parse has to substitute a false lifetime.
 */
const EDGE_FRESH_SECONDS = 86_400;
const EDGE_STALE_SECONDS = 604_800;

// Short because the home page carries the latest Germomics episode, which no write purges.
export const HOME_EDGE_FRESH_SECONDS = 600;

/**
 * A publish_at seconds away would otherwise send a max-age near zero, and every read until it passed
 * would be a render. A minute is the most a scheduled post can lag its time for it.
 */
const SCHEDULED_FLOOR_SECONDS = 60;

const edgeCacheControl = (fresh: number) =>
  `max-age=${fresh}, stale-while-revalidate=${EDGE_STALE_SECONDS}`;

/**
 * Sent as `Cloudflare-CDN-Cache-Control`, not `s-maxage`: `s-maxage` implies proxy-revalidate, so
 * Cloudflare refuses to serve stale and every read past the lifetime blocks on a render.
 */
export const EDGE_CACHE_CONTROL = edgeCacheControl(EDGE_FRESH_SECONDS);

/** Short because the colophon's site-health tile age is the watchdog's liveness. */
export const HEALTH_EDGE_CACHE_CONTROL = edgeCacheControl(600);

/**
 * The edge policy for a page that lists posts. A scheduled post goes live with no write to purge on,
 * so the page expires when the next one does; with nothing scheduled it is the plain policy.
 */
export function scheduledEdgeCacheControl(
  now: Date,
  nextPublishAt: Date | null,
  fresh: number = EDGE_FRESH_SECONDS,
): string {
  if (!nextPublishAt) return edgeCacheControl(fresh);
  const untilPublish = Math.ceil((nextPublishAt.getTime() - now.getTime()) / 1000);
  return edgeCacheControl(Math.min(fresh, Math.max(SCHEDULED_FLOOR_SECONDS, untilPublish)));
}

export const EDGE_CACHE_HEADER = "Cloudflare-CDN-Cache-Control";

// A misspelled tag is a purge that silently does nothing: `cache.purge` succeeds on an unmatched tag.
export function cacheTags(slug?: string): string {
  return slug ? `post:${slug},posts` : "posts";
}

const PAGES_CACHE_TAG = "pages";

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

type ArticleSeo = {
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
function articleFacts(origin: string, post: ArticleSeo) {
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
    mainEntityOfPage: { "@type": "WebPage", "@id": `${origin}/writing/${post.slug}` },
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

export const PUBLICATIONS_URL = "/research/publications";

export const PUBLICATIONS_DESCRIPTION =
  "Peer-reviewed work by Dustin Edwards on retroviruses, bacteriophage genomics, and science education, with full text hosted here.";

export const OWNER_ORCID = "https://orcid.org/0000-0001-6409-8041";
export const OWNER_SCHOLAR =
  "https://scholar.google.com/citations?user=lfzCCXwAAAAJ";
export const OWNER_PUBMED =
  "https://pubmed.ncbi.nlm.nih.gov/?term=Edwards+Dustin%5BAuthor%5D&sort=date";
export const OWNER_FACULTY_PAGE = "https://faculty.tarleton.edu/dcedwards/";

// Confirmed by Dustin, 2026-09-28 (#200); each ties to Tarleton.
export const OWNER_SEA_PHAGES = "https://seaphages.org/faculty/318/";
export const OWNER_SCOPUS = "https://www.scopus.com/authid/detail.uri?authorId=57204587587";
export const OWNER_LOOP = "https://loop.frontiersin.org/people/2520780";
export const OWNER_GITHUB = "https://github.com/DrDustinEdwards";
export const OWNER_LINKEDIN = "https://www.linkedin.com/in/dustin-edwards-152235274/";

// The headshot (Dustin, 2026-09-28), uploaded to MEDIA from Tarleton's file so nothing here links to
// another server. The square crop leads: search engines prefer it for a Person.
export const OWNER_PHOTO = {
  key: "dustin-edwards-headshot-a4b25f04061613b9-1365x2048.jpg",
  width: 1365,
  height: 2048,
} as const;
export const OWNER_PHOTO_SQUARE = {
  key: "dustin-edwards-headshot-square-090e58f805bc9e9f-1365x1365.jpg",
  width: 1365,
  height: 1365,
} as const;

function photoObject(origin: string, photo: { key: string; width: number; height: number }) {
  const url = `${origin}/media/${photo.key}`;
  return { "@type": "ImageObject", url, contentUrl: url, width: photo.width, height: photo.height };
}

export const GERMOMICS_URL = "https://germomics.com/";
export const GERMOMICS_X_URL = "https://x.com/Germomics";

// The footer's `rel="me"` profiles, in order. `check:machine-readable` reads this list.
export const OWNER_PROFILES = [OWNER_SCHOLAR, OWNER_ORCID, OWNER_PUBMED] as const;

const OWNER_SAME_AS = [
  ...OWNER_PROFILES,
  OWNER_FACULTY_PAGE,
  OWNER_SEA_PHAGES,
  OWNER_SCOPUS,
  OWNER_LOOP,
  OWNER_GITHUB,
  OWNER_LINKEDIN,
  GERMOMICS_URL,
  GERMOMICS_X_URL,
];

// What he is known for, so a reader of the markup can tell him from the other Dustin Edwardses.
const OWNER_KNOWS_ABOUT = [
  "Virology",
  "Bacteriophages",
  "Phage genomics",
  "Avian retroviruses",
  "Retroviruses",
  "Science education",
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
    ...personFacts(origin),
  };
}

/** What both Person nodes say about the owner, in their key order. No alternate names. */
function personFacts(origin: string) {
  return {
    name: SITE.name,
    honorificSuffix: "Ph.D.",
    jobTitle: SITE.jobTitle,
    image: [photoObject(origin, OWNER_PHOTO_SQUARE), photoObject(origin, OWNER_PHOTO)],
    description: SITE.description,
    url: origin,
    worksFor: {
      "@type": "CollegeOrUniversity",
      name: SITE.affiliation,
      url: "https://www.tarleton.edu/",
      department: {
        "@type": "Organization",
        name: SITE.department,
      },
    },
    knowsAbout: OWNER_KNOWS_ABOUT,
    sameAs: OWNER_SAME_AS,
  };
}

// Registries spell his name several ways, so this reads the exact alias table the exports use: a
// surname-plus-initial rule claimed any "D* Edwards" co-author as the owner in JSON-LD.
export function isSiteOwner(name: string) {
  return canonicalAuthor(name) === SITE.name;
}

// Only the owner's entry becomes an `@id` reference; replacing the whole array would drop co-authors.
// Every record has its own page (app/lib/publications/by-slug.ts), so each article takes that page as
// its `@id` and `url`, the same node the paper page describes in full; a hosted PDF is its encoding.
export function publicationsJsonLd(
  origin: string,
  items: {
    title: string;
    authors: string[];
    year: number;
    journal: string | null;
    slug: string;
    /** Null for a submitted manuscript, which has no DOI yet. */
    doi: string | null;
    pdfPath: string | null;
    /** The curated type, so a chapter here is the same Chapter its own page describes. */
    type?: string;
  }[],
) {
  const id = personId(origin);
  return [
    personNode(origin),
    ...items.map((p) => ({
      "@context": "https://schema.org",
      "@type": p.type ? schemaTypeFor(p.type) : "ScholarlyArticle",
      "@id": origin + paperPath(p.slug),
      // Decoding is safe here: `jsonLd()` escapes `<` and `>` on the way into the script element.
      headline: decodeEntities(p.title),
      name: decodeEntities(p.title),
      author: p.authors.map((name) =>
        isSiteOwner(name) ? { "@id": id } : { "@type": "Person", name: canonicalAuthor(name) },
      ),
      datePublished: String(p.year),
      ...(p.journal
        ? { isPartOf: { "@type": "Periodical", name: decodeEntities(p.journal) } }
        : {}),
      ...(p.doi
        ? {
            identifier: { "@type": "PropertyValue", propertyID: "DOI", value: p.doi },
            sameAs: `https://doi.org/${p.doi}`,
          }
        : {}),
      url: origin + paperPath(p.slug),
      ...(p.pdfPath
        ? {
            encoding: {
              "@type": "MediaObject",
              encodingFormat: "application/pdf",
              contentUrl: origin + p.pdfPath,
            },
          }
        : {}),
    })),
  ];
}
