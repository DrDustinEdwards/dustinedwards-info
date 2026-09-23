/*
 * THE ONE IMPORT IN THIS FILE. `publicationsJsonLd` decodes character references so the emitted
 * schema.org `headline` and `name` are the strings a human reads, and a builder that left that to
 * its callers would emit a wrong VALUE the first time one forgot.
 */
/*
 * RELATIVE, not the `~/` alias every route uses. `tsconfig.node.json` carries no path mapping and
 * has to compile this file, so an aliased import here fails the build scripts' project while
 * compiling fine for the Worker.
 */
import { decodeEntities } from "./publications/entities.mjs";

/**
 * The canonical public origin. Every absolute URL the site emits derives from this and never from
 * `request.url`: prerendering runs in Node at build time with no request and no Worker env, and a
 * canonical URL should name the canonical origin whichever host served the response.
 *
 * DNS cutover item: change this with BETTER_AUTH_URL and the Google redirect URI.
 */
export const SITE_ORIGIN = "https://dustinedwards.dustin-edwards.workers.dev";

/**
 * The default social card, for any page without one of its own. Derived from SITE_ORIGIN rather
 * than written out: hardcoding the apex would point every scraper at the legacy WordPress site
 * until DNS moves.
 */
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/dustin-edwards-og-image.png`;

/**
 * The site's identity, split by the job each string does. `role` and `affiliation` are STRUCTURED
 * DATA, the jobTitle and worksFor a machine reads, so they stay short, literal and true. `eyebrow`
 * and `tagline` are the homepage's own words and are free to be sentences.
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
 * Everything a post's head tags are built from, in ONE place. The public route and the admin
 * preview both call this, because a preview that computed it a second way would lie the moment the
 * two disagreed, and it would lie silently.
 *
 * The precedence is ratified and is not this function's to change: a per-post cover wins, then the
 * card `build:og` generated, then the site mark.
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
     * True when the card fell all the way through to the site mark. The editor shows this rather than
     * a placeholder, because "no cover" is a real and correct outcome the author should see.
     */
    usingDefaultImage: socialImage === null,
  };
}

/**
 * Where a search result stops, which is NOT where the description field's own counter stops. Google
 * truncates by rendered PIXEL width, roughly 600px of title and 920px of desktop description, so any
 * character count approximates a measure this site cannot take. A preview cutting at the description
 * field's own 160-character counter would show text the result will actually clip.
 */
/**
 * The COMPLETE social and canonical set for a hand-authored page.
 *
 * ONE BUILDER, so a page cannot ship a partial set and a property added later reaches every page at
 * once. `summary_large_image` on all of them, because the image argument falls through to the site
 * mark and a `twitter:card` without an image renders as a bare link.
 *
 * @param page `path` is site-absolute and starts with a slash.
 */
export function pageMeta(page: {
  title: string;
  description: string;
  path: string;
  image?: string;
  /**
   * The Open Graph type. `website` for a hand-written page, `article` for a page that IS a work.
   *
   * `check:invariants` section 13 refuses a hand-assembled social set, so a page needing one thing
   * differently teaches this helper rather than exempting itself. The `citation_*` tags stay appended
   * by the route: they are not social metadata and no other page has them.
   */
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

export const SERP_TITLE_LIMIT = 60;
export const SERP_DESCRIPTION_LIMIT = 155;

/**
 * Cuts at the last WORD boundary before the limit, the way a search engine does. Returns the text
 * unchanged when it fits, so the caller can tell truncation happened by comparing.
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
    sameAs: OWNER_SAME_AS,
  };
}

/**
 * THE STRING THAT PERMITS SHARED CACHING, built from the lifetime below.
 *
 * HTML MAY USE IT, and needs no `Vary` to be safe. The theme is a dimension of the cache KEY the
 * gateway sets in `workers/app.ts`, so a dark document and a light one are different entries rather
 * than one entry a second reader must be kept away from.
 *
 * What travels with it is `Cache-Tag`, so a response that can be stored can also be purged.
 */
/**
 * THE LIFETIME ITSELF, and it is the owner rather than a copy of the string. Hard rule 17 gives a
 * measured value one owner, and a page typing the lifetime in prose beside a constant is two owners
 * that agree until the day somebody changes one.
 *
 * NEVER PARSE `s-maxage` BACK OUT OF THE STRING. A parse that stops matching has to substitute
 * something, and a substituted cache lifetime is a false claim rather than a missing one.
 */
const SHARED_CACHE_SECONDS = 600;

export const SHARED_CACHE_CONTROL =
  `public, s-maxage=${SHARED_CACHE_SECONDS}, stale-while-revalidate=86400`;

/**
 * The same lifetime in minutes, for prose that has to state it. Exported rather than computed
 * there, because the thing being stated is a property of the cache policy and not of the page.
 */
export const SHARED_CACHE_MINUTES = SHARED_CACHE_SECONDS / 60;

/**
 * `HTML_VARY` WAS `"Cookie"` AND WAS DELETED. The theme is a dimension of the cache key now, where
 * absence is not a special case: a request with no theme cookie resolves to a theme like any other.
 *
 * Nothing replaced it, deliberately. Emitting `Vary: Cookie` here would fragment the cache on every
 * unrelated cookie value.
 */

/**
 * Cache tags for a public HTML response. ONE OWNER of the tag vocabulary, ruling 17.
 *
 *   `post:<slug>`  one post's page, the only per-document tag
 *   `posts`        anything whose content is a function of the corpus
 *   `pages`        the hand-authored pages that do not read the corpus
 *
 * `pages` is inert today and is still sent, so that purgeable by name is a property of every
 * shared-cacheable response rather than of most of them.
 *
 * A SPELLING MISTAKE HERE IS A PURGE THAT SILENTLY DOES NOTHING: `cache.purge` reports success for
 * a tag matching no stored response, because there is nothing for it to report.
 *
 * @param slug when present, the post this response IS
 */
export function cacheTags(slug?: string): string {
  return slug ? `post:${slug},posts` : "posts";
}

/** The tag for a page that does not read the corpus. See `cacheTags`. */
export const PAGES_CACHE_TAG = "pages";

/**
 * The `headers()` a public HTML route returns. ONE definition, many callers: a route that returns
 * nothing falls through to hard rule 8's uncached default and is never edge-cached.
 *
 * A copy that drops `Cache-Tag` is a response nothing can purge, which fails quietly rather than
 * visibly. `check:headers` asserts the pairing on every route that names the shared string, in both
 * directions.
 *
 * @param tag the cache tag for this response, from `cacheTags` or `PAGES_CACHE_TAG`
 */
export function publicHtmlHeaders(tag: string = PAGES_CACHE_TAG) {
  return { "Cache-Control": SHARED_CACHE_CONTROL, "Cache-Tag": tag };
}

/**
 * For the routes that negotiate on Accept. `Cookie` left this string and `Accept` stays, because
 * the two were never the same claim: the post page and `/search` genuinely serve more than one
 * representation at one URL, and a shared cache ignoring that hands a markdown request the HTML.
 */
export const HTML_VARY_ACCEPT = "Accept";

/**
 * THE STRING THAT REFUSES STORAGE. Nothing may keep this response: not a shared cache, not an
 * intermediary, not the browser.
 *
 * Its two mechanisms matter more than its callers, and both are invisible from a route file. It is
 * hard rule 8's default in `workers/app.ts` for any response declaring no `Cache-Control` of its
 * own, and it is what a cookie-bearing request gets on the HTML routes after the downgrade there.
 */
export const NO_STORE_CACHE_CONTROL = "private, no-store";

export type ArticleSeo = {
  slug: string;
  title: string;
  description: string | null;
  publishAt: Date | null;
  updatedAt: Date | null;
  coverImage: string | null;
  /** The generated social card, when one was built. See postSocial. */
  ogImage?: string | null;
  tags: string[];
};

/**
 * THE ARTICLE FACTS BOTH VOCABULARIES STATE, derived once. `dateModified` is
 * `updatedAt ?? publishAt` and the author is a shape this file owns, so a second derivation would
 * agree the day it was written and drift the day either rule changed.
 *
 * `articleJsonLd` spreads this into schema.org names and `articleOpenGraph` maps it to `article:*`
 * names. Neither computes a value of its own, and the gate compares the two outputs field by field.
 */
export function articleFacts(origin: string, post: ArticleSeo) {
  return {
    publishedTime: post.publishAt?.toISOString(),
    /** Falls back to publication: an unrevised article was modified when it appeared. */
    modifiedTime: (post.updatedAt ?? post.publishAt)?.toISOString(),
    authorName: SITE.name,
    authorUrl: origin,
    tags: post.tags,
  };
}

/**
 * The `article:*` Open Graph properties, from `articleFacts` and nothing else. `article:tag`
 * REPEATS, one property per tag, which is why this returns a list; the JSON-LD side joins the same
 * array into one `keywords` string, and that difference belongs to the vocabularies.
 *
 * An absent tag or date yields NO property rather than an empty one: an `article:published_time`
 * with no content claims the article has no publication date.
 */
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

/** schema.org Article for one post. */
export function articleJsonLd(origin: string, post: ArticleSeo) {
  const facts = articleFacts(origin, post);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description ?? undefined,
    datePublished: facts.publishedTime,
    dateModified: facts.modifiedTime,
    /*
     * ONE RESOLUTION, SHARED WITH THE CARD. Asking `postSocial` rather than restating its chain is
     * the point: the two cannot disagree, and a fallback added later reaches both.
     */
    image: postSocial({
      slug: post.slug,
      title: post.title,
      description: post.description,
      coverImage: post.coverImage,
      ogImage: post.ogImage ?? null,
    }).image,
    // Same array the OG side emits one property per entry from. Joined here because schema.org wants
    // one string; that difference is the vocabulary's, not a second opinion about this post's tags.
    keywords: facts.tags.length > 0 ? facts.tags.join(", ") : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${origin}/blog/${post.slug}` },
    author: { "@type": "Person", name: facts.authorName, url: facts.authorUrl },
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

