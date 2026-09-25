import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { doiKey, generate } from "../build-publications.mjs";
import {
  closePart,
  csl,
  extractedKeys,
  extractedPapers,
  hosted,
  openPart,
  OUT_PATH,
  root,
  siteEntries,
  TEXT_PATH,
} from "./publications-context.mjs";

/* Generation parity, the site and CSL join, the hosted PDFs, their extracted text, PMC links and abstracts. */
const { tally, ok } = openPart("corpus");

/* An empty scope throws from the context before this line runs, failing all five parts, so a
   "both source files carry records" check here could never fail and is not counted. */

{
  const committed = readFileSync(OUT_PATH, "utf8").replace(/\r\n/g, "\n");
  const emitted = generate();
  let detail = "";
  if (committed !== emitted) {
    const a = committed.split("\n");
    const b = emitted.split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) {
        detail =
          `first difference at line ${i + 1}\n` +
          `          committed: ${JSON.stringify(a[i]?.slice(0, 110))}\n` +
          `          generated: ${JSON.stringify(b[i]?.slice(0, 110))}\n` +
          `        It is generated: edit data/publications.*.json and run ` +
          `\`npm run build:publications\`, never app/data/publications.ts.`;
        break;
      }
    }
  }
  ok(
    `app/data/publications.ts matches a fresh generation (${emitted.length} bytes)`,
    committed === emitted,
    detail,
  );
}

const cslByDoi = new Map();
let duplicateCsl = "";
for (const record of csl) {
  const key = doiKey(record.DOI ?? record.id);
  if (cslByDoi.has(key)) duplicateCsl = record.DOI ?? record.id;
  cslByDoi.set(key, record);
}
ok(
  `every CSL DOI is distinct after casefolding (${cslByDoi.size} of ${csl.length})`,
  duplicateCsl === "",
  duplicateCsl ? `two records share ${duplicateCsl} once casefolded` : "",
);

const siteKeys = siteEntries.map(([doi]) => doiKey(doi));
ok(
  `every site DOI is distinct after casefolding (${new Set(siteKeys).size} of ${siteKeys.length})`,
  new Set(siteKeys).size === siteKeys.length,
  "DOI names are case-insensitive per spec, so two casings of one DOI are one work",
);

ok(
  `the two files describe the same number of works (${siteEntries.length})`,
  siteEntries.length === csl.length,
  `site ${siteEntries.length}, csl ${csl.length}`,
);

const unjoined = siteKeys.filter((key) => !cslByDoi.has(key));
ok(
  "every site record joins a CSL record",
  unjoined.length === 0,
  unjoined.length ? `no CSL record for: ${unjoined.join(", ")}` : "",
);

const ids = siteEntries.map(([, f]) => f.id);
ok(
  `every record id is unique (${new Set(ids).size} of ${ids.length})`,
  new Set(ids).size === ids.length,
);

