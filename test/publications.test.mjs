import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { decideFileWrite } from "../app/lib/editor/publish-policy.mjs";
import { compilePublication } from "../app/lib/publications/compile.mjs";
import { parsePublication } from "../app/lib/publications/parse.mjs";
import { renderPublicationFile } from "../app/lib/publications/serialize.mjs";
import { validateCorpus } from "../app/lib/publications/validate.mjs";
import { readCitedBy, repoHost } from "../scripts/lib/publications.mjs";

/*
 * The publication file format and its validator, node side. check:machine-readable holds the real corpus to
 * the same code; these cases plant one defect at a time in a real or minimal file and read the messages,
 * which is what a Carrel writer is shown.
 */

const DIR = "content/publications";
const GODFATHER = "10-1128-mra-00888-24";
const godfather = () => readFileSync(`${DIR}/${GODFATHER}.md`, "utf8");

/** @param {string} slug @param {string} raw @param {{ others?: any[] }} [options] */
async function compile(slug, raw, options = {}) {
  return compilePublication({
    slug,
    raw,
    host: repoHost,
    others: options.others ?? [],
    citedByArtifact: await readCitedBy(),
  });
}

/** A file with one front matter field changed, through the one writer of the format. */
function withField(raw, changes) {
  const { data, fullText } = parsePublication({ file: "x.md", raw });
  return renderPublicationFile({ ...data, ...changes }, fullText);
}

const MANUSCRIPT = {
  slug: "cryo-em-example-manuscript",
  id: "edwards-2026-cryo-em-example",
  status: "submitted",
  draft: true,
  type: "article",
  title: "An example cryo-EM manuscript under review",
  authors: ["Dustin Edwards", "Example Coauthor"],
  journal: "Example Journal",
  year: 2026,
  topics: ["bacteriophages"],
  access: "external",
  isOpenAccess: false,
  abstract: "An abstract.",
};

await test("every file round-trips through the one writer, byte for byte", () => {
  const names = readdirSync(DIR).filter((n) => n.endsWith(".md"));
  assert.ok(names.length >= 36, `${names.length} files`);
  for (const name of names) {
    const raw = readFileSync(`${DIR}/${name}`, "utf8");
    const { data, fullText } = parsePublication({ file: name, raw });
    assert.equal(renderPublicationFile(data, fullText), raw, name);
  }
});

await test("a minimal manuscript with no DOI compiles, with no citation tags and no DOI line anywhere", async () => {
  const out = await compile(MANUSCRIPT.slug, renderPublicationFile(MANUSCRIPT, null));
  assert.equal(out.ok, true, out.errors?.join("\n"));
  assert.equal(out.record.doi, null);
  assert.equal(out.record.stage, "submitted");
  assert.equal(out.record.year, 2026);
  assert.equal(out.record.access, "external");
  assert.doesNotMatch(out.twin, /^doi:/m);
  assert.doesNotMatch(out.twin, /doi\.org\/null/);
  assert.equal(out.draft, true);
});

await test("a field the format does not have is refused rather than silently kept", async () => {
  const out = await compile(
    MANUSCRIPT.slug,
    renderPublicationFile({ ...MANUSCRIPT }, null).replace("---\n", "---\nmystery: 1\n"),
  );
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => e === "mystery: is not a publication field"));
});

