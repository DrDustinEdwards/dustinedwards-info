import { doiKey } from "../build-publications.mjs";
import { accessionUrl, accessionsInText } from "../../app/lib/publications/accessions.mjs";
import { updateNoticeProblem } from "../../app/lib/publications/update-notice.mjs";
import { PUBLICATIONS } from "../../app/data/publications.ts";
import {
  closePart,
  extractedPapers,
  openPart,
  siteEntries,
  SLUG_ROUTE,
} from "./publications-context.mjs";

/* Update notices and the accessions each PDF's data-availability statement names. */
const { tally, ok } = openPart("notices");

{
  const noticed = PUBLICATIONS.filter((p) => p.updateNotice);
  ok(
    `no record carries a retraction or correction (${PUBLICATIONS.length} read)`,
    noticed.length === 0,
    noticed.length
      ? `notices on: ${noticed.map((p) => `${p.id} (${p.updateNotice?.type})`).join(", ")}`
      : "",
  );

  const malformed = PUBLICATIONS.map((p) => ({
    id: p.id,
    problem: updateNoticeProblem(p.updateNotice),
  })).filter(({ problem }) => problem !== null);
  ok(
    "every update notice present is well formed",
    malformed.length === 0,
    malformed.map((m) => `${m.id}: ${m.problem}`).join("; "),
  );

  const routeSource = SLUG_ROUTE;
  ok(
    "the paper page renders the notice through updateNoticeText",
    /updateNoticeText\(/.test(routeSource),
    "a sentence written into the route would be a second owner of what a " +
      "retraction says, on the one page where that has to be right",
  );
}

/* Anchored on the data-availability statement: a plain regex pulls in the comparison phages' accessions. */
{
  const derived = new Map();
  for (const [doi, entry] of Object.entries(extractedPapers)) {
    const found = accessionsInText(entry.text ?? []);
    if (found.length > 0) derived.set(doiKey(doi), found);
  }

  ok(
    `the data-availability sweep found accessions (${derived.size} papers)`,
    derived.size > 0,
    "a zero here would make both directions below vacuous",
  );

  const curated = new Map(
    siteEntries
      .filter(([, f]) => Array.isArray(f.accessions) && f.accessions.length > 0)
      .map(([doi, f]) => [doiKey(doi), f.accessions]),
  );

  const flat = (/** @type {any[]} */ list) =>
    list.map((a) => `${a.kind}:${a.id}`).sort().join(",");

  const unrecorded = [...derived.entries()]
    .filter(([key, found]) => flat(curated.get(key) ?? []) !== flat(found))
    .map(([key]) => key);
  ok(
    `every accession the PDFs name is in the corpus (${derived.size} papers with one)`,
    unrecorded.length === 0,
    unrecorded.length
      ? unrecorded
          .map(
            (key) =>
              `${key}: text says ${flat(derived.get(key) ?? [])}, corpus says ${flat(curated.get(key) ?? [])}`,
          )
          .join("; ")
      : "",
  );

  const unsupported = [...curated.keys()].filter((key) => !derived.has(key));
  ok(
    "no record claims an accession its PDF does not name",
    unsupported.length === 0,
    unsupported.length ? `unsupported: ${unsupported.join(", ")}` : "",
  );

  /* An SRA run under a nuccore URL is a 404 that looks like a working link. */
  const badLinks = [...curated.values()]
    .flat()
    .map((a) => ({ a, url: accessionUrl(a) }))
    .filter(({ a, url }) => !url.startsWith("https://www.ncbi.nlm.nih.gov/") || !url.endsWith(a.id));
  ok(
    `every accession builds an NCBI URL ending in its own id (${[...curated.values()].flat().length} accessions)`,
    badLinks.length === 0,
    badLinks.map(({ a, url }) => `${a.kind}:${a.id} -> ${url}`).join("; "),
  );
}

/* Measured 7 by running this part on 2026-09-24; the floor sits a little under it. */
export const outcome = closePart(tally, "notices", 6);
