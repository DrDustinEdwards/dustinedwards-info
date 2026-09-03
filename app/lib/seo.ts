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
 * ## HTML MAY USE IT, BUT ONLY WITH `HTML_VARY`
 *
 * The old comment was reaching for something true: an HTML document here
 * embeds reader state, because the theme is read from a cookie and written
 * into `<html data-theme>` in the first byte. A bare `public` on that WOULD
 * serve one reader's theme to another.
 *
 * What makes it safe is the pairing, not the value: an HTML route returns this
 * WITH `Vary: Cookie`, and `workers/app.ts` refuses to store any response
 * generated for a cookie-bearing request. The only variant ever written is the
 * cookieless one. Copy this constant onto an HTML route without `HTML_VARY`
 * and that protection is gone.
 */
export const SHARED_CACHE_CONTROL =
  "public, s-maxage=600, stale-while-revalidate=86400";

/**
 * What public HTML varies on. Paired with the downgrade in `workers/app.ts`.
 *
 * A route carrying this is declaring two things: it is publicly cacheable, and
 * its body depends on the Cookie header. The Worker entry then refuses to let
 * any response generated FOR a cookie-bearing request be stored. Together those
 * mean the only variant ever written is the cookieless one.
 *
 * **Why not `Vary: Cookie` alone.** Measured 2026-08-02: an ABSENT Cookie header
 * is not treated as its own variant. A cookieless request matches whatever
 * variant is already stored, so if a reader with `theme=dark` warmed the entry,
 * every first-time visitor was served a dark document. Present-but-different
 * cookie values DO separate correctly; absent does not. Grounds and the full
 * matrix: Capsid `dustinedwards/workers-cache-vary.md`.
 *
 * `Vary` is still required here, and dropping it would invert the bug: without
 * it a cookie-bearing request would match the stored cookieless variant and see
 * someone else's page. The measurement confirms that direction is safe WITH the
 * header.
 */
export const HTML_VARY = "Cookie";

/**
 * The `headers()` a public HTML route returns. ONE definition, five callers.
 *
 * ## THE PAIRING IS THE SAFETY PROPERTY, AND IT WAS COPIED FIVE TIMES
 *
 * Four routes returned this object character for character, and /projects
 * returned nothing at all, so it fell through to hard rule 8's uncached
 * default and was the one public page never edge-cached. That omission is in
 * core.md as a known gap; this helper is what closes it.
 *
 * The two values must travel TOGETHER. The shared string alone on an HTML
 * route serves one reader's theme to another, because every document here
 * embeds reader state in `<html data-theme>` from a cookie. `Vary: Cookie` is
 * what makes the cookieless downgrade in `workers/app.ts` able to keep the
 * stored variant cookieless. A copy-paste that drops the Vary line is the
 * measured theme bug, and a helper is the shape that cannot drop half of it.
 *
 * NOT for the routes that negotiate on Accept: those need HTML_VARY_ACCEPT
 * and say so themselves.
 */
export function publicHtmlHeaders() {
  return { "Cache-Control": SHARED_CACHE_CONTROL, Vary: HTML_VARY };
}

/** For the two routes that also negotiate on Accept. */
export const HTML_VARY_ACCEPT = "Accept, Cookie";

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
