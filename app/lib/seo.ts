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
/**
 * The COMPLETE social and canonical set for a hand-authored page.
 *
 * ## Why this is a function and not five copies
 *
 * Five pages each hand-assembled part of this list and each stopped at a
 * different point. Measured 2026-08-20: the HOME PAGE, which is the URL people
 * paste, carried `og:image` and `twitter:card` and had NO canonical, no
 * `og:title`, no `og:description`, no `og:url` and no `og:type`. The colophon
 * and the roster carried a title and a description and nothing else. Projects
 * and playground carried canonical and OG text and no image and no card.
 *
 * Every one of those is the same omission with a different edge missing, which
 * is what a copied literal does over time. One builder means a page cannot ship
 * a partial set, and adding a property later reaches every page at once.
 *
 * ## The canonical matters more than it did
 *
 * `SITE_ORIGIN` is still `workers.dev` and the site moves to the apex at DNS
 * cutover. A page with no canonical is a page that will exist at two hostnames
 * with no statement about which is authoritative, which is duplicate content by
 * construction rather than by accident. Emitting it now means the cutover is a
 * change to one constant rather than an SEO incident.
 *
 * ## Twitter card
 *
 * `summary_large_image` on every page, because every page has an image: the
 * argument falls through to the site mark, which is a real 1200x630 card rather
 * than a placeholder. A `twitter:card` without an image renders as a bare link,
 * so the two travel together or neither is worth setting.
 *
 * @param page `path` is site-absolute and starts with a slash.
 */
export function pageMeta(page: {
  title: string;
  description: string;
  path: string;
  image?: string;
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
    { property: "og:type", content: "website" },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: image },
  ];
}

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
 * THE STRING THAT PERMITS SHARED CACHING. Ten minutes at the edge, then a day
 * of stale-while-revalidate, so a deploy or a content sync propagates quickly
 * without every reader paying for an origin hit.
 *
 * ## RENAMED 2026-08-23, because the old name and comment were both wrong
 *
 * It was `PUBLIC_CACHE_CONTROL` and its comment read "Cache policy for public
 * NON-HTML surfaces" and "**Not for HTML.**" That was false on both counts, and
 * it had been false for some time: SEVEN HTML routes set this value. home, the
 * blog index, the post route, colophon, phage-discovery, playground and search
 * all return it from `headers()`.
 *
 * The name now says what the value DOES rather than which surfaces were
 * imagined to use it, because a name that encodes a surface claim goes stale
 * the first time a surface changes its mind, and nothing fails when it does.
 *
 * ## HTML MAY USE IT, AND SINCE 2026-09-05 IT NEEDS NO `Vary` TO BE SAFE
 *
 * The old comment was reaching for something true: an HTML document here
 * embeds reader state, because the theme is read from a cookie and written
 * into `<html data-theme>` in the first byte. A bare `public` on that WOULD
 * serve one reader's theme to another.
 *
 * What used to make it safe was a pairing: the route returned this WITH
 * `Vary: Cookie`, and `workers/app.ts` refused to store any response generated
 * for a cookie-bearing request, so the only variant ever written was the
 * cookieless one.
 *
 * WHAT MAKES IT SAFE NOW IS THE CACHE KEY. The theme is a dimension of the key
 * the platform owns, passed as `ctx.props` and in `cf.cacheKey` by the gateway
 * in `workers/app.ts`. A dark document and a light one are different entries
 * rather than one entry the second reader must be kept away from, which is why
 * every reader can now be served from cache instead of only the cookieless
 * ones. Ruling 16, 2026-09-05.
 *
 * The pairing did not disappear, it changed partners: what travels with this
 * string is now `Cache-Tag`, so a response that can be stored can also be
 * purged. `publicHtmlHeaders` is still the shape that cannot drop half of it.
 */
/**
 * THE LIFETIME ITSELF, and it is the owner rather than a copy of the string.
 *
 * INVERTED 2026-09-04, when `/admin/mentions` had to tell an operator how long
 * an approval takes to reach a reader. That sentence is a statement about this
 * number, and hard rule 17 gives a measured value one owner: a page typing
 * "ten minutes" beside a constant reading 600 is two owners that agree until
 * the day somebody changes one.
 *
 * So the number is declared and the header is built from it. The alternative
 * considered and refused was parsing `s-maxage=(\d+)` back out of the string,
 * which reintroduces the same problem one level down: a parse that stops
 * matching has to substitute something, and a substituted cache lifetime is a
 * false claim rather than a missing one.
 *
 * Nothing compares this header's TEXT against a literal, checked before the
 * inversion: `check:headers`, `check:browser`, `check:features` and
 * `check:page-payload` all test for the IDENTIFIER's presence, and
 * `verify-live` reads the value through this export. Two prose mentions of
 * `s-maxage=600` exist in gate comments and neither is an assertion.
 */
