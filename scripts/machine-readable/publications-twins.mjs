import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { paperAskUrl, paperMarkdownPath, paperPath } from "../../app/lib/publications/paths.mjs";
import { decodeEntities } from "../../app/lib/publications/entities.mjs";
import { paperSearchInputs } from "../../app/lib/publications/search-inputs.mjs";
import { recordsForPapers } from "../../app/lib/search/records.mjs";
import { keyForUrl, urlForKey } from "../../app/lib/search/ask-keys.mjs";
import { closePart, compiled, hosted, openPart, refusalsFor, root, SLUG_ROUTE } from "./publications-context.mjs";

/* The markdown twins, their llms.txt listing, the paper search records and the Ask keys and URLs. */
const { tally, ok } = openPart("twins");

/** @param {string[]} messages */
const shown = (messages) => messages.slice(0, 8).join("; ") + (messages.length > 8 ? `; and ${messages.length - 8} more` : "");

/* The papers every public surface lists. */
const published = compiled.filter((c) => !c.draft);
const twins = new Map(published.map((c) => [`${c.slug}.md`, c.twin]));
const papers = published.map((c) => c.record);

ok(
  `one twin generated per published record (${twins.size} of ${published.length})`,
  twins.size === published.length && published.length > 0,
  "every assertion below iterates this map, so a short map is a quiet pass",
);

/*
 * The twin is a D1 row served by a route, since publications moved to files. A file left under public/ would
 * be served by the asset handler ahead of the route, and would not change when the paper does.
 */
{
  const dir = join(root, "public", "research", "publications");
  const strayStatic = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name)
    : [];
  ok(
    "no markdown twin sits under public/research/publications/, where an asset would shadow the route",
    strayStatic.length === 0,
    strayStatic.length ? `delete: ${strayStatic.join(", ")}. The twin is served from D1 (app/routes/publications.$slug[.md].ts)` : "",
  );
  const routes = readFileSync(join(root, "app", "routes.ts"), "utf8");
  ok(
    "the twin route is registered",
    /route\("research\/publications\/:slug\.md", "routes\/publications\.\$slug\[\.md\]\.ts"\)/.test(routes),
    "without it a twin answers the paper page's 404",
  );
}

/* Matched on the URL, because a count passes on a list naming the wrong papers. */
const llms = readFileSync(join(root, "content", "llms.txt"), "utf8");
const advertised = new Set([...llms.matchAll(/^\s{2}(\/research\/publications\/[a-z0-9-]+\.md)$/gm)].map((m) => m[1]));
ok(`llms.txt lists markdown twins (${advertised.size} found)`, advertised.size > 0, "an empty set here would make both directions below vacuous");

/* A paper added through Carrel is not in llms.txt until it is written there: the list is what is not derived. */
const expectedTwinUrls = new Set([...twins.keys()].map((name) => `/research/publications/${name}`));
const overAdvertised = [...advertised].filter((url) => !expectedTwinUrls.has(url));
ok(
  "llms.txt lists no twin this corpus does not produce",
  overAdvertised.length === 0,
  overAdvertised.length ? `advertised with no file: ${overAdvertised.join(", ")}` : "",
);
{
  const unadvertised = [...expectedTwinUrls].filter((url) => !advertised.has(url));
  console.log(`        (${expectedTwinUrls.size - unadvertised.length} of ${expectedTwinUrls.size} twins are in llms.txt${unadvertised.length ? `; not yet: ${unadvertised.join(", ")}` : ""})`);
}

const textless = hosted
  .filter((c) => !c.draft)
  .filter((c) => {
    const body = twins.get(`${c.slug}.md`) ?? "";
    const at = body.indexOf("## Full text");
    // The twin joins pages on a blank line and trims each, so it runs a little short, never half.
    return at === -1 || body.length - at < (c.fullText?.length ?? 0);
  })
  .map((c) => c.record.id);
ok(
  `every hosted paper's twin carries its extracted text (${hosted.length} hosted)`,
  textless.length === 0,
  textless.length ? `missing or truncated: ${textless.join(", ")}` : "",
);

