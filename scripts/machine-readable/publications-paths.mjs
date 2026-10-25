import { HOSTED_WITHOUT_LICENSE, permitsRedistribution } from "../../app/lib/publications/hosting.mjs";
import { paperPdfPath } from "../../app/lib/publications/paths.mjs";
import { TOPICS } from "../../app/lib/publications/topics.mjs";
import { closePart, hosted, openPart, records, refusalsFor } from "./publications-context.mjs";

/* Topics, page slugs, where each PDF lives and the hosting licenses. */
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
  const stale = [...HOSTED_WITHOUT_LICENSE.keys()].filter((doi) => !unlicensed.some((r) => r.doi === doi));
  ok(
    "every DOI in the allowlist is still a PDF hosted without a license",
    stale.length === 0,
    stale.length
      ? `${stale.map((doi) => `${doi} (recorded as ${HOSTED_WITHOUT_LICENSE.get(doi)})`).join(", ")}. Either the ` +
          "file is gone or a registry now records terms; check which, then remove the entry."
      : "",
  );

  ok(
    `every unlicensed hosted record records what the registries said (${unlicensed.length})`,
    refusalsFor("licenseSource").length === 0,
    shown(refusalsFor("licenseSource")),
  );
}

/* Measured 10 by running this part on 2026-10-20, after the PDF redirect map went; the floor sits a little under it. */
export const outcome = closePart(tally, "paths", 9);
