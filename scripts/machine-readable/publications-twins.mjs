import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { doiKey } from "../build-publications.mjs";
import { generateTwins } from "../build-publication-twins.mjs";
import {
  doiSlug,
  paperAskUrl,
  paperMarkdownPath,
  paperPath,
} from "../../app/lib/publications/paths.mjs";
import { decodeEntities } from "../../app/lib/publications/entities.mjs";
import { paperSearchInputs } from "../../app/lib/publications/search-inputs.mjs";
import { recordsForPapers } from "../../app/lib/search/records.mjs";
import { keyForUrl, urlForKey } from "../../app/lib/search/ask-keys.mjs";
import { PUBLICATIONS } from "../../app/data/publications.ts";
import {
  closePart,
  extractedPapers,
  hosted,
  openPart,
  root,
  SLUG_ROUTE,
} from "./publications-context.mjs";

/* The markdown twins, their llms.txt listing, the paper search records and the Ask keys and URLs. */
const { tally, ok } = openPart("twins");

/*
 * Nothing imports the twins, so a build that never ran ships an llms.txt advertising 404s.
 * Compared in memory and never written first: a gate that repairs its subject cannot fail.
 */
const twins = await generateTwins();

ok(
  `one twin generated per record (${twins.size} of ${PUBLICATIONS.length})`,
  twins.size === PUBLICATIONS.length,
  "every assertion below iterates this map, so a short map is a quiet pass",
);

const TWIN_DIR = join(root, "public", "publications");
const missingTwins = [...twins.keys()].filter((name) => !existsSync(join(TWIN_DIR, name)));
ok(
  "every twin exists on disk",
  missingTwins.length === 0,
  missingTwins.length
    ? `run npm run build:publication-twins. Missing: ${missingTwins.join(", ")}`
    : "",
);

const driftedTwins = [...twins.entries()]
  .filter(([name, body]) => {
    const path = join(TWIN_DIR, name);
    return existsSync(path) && readFileSync(path, "utf8") !== body;
  })
  .map(([name]) => name);
ok(
  "every twin on disk matches a fresh generation",
  driftedTwins.length === 0,
  driftedTwins.length
    ? `stale, run npm run build:publication-twins: ${driftedTwins.join(", ")}`
    : "",
);

/* A corrected DOI leaves a file nothing overwrites. */
const strayTwins = readdirSync(TWIN_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name)
  .filter((name) => !twins.has(name));
ok(
  "no twin on disk belongs to a record this corpus no longer carries",
  strayTwins.length === 0,
  strayTwins.length ? `stray: ${strayTwins.join(", ")}` : "",
);

/* Matched on the URL, because a count passes on a list naming the wrong papers. */
const llms = readFileSync(join(root, "content", "llms.txt"), "utf8");
const advertised = new Set(
  [...llms.matchAll(/^\s{2}(\/publications\/[a-z0-9-]+\.md)$/gm)].map((m) => m[1]),
);
ok(
  `llms.txt lists markdown twins (${advertised.size} found)`,
  advertised.size > 0,
  "an empty set here would make both directions below vacuous",
);

const expectedTwinUrls = new Set([...twins.keys()].map((name) => `/publications/${name}`));
const unadvertised = [...expectedTwinUrls].filter((url) => !advertised.has(url));
ok(
  `every twin is listed in llms.txt (${expectedTwinUrls.size} twins)`,
  unadvertised.length === 0,
  unadvertised.length ? `absent from llms.txt: ${unadvertised.join(", ")}` : "",
);

const overAdvertised = [...advertised].filter((url) => !expectedTwinUrls.has(url));
ok(
  "llms.txt lists no twin this corpus does not produce",
  overAdvertised.length === 0,
  overAdvertised.length ? `advertised with no file: ${overAdvertised.join(", ")}` : "",
);

const textless = [];
for (const [doi, fields] of hosted) {
  const entry = extractedPapers[doi] ?? extractedPapers[doiKey(doi)];
  const body = twins.get(`${doiSlug(doi)}.md`) ?? "";
  if (!entry) continue;
  const marker = "## Full text";
  const at = body.indexOf(marker);
  // Half: the twin joins pages on a blank line and trims each, so it runs a little short, never half.
  if (at === -1 || body.length - at < entry.chars / 2) {
    textless.push(`${fields.id} (${at === -1 ? "no section" : "short"})`);
  }
}
ok(
  `every hosted paper's twin carries its extracted text (${hosted.length} hosted)`,
  textless.length === 0,
  textless.length ? `missing or truncated: ${textless.join(", ")}` : "",
);

