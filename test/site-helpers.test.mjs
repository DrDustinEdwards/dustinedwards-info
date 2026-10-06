// Holds packages/site-helpers to the output the sites already publish. test/fixtures/site-helpers/ is each site's own output,
// captured by scripts/capture-site-helper-fixtures.mjs (PROVENANCE.json names the commits), and the package must reproduce it
// byte for byte from the same data, so adopting it changes nothing a reader or a crawler sees.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RRF_K,
  absolutiseUrls,
  atomDocument,
  cdata,
  escapeXml,
  escapeXmlText,
  fuse,
  ftsLiteral,
  isoDay,
  llmsDocument,
  mathToTex,
  rfc822,
  rssDocument,
  sitemapDocument,
  toMatchExpression,
} from "../packages/site-helpers/index.mjs";

const fixture = (/** @type {string} */ name) =>
  readFileSync(new URL(`./fixtures/site-helpers/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

/** The entries a sitemap lists, read back out of the captured document. */
function entriesOf(/** @type {string} */ xml, /** @type {RegExp} */ lastmodPattern) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => {
    const get = (/** @type {string} */ tag) => body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
    const lastmod = get("lastmod");
    const priority = get("priority");
    return {
      loc: /** @type {string} */ (get("loc")),
      lastmod: lastmod && lastmodPattern.test(lastmod) ? lastmod : null,
      changefreq: get("changefreq"),
      priority: priority === undefined ? undefined : Number(priority),
    };
  });
}

test("sitemap: this site's document is reproduced byte for byte", () => {
  const xml = fixture("dustinedwards-sitemap.xml");
  assert.equal(sitemapDocument(entriesOf(xml, /^\d{4}-\d{2}-\d{2}$/)), xml);
});

test("sitemap: germomics' compact document with no trailing newline is reproduced byte for byte", () => {
  const xml = fixture("germomics-sitemap.xml");
  assert.equal(sitemapDocument(entriesOf(xml, /^\d{4}-\d{2}-\d{2}$/), { trailingNewline: false }), xml);
});

test("sitemap: foxhound's expanded document with datetimes, changefreq and priority is reproduced byte for byte", () => {
  const xml = fixture("foxhound-sitemap.xml");
  assert.equal(
    sitemapDocument(entriesOf(xml, /^\d{4}-\d{2}-\d{2}T/), { layout: "expanded", lastmodFormat: "datetime" }),
    xml,
  );
});

test("sitemap: a loc with an ampersand does not end the document", () => {
  const xml = sitemapDocument([{ loc: "https://x.test/a?b=1&c=2" }]);
  assert.match(xml, /<loc>https:\/\/x\.test\/a\?b=1&amp;c=2<\/loc>/);
});

/** The sections of a captured llms.txt, parsed back so the skeleton can be rebuilt from them. */
function llmsParts(/** @type {string} */ text) {
  const [head, ...sectionTexts] = text.split(/\n## /);
  const [title, summary, ...intro] = head.trimEnd().split("\n\n");
  return {
    title: title.replace(/^# /, ""),
    summary: summary.replace(/^> /, ""),
    intro,
    sections: sectionTexts.map((section) => {
      const [heading, ...lines] = section.trimEnd().split("\n");
      return {
        heading,
        links: lines.map((line) => {
          const match = line.match(/^- \[(.*)\]\((\S+)\)(?:: (.*))?$/);
          assert.ok(match, `a link line: ${line}`);
          return { title: match[1], url: match[2], description: match[3] };
        }),
      };
    }),
  };
}

test("llms: germomics' file is reproduced byte for byte from its parts", () => {
  const text = fixture("germomics-llms.txt");
  assert.equal(llmsDocument(llmsParts(text)), text);
});

test("llms: a link title's brackets are escaped and an empty section is dropped", () => {
  const text = llmsDocument({
    title: "T",
    summary: "S",
    sections: [
      { heading: "A", links: [{ title: "[draft] note", url: "https://x.test/n" }] },
      { heading: "Empty", links: [] },
    ],
  });
  assert.match(text, /- \[\\\[draft\\\] note\]\(https:\/\/x\.test\/n\)/);
  assert.doesNotMatch(text, /## Empty/);
});

test("xml: escapeXml covers all five entities and escapeXmlText leaves the quotes", () => {
  assert.equal(escapeXml(`&<>"'`), "&amp;&lt;&gt;&quot;&apos;");
  assert.equal(escapeXmlText(`&<>"'`), `&amp;&lt;&gt;"'`);
});

