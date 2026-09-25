import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { doiSlug, paperPdfPath } from "../../app/lib/publications/paths.mjs";
import { closePart, hosted, openPart, OUT_PATH, root, siteEntries } from "./publications-context.mjs";

/* Topics, page slugs, where each PDF lives, the PDF redirects and the hosting licences. */
const { tally, ok } = openPart("paths");

/* Only inside the TOPICS block: an indent-anchored matcher over the whole module sweeps in every id. */
const generated = readFileSync(OUT_PATH, "utf8");
const topicsBlock = /export const TOPICS: Topic\[\] = \[([\s\S]*?)\n\];/.exec(generated);
ok(
  "the generated module carries a parseable TOPICS block",
  Boolean(topicsBlock),
  "the block is the only source for declared topic ids; without it the check below is vacuous",
);
const declaredTopics = new Set(
  [...(topicsBlock?.[1] ?? "").matchAll(/^\s{4}id: "([^"]+)",$/gm)].map((m) => m[1]),
);
ok(
  `the TOPICS block declares more than one topic (${declaredTopics.size})`,
  declaredTopics.size >= 2,
  "one or zero would mean the parse above matched something other than the block",
);
const undeclared = [
  ...new Set(siteEntries.flatMap(([, f]) => f.topics ?? []).filter((t) => !declaredTopics.has(t))),
];
ok(
  `every topic a record claims is declared (${declaredTopics.size} declared)`,
  undeclared.length === 0,
  undeclared.length ? `undeclared: ${undeclared.join(", ")}` : "",
);
const untopiced = siteEntries.filter(([, f]) => !f.topics || f.topics.length === 0);
ok(
  "every record carries at least one topic",
  untopiced.length === 0,
  untopiced.length ? untopiced.map(([, f]) => f.id).join(", ") : "",
);

/* The slug is lossy, so a collision is two papers on one URL. */
const slugs = siteEntries.map(([doi]) => doiSlug(doi));
const slugCounts = new Map();
for (const slug of slugs) slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
const collided = [...slugCounts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
ok(
  `every DOI produces a distinct page slug (${slugCounts.size} of ${slugs.length})`,
  collided.length === 0,
  collided.length
    ? `these slugs are claimed by more than one DOI: ${collided.join(", ")}. ` +
        "doiSlug collapses punctuation, so two DOIs differing only in punctuation collide."
    : "",
);
ok(
  "every slug is a single lower-case path segment",
  slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
  slugs.filter((s) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)).join(", "),
);

/* `pdfPath` stays a literal because `build:template-refs` matches asset references as literals. */
const pathMismatch = siteEntries
  .filter(([doi, f]) => f.pdfPath && f.pdfPath !== paperPdfPath(doiSlug(doi)))
  .map(([doi, f]) => `${f.id}: ${f.pdfPath} should be ${paperPdfPath(doiSlug(doi))}`);
ok(
  `every hosted pdfPath is the path paperPdfPath derives (${hosted.length} checked)`,
  pathMismatch.length === 0,
  pathMismatch.join("; "),
);

/* What Scholar cares about: `paperPdfPath` can move while the equality above passes. */
const outsideOwnDirectory = siteEntries
  .filter(([doi, f]) => f.pdfPath && !f.pdfPath.startsWith(`/publications/${doiSlug(doi)}/`))
  .map(([, f]) => f.id);
ok(
  "every hosted PDF is in the same subdirectory as its paper's page",
  outsideOwnDirectory.length === 0,
  outsideOwnDirectory.length
    ? `${outsideOwnDirectory.join(", ")}. Google Scholar only honors ` +
        "citation_pdf_url when the file is in the abstract page's own subdirectory."
    : "",
);

/* Both directions: a one-way check passes on an entry pointing at nothing, a 301 into a 404. */
const redirects = JSON.parse(readFileSync(join(root, "content", "redirects.json"), "utf8"));
const pdfRedirects = redirects.pdfs ?? {};
const redirectTargets = new Set(Object.values(pdfRedirects));
const hostedPaths = new Set(hosted.map(([, f]) => f.pdfPath));

