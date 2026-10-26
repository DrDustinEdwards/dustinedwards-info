import { SERP_TITLE_LIMIT, headTags, truncateForSerp } from "@drdustinedwards/site-helpers/head";
import { article, breadcrumbs, website } from "@drdustinedwards/site-helpers/schema";

// Relative, not `~/`: tsconfig.node.json also compiles this file and has no path mapping.
import { IDENTITY } from "./identity.generated.mjs";
import { TERMS_PATH } from "./license.mjs";
import { canonicalAuthor } from "./publications/authors.mjs";
import { schemaTypeFor } from "./publications/article-json-ld.mjs";
import { decodeEntities } from "./publications/entities.mjs";
import { paperPath } from "./publications/paths.mjs";

import { SITE_ORIGIN } from "./site-origin.mjs";

export { SITE_ORIGIN };

/** The `license` of every Dataset: the site's terms page (app/lib/license.mjs). */
export const LICENSE_URL = `${SITE_ORIGIN}${TERMS_PATH}`;

const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/dustin-edwards-og-image.png`;

// The person, the role, the headship, the department and the university are the CV's: derived from
// content/cv/profile.md and appointments.md by app/lib/identity.mjs (written to identity.generated.mjs at build),
// so a CV change reaches the site settings, the titles, the About text and the structured data.
// `role` is the visible identity line; `jobTitle` is the Person record's, which also names the headship
// (Dustin, 2026-09-28). `affiliation` is structured data (worksFor), so it stays short and literal; `org` is the full line for people to read.
// The description is the name and the role only (Dustin, 2026-10-15: "It should be just 'Dr. Dustin Edwards,
// Professor and Virologist'"). "Dr." is the doctorate the CV states, so it follows the degree rather than being typed.
const HONORIFIC = /^(Ph\.?D|M\.?D|D\.?V\.?M|Ed\.?D|D\.?Sc)\.?$/i.test(IDENTITY.degree) ? "Dr. " : "";
export const SITE = {
  name: IDENTITY.name,
  role: IDENTITY.role,
  jobTitle: IDENTITY.jobTitle,
  affiliation: IDENTITY.affiliation,
  // The university and its system, for the home hero and the About panel. `affiliation` stays the short form worksFor needs.
  org: IDENTITY.org,
  department: IDENTITY.department,
  eyebrow: IDENTITY.role,
  tagline: `${IDENTITY.role}, ${IDENTITY.department}, ${IDENTITY.affiliation}.`,
  description: `${HONORIFIC}${IDENTITY.name}, ${IDENTITY.role}`,
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
    pageTitle: searchTitle(post.title),
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
  /** `og:title` and `twitter:title`, where they keep more than the search title (a paper's whole title). */
  socialTitle?: string;
}) {
  return headTags({
    origin: SITE_ORIGIN,
    path: page.path,
    title: truncateForSerp(page.title, SERP_TITLE_LIMIT),
    // A title cut for search keeps its whole wording on the card.
    socialTitle: page.socialTitle ?? page.title,
    description: page.description,
    image: page.image ?? DEFAULT_OG_IMAGE,
    siteName: SITE.name,
    type: page.ogType,
  });
}

export { SERP_DESCRIPTION_LIMIT, SERP_TITLE_LIMIT, truncateForSerp } from "@drdustinedwards/site-helpers/head";

/**
 * The `<title>` a search result shows: the title with its suffix where both fit, else the suffix dropped and the title cut
 * at a word by Prelum's `truncateForSerp`. Only this title is shortened: the page's heading, `og:title` and the citation and
 * JSON-LD metadata keep the whole title, which for a paper is a fact.
 */
export function searchTitle(title: string, suffix: string = ` | ${SITE.name}`): string {
  const full = `${title}${suffix}`;
  return full.length <= SERP_TITLE_LIMIT ? full : truncateForSerp(title, SERP_TITLE_LIMIT);
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

/** A response whose address changes when its bytes do (hashed media, uploads). */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** The small text files crawlers read (robots.txt, security.txt, llms.txt). */
export const HOURLY_CACHE_CONTROL = "public, max-age=3600";

/** Paths no crawler needs, in /robots.txt and /ai.txt alike. /search/ask is here because every answer is billed. */
export const ROBOTS_DISALLOW = ["/admin", "/lab", "/preview", "/search/ask"];

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

/**
 * The tags of a document that lists both posts and procedures (the sitemap), in the comma-list
 * `cacheTags()` uses. `purgePosts` and `purgeProcedures` each reach it. The literal is the one
 * `PROCEDURES_CACHE_TAG` names (app/kb/procedures/route.ts); test/worker/cache-tags.test.ts pins both.
 */
export const POSTS_AND_PROCEDURES_CACHE_TAGS = `${cacheTags()},procedures`;

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

/** The facts Prelum's `headTags` and `article` both read, so the Open Graph tags and the JSON-LD cannot drift apart. */
export function articleFacts(post: ArticleSeo) {
  return { published: post.publishAt, modified: post.updatedAt ?? post.publishAt, author: SITE.name, tags: post.tags };
}

export function articleJsonLd(origin: string, post: ArticleSeo) {
  return article({
    url: `${origin}/writing/${post.slug}`,
    headline: post.title,
    description: post.description,
    image: postSocial({
      slug: post.slug,
      title: post.title,
      description: post.description,
      coverImage: post.coverImage,
      ogImage: post.ogImage ?? null,
    }).image,
    ...articleFacts(post),
    author: { "@type": "Person", name: SITE.name, url: origin },
    publisher: { "@type": "Person", name: SITE.name, url: origin },
  });
}

export function breadcrumbJsonLd(origin: string, trail: Array<[string, string]>) {
  return breadcrumbs(origin, trail.map(([name, path]) => ({ name, path })));
}

export function webSiteJsonLd(origin: string) {
  return website({ origin, name: SITE.name, description: SITE.description });
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
const OWNER_SEA_PHAGES = "https://seaphages.org/faculty/318/";
const OWNER_SCOPUS = "https://www.scopus.com/authid/detail.uri?authorId=57204587587";
const OWNER_LOOP = "https://loop.frontiersin.org/people/2520780";
const OWNER_GITHUB = "https://github.com/DrDustinEdwards";
const OWNER_LINKEDIN = "https://www.linkedin.com/in/dustin-edwards-152235274/";
const OWNER_WIKIDATA = "https://www.wikidata.org/wiki/Q141630373";

// The headshot (Dustin, 2026-09-28), uploaded to MEDIA from Tarleton's file so nothing here links to
// another server. The square crop leads: search engines prefer it for a Person.
export const OWNER_PHOTO = {
  key: "dustin-edwards-headshot-a4b25f04061613b9-1365x2048.jpg",
  width: 1365,
  height: 2048,
} as const;
const OWNER_PHOTO_SQUARE = {
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
  OWNER_WIKIDATA,
  GERMOMICS_URL,
  GERMOMICS_X_URL,
];

// What he is known for.
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

/** Not a duplicate of `personJsonLd`: this `@id` joins papers to a person. */
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
    honorificSuffix: IDENTITY.degree,
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