test("xml: escaping the ampersand first does not double-escape", () => {
  assert.equal(escapeXml("a &lt; b"), "a &amp;lt; b");
});

test("xml: a CDATA section survives a ]]> inside its text", () => {
  assert.equal(cdata("a ]]> b"), "<![CDATA[a ]]]]><![CDATA[> b]]>");
});

test("xml: the sites' feed fragments are the primitives' output", () => {
  const germomics = fixture("germomics-site-feed.xml");
  assert.ok(germomics.includes(`<title>${escapeXml(`Why phages win: notes & "questions" <draft>`)}</title>`));
  assert.ok(germomics.includes(`<pubDate>${rfc822("2026-06-21 09:30:00")}</pubDate>`));
  assert.ok(germomics.includes(`<pubDate>${rfc822("2026-05-02T08:00:00Z")}</pubDate>`));
  const foxhound = fixture("foxhound-feed.rss");
  assert.ok(foxhound.includes(`<title>${cdata(`Recovering failed payments: what works & what "doesn't"`)}</title>`));
  assert.ok(foxhound.includes(`<pubDate>${rfc822(new Date("2026-08-01T12:00:00.000Z"))}</pubDate>`));
});

test("xml: dates read as UTC and an unreadable one is the epoch, never today", () => {
  assert.equal(rfc822("2026-06-21 09:30:00"), "Sun, 21 Jun 2026 09:30:00 GMT");
  assert.equal(rfc822("not a date"), "Thu, 01 Jan 1970 00:00:00 GMT");
  assert.equal(isoDay("2026-07-01 12:00:00"), "2026-07-01");
  assert.equal(isoDay(null), null);
  assert.equal(isoDay("not a date"), null);
});

test("xml: only a single-slash root-relative URL is made absolute", () => {
  const html = `<a href="/a">x</a><img src="//cdn.test/i.png" srcset="/s1.png 1x, /s2.png 2x">`;
  assert.equal(
    absolutiseUrls(html, "https://x.test"),
    `<a href="https://x.test/a">x</a><img src="//cdn.test/i.png" srcset="https://x.test/s1.png 1x, https://x.test/s2.png 2x">`,
  );
});

test("xml: KaTeX markup becomes its TeX", () => {
  const html = `<span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span><span class="katex-html">x</span></span>`;
  assert.equal(mathToTex(html), "$x^2$");
});

test("feeds: itemPath moves a post's URL in all three formats", () => {
  const post = { slug: "p", title: "T", html: null, description: null, publishAt: null, updatedAt: null, tags: [] };
  const base = { title: "F", link: "https://x.test", description: "d", selfUrl: "https://x.test/f", origin: "https://x.test", posts: [post], itemPath: "/blog" };
  assert.match(rssDocument(base), /<link>https:\/\/x\.test\/blog\/p<\/link>/);
  assert.match(
    atomDocument({ ...base, subtitle: "s", alternateUrl: "https://x.test", authorName: "A" }),
    /href="https:\/\/x\.test\/blog\/p"/,
  );
});

test("search: a quote inside a term is doubled, so the term cannot leave its quotes", () => {
  assert.equal(ftsLiteral(`say "hi"`), `"say ""hi"""`);
  assert.equal(toMatchExpression({ terms: [`a"b`] }), `"a""b"`);
});

test("search: operators and hyphens stay literal text", () => {
  assert.equal(toMatchExpression({ terms: ["NEAR", "t-cell"], phrases: ["exact words"] }), `"exact words" AND "NEAR" AND "t-cell"`);
});

test("search: only the last term takes the prefix star, and nothing to match is null", () => {
  assert.equal(toMatchExpression({ terms: ["a", "cloudf"] }, true), `"a" AND "cloudf"*`);
  assert.equal(toMatchExpression({ terms: [] }), null);
});

test("search: fusion uses k = 60 and adds a document's contributions from every list", () => {
  assert.equal(RRF_K, 60);
  const [top] = fuse([[{ uid: "a" }, { uid: "b" }], [{ uid: "b" }]]);
  assert.equal(top.item.uid, "b");
  assert.equal(top.score, 1 / (60 + 2) + 1 / (60 + 1));
  assert.deepEqual(top.ranks, [2, 1]);
});

test("search: the fusion constant is the argument's, not a baked-in one", () => {
  const [only] = fuse([[{ uid: "a" }]], 10);
  assert.equal(only.score, 1 / 11);
});
