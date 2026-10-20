// Read off the running site: every URL the sitemap lists answers 200 itself, not through a redirect, and
// the old feed addresses keep answering with the feed, because a feed reader may never follow a
// redirect. Plain fetches, not the browser page, because the status is what is being read and a page
// would follow a redirect.
import { BASE, ok } from "../harness.mjs";

/** @param {string} path */
const head = (path) => fetch(`${BASE}${path}`, { redirect: "manual" });

/** @param {import("../harness.mjs").CaseContext} _ctx */
export async function run(_ctx) {
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  ok("the sitemap lists pages to check", paths.length > 20, `${paths.length} <loc> entries`);

  /** @type {string[]} */
  const notOk = [];
  for (const path of paths) {
    const res = await head(path);
    if (res.status !== 200) notOk.push(`${path} ${res.status}`);
  }
  ok("every sitemap URL answers 200", notOk.length === 0, notOk.slice(0, 10).join(", "));

  // The old feeds answer with the feed itself (app/routes.ts, the legacy-blog routes).
  /** @type {string[]} */
  const feeds = [];
  for (const path of ["/blog/rss.xml", "/blog/feed.json", "/blog/atom.xml"]) {
    const res = await head(path);
    const type = res.headers.get("content-type") ?? "";
    if (res.status !== 200 || !/xml|json/.test(type)) feeds.push(`${path} ${res.status} ${type}`);
  }
  ok("the old feed addresses keep answering with the feed", feeds.length === 0, feeds.join(", "));
  console.log(`  sitemap and feeds: ${paths.length} sitemap URLs at 200`);
}