await test("a hosted paper: the PDF's hash, its derived path, its text and its accessions are all held", async () => {
  assert.equal((await compile(GODFATHER, godfather())).ok, true);

  const sha = await compile(GODFATHER, withField(godfather(), { pdfSha256: "0".repeat(64) }));
  assert.ok(
    sha.errors.some((e) => e.startsWith("pdfSha256:") && e.includes("does not match")),
    sha.errors.join("\n"),
  );

  const path = await compile(
    GODFATHER,
    withField(godfather(), { pdfPath: "/research/publications/flat/dustin-edwards-x.pdf" }),
  );
  assert.ok(
    path.errors.some((e) => e.startsWith("pdfPath:") && e.includes("should be")),
    path.errors.join("\n"),
  );

  const noText = parsePublication({ file: "x", raw: godfather() });
  const bare = await compile(GODFATHER, renderPublicationFile(noText.data, null));
  assert.ok(
    bare.errors.some((e) => e.startsWith("Full text:")),
    bare.errors.join("\n"),
  );

  const accessions = await compile(
    GODFATHER,
    withField(godfather(), { accessions: [{ kind: "genbank", id: "ZZ999999" }] }),
  );
  assert.ok(
    accessions.errors.some((e) => e.startsWith("accessions:")),
    accessions.errors.join("\n"),
  );

  const noFile = await compilePublication({
    slug: GODFATHER,
    raw: godfather(),
    host: { pdf: async () => null },
    others: [],
    citedByArtifact: await readCitedBy(),
  });
  assert.ok(
    noFile.errors.some((e) => e.startsWith("pdfPath:") && e.includes("is not in the repository")),
    noFile.errors.join("\n"),
  );
});

await test("hosting a paper with no redistribution license is Dustin's call, per DOI", async () => {
  const out = await compile(
    GODFATHER,
    withField(godfather(), { license: null, licenseSource: "none-deposited" }),
  );
  assert.equal(out.ok, false);
  assert.ok(
    out.errors.some((e) => e.startsWith("license:") && e.includes("Dustin's call")),
    out.errors.join("\n"),
  );
});

await test("an id or a DOI another paper holds is refused, whatever the DOI's case", async () => {
  const others = [
    { slug: "other-paper", id: "edwards-2025-godfather", doi: "10.1128/MRA.00888-24" },
  ];
  const out = await compile(GODFATHER, godfather(), { others });
  assert.ok(
    out.errors.some((e) => e.startsWith("id:") && e.includes("other-paper")),
    out.errors.join("\n"),
  );
  assert.ok(
    out.errors.some((e) => e.startsWith("doi:") && e.includes("case-insensitive")),
    out.errors.join("\n"),
  );
});

await test("the corpus rule catches a duplicate id, a case-folded DOI and an empty corpus", () => {
  const dupes = validateCorpus([
    { file: "a.md", slug: "a", id: "x", doi: "10.1/A" },
    { file: "b.md", slug: "b", id: "x", doi: "10.1/a" },
  ]);
  assert.equal(dupes.length, 2);
  assert.ok(validateCorpus([]).some((e) => e.includes("empty")));
});

await test("the write policy: an operator may edit but never first-publish, Carrel may, a read-only credential may not write", () => {
  const isDraft = (raw) => raw === "draft";
  const base = { noun: "publication", isDraft };
  assert.throws(
    () =>
      decideFileWrite({
        ...base,
        actor: { kind: "operator", id: "t" },
        incomingDraft: false,
        priorRaw: null,
      }),
    /reserved to the human admin/,
  );
  assert.doesNotThrow(() =>
    decideFileWrite({
      ...base,
      actor: { kind: "operator", id: "t" },
      incomingDraft: false,
      priorRaw: "live",
    }),
  );
  // Unpublished now, but an earlier revision was live: a republication, which an operator may do.
  assert.doesNotThrow(() =>
    decideFileWrite({
      ...base,
      actor: { kind: "operator", id: "t" },
      incomingDraft: false,
      priorRaw: "draft",
      history: ["draft", "live", "draft"],
    }),
  );
  assert.throws(
    () =>
      decideFileWrite({
        ...base,
        actor: { kind: "operator", id: "t" },
        incomingDraft: false,
        priorRaw: "draft",
        history: ["draft"],
      }),
    /reserved to the human admin/,
  );
  assert.doesNotThrow(() =>
    decideFileWrite({
      ...base,
      actor: { kind: "carrel", changeId: "c" },
      incomingDraft: false,
      priorRaw: null,
    }),
  );
  assert.throws(
    () =>
      decideFileWrite({
        ...base,
        actor: { kind: "smoke", id: "s" },
        incomingDraft: true,
        priorRaw: null,
      }),
    /READ ONLY/,
  );
});
