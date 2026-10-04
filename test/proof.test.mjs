import test from "node:test";
import assert from "node:assert/strict";

import { proofErrors, proofFromFile, proofMarkdown, resolveProof } from "../app/lib/procedures/proof.mjs";

/* Proof of use (app/lib/procedures/proof.mjs): stored slugs, resolved to words and addresses from rows, never inferred. */

test("a proof of papers and phages is valid; every malformed shape is refused with a message that says which", () => {
  assert.deepEqual(proofErrors(undefined), []);
  assert.deepEqual(proofErrors({ papers: ["10-1128-mra-01242-18"], phages: ["arlo", "finny"] }), []);
  assert.deepEqual(proofErrors({ phages: ["arlo"] }), []);
  assert.match(proofErrors("arlo")[0], /must be a mapping/);
  assert.match(proofErrors([])[0], /must be a mapping/);
  assert.match(proofErrors({})[0], /empty/);
  assert.match(proofErrors({ papers: [] }).join(" "), /non-empty list/);
  assert.match(proofErrors({ papers: ["Not A Slug"] })[0], /not a publication slug/);
  assert.match(proofErrors({ phages: ["Arlo"] })[0], /not a phage key/);
  assert.match(proofErrors({ phages: ["arlo", "arlo"] })[0], /one entry twice/);
  assert.match(proofErrors({ papers: ["a"], cited: ["x"] })[0], /no field "cited"/);
});

test("the record keeps slugs only, and null when nothing is stated", () => {
  assert.deepEqual(proofFromFile({ papers: ["p"], phages: ["arlo"] }), { papers: ["p"], phages: ["arlo"] });
  assert.deepEqual(proofFromFile({ phages: ["arlo"] }), { papers: [], phages: ["arlo"] });
  assert.equal(proofFromFile(null), null);
  assert.equal(proofFromFile(undefined), null);
  assert.equal(proofFromFile({}), null);
});

const ROWS = {
  papers: new Map([["p1", { title: "A genome announcement", year: 2018 }]]),
  phages: new Map([["arlo", "Arlo"]]),
};

test("the words and addresses come from the rows; a slug the rows lack stays visible, unlinked", () => {
  const proof = resolveProof({ papers: ["p1", "gone"], phages: ["arlo", "nobody"] }, ROWS);
  assert.deepEqual(proof.papers, [
    { slug: "p1", title: "A genome announcement", year: 2018, href: "/research/publications/p1/" },
    { slug: "gone", title: "gone", year: null, href: null },
  ]);
  assert.deepEqual(proof.phages, [
    { key: "arlo", name: "Arlo", href: "/research/phages#arlo" },
    { key: "nobody", name: "nobody", href: null },
  ]);
  assert.equal(resolveProof(null, ROWS), null);
});

test("the twin lists the same papers and phages with absolute links, and nothing when there is no proof", () => {
  const md = proofMarkdown(resolveProof({ papers: ["p1"], phages: ["arlo"] }, ROWS), "https://example.test");
  assert.ok(md.startsWith("## Proof of use\n\nPapers that used this method:"));
  assert.ok(md.includes("- [A genome announcement](https://example.test/research/publications/p1/) (2018)"));
  assert.ok(md.includes("Phages it produced:\n\n- [Arlo](https://example.test/research/phages#arlo)"));
  assert.equal(proofMarkdown(null, "https://example.test"), "");
  assert.ok(!proofMarkdown(resolveProof(proofFromFile({ phages: ["arlo"] }), ROWS), "https://example.test").includes("Papers that used"));
});