const SHARED_CACHE_SECONDS = 600;

export const SHARED_CACHE_CONTROL =
  `public, s-maxage=${SHARED_CACHE_SECONDS}, stale-while-revalidate=86400`;

/**
 * The same lifetime in minutes, for prose that has to state it.
 *
 * ONE READER TODAY: the approval note on `/admin/mentions`. It is exported
 * rather than computed there because the thing being stated is a property of
 * the cache policy, not of the admin page, and a page that derived it itself
 * would be the second owner this constant exists to prevent.
 */
export const SHARED_CACHE_MINUTES = SHARED_CACHE_SECONDS / 60;

/**
 * `HTML_VARY` WAS `"Cookie"` AND WAS DELETED 2026-09-05. Ruling 16.
 *
 * What it said, and it was true of the arrangement it belonged to: a route
 * carrying it declared that its body depends on the Cookie header, and
 * `workers/app.ts` then refused to store any response generated FOR a
 * cookie-bearing request, so the only variant ever written was the cookieless
 * one. Measured 2026-08-02: an ABSENT Cookie header is not treated as its own
 * variant, so a cookieless request matches whatever variant is already stored,
 * and a reader with `theme=dark` warming the entry served every first-time
 * visitor a dark document. Full matrix: Capsid
 * `dustinedwards/workers-cache-vary.md`.
 *
 * **THAT DEFECT WAS A PROPERTY OF `Vary`, AND `Vary` IS WHAT WENT.** The theme
 * is now a dimension of the cache KEY, where absence is not a special case: a
 * request with no theme cookie resolves to a theme like every other request and
 * keys on it. There is no stored variant for it to match by accident.
 *
 * Nothing replaced it, deliberately. Emitting `Vary: Cookie` now would fragment
 * the cache on every unrelated cookie value, which is the cost the old
 * arrangement paid and this one exists to stop paying.
 */

/**
 * Cache tags for a public HTML response. ONE OWNER of the tag vocabulary.
 *
 * Ruling 17, 2026-09-05. Every shared-cacheable HTML response carries
 * `Cache-Tag`, so that a write can invalidate exactly what it changed instead
 * of waiting out `s-maxage` or purging everything.
 *
 * ## THE VOCABULARY IS THREE WORDS AND THAT IS ON PURPOSE
 *
 *   `post:<slug>`  one post's page. The only per-document tag.
 *   `posts`        anything whose content is a function of the corpus: the
 *                  post page too, the index, the tag archives, the series
 *                  hubs, the feeds, the sitemap and llms.txt. A publish moves
 *                  all of them at once, so they purge together.
 *   `pages`        the hand-authored pages that do not read the corpus.
 *
 * **`pages` IS INERT TODAY AND IS STILL WORTH SENDING.** Nothing calls a purge
 * for it: those pages change only when the code changes, and the Worker version
 * is in the cache key, so a deploy already invalidates them. It is here so that
 * "every shared-cacheable response is purgeable by name" is a property of the
 * site rather than a description of most of it, and so the gate that asserts
 * the header can be universal rather than carrying an exemption list.
 *
 * A SPELLING MISTAKE HERE IS A PURGE THAT SILENTLY DOES NOTHING, which is why
 * this is a function and not a literal at eleven call sites: `cache.purge`
 * reports `success: true` for a tag that matches no stored response, because
 * there is nothing for it to report. One owner is the only defence.
 *
 * @param slug when present, the post this response IS
 */
export function cacheTags(slug?: string): string {
  return slug ? `post:${slug},posts` : "posts";
}

/** The tag for a page that does not read the corpus. See `cacheTags`. */
export const PAGES_CACHE_TAG = "pages";