/* Anchored to the named references, not a bare `&`: frontmatter URLs carry query strings. */
const entityTwins = [...twins.entries()].filter(([, body]) => /&(?:amp|lt|gt|quot|apos|#\d+);/.test(body)).map(([name]) => name);
ok("no twin carries an undecoded character reference", entityTwins.length === 0, entityTwins.length ? `still escaped in: ${entityTwins.join(", ")}` : "");

const paperRecords = recordsForPapers(paperSearchInputs(papers));

ok(
  `one search record per paper (${paperRecords.length} of ${papers.length})`,
  paperRecords.length === papers.length,
  "every assertion below iterates this list",
);

{
  const ARTIFACT_PATH = join(root, "content", "generated", "posts.json");
  if (!existsSync(ARTIFACT_PATH)) {
    ok(
      "content/generated/posts.json exists, so the paper records can be compared",
      false,
      "run npm run build:content. check-all's preflight does this before any gate.",
    );
  } else {
    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
    const inArtifact = new Map(
      (artifact.records ?? [])
        .filter((/** @type {any} */ r) => String(r.uid).startsWith("paper:"))
        .map((/** @type {any} */ r) => [r.uid, r]),
    );
    const expected = new Map(paperRecords.map((r) => [r.uid, r]));

    const missingRecords = [...expected.keys()].filter((uid) => !inArtifact.has(uid));
    ok(
      `every paper has a record in the content artifact (${expected.size} papers)`,
      missingRecords.length === 0,
      missingRecords.length ? `absent from posts.json, run npm run build:content: ${missingRecords.join(", ")}` : "",
    );

    const strayRecords = [...inArtifact.keys()].filter((uid) => !expected.has(uid));
    ok("the artifact carries no paper record this corpus does not produce", strayRecords.length === 0, strayRecords.length ? `stray: ${strayRecords.join(", ")}` : "");

    const wrongUrls = [...expected.entries()]
      .filter(([uid, record]) => inArtifact.has(uid) && inArtifact.get(uid).url !== record.url)
      .map(([uid]) => uid);
    ok("every paper record in the artifact points at the paper's page", wrongUrls.length === 0, wrongUrls.length ? `url mismatch: ${wrongUrls.join(", ")}` : "");
  }
}

/* Classic search shows the line it matched, so two-column text would snippet a mangled one. */
ok(
  `no paper search record carries the PDF text (${hosted.length} hosted compared)`,
  refusalsFor("search record").length === 0,
  shown(refusalsFor("search record")),
);

/* `keyForUrl` and `urlForKey` are asymmetric: a key that did not round-trip cites a 404. */
{
  const brokenKeys = papers
    .map((paper) => {
      const key = keyForUrl(paperPath(paper.slug));
      return { slug: paper.slug, key, back: urlForKey(key) };
    })
    .filter(({ slug, key, back }) => key !== `research/publications/${slug}.md` || back !== paperPath(slug));
  ok(
    `every paper's Ask key is its twin and maps back to its page (${papers.length} papers)`,
    brokenKeys.length === 0,
    brokenKeys.length ? brokenKeys.map((b) => `${b.slug}: key ${b.key}, back ${b.back}`).join("; ") : "",
  );

  const keyPathMismatch = papers.map((paper) => paper.slug).filter((slug) => `/${keyForUrl(paperPath(slug))}` !== paperMarkdownPath(slug));
  ok("every Ask key names the path the twin route serves", keyPathMismatch.length === 0, keyPathMismatch.length ? `key and twin path disagree: ${keyPathMismatch.join(", ")}` : "");
}

{
  const badAskUrls = papers
    .map((paper) => ({ id: paper.id, url: paperAskUrl(decodeEntities(paper.title)) }))
    .filter(({ url }) => !url.startsWith("/search?q=") || url.length > 600);
  ok(
    `paperAskUrl builds a /search query for every paper (${papers.length})`,
    badAskUrls.length === 0,
    badAskUrls.length ? badAskUrls.map((b) => `${b.id}: ${b.url.slice(0, 80)}`).join("; ") : "",
  );

  /* The quoted title and nothing else, because the classic index ANDs its terms. */
  const notJustTheTitle = papers
    .filter((paper) => {
      const title = decodeEntities(paper.title);
      const q = new URL(paperAskUrl(title), "https://example.invalid").searchParams.get("q");
      return q !== `"${title}"`;
    })
    .map((p) => p.id);
  ok(
    `the Ask query is the quoted title alone (${papers.length} papers)`,
    notJustTheTitle.length === 0,
    notJustTheTitle.length ? `a term the record does not carry makes the classic half return nothing: ${notJustTheTitle.join(", ")}` : "",
  );

  /* `query.mjs` reads a quoted run as a phrase, so a title carrying a quote splits it. */
  const quotedTitles = papers.filter((p) => /["']/.test(p.title)).map((p) => p.id);
  ok(
    `no title contains a quotation mark (${papers.length} read)`,
    quotedTitles.length === 0 && refusalsFor("title").length === 0,
    quotedTitles.length ? `paperAskUrl quotes the title, so these would break the phrase: ${quotedTitles.join(", ")}` : shown(refusalsFor("title")),
  );

  const routeSource = SLUG_ROUTE;
  ok(
    "the paper page calls paperAskUrl and imports it from paths.mjs",
    /paperAskUrl\(/.test(routeSource) && /from "~\/lib\/publications\/paths\.mjs"/.test(routeSource),
    "a hand-built /search URL on the page would be a second owner of the question",
  );
  ok(
    "the paper page builds no /search URL of its own",
    !/href=\{`\/search\?q=/.test(routeSource),
    "found an interpolated /search href beside the one the module owns",
  );
}

/* Measured by running this part on 2026-09-30; the floor sits a little under it. */
export const outcome = closePart(tally, "twins", 18);
