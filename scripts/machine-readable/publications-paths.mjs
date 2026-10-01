import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { HOSTED_WITHOUT_LICENCE, permitsRedistribution } from "../../app/lib/publications/hosting.mjs";
import { paperPdfPath } from "../../app/lib/publications/paths.mjs";
import { TOPICS } from "../../app/lib/publications/topics.mjs";
import { closePart, hosted, openPart, records, refusalsFor, root } from "./publications-context.mjs";

/* Topics, page slugs, where each PDF lives, the PDF redirects and the hosting licences. */
const { tally, ok } = openPart("paths");

/** @param {string[]} messages */
const shown = (messages) => messages.slice(0, 8).join("; ") + (messages.length > 8 ? `; and ${messages.length - 8} more` : "");

const declaredTopics = new Set(TOPICS.map((t) => t.id));
ok(
  `the topic vocabulary declares more than one topic (${declaredTopics.size})`,
  declaredTopics.size >= 2,
  "one or zero would mean the vocabulary this gate holds the records to is not the real one",
);
ok(
  `every topic a record claims is declared, and every record carries at least one (${declaredTopics.size} declared)`,
  refusalsFor("topics").length === 0 && records.every((r) => r.topics.length > 0),
  shown(refusalsFor("topics")),
);

/* The slug is lossy, so a collision is two papers on one URL; uniqueness is the corpus part's. */
ok(
  "every slug is a single lower-case path segment, and a DOI's slug is the one doiSlug derives",
  refusalsFor("slug", "doi").length === 0 && records.every((r) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)),
  shown(refusalsFor("slug", "doi")),
);

/* `pdfPath` stays a literal in the file because `build:template-refs` matches asset references as literals. */
ok(
  `every hosted pdfPath is the path paperPdfPath derives (${hosted.length} checked)`,
  refusalsFor("pdfPath").length === 0 && hosted.every((c) => c.record.pdfPath === paperPdfPath(c.slug)),
  shown(refusalsFor("pdfPath")),
);

/* What Scholar cares about: `paperPdfPath` can move while the equality above passes. */
const outsideOwnDirectory = hosted.filter((c) => !c.record.pdfPath?.startsWith(`/research/publications/${c.slug}/`)).map((c) => c.slug);
ok(
  "every hosted PDF is in the same subdirectory as its paper's page",
  outsideOwnDirectory.length === 0,
  outsideOwnDirectory.length
    ? `${outsideOwnDirectory.join(", ")}. Google Scholar only honors citation_pdf_url when the file is in the ` +
        "abstract page's own subdirectory."
    : "",
);

/*
 * Both directions, for the papers that were published at a flat PDF path: a one-way check passes on an entry
 * pointing at nothing, a 301 into a 404. A paper added after the move never had a flat URL, so it owes the
 * map nothing, and the first direction holds only the 31 that did. Nothing is ever added to this list.
 */
const FLAT_URL_SLUGS = new Set([
  "10-1002-9780470025079-chap06-pub2",
  "10-1080-07448481-2025-2472184",
  "10-1128-jmbe-00313-25",
  "10-1128-jvi-00356-08",
  "10-1128-jvi-01788-13",
  "10-1128-jvi-02150-14",
  "10-1128-jvi-03444-13",
  "10-1128-mra-00173-22",
  "10-1128-mra-00174-22",
  "10-1128-mra-00556-21",
  "10-1128-mra-00558-21",
  "10-1128-mra-00778-23",
  "10-1128-mra-00783-22",
  "10-1128-mra-00888-24",
  "10-1128-mra-01039-19",
  "10-1128-mra-01077-21",
  "10-1128-mra-01079-21",
  "10-1128-mra-01242-18",
  "10-1128-mra-01594-18",
  "10-1187-cbe-21-03-0057",
  "10-1371-journal-pone-0042123",
  "10-1371-journal-ppat-1004454",
  "10-3389-feduc-2023-1279921",
  "10-3389-feduc-2024-1442306",
  "10-3389-feduc-2024-1442318",
  "10-3390-ijerph22071139",
  "10-3390-v3060861",
  "10-3390-v3101815",
  "10-7589-2018-08-187",
  "10-7589-2019-04-088",
  "10-7589-jwd-d-22-00023",
]);