/* Publications. Restored by ruling 63. */

/** The route. `pageMeta` builds the absolute form from `SITE_ORIGIN`. */
export const PUBLICATIONS_URL = "/publications";

export const PUBLICATIONS_DESCRIPTION =
  "Peer-reviewed work by Dustin Edwards on retroviruses, bacteriophage genomics, and science education, with full text hosted here.";

/**
 * Authority records that identify the site owner, for schema.org sameAs and the footer. Each was
 * fetched on 2026-09-23 and names him: the Scholar profile at Tarleton State (the id this file held
 * before answered 404), the ORCID record, the PubMed author search, and the faculty page the Biology
 * department links to (the directory URL held before also answered 404).
 */
export const OWNER_ORCID = "https://orcid.org/0000-0001-6409-8041";
export const OWNER_SCHOLAR =
  "https://scholar.google.com/citations?user=lfzCCXwAAAAJ";
export const OWNER_PUBMED =
  "https://pubmed.ncbi.nlm.nih.gov/?term=Edwards+Dustin%5BAuthor%5D&sort=date";
export const OWNER_FACULTY_PAGE = "https://faculty.tarleton.edu/dcedwards/";

/** The podcast and its account (rulings 134 and 135). */
export const GERMOMICS_URL = "https://germomics.com/";
export const GERMOMICS_X_URL = "https://x.com/Germomics";

