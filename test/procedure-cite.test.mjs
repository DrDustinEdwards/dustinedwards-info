import test from "node:test";
import assert from "node:assert/strict";

import { bibtex, citationText, citeFacts, familyGiven, needsFreeze, versionPath, zenodoMetadata } from "../app/kb/procedures/cite.mjs";
import { parseProcedure } from "../app/kb/procedures/parse.mjs";
import { validateProcedure } from "../app/kb/procedures/validate.mjs";

/* How a procedure version is addressed and cited (app/kb/procedures/cite.mjs) and how its history is judged
 * (validate.mjs). A citation points at the version's frozen copy, which never changes, or at its DOI once it has one. */

const where = { origin: "https://dustinedwards.info", creator: { name: "Dustin Edwards", affiliation: "Tarleton State University" } };
const history = [
  { version: "2", date: "2026-10-01", summaryHtml: "Added the spin.", doi: null },
  { version: "1.1", date: "2026-09-15", summaryHtml: "Fixed a volume.", doi: "10.5281/zenodo.111" },
  { version: "1", date: "2026-09-01", summaryHtml: "First.", doi: "10.5281/zenodo.100" },
];
const record = {
  slug: "phage-dna-extraction",
  title: "Phage DNA Extraction Protocol",
  description: "A column-free method.",
  path: "/research/protocols/phage-dna-extraction",
  version: "2",
  updated: "2026-10-02",
  methods: ["extraction"],
  basedOn: [{ doi: "10.1093/nar/19.19.5442" }, { doi: null }],
  history,
};

test("a version's frozen copy is at <page>/v/<version>, and only a published, versioned procedure is frozen", () => {
  assert.equal(versionPath("/research/protocols/x", "2"), "/research/protocols/x/v/2");
  assert.equal(versionPath("/research/protocols/x", "1.1"), "/research/protocols/x/v/1.1");
  assert.equal(needsFreeze({ draft: false, version: "2" }), true);
  assert.equal(needsFreeze({ draft: true, version: "2" }), false);
  assert.equal(needsFreeze({ draft: false, version: null }), false);
  assert.equal(needsFreeze({ draft: false, version: "" }), false);
});

test("an unversioned procedure cannot be cited, and a version takes its history entry's date", () => {
  assert.equal(citeFacts({ ...record, version: null }), null);
  assert.deepEqual(citeFacts(record), { version: "2", date: "2026-10-01", doi: null });
  assert.deepEqual(citeFacts({ ...record, history: [] }), { version: "2", date: "2026-10-02", doi: null });
  assert.equal(citeFacts({ ...record, history: [], updated: null }), null);
  assert.equal(citeFacts({ ...record, history: undefined, version: "1.1" })?.date, "2026-10-02");
});

test("familyGiven reads a name written given-first", () => {
  assert.deepEqual(familyGiven("Dustin Edwards"), { family: "Edwards", given: "Dustin" });
  assert.deepEqual(familyGiven("Mary Jane Watson"), { family: "Watson", given: "Mary Jane" });
});

test("the citation points at the version's frozen copy, or at its DOI once the version has one", () => {
  const frozen = citationText(record, citeFacts(record), where);
  assert.equal(
    frozen,
    "Edwards, D. (2026). Phage DNA Extraction Protocol (Version 2) [Laboratory protocol]. dustinedwards.info. https://dustinedwards.info/research/protocols/phage-dna-extraction/v/2",
  );
  const minted = citationText(record, { version: "1.1", date: "2026-09-15", doi: "10.5281/zenodo.111" }, where);
  assert.match(minted, /\(2026\)\. .*\(Version 1\.1\).* https:\/\/doi\.org\/10\.5281\/zenodo\.111$/);
});

