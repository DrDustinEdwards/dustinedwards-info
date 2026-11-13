/* The structured panels as the server renders them in Capsomer's header: real HTML and crawlable links
 * (the disclosure pattern itself is tested in Capsomer). The interactions (hover, click, Escape, the viewport) are the browser
 * cases in scripts/lib/browser/cases/header-menus.mjs. */

import test from "node:test";
import assert from "node:assert/strict";

import { bundleRenderer } from "./lib/render-bundle.mjs";

const { render } = await bundleRenderer(`
  import { createElement as h } from "react";
  import { renderToString } from "react-dom/server";
  import { createMemoryRouter, RouterProvider } from "react-router";
  import { SiteHeader } from "~/components/site-header";
  export function render(pathname) {
    const router = createMemoryRouter([{ path: "*", element: h(SiteHeader) }], { initialEntries: [pathname] });
    return renderToString(h(RouterProvider, { router }));
  }
`);

const SECTIONS = ["research", "teaching", "software", "writing", "about"];
const html = render("/");

/** The markup of one panel: Capsomer names its id after the section's, and the panel ends at its list item. */
function panelHtml(id) {
  const start = html.search(new RegExp(`id="[^"]*-${id}"[^>]*popover`));
  assert.ok(start > 0, `no panel for ${id} in the server HTML`);
  return html.slice(start, html.indexOf("</li>", html.indexOf("site-nav-foot", start)));
}

const hrefsIn = (markup) => [...markup.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => m[1]);

await test("the panels' links are real anchors in the HTML, so a crawler and a reader without script can follow them", () => {
  const all = hrefsIn(html);
  for (const must of [
    "/research",
    "/research/publications",
    "/research/protocols",
    "/research/tools",
    "/teaching/phage-discovery",
    "/teaching#join-the-lab",
    "/software/capsid",
    "/systems",
    "/writing",
    "/writing/rss.xml",
    "/search",
    "/about",
    "/cv",
    "/dustin-edwards-cv.pdf",
    "/colophon",
  ]) {
    assert.ok(all.includes(must), `${must} is not an anchor in the server HTML`);
  }
  assert.ok(all.some((href) => href.startsWith("https://scholar.google.com/")));
  assert.ok(all.some((href) => href.startsWith("https://orcid.org/")));
  assert.ok(all.some((href) => href.startsWith("https://pubmed.ncbi.nlm.nih.gov/")));
  assert.ok(
    all.some((href) => /^\/writing\/[a-z0-9-]+$/.test(href)),
    "no article tile",
  );
  assert.ok(all.filter((href) => href !== "/").length >= 40, `only ${all.length} anchors`);
  assert.ok(!all.some((href) => href.startsWith("/interests/")));
  // An empty library answers 404 to the public, so its links are not in the markup until it has an entry.
  assert.ok(!all.includes("/recipes") && !all.includes("/software/how-tos"));
});

await test("a panel names no heading, so the page outline is not opened by the menu", () => {
  const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
  assert.doesNotMatch(nav, /<h[1-6]\b/);
});

await test("inside a section its button is marked as the section, and no other is", () => {
  const onWriting = render("/writing/ten-years-on-cloudflare");
  const marked = [...onWriting.matchAll(/<button\b[^>]*data-cap-part="panel-trigger"[^>]*>/g)]
    .map((m) => m[0])
    .filter((b) => b.includes("data-current"));
  assert.equal(marked.length, 1);
  assert.match(marked[0], /aria-controls="[^"]*-writing"/);
  // A panel link to the page the reader is on says so; a link to the section hub does not claim to be the page.
  assert.doesNotMatch(onWriting, /href="\/writing"[^>]*aria-current/);
});

await test("the spotlight and the tiles show the newest paper and the newest articles from build-time data", () => {
  const research = panelHtml("research");
  assert.match(research, /Latest paper/);
  assert.match(research, /Science communication tools/);
  assert.match(research, /Journal of Microbiology &amp; Biology Education, 2026/);
  assert.match(panelHtml("writing"), /Newest/);
});