const redirects = JSON.parse(readFileSync(join(root, "content", "redirects.json"), "utf8"));
const pdfRedirects = redirects.pdfs ?? {};
const redirectTargets = new Set(Object.values(pdfRedirects));
const hostedPaths = new Set(hosted.map((c) => c.record.pdfPath));

ok(
  `the PDF redirect map is populated (${Object.keys(pdfRedirects).length} entries)`,
  Object.keys(pdfRedirects).length > 0,
  "an empty map would make both directions below vacuous",
);
const unredirected = hosted
  .filter((c) => FLAT_URL_SLUGS.has(c.slug) && !redirectTargets.has(c.record.pdfPath))
  .map((c) => c.record.pdfPath);
ok(
  `every PDF that was once published at a flat path is the target of a redirect from it (${FLAT_URL_SLUGS.size} grandfathered)`,
  unredirected.length === 0,
  unredirected.length
    ? `no old URL redirects to: ${unredirected.join(", ")}. Every one of these was published at a flat path for ` +
        "seven weeks and that URL is a promise."
    : "",
);
const danglingTargets = [...redirectTargets].filter((p) => !hostedPaths.has(p));
ok(
  "every redirect target is a PDF the corpus actually hosts",
  danglingTargets.length === 0,
  danglingTargets.length ? `301 into nothing: ${danglingTargets.join(", ")}` : "",
);
const sourcesStillOnDisk = Object.keys(pdfRedirects).filter((p) => existsSync(join(root, "public", p.replace(/^\//, ""))));
ok(
  "no redirect source is also a file on disk",
  sourcesStillOnDisk.length === 0,
  sourcesStillOnDisk.length
    ? `${sourcesStillOnDisk.join(", ")} exist as assets, and the static handler runs ahead of the Worker, so ` +
        "the redirect would never fire."
    : "",
);

/*
 * `licenseSource` has three states: tdm-only is terms that license redistribution to nobody, and
 * collapsing it would hide that those were checked. The allowlist is hosting.mjs's, and the validator holds
 * every hosted paper to it; this part keeps the list from going stale.
 */
{
  const hostedRecords = hosted.map((c) => c.record);
  const licensed = hostedRecords.filter((r) => permitsRedistribution(r.license));
  const unlicensed = hostedRecords.filter((r) => !permitsRedistribution(r.license));

  console.log(
    `        (${licensed.length} hosted with a redistribution license, ` +
      `${unlicensed.length} hosted without one and named in hosting.mjs)`,
  );

  ok(`the hosted set is non-empty (${hostedRecords.length})`, hostedRecords.length > 0, "every rights assertion below iterates it");
  ok(
    `some hosted PDFs carry a redistribution license (${licensed.length})`,
    licensed.length > 0,
    "a zero would mean the license predicate matches nothing and the split below is fake",
  );
  ok(
    `every PDF hosted without a license is one Dustin has chosen to host, named per DOI (${unlicensed.length})`,
    refusalsFor("license").length === 0,
    shown(refusalsFor("license")),
  );

  /* Stale exemptions are how an allowlist stops meaning anything. */
  const stale = [...HOSTED_WITHOUT_LICENCE.keys()].filter((doi) => !unlicensed.some((r) => r.doi === doi));
  ok(
    "every DOI in the allowlist is still a PDF hosted without a license",
    stale.length === 0,
    stale.length
      ? `${stale.map((doi) => `${doi} (recorded as ${HOSTED_WITHOUT_LICENCE.get(doi)})`).join(", ")}. Either the ` +
          "file is gone or a registry now records terms; check which, then remove the entry."
      : "",
  );

  ok(
    `every unlicensed hosted record records what the registries said (${unlicensed.length})`,
    refusalsFor("licenseSource").length === 0,
    shown(refusalsFor("licenseSource")),
  );
}

/* Measured by running this part on 2026-09-30; the floor sits a little under it. */
export const outcome = closePart(tally, "paths", 14);