/** The profiles the footer marks `rel="me"`, in its order. `check:microformats` reads this list. */
export const OWNER_PROFILES = [OWNER_SCHOLAR, OWNER_ORCID, OWNER_PUBMED] as const;

/** Every sameAs, one list for both Person records so they cannot disagree. */
export const OWNER_SAME_AS = [
  ...OWNER_PROFILES,
  OWNER_FACULTY_PAGE,
  GERMOMICS_URL,
  GERMOMICS_X_URL,
];

/** Stable `@id` for the owner's Person node, so it is described once per page. */
export function personId(origin: string) {
  return `${origin}/#person`;
}

/**
 * schema.org Person for the site owner, carrying the authority links. The sameAs array is the
 * point: another academic works under this name and a citation graph has already merged some of his
 * work into this author record, so the ORCID, the Scholar profile and the faculty page give a
 * consumer three ways to tell them apart without guessing from a name string.
 *
 * `personJsonLd` above is the home page's Person and carries no `@id`. The two are not a duplication
 * to collapse: that one describes the site owner to a reader, this one joins a paper to a human.
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

/**
 * Match the site owner in an author list. The registries return several spellings of his name and
 * his position in the list varies, so this keys on surname plus a D initial rather than an exact
 * string.
 */
export function isSiteOwner(name: string) {
  const parts = name.trim().split(/\s+/);
  const surname = parts[parts.length - 1] ?? "";
  const given = parts[0] ?? "";
  return surname.toLowerCase() === "edwards" && given.toUpperCase().startsWith("D");
}

/**
 * One Person node followed by a ScholarlyArticle per publication. Co-authors stay plain Person
 * objects and only the owner's entry becomes an `@id` reference: replacing the whole author array
 * with a single reference would drop the co-authors and misstate authorship on every other record.
 */
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
      /*
       * DECODED HERE RATHER THAN AT THE CALL SITE: this function owns the node shape, and a caller that
       * forgot would emit an escaped string as a schema.org `name`, a wrong VALUE rather than a glitch.
       * Safe for the invariant it looks like it breaks, since `jsonLd()` escapes `<` and `>` on the way
       * into the script element.
       */
      headline: decodeEntities(p.title),
      author: p.authors.map((name) =>
        isSiteOwner(name) ? { "@id": id } : { "@type": "Person", name },
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