const missingPdfs = hosted
  .filter(([, f]) => !existsSync(join(root, "public", f.pdfPath.replace(/^\//, ""))))
  .map(([, f]) => f.pdfPath);
ok(
  `every pdfPath resolves to a file on disk (${hosted.length} hosted)`,
  missingPdfs.length === 0,
  missingPdfs.length ? `missing: ${missingPdfs.join(", ")}` : "",
);
ok(
  "the hosted set is non-empty, so the assertion above read something",
  hosted.length > 0,
  "a zero here would make the missing-PDF sweep vacuous",
);

const emptyPdfs = hosted
  .filter(([, f]) => {
    const p = join(root, "public", f.pdfPath.replace(/^\//, ""));
    return existsSync(p) && statSync(p).size === 0;
  })
  .map(([, f]) => f.pdfPath);
ok(
  "no hosted PDF is a zero-byte file",
  emptyPdfs.length === 0,
  emptyPdfs.length ? `empty: ${emptyPdfs.join(", ")}` : "",
);

ok(
  "data/publications.text.json exists",
  existsSync(TEXT_PATH),
  "run node scripts/extract-publication-text.mjs; every assertion below reads it",
);

ok(
  `the extracted-text artifact is non-empty (${Object.keys(extractedPapers).length} PDFs)`,
  Object.keys(extractedPapers).length > 0,
  "an empty artifact would make every sweep below vacuous",
);

const untexted = hosted.filter(([doi]) => !extractedKeys.has(doiKey(doi))).map(([doi]) => doi);
ok(
  `every hosted PDF has extracted text (${hosted.length} hosted)`,
  untexted.length === 0,
  untexted.length ? `no text for: ${untexted.join(", ")}` : "",
);

const hostedKeys = new Set(hosted.map(([doi]) => doiKey(doi)));
const orphanText = [...extractedKeys].filter((key) => !hostedKeys.has(key));
ok(
  "the extracted-text artifact carries no entry this site does not host",
  orphanText.length === 0,
  orphanText.length ? `orphaned: ${orphanText.join(", ")}` : "",
);

/* Hashed, never size or mtime: a re-exported PDF of the same length is the likely case. */
const staleText = [];
for (const [doi, fields] of hosted) {
  const entry = extractedPapers[doi] ?? extractedPapers[doiKey(doi)];
  if (!entry) continue;
  const diskPath = join(root, "public", fields.pdfPath.replace(/^\//, ""));
  if (!existsSync(diskPath)) continue;
  const sha = createHash("sha256").update(readFileSync(diskPath)).digest("hex");
  if (sha !== entry.sha256) staleText.push(`${doi} (pdf ${sha.slice(0, 12)}, text says ${String(entry.sha256).slice(0, 12)})`);
}
ok(
  "every extracted text matches the sha256 of the PDF on disk",
  staleText.length === 0,
  staleText.length
    ? `re-run scripts/extract-publication-text.mjs. Stale: ${staleText.join("; ")}`
    : "",
);

const inconsistentText = Object.entries(extractedPapers)
  .filter(([, entry]) => {
    const pages = Array.isArray(entry.text) ? entry.text : [];
    const chars = pages.reduce((/** @type {number} */ sum, /** @type {unknown} */ page) => sum + String(page).length, 0);
    return pages.length !== entry.pages || chars !== entry.chars;
  })
  .map(([doi]) => doi);
ok(
  "every extracted entry's page and character counts match its own text",
  inconsistentText.length === 0,
  inconsistentText.length ? `inconsistent: ${inconsistentText.join(", ")}` : "",
);

/* A scanned PDF extracts to nothing and everything above still passes. */
const emptyText = Object.entries(extractedPapers)
  .filter(([, entry]) => (entry.chars ?? 0) < 500)
  .map(([doi, entry]) => `${doi} (${entry.chars})`);
ok(
  "no extracted text is empty or near-empty",
  emptyText.length === 0,
  emptyText.length
    ? `extraction produced almost nothing for: ${emptyText.join(", ")}. ` +
        "A scanned PDF with no text layer looks exactly like this."
    : "",
);

const accessMismatch = siteEntries.filter(
  ([, f]) =>
    (f.access === "self-hosted" && !f.pdfPath) ||
    (f.access === "external" && f.pdfPath),
);
ok(
  "access agrees with pdfPath on every record",
  accessMismatch.length === 0,
  accessMismatch.length
    ? accessMismatch.map(([, f]) => `${f.id} is ${f.access} with pdfPath ${f.pdfPath}`).join("; ")
    : "",
);

/* Landing-page form answers for every PMCID, including those the API refuses. */
const withPmc = siteEntries.filter(([, f]) => f.pmcUrl);
const badPmcUrls = withPmc
  .filter(([, f]) => !/^https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC\d+\/$/.test(f.pmcUrl))
  .map(([, f]) => f.pmcUrl);
ok(
  `every pmcUrl is in landing-page form (${withPmc.length} carry one)`,
  badPmcUrls.length === 0,
  badPmcUrls.length ? `not landing-page form: ${badPmcUrls.join(", ")}` : "",
);
ok(
  "the pmcUrl set is non-empty, so the form assertion above read something",
  withPmc.length > 0,
);

const pmcMismatch = siteEntries.filter(
  ([, f]) => Boolean(f.pmcid) !== Boolean(f.pmcUrl),
);
ok(
  "pmcid and pmcUrl are present together or absent together",
  pmcMismatch.length === 0,
  pmcMismatch.length ? pmcMismatch.map(([, f]) => f.id).join(", ") : "",
);

/* These land in a `<script type="application/ld+json">` block, where `<` ends the element early. */
const abstracts = csl.filter((c) => typeof c.abstract === "string" && c.abstract.length > 0);
const withAngle = abstracts.filter((c) => c.abstract.includes("<")).map((c) => c.DOI);
ok(
  `no stored abstract contains a left angle bracket (${abstracts.length} read)`,
  withAngle.length === 0,
  withAngle.length ? `contains "<": ${withAngle.join(", ")}` : "",
);
ok(
  "the abstract set is non-empty, so the bracket sweep above read something",
  abstracts.length > 0,
  "this is the companion the July build added after an assertion passed by reading zero",
);

/* Measured 22 by running this part on 2026-09-25; the floor sits a little under it. */
export const outcome = closePart(tally, "corpus", 20);