/**
 * The `headers()` a public HTML route returns. ONE definition, many callers.
 *
 * ## IT WAS A PAIRING AND IT IS STILL A PAIRING, with a different second half
 *
 * Four routes once returned `Cache-Control` and `Vary` character for character,
 * and /projects returned nothing at all, so it fell through to hard rule 8's
 * uncached default and was the one public page never edge-cached. That is why
 * this helper exists and the reason has not changed.
 *
 * What travels with the shared string now is `Cache-Tag` rather than `Vary`. A
 * copy-paste that dropped the old second half was the measured theme bug; one
 * that drops this one is a response nothing can purge, which fails quietly
 * instead of visibly. `check:headers` asserts the pairing on every route that
 * names the shared string, in both directions.
 *
 * @param tag the cache tag for this response, from `cacheTags` or `PAGES_CACHE_TAG`
 */
export function publicHtmlHeaders(tag: string = PAGES_CACHE_TAG) {
  return { "Cache-Control": SHARED_CACHE_CONTROL, "Cache-Tag": tag };
}

/**
 * For the routes that negotiate on Accept.
 *
 * `Cookie` LEFT THIS STRING 2026-09-05 and `Accept` stays, because the two were
 * never the same kind of claim. The post page and `/search` genuinely serve
 * more than one representation at one URL, and a shared cache that ignored that
 * would hand a markdown request the HTML copy: measured on the wire after
 * `2f0b4d5`, 31,869 bytes of `text/html` answering `Accept: text/markdown`.
 */
export const HTML_VARY_ACCEPT = "Accept";

/**
 * THE STRING THAT REFUSES STORAGE. Nothing may keep this response: not a
 * shared cache, not an intermediary, not the browser.
 *
 * ## RENAMED 2026-08-23, because the old name named the wrong thing
 *
 * It was `HTML_CACHE_CONTROL`, which read as "the cache policy for HTML". It is
 * not: the HTML routes return the SHARED string above. What actually sets this
 * is the NON-HTML half of the site, the markdown twin and the JSON branch of
 * `/search`, plus two mechanisms rather than routes.
 *
 * Those two are why the value matters more than its callers. It is hard rule
 * 8's default in `workers/app.ts`, applied to every response that declares no
 * `Cache-Control` of its own, and it is what a cookie-bearing request gets on
 * the HTML routes after the downgrade there. Both are the fail-closed
 * direction, and both are invisible from any route file.
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
 * THE ARTICLE FACTS BOTH VOCABULARIES STATE, derived once.
 *
 * JSON-LD and Open Graph describe the same article to two different readers,
 * and until 2026-09-03 only the first was emitted: a crawler that reads OG and
 * not JSON-LD got a weaker article than the page already knew about.
 *
 * The obvious way to fix that is to write four `article:*` tags in the route,
 * and it is the wrong one. `dateModified` is not `updatedAt`, it is
 * `updatedAt ?? publishAt`, and the author is not a string in the route, it is
 * a shape this file owns. A second derivation would agree on the day it was
 * written and drift on the day either rule changes, which is the exact defect
 * the `image` field above already carries a comment about.
 *
 * So both callers read THIS. `articleJsonLd` spreads it into schema.org names
 * and `articleOpenGraph` maps it to `article:*` names, and neither computes a
 * value of its own. The gate compares the two outputs field by field, so the
 * claim is checked rather than asserted here.
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
 * The `article:*` Open Graph properties, from `articleFacts` and nothing else.
 *
 * `article:tag` REPEATS, one property per tag, which is what the vocabulary
 * says and is why this returns a list rather than an object. The JSON-LD side
 * joins the same array into a single `keywords` string, because that is what
 * schema.org asks for; the two spellings are a property of the vocabularies,
 * not of the data, and they come from one array either way.
 *
 * A tag or a date that is absent yields NO tag rather than an empty one. An
 * `article:published_time` with no content is a claim that the article has no
 * publication date, which is worse than saying nothing.
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
     * ONE RESOLUTION, SHARED WITH THE CARD.
     *
     * This read `coverImage` alone while `postSocial` falls through cover, then
     * the generated OG card, then the site mark. So a post with a built card and
     * no cover told a social crawler it had a card and told Google it had NO
     * image at all, from two statements about the same post on the same page.
     *
     * Asking `postSocial` rather than restating its chain is the point: the two
     * cannot disagree again, and a fourth fallback added later reaches both.
     * `postSocial` always returns an absolute URL and never null, so this is
     * never undefined, which is also the correct schema.org answer.
     */
    image: postSocial({
      slug: post.slug,
      title: post.title,
      description: post.description,
      coverImage: post.coverImage,
      ogImage: post.ogImage ?? null,
    }).image,
    // Same array the OG side emits one property per entry from. Joined here
    // because schema.org wants one string; that difference is the vocabulary's,
    // not a second opinion about which tags this post has.
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
