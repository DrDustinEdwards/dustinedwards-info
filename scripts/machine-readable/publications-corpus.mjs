import { doiKey, validateCorpus } from "../../app/lib/publications/validate.mjs";
import {
  closePart,
  compiled,
  files,
  hosted,
  openPart,
  records,
  refusalsFor,
  refused,
} from "./publications-context.mjs";

/*
 * The files against the shared validator, the corpus's own uniqueness, the hosted PDFs and the text read
 * from them, PMC links and abstracts. The rules are validate.mjs's; this part reports them by category.
 */
const { tally, ok } = openPart("corpus");

/** @param {string[]} messages */
const shown = (messages) => messages.slice(0, 8).join("; ") + (messages.length > 8 ? `; and ${messages.length - 8} more` : "");

ok(
  `every publication file passes the validation module the save uses (${files.length} files)`,
  refused.length === 0,
  shown(refused.flatMap((r) => r.errors.map((e) => `${r.file}: ${e}`))),
);

{
  const duplicates = validateCorpus(
    compiled.map((c) => ({ file: c.file, slug: c.slug, id: c.record.id, doi: c.record.doi })),
  );
  const only = (/** @type {string} */ label) => duplicates.filter((d) => d.includes(label));
  ok(`every record id is unique (${new Set(records.map((r) => r.id)).size} of ${records.length})`, only("id \"").length === 0, shown(only("id \"")));
  ok(
    "every DOI is distinct after casefolding",
    only("DOI (case-folded)").length === 0,
    `${shown(only("DOI (case-folded)"))}. DOI names are case-insensitive per spec, so two casings of one DOI are one work`,
  );
  ok(
    "every DOI produces a distinct page slug",
    only("page slug").length === 0,
    `${shown(only("page slug"))}. doiSlug collapses punctuation, so two DOIs differing only in punctuation collide`,
  );
  ok("the corpus is not empty", !duplicates.some((d) => d.includes("corpus is empty")), shown(duplicates));
  ok(
    `the DOI set is as large as the file set, or the rest are manuscripts (${records.filter((r) => r.doi).length} with a DOI)`,
    new Set(records.flatMap((r) => (r.doi ? [doiKey(r.doi)] : []))).size === records.filter((r) => r.doi).length,
  );
}

ok(
  "the hosted set is non-empty, so the PDF assertions below read something",
  hosted.length > 0,
  "a zero here would make the missing-PDF, hash and text sweeps vacuous",
);
ok(`every pdfPath resolves to a file in the repository (${hosted.length} hosted)`, refusalsFor("pdfPath").length === 0, shown(refusalsFor("pdfPath")));
ok(
  "every file records the sha256 of the PDF its text was extracted from, and it matches the PDF",
  refusalsFor("pdfSha256").length === 0,
  `${shown(refusalsFor("pdfSha256"))}. Re-run scripts/extract-publication-text.mjs`,
);
ok(
  "every hosted paper carries its extracted text, and none is empty or near-empty",
  refusalsFor("Full text").length === 0,
  `${shown(refusalsFor("Full text"))}. A scanned PDF with no text layer looks exactly like this`,
);
ok(
  "access agrees with pdfPath, externalUrl and the text on every record",
  refusalsFor("access", "externalUrl").length === 0,
  shown(refusalsFor("access", "externalUrl")),
);

/* Landing-page form answers for every PMCID, including those the API refuses. */
ok(
  `every pmcUrl is in landing-page form and pmcid and pmcUrl travel together (${records.filter((r) => r.pmcUrl).length} carry one)`,
  refusalsFor("pmcUrl", "pmcid").length === 0,
  shown(refusalsFor("pmcUrl", "pmcid")),
);
ok("the pmcUrl set is non-empty, so the form assertion above read something", records.some((r) => r.pmcUrl));

/* These land in a `<script type="application/ld+json">` block, where `<` ends the element early. */
const withAbstract = records.filter((r) => typeof r.abstract === "string" && r.abstract.length > 0);
ok(
  `no stored abstract contains a left angle bracket (${withAbstract.length} read)`,
  refusalsFor("abstract", "csl.abstract").length === 0,
  shown(refusalsFor("abstract", "csl.abstract")),
);
ok(
  "the abstract set is non-empty, so the bracket sweep above read something",
  withAbstract.length > 0,
  "this is the companion the July build added after an assertion passed by reading zero",
);

ok(
  "every Crossref record names the paper's own DOI",
  refusalsFor("csl", "csl.DOI").length === 0,
  shown(refusalsFor("csl", "csl.DOI")),
);

/* Measured by running this part on 2026-09-30; the floor sits a little under it. */
export const outcome = closePart(tally, "corpus", 14);