/* Anchored to the named references, not a bare `&`: frontmatter URLs carry query strings. */
const entityTwins = [...twins.entries()]
  .filter(([, body]) => /&(?:amp|lt|gt|quot|apos|#\d+);/.test(body))
  .map(([name]) => name);
ok(
  "no twin carries an undecoded character reference",
  entityTwins.length === 0,
  entityTwins.length ? `still escaped in: ${entityTwins.join(", ")}` : "",
);

const paperRecords = recordsForPapers(paperSearchInputs(PUBLICATIONS));

ok(
  `one search record per paper (${paperRecords.length} of ${PUBLICATIONS.length})`,
  paperRecords.length === PUBLICATIONS.length,
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
      missingRecords.length
        ? `absent from posts.json, run npm run build:content: ${missingRecords.join(", ")}`
        : "",
    );

    const strayRecords = [...inArtifact.keys()].filter((uid) => !expected.has(uid));
    ok(
      "the artifact carries no paper record this corpus does not produce",
      strayRecords.length === 0,
      strayRecords.length ? `stray: ${strayRecords.join(", ")}` : "",
    );

    const wrongUrls = [...expected.entries()]
      .filter(([uid, record]) => inArtifact.has(uid) && inArtifact.get(uid).url !== record.url)
      .map(([uid]) => uid);
    ok(
      "every paper record in the artifact points at the paper's page",
      wrongUrls.length === 0,
      wrongUrls.length ? `url mismatch: ${wrongUrls.join(", ")}` : "",
    );
  }
}

/* Classic search shows the line it matched, so two-column text would snippet a mangled one. */
{
  const oversized = paperRecords
    .filter((record) => {
      const doi = PUBLICATIONS.find((p) => record.uid === `paper:${doiSlug(p.doi)}`)?.doi;
      const entry = doi ? (extractedPapers[doi] ?? extractedPapers[doiKey(doi)]) : null;
      return entry ? record.body.length > entry.chars / 2 : false;
    })
    .map((record) => record.uid);
  ok(
    `no paper search record carries the PDF text (${hosted.length} hosted compared)`,
    oversized.length === 0,
    oversized.length ? `body is full-text sized: ${oversized.join(", ")}` : "",
  );
}

/* `keyForUrl` and `urlForKey` are asymmetric: a key that did not round-trip cites a 404. */
{
  const brokenKeys = PUBLICATIONS.map((paper) => {
    const slug = doiSlug(paper.doi);
    const key = keyForUrl(paperPath(slug));
    return { slug, key, back: urlForKey(key) };
  }).filter(
    ({ slug, key, back }) => key !== `publications/${slug}.md` || back !== paperPath(slug),
  );
  ok(
    `every paper's Ask key is its twin and maps back to its page (${PUBLICATIONS.length} papers)`,
    brokenKeys.length === 0,
    brokenKeys.length
      ? brokenKeys.map((b) => `${b.slug}: key ${b.key}, back ${b.back}`).join("; ")
      : "",
  );

  const keyPathMismatch = PUBLICATIONS.map((paper) => doiSlug(paper.doi)).filter(
    (slug) => `/${keyForUrl(paperPath(slug))}` !== paperMarkdownPath(slug),
  );
  ok(
    "every Ask key names the file the twin build writes",
    keyPathMismatch.length === 0,
    keyPathMismatch.length ? `key and twin path disagree: ${keyPathMismatch.join(", ")}` : "",
  );
}

{
  const badAskUrls = PUBLICATIONS.map((paper) => ({
    id: paper.id,
    url: paperAskUrl(decodeEntities(paper.title)),
  })).filter(({ url }) => !url.startsWith("/search?q=") || url.length > 600);
  ok(
    `paperAskUrl builds a /search query for every paper (${PUBLICATIONS.length})`,
    badAskUrls.length === 0,
    badAskUrls.length ? badAskUrls.map((b) => `${b.id}: ${b.url.slice(0, 80)}`).join("; ") : "",
  );

  /* The quoted title and nothing else, because the classic index ANDs its terms. */
  const notJustTheTitle = PUBLICATIONS.filter((paper) => {
    const title = decodeEntities(paper.title);
    const q = new URL(paperAskUrl(title), "https://example.invalid").searchParams.get("q");
    return q !== `"${title}"`;
  }).map((p) => p.id);
  ok(
    `the Ask query is the quoted title alone (${PUBLICATIONS.length} papers)`,
    notJustTheTitle.length === 0,
    notJustTheTitle.length
      ? `a term the record does not carry makes the classic half return nothing: ` +
          notJustTheTitle.join(", ")
      : "",
  );

  /* `query.mjs` reads a quoted run as a phrase, so a title carrying a quote splits it. */
  const quotedTitles = PUBLICATIONS.filter((p) => /["']/.test(p.title)).map((p) => p.id);
  ok(
    `no title contains a quotation mark (${PUBLICATIONS.length} read)`,
    quotedTitles.length === 0,
    quotedTitles.length
      ? `paperAskUrl quotes the title, so these would break the phrase: ${quotedTitles.join(", ")}`
      : "",
  );

  const routeSource = SLUG_ROUTE;
  ok(
    "the paper page calls paperAskUrl and imports it from paths.mjs",
    /paperAskUrl\(/.test(routeSource) &&
      /from "~\/lib\/publications\/paths\.mjs"/.test(routeSource),
    "a hand-built /search URL on the page would be a second owner of the question",
  );
  ok(
    "the paper page builds no /search URL of its own",
    !/href=\{`\/search\?q=/.test(routeSource),
    "found an interpolated /search href beside the one the module owns",
  );
}

/* Measured 21 by running this part on 2026-09-24; the floor sits a little under it. */
export const outcome = closePart(tally, "twins", 20);