test("the BibTeX entry carries the version, and the doi only when there is one", () => {
  const entry = bibtex(record, citeFacts(record), where);
  assert.match(entry, /^@misc\{edwards2026phage-dna-extractionv2,/);
  assert.match(entry, /  version = \{2\},/);
  assert.match(entry, /  url = \{https:\/\/dustinedwards\.info\/research\/protocols\/phage-dna-extraction\/v\/2\},/);
  assert.ok(!entry.includes("doi ="));
  assert.match(bibtex(record, { version: "1.1", date: "2026-09-15", doi: "10.5281/zenodo.111" }, where), /  doi = \{10\.5281\/zenodo\.111\},/);
});

test("the Zenodo metadata never names a DOI or a license of its own, and links the version it follows and its sources", () => {
  const meta = zenodoMetadata(record, citeFacts(record), where);
  assert.equal(meta.version, "2");
  assert.equal(meta.publication_date, "2026-10-01");
  assert.deepEqual(meta.creators, [{ name: "Edwards, Dustin", affiliation: "Tarleton State University" }]);
  assert.deepEqual(meta.keywords, ["Nucleic acid extraction"]);
  assert.ok(!("doi" in meta) && !("license" in meta));
  assert.deepEqual(
    meta.related_identifiers.map((r) => [r.relation, r.identifier]),
    [
      ["isAlternateIdentifier", "https://dustinedwards.info/research/protocols/phage-dna-extraction/v/2"],
      ["isNewVersionOf", "10.5281/zenodo.111"],
      ["isDerivedFrom", "10.1093/nar/19.19.5442"],
    ],
  );
});

const PROTOCOL = `---
profile: protocol
method: [pcr]
path: /research/protocols/mini
title: Mini protocol
seo_title: Mini protocol
description: A small protocol for the tests.
version: "2"
history:
  - version: "2"
    date: 2026-10-01
    summary: Added the spin.
    doi: 10.5281/zenodo.200
  - version: "1"
    date: 2026-09-01
    summary: First.
updated: 2026-10-01
status: in-development
last_run: 2026-09-01
host_strain: not applicable
biosafety: not applicable
biosafety_level: BSL-1
scale: { count: 1, unit: tube }
based_on:
  - citation: Test source
    for: the method
materials:
  - name: buffer
    amount: 10 µl
equipment:
  - microcentrifuge
expected_results: A result.
limitations: A limit.
references:
  - "Test reference."
---

## Method

1. Add @buffer{10%µl} to the tube.
`;

/** @param {string} raw */
const errorsOf = (raw) => validateProcedure(parseProcedure({ file: "mini", raw }), { slug: "mini" }).errors.join("\n");

test("a well-formed history is valid", () => {
  assert.equal(errorsOf(PROTOCOL), "");
});

test("a version sits in a URL, so it is letters, digits, dots, hyphens and underscores", () => {
  assert.match(errorsOf(PROTOCOL.replace('version: "2"\nhistory', 'version: "2/3"\nhistory')), /version is "2\/3"; it sits in a URL/);
  assert.match(errorsOf(PROTOCOL.replace('  - version: "1"\n', '  - version: "1 beta"\n')), /needs a version of letters, digits, dots, hyphens and underscores/);
  assert.equal(errorsOf(PROTOCOL.replace(/version: "2"\nhistory/, 'version: "2"\nhistory').replace('  - version: "1"\n', '  - version: "1.0-rc_1"\n')), "");
});

test("the first history entry must be the version the page is at", () => {
  assert.match(errorsOf(PROTOCOL.replace('version: "2"\nhistory', 'version: "3"\nhistory')), /the newest entry is the current version/);
  assert.match(errorsOf(PROTOCOL.replace('version: "2"\nhistory', 'version: "MISSING: none yet"\nhistory')), /history needs a version/);
});

test("history rejects a repeated version, an older entry first, a bad date, a bad DOI, an unknown field and no summary", () => {
  assert.match(errorsOf(PROTOCOL.replace('  - version: "1"\n', '  - version: "2"\n')), /the version is listed twice/);
  assert.match(errorsOf(PROTOCOL.replace("date: 2026-09-01", "date: 2026-11-01")), /later than the entry above it/);
  assert.match(errorsOf(PROTOCOL.replace("date: 2026-09-01", "date: 09/01/2026")), /write the date as YYYY-MM-DD/);
  assert.match(errorsOf(PROTOCOL.replace("doi: 10.5281/zenodo.200", "doi: https://doi.org/10.5281/zenodo.200")), /write the DOI as 10\.xxxx\/suffix/);
  assert.match(errorsOf(PROTOCOL.replace("summary: First.", "summary: First.\n    note: x")), /history\[1\]\.note is not a history field/);
  assert.match(errorsOf(PROTOCOL.replace("summary: First.", 'summary: ""')), /needs a summary of what changed/);
});
