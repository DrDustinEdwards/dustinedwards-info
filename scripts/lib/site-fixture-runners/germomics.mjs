// Runs germomics' own feed, sitemap and llms builders (its origin/main, loaded by site-clone-loader) on fixed sample data and
// prints each output as JSON. See scripts/capture-site-helper-fixtures.mjs.

import { pathToFileURL } from "node:url";
import { join } from "node:path";

const APP = process.env.SITE_APP ?? "";
const load = (/** @type {string} */ file) => import(pathToFileURL(join(APP, file)).href);

const show = {
  title: "Germomics",
  language: "en-us",
  description: "Microbiology and history, told by a virologist.",
  author: "Dustin Edwards",
};
/** Post-shaped rows: a title with every escaped character, a body with links and markup, and one with no excerpt. */
const articles = [
  {
    id: 1,
    title: `Why phages win: notes & "questions" <draft>`,
    slug: "why-phages-win",
    publishedAt: "2026-06-21 09:30:00",
    updatedAt: "2026-07-01 12:00:00",
    excerpt: "A short summary with <angle> brackets & an ampersand.",
    seoDescription: null,
    body: '<p>Body with <a href="/about">a link</a> and an <em>emphasis</em>.</p>',
  },
  {
    id: 2,
    title: "It's alive",
    slug: "its-alive",
    publishedAt: "2026-05-02T08:00:00Z",
    updatedAt: null,
    excerpt: null,
    seoDescription: "Used when there is no excerpt.",
    body: "<p>Second body.</p>",
  },
];
const episodes = [
  { id: 3, title: "Episode one: the first cell", slug: "episode-one", publishedAt: "2026-04-01 00:00:00", updatedAt: null, excerpt: "What a cell is.", seoDescription: null, body: "<p>Notes.</p>", audioUrl: "https://media.example/e1.mp3", guid: "g1" },
];

const out = {};
out["site-feed.xml"] = (await load("lib/rss.server.ts")).buildSiteFeed(show, articles, "https://germomics.example");

const discovery = await load("lib/discovery.server.ts");
out["llms.txt"] = discovery.buildLlmsTxt(show, episodes, articles, "https://germomics.example", undefined);
out["llms-full.txt"] = discovery.buildLlmsFullTxt(show, episodes, articles, "https://germomics.example");

const sitemap = await load("routes/sitemap.ts");
const response = await sitemap.loader({ request: new Request("https://germomics.example/sitemap.xml"), context: {} });
out["sitemap.xml"] = await response.text();

console.log(JSON.stringify(out));
