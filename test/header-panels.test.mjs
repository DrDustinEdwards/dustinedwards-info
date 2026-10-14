/* The structured panels as the server renders them: real HTML, crawlable links, the disclosure pattern
 * and nothing from the menu roles. The interactions (hover, click, Escape, the viewport) are the browser
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

/** The markup of one panel: from its opening tag to the next list item of the bar. */
function panelHtml(id) {
  const start = html.indexOf(`id="site-nav-${id}"`);
  assert.ok(start > 0, `no panel for ${id} in the server HTML`);
  const end = html.indexOf('data-nav-menu=""', start);
  return html.slice(start, end === -1 ? html.indexOf("</nav>", start) : end);
}

const hrefsIn = (markup) => [...markup.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => m[1]);

await test("the bar has five section buttons, each a disclosure of its own panel", () => {
  const buttons = [...html.matchAll(/<button\b[^>]*data-nav-button[^>]*>/g)].map((m) => m[0]);
  assert.equal(buttons.length, 5);
  for (const [i, id] of SECTIONS.entries()) {
    const button = buttons[i];
    assert.match(button, new RegExp(`aria-controls="site-nav-${id}"`));
    assert.match(button, new RegExp(`popovertarget="site-nav-${id}"`, "i"));
    assert.match(button, /type="button"/);
    assert.ok(html.includes(`id="site-nav-${id}"`), `${id}: aria-controls names nothing`);
  }
  // The names, in the bar's order; the old word-and-chevron pair is gone.
  const labels = [...html.matchAll(/<span class="site-nav-button-label">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["Research", "Teaching", "Software", "Writing", "About"]);
  assert.ok(!html.includes("site-nav-word"));
});

await test("no menu, menubar or menuitem role anywhere in the header", () => {
  assert.doesNotMatch(html, /role="(menu|menubar|menuitem)"/);
});

await test("every panel has its parts in order: band, three tiles, rows with a spotlight, three quick links", () => {
  for (const id of SECTIONS) {
    const panel = panelHtml(id);
    const order = ["site-nav-band", "site-nav-tiles", "site-nav-body", "site-nav-rows", "site-nav-spot", "site-nav-foot"].map((cls) => panel.indexOf(`class="${cls}`));
    assert.ok(order.every((at) => at >= 0), `${id}: a part is missing (${order})`);
    assert.deepEqual([...order].sort((a, b) => a - b), order, `${id}: the parts are out of order`);
    assert.equal((panel.match(/class="site-nav-tile"/g) ?? []).length, 3, `${id}: tiles`);
    const foot = panel.slice(panel.indexOf('class="site-nav-foot"'));
    assert.equal((foot.match(/class="site-nav-foot-link"/g) ?? []).length, 3, `${id}: quick links`);
  }
});

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
  assert.ok(all.some((href) => /^\/writing\/[a-z0-9-]+$/.test(href)), "no article tile");
  assert.ok(all.filter((href) => href !== "/").length >= 40, `only ${all.length} anchors`);
  assert.ok(!all.some((href) => href.startsWith("/interests/")));
  // An empty library answers 404 to the public, so its links are not in the markup until it has an entry.
  assert.ok(!all.includes("/recipes") && !all.includes("/software/how-tos"));
});

await test("the Lab sign-in link is on the bar beside Search, outside the nav, and goes to the lab workspace", () => {
  const tools = html.slice(html.indexOf('class="site-header-tools"'));
  assert.match(tools, /<a\b[^>]*data-lab-link[^>]*href="\/lab"/);
  assert.ok(tools.indexOf("data-search-trigger") < tools.indexOf('href="/lab"'));
  const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
  assert.ok(!nav.includes('href="/lab"'));
  assert.match(tools, /Lab<span class="site-lab-more"> sign-in<\/span>/);
});

await test("a panel names no heading, so the page outline is not opened by the menu", () => {
  const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
  assert.doesNotMatch(nav, /<h[1-6]\b/);
});

await test("inside a section its button is marked as the section, and no other is", () => {
  const onWriting = render("/writing/ten-years-on-cloudflare");
  const marked = [...onWriting.matchAll(/<button\b[^>]*data-nav-button[^>]*>/g)].map((m) => m[0]).filter((b) => b.includes("data-section"));
  assert.equal(marked.length, 1);
  assert.match(marked[0], /aria-controls="site-nav-writing"/);
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
