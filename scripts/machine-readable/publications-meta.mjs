import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { doiSlug, paperPath, paperPdfPath } from "../../app/lib/publications/paths.mjs";
import {
  buildCitationTags,
  REQUIRED_CITATION_TAGS,
} from "../../app/lib/publications/citation-tags.mjs";
import { PUBLICATIONS } from "../../app/data/publications.ts";
import { SHOWCASE_TYPES } from "../../app/lib/publications/export-response.mjs";
import { SHOWCASE_TYPES as PAGE_SHOWCASE_TYPES } from "../../app/lib/publications/listing.mjs";
import {
  organismsIn,
  toBibtex,
  toBibtexAll,
  toCslJson,
  toRisAll,
} from "../../app/lib/publications/exports.mjs";
import {
  closePart,
  CSL_PATH,
  openPart,
  root,
  site,
  siteEntries,
  SLUG_ROUTE,
} from "./publications-context.mjs";

/* Citation tags, plain-language lines, the cited-by artifact, the showcase set, the exports and the preprint count. */
const { tally, ok } = openPart("meta");

/*
 * Not against the render: `createRoutesStub` never mounts `<Meta />`. Both halves, the builder
 * and the route calling it, since either alone is green while the page is wrong.
 */
{
  const ORIGIN = "https://example.invalid";
  /** @type {string[]} */
  const tagFailures = [];
  let tagged = 0;
  let authorTags = 0;
  let pdfTags = 0;

  for (const paper of PUBLICATIONS) {
    const slug = doiSlug(paper.doi);
    const isHosted = paper.access === "self-hosted" && paper.pdfPath !== null;
    let tags;
    try {
      tags = buildCitationTags(paper, {
        abstractUrl: `${ORIGIN}${paperPath(slug)}`,
        pdfUrl: isHosted ? `${ORIGIN}${paperPdfPath(slug)}` : null,
      });
    } catch (error) {
      tagFailures.push(`${paper.id}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    tagged += 1;
    const names = tags.map((t) => t.name);
    for (const required of REQUIRED_CITATION_TAGS) {
      if (!names.includes(required)) tagFailures.push(`${paper.id}: no ${required}`);
    }
    const authors = tags.filter((t) => t.name === "citation_author");
    authorTags += authors.length;
    /* One tag per author: otherwise Scholar reads a single author whose name is the whole list. */
    if (authors.length !== paper.authors.length) {
      tagFailures.push(
        `${paper.id}: ${authors.length} citation_author tags for ${paper.authors.length} authors`,
      );
    }
    const pdf = tags.find((t) => t.name === "citation_pdf_url");
    if (isHosted && !pdf) tagFailures.push(`${paper.id}: hosted but no citation_pdf_url`);
    if (!isHosted && pdf) tagFailures.push(`${paper.id}: not hosted but has citation_pdf_url`);
    if (pdf) {
      pdfTags += 1;
      const dir = `${ORIGIN}${paperPath(slug)}`;
      if (!pdf.content.startsWith(dir)) {
        tagFailures.push(`${paper.id}: citation_pdf_url is not under ${dir}`);
      }
    }
  }

  ok(
    `every record produces a citation tag set (${tagged} of ${PUBLICATIONS.length})`,
    tagged === PUBLICATIONS.length,
    "a zero here would make every assertion in this block vacuous",
  );
  ok(
    `the tag sets carry authors and PDFs (${authorTags} author tags, ${pdfTags} pdf tags)`,
    authorTags > 0 && pdfTags > 0,
    "both counts must be non-zero or the shape checks above read nothing",
  );
  ok(
    "every record's citation tags carry the required set and one tag per author",
    tagFailures.length === 0,
    tagFailures.slice(0, 6).join("; "),
  );

  const routeSource = SLUG_ROUTE;
  ok(
    "the paper route calls buildCitationTags",
    /buildCitationTags\s*\(/.test(routeSource),
    "a correct builder nobody calls is a page with no citation tags",
  );
  ok(
    "the paper route imports buildCitationTags from the gated module",
    /import\s*\{[^}]*buildCitationTags[^}]*\}\s*from\s*"~\/lib\/publications\/citation-tags\.mjs"/.test(
      routeSource,
    ),
    "a locally defined builder would satisfy the call check above and be unchecked",
  );
}

{
  const summaries = siteEntries
    .map(([, f]) => [f.id, f.summary])
    .filter(([, value]) => value !== null && value !== undefined);

  console.log(
    `        (${summaries.length} of ${siteEntries.length} records carry a ` +
      "plain-language line; the assertions below are vacuous at zero, by design)",
  );

  const tooLong = summaries.filter(([, v]) => String(v).length > 200);
  ok(
    `no plain-language line exceeds 200 characters (${summaries.length} checked)`,
    tooLong.length === 0,
    tooLong.map(([id, v]) => `${id} is ${String(v).length}`).join(", "),
  );

  const multiSentence = summaries.filter(([, v]) => /[.!?]\s+[A-Z]/.test(String(v)));
  ok(
    "every plain-language line is a single sentence",
    multiSentence.length === 0,
    multiSentence.map(([id]) => id).join(", "),
  );

  /* The PreToolUse hook cannot reach data files, and the escapes keep this file free of the dashes. */
  const WIDE_DASH = new RegExp("[\\u2013\\u2014]");
  const dashed = summaries.filter(([, v]) => WIDE_DASH.test(String(v)));
  ok(
    "no plain-language line carries an em dash or en dash",
    dashed.length === 0,
    dashed.map(([id]) => id).join(", "),
  );

  const empty = summaries.filter(([, v]) => String(v).trim().length === 0);
  ok(
    "no plain-language line is present but blank",
    empty.length === 0,
    `${empty.map(([id]) => id).join(", ")}. Absent is a state; empty is a mistake.`,
  );
}

/* Asserts the artifact describes this corpus and says when, never its numbers. */
{
  const citedByPath = join(root, "data", "publications.cited-by.json");
  ok(
    "the cited-by artifact exists",
    existsSync(citedByPath),
    "regenerate with `node scripts/fetch-cited-by.mjs --write`",
  );
  if (existsSync(citedByPath)) {
    const artifact = JSON.parse(readFileSync(citedByPath, "utf8"));
    const works = artifact.works ?? {};
    const keys = Object.keys(works);

    ok(
      `the cited-by artifact carries records (${keys.length})`,
      keys.length > 0,
      "every assertion below iterates it",
    );
    ok(
      `the artifact records the date it was read (${artifact.fetchedAt})`,
      /^\d{4}-\d{2}-\d{2}$/.test(String(artifact.fetchedAt ?? "")),
      "the page prints this date beside the list; an absent one would print a " +
        "list with no provenance, which is a claim with no age",
    );

    const strays = keys.filter((doi) => !Object.hasOwn(site, doi));
    ok(
      "every cited-by key is a DOI this corpus carries",
      strays.length === 0,
      strays.join(", "),
    );
    const uncovered = siteEntries.filter(([doi]) => !Object.hasOwn(works, doi));
    ok(
      `every corpus record has a cited-by entry (${keys.length} of ${siteEntries.length})`,
      uncovered.length === 0,
      uncovered.length
        ? `${uncovered.map(([, f]) => f.id).join(", ")}. A missing entry and a zero ` +
            "entry are different facts, and the page renders them differently."
        : "",
    );

    const cap = Number(artifact.maxCiting ?? 0);
    ok(`the artifact records its own cap (${cap})`, cap > 0);
    const overCap = keys.filter((d) => (works[d].citing?.length ?? 0) > cap);
    ok(
      `no entry exceeds the cap (${cap})`,
      overCap.length === 0,
      overCap.join(", "),
    );
    const totalBelowList = keys.filter(
      (d) => Number(works[d].total ?? 0) < (works[d].citing?.length ?? 0),
    );
    ok(
      "no entry's total is below the number of works listed under it",
      totalBelowList.length === 0,
      totalBelowList.length
        ? `${totalBelowList.join(", ")}. The two came from different reads.`
        : "",
    );

    const citingCount = keys.reduce((n, d) => n + (works[d].citing?.length ?? 0), 0);
    ok(
      `the artifact lists citing works (${citingCount})`,
      citingCount > 0,
      "a zero would make the shape assertions below vacuous",
    );
    /* A bare name: the page builds its own link, so a URL renders a doubled `https://doi.org/`. */
    const urlShaped = keys.flatMap((d) =>
      (works[d].citing ?? []).filter((/** @type {any} */ w) => w.doi?.startsWith("http")),
    );
    ok(
      "every citing DOI is a bare name rather than a URL",
      urlShaped.length === 0,
      urlShaped.slice(0, 3).map((/** @type {any} */ w) => w.doi).join(", "),
    );
  }
}

const showcase = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));

ok(
  `the showcase set is non-empty (${showcase.length} of ${siteEntries.length})`,
  showcase.length > 0,
  "every export assertion below iterates it",
);

/* Stated twice, the page's in its pure listing module, so it is imported rather than parsed out of the route. */
{
  const routeTypes = new Set(/** @type {Set<string>} */ (PAGE_SHOWCASE_TYPES));
  ok(
    `the page's SHOWCASE_TYPES set is non-empty (${routeTypes.size} types)`,
    routeTypes.size > 0,
    "an empty set would make the comparison below vacuous",
  );
  const onlyRoute = [...routeTypes].filter((t) => !SHOWCASE_TYPES.has(t));
  const onlyExport = [...SHOWCASE_TYPES].filter((t) => !routeTypes.has(t));
  ok(
    "the page and the exports agree about which types are shown",
    onlyRoute.length === 0 && onlyExport.length === 0,
    `only in listing.mjs: ${onlyRoute.join(", ") || "none"}; ` +
      `only in export-response.mjs: ${onlyExport.join(", ") || "none"}`,
  );
}

{
  const papers = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));
  const bib = toBibtexAll(papers);
  const ris = toRisAll(papers);
  const csl = toCslJson(JSON.parse(readFileSync(CSL_PATH, "utf8")));

  ok(
    "the exports are byte-identical across two generations",
    toBibtexAll(papers) === bib && toRisAll(papers) === ris,
    "an export that changes without the corpus changing cannot be cited",
  );

  const bibEntries = (bib.match(/^@/gm) ?? []).length;
  ok(
    `the BibTeX export carries one entry per shown record (${bibEntries})`,
    bibEntries === papers.length,
    `${papers.length} records, ${bibEntries} entries`,
  );
  const risRecords = (ris.match(/^TY {2}- /gm) ?? []).length;
  const risTerminators = (ris.match(/^ER {2}- $/gm) ?? []).length;
  ok(
    `the RIS export carries one terminated record per shown record (${risRecords})`,
    risRecords === papers.length && risTerminators === papers.length,
    `${papers.length} records, ${risRecords} TY tags, ${risTerminators} ER tags. ` +
      "An unterminated record swallows the next one on import.",
  );

  const missingDoi = papers.filter((p) => !bib.includes(p.doi) || !ris.includes(p.doi));
  ok(
    "every shown record's DOI appears in both text exports",
    missingDoi.length === 0,
    missingDoi.map((p) => p.id).join(", "),
  );

  /* The stored corpus keeps them escaped, and a reference manager would show `p &lt; 0.05`. */
  const leaked = /&(amp|lt|gt|quot|apos|#\d+);/.exec(bib + ris + csl);
  ok(
    "no character reference survives into any export",
    leaked === null,
    leaked ? `found ${leaked[0]}` : "",
  );

  /* A lowercased genus is wrong under the nomenclature codes. */
  const withOrganism = papers.filter((p) => organismsIn(p.title).length > 0);
  ok(
    `some shown titles carry an organism name (${withOrganism.length})`,
    withOrganism.length > 0,
    "a zero would make the brace assertion below vacuous",
  );
  const unprotected = withOrganism.filter((p) => {
    const entry = toBibtex(p);
    return organismsIn(p.title).some((o) => !entry.includes(`{${o}}`));
  });
  ok(
    "every organism name in a title is brace-protected in BibTeX",
    unprotected.length === 0,
    unprotected.map((p) => p.id).join(", "),
  );

  /* As deposited: a lowercasing export would disagree with the registry it came from. */
  const folded = papers.filter(
    (p) => p.doi !== p.doi.toLowerCase() && !bib.includes(`doi = {${p.doi}}`),
  );
  ok(
    "mixed-case DOIs are exported as deposited",
    folded.length === 0,
    folded.map((p) => p.id).join(", "),
  );
}

/* A count, so a second preprint is a decision somebody makes here. */
const preprints = siteEntries.filter(([, f]) => f.preprintDoi);
ok(
  `exactly one record carries a preprintDoi (${preprints.length})`,
  preprints.length === 1,
  preprints.map(([, f]) => `${f.id} -> ${f.preprintDoi}`).join(", "),
);

/* Measured 31 by running this part on 2026-09-24; the floor sits a little under it. */
export const outcome = closePart(tally, "meta", 29);
