import { accessionUrl, accessionsInText } from "../../app/lib/publications/accessions.mjs";
import { closePart, hosted, openPart, records, refusalsFor, SLUG_ROUTE } from "./publications-context.mjs";

/* Update notices and the accessions each PDF's data-availability statement names. */
const { tally, ok } = openPart("notices");

{
  const noticed = records.filter((p) => p.updateNotice);
  ok(
    `no record carries a retraction or correction (${records.length} read)`,
    noticed.length === 0,
    noticed.length ? `notices on: ${noticed.map((p) => `${p.id} (${p.updateNotice?.type})`).join(", ")}` : "",
  );

  ok(
    "every update notice present is well formed",
    refusalsFor("updateNotice").length === 0,
    refusalsFor("updateNotice").join("; "),
  );

  const routeSource = SLUG_ROUTE;
  ok(
    "the paper page renders the notice through updateNoticeText",
    /updateNoticeText\(/.test(routeSource),
    "a sentence written into the route would be a second owner of what a retraction says, on the one page where that has to be right",
  );
}

/* Anchored on the data-availability statement: a plain regex pulls in the comparison phages' accessions. */
{
  const derived = new Map();
  for (const c of hosted) {
    const found = accessionsInText([c.fullText ?? ""]);
    if (found.length > 0) derived.set(c.slug, found);
  }

  ok(
    `the data-availability sweep found accessions (${derived.size} papers)`,
    derived.size > 0,
    "a zero here would make both directions below vacuous",
  );

  const curated = new Map(records.filter((r) => r.accessions.length > 0).map((r) => [r.slug, r.accessions]));

  const flat = (/** @type {any[]} */ list) => list.map((a) => `${a.kind}:${a.id}`).sort().join(",");

  const unrecorded = [...derived.entries()].filter(([slug, found]) => flat(curated.get(slug) ?? []) !== flat(found)).map(([slug]) => slug);
  ok(
    `every accession the PDFs name is in the corpus (${derived.size} papers with one)`,
    unrecorded.length === 0 && refusalsFor("accessions").length === 0,
    [
      ...unrecorded.map((slug) => `${slug}: text says ${flat(derived.get(slug) ?? [])}, corpus says ${flat(curated.get(slug) ?? [])}`),
      ...refusalsFor("accessions"),
    ].join("; "),
  );

  const unsupported = [...curated.keys()].filter((slug) => !derived.has(slug));
  ok("no record claims an accession its PDF does not name", unsupported.length === 0, unsupported.length ? `unsupported: ${unsupported.join(", ")}` : "");

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

/* Measured by running this part on 2026-09-30; the floor sits a little under it. */
export const outcome = closePart(tally, "notices", 6);
