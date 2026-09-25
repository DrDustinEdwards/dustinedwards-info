import { listBlogPostsFullText, listBlogPostsRendered } from "~/db";
import { atomDocument } from "~/lib/atom-feed.mjs";
import { jsonFeedDocument } from "~/lib/json-feed.mjs";
import { rssDocument } from "~/lib/rss-feed.mjs";
import { SHARED_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import { tagPath } from "~/lib/tag-path.mjs";

export type FeedFormat = "json" | "rss" | "atom";

/** check:headers reads these literals and asserts isUnpolicedType() exempts each from the CSP. */
const FEED_CONTENT_TYPES = {
  /*
   * `application/json`, not `application/feed+json`: Cloudflare does not compress `+json` types, and
   * this is the largest response on the site. Readers identify it by the `version` member.
   */
  json: "application/json; charset=utf-8",
  rss: "application/rss+xml; charset=utf-8",
  atom: "application/atom+xml; charset=utf-8",
} as const;

const FEED_FILES = { json: "feed.json", rss: "rss.xml", atom: "atom.xml" } as const;

const FEED_ITEMS = 20;

/** What one feed covers: its page, its title and blurb, and which posts it lists in what order. */
interface FeedScope {
  path: string;
  title: string;
  description: string;
  list: Parameters<typeof listBlogPostsFullText>[1];
}

export const blogFeed: FeedScope = {
  path: "/blog",
  title: `${SITE.name} blog`,
  description: "Writing on building for the web, mostly on Cloudflare.",
  list: { perPage: FEED_ITEMS },
};

/** 404 on an unknown tag stays with the route: a feed and its page must agree about whether a tag exists. */
export function tagFeed(tag: { slug: string; name: string }): FeedScope {
  return {
    path: tagPath(tag.slug),
    title: `${SITE.name} blog: ${tag.name}`,
    description: `Posts tagged ${tag.name}.`,
    list: { perPage: FEED_ITEMS, tag: tag.slug },
  };
}

/** Ordered by part, not date, and uncapped: a subscriber receives part one first and loses no later part. */
export function seriesFeed(series: { name: string }): FeedScope {
  return {
    path: seriesPath(series.name),
    title: `${SITE.name} blog: ${series.name}`,
    description: `Every part of ${series.name}, in order.`,
    list: { series: series.name, orderBy: "part" },
  };
}

/** One feed document for a scope, in JSON Feed, RSS or Atom, shared-cached. */
export async function feedResponse(env: Env, format: FeedFormat, scope: FeedScope) {
  const pageUrl = `${SITE_ORIGIN}${scope.path}`;
  const selfUrl = `${pageUrl}/${FEED_FILES[format]}`;

  let body: string;
  if (format === "json") {
    const posts = await listBlogPostsFullText(env, scope.list);
    const feed = jsonFeedDocument({
      title: scope.title,
      homePageUrl: pageUrl,
      feedUrl: selfUrl,
      description: scope.description,
      authorName: SITE.name,
      posts,
      origin: SITE_ORIGIN,
    });
    body = `${JSON.stringify(feed, null, 2)}\n`;
  } else {
    const posts = await listBlogPostsRendered(env, scope.list);
    body =
      format === "rss"
        ? rssDocument({
            title: scope.title,
            link: pageUrl,
            description: scope.description,
            selfUrl,
            posts,
            origin: SITE_ORIGIN,
          })
        : atomDocument({
            title: scope.title,
            subtitle: scope.description,
            alternateUrl: pageUrl,
            selfUrl,
            authorName: SITE.name,
            posts,
            origin: SITE_ORIGIN,
          });
  }

  return new Response(body, {
    headers: {
      "content-type": FEED_CONTENT_TYPES[format],
      "cache-control": SHARED_CACHE_CONTROL,
    },
  });
}