ok(
  `the PDF redirect map is populated (${Object.keys(pdfRedirects).length} entries)`,
  Object.keys(pdfRedirects).length > 0,
  "an empty map would make both directions below vacuous",
);
const unredirected = [...hostedPaths].filter((p) => !redirectTargets.has(p));
ok(
  `every hosted PDF is the target of a redirect from its old URL (${hostedPaths.size} hosted)`,
  unredirected.length === 0,
  unredirected.length
    ? `no old URL redirects to: ${unredirected.join(", ")}. Every one of these ` +
        "was published at a flat path for seven weeks and that URL is a promise."
    : "",
);
const danglingTargets = [...redirectTargets].filter((p) => !hostedPaths.has(p));
ok(
  "every redirect target is a PDF the corpus actually hosts",
  danglingTargets.length === 0,
  danglingTargets.length ? `301 into nothing: ${danglingTargets.join(", ")}` : "",
);
const sourcesStillOnDisk = Object.keys(pdfRedirects).filter((p) =>
  existsSync(join(root, "public", p.replace(/^\//, ""))),
);
ok(
  "no redirect source is also a file on disk",
  sourcesStillOnDisk.length === 0,
  sourcesStillOnDisk.length
    ? `${sourcesStillOnDisk.join(", ")} exist as assets, and the static handler runs ` +
        "ahead of the Worker, so the redirect would never fire."
    : "",
);

/*
 * `licenseSource` has three states: tdm-only is terms that license redistribution to nobody, and
 * collapsing it would hide that those were checked.
 */
const HOSTED_WITHOUT_LICENCE = new Map([
  // Bronze is free to read on the publisher's site with no license, which they can reverse.
  ["10.1128/jvi.00356-08", "ASM, green OA, crossref:tdm-only"],
  ["10.1128/jvi.01788-13", "ASM, bronze OA, crossref:tdm-only"],
  ["10.1128/jvi.03444-13", "ASM, bronze OA, crossref:tdm-only"],
  ["10.1128/jvi.02150-14", "ASM, bronze OA, crossref:tdm-only"],
  // Not open access at all.
  ["10.1002/9780470025079.chap06.pub2", "Wiley chapter, closed, crossref:tdm-only"],
  ["10.1080/07448481.2025.2472184", "Taylor and Francis, closed"],
  ["10.7589/2018-08-187", "Journal of Wildlife Diseases, closed"],
  ["10.7589/2019-04-088", "Journal of Wildlife Diseases, closed since July"],
  ["10.7589/JWD-D-22-00023", "Journal of Wildlife Diseases, closed"],
]);

{
  const permitsRedistribution = (/** @type {string | null} */ licence) =>
    typeof licence === "string" &&
    (licence.startsWith("cc-by") || licence === "cc0" || licence === "public-domain");

  const hostedRecords = siteEntries.filter(([, f]) => f.pdfPath);
  const licensed = hostedRecords.filter(([, f]) => permitsRedistribution(f.license));
  const unlicensed = hostedRecords.filter(([, f]) => !permitsRedistribution(f.license));

  console.log(
    `        (${licensed.length} hosted with a redistribution license, ` +
      `${unlicensed.length} hosted without one and named below)`,
  );

  ok(
    `the hosted set is non-empty (${hostedRecords.length})`,
    hostedRecords.length > 0,
    "every rights assertion below iterates it",
  );
  ok(
    `some hosted PDFs carry a redistribution license (${licensed.length})`,
    licensed.length > 0,
    "a zero would mean the license predicate matches nothing and the split below is fake",
  );

  const undeclared = unlicensed.filter(([doi]) => !HOSTED_WITHOUT_LICENCE.has(doi));
  ok(
    `every PDF hosted without a license is named in this gate (${unlicensed.length})`,
    undeclared.length === 0,
    undeclared.length
      ? undeclared
          .map(([doi, f]) => `${f.id} (${doi}), license ${f.license ?? "none"}, ` +
            `source ${f.licenseSource ?? "none"}`)
          .join("; ") +
          ". Hosting a paper whose license does not permit it is Dustin's call to " +
          "make and is recorded per DOI, so a NEW one is a new decision rather " +
          "than a precedent."
      : "",
  );

  /* Stale exemptions are how an allowlist stops meaning anything. */
  const stale = [...HOSTED_WITHOUT_LICENCE.keys()].filter(
    (doi) => !unlicensed.some(([d]) => d === doi),
  );
  ok(
    "every DOI named here is still a PDF hosted without a license",
    stale.length === 0,
    stale.length
      ? `${stale.map((doi) => `${doi} (recorded as ${HOSTED_WITHOUT_LICENCE.get(doi)})`).join(", ")}. Either the file is gone or a registry now records ` +
          "terms; check which, then remove the entry."
      : "",
  );

  const unchecked = unlicensed.filter(([, f]) => !f.licenseSource && f.license === null);
  ok(
    `every unlicensed hosted record records what the registries said (${unlicensed.length})`,
    unchecked.length === 0,
    unchecked.length
      ? `${unchecked.map(([, f]) => f.id).join(", ")} carry neither a license nor a ` +
          "licenseSource, so it is not possible to tell a closed paper from an " +
          "unchecked one. Re-run pubs-pipeline/refresh.py."
      : "",
  );
}

/* Measured 17 by running this part on 2026-09-24; the floor sits a little under it. */
export const outcome = closePart(tally, "paths", 16);
