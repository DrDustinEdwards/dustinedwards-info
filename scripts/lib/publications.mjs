// Every publication file compiled the one way the Carrel adapter's save compiles it
// (app/lib/publications/compile.mjs), for build:content, sync:content, the gates and the link check.

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCv } from "../../app/lib/cv/entries.mjs";
import { compilePublication } from "../../app/lib/publications/compile.mjs";
import { PUBLICATIONS_DIR, parsePublication } from "../../app/lib/publications/parse.mjs";
import { sortPublications } from "../../app/lib/publications/record.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUBLICATIONS_SOURCE_DIR = PUBLICATIONS_DIR;
/** The D1 rows sync:content writes: the twin and the raw record ride in them, so the Worker never imports it. */
export const PUBLICATIONS_ARTIFACT_PATH = path.join("content", "generated", "publications.json");
/** The published records alone, small enough for the CV page to import into the Worker bundle. */
export const PUBLICATION_RECORDS_PATH = path.join("content", "generated", "publication-records.json");
const CITED_BY_PATH = path.join("data", "publications.cited-by.json");

/** The repository's PDFs, read from public/ as a clone has them. */
const repoHost = {
  /** @param {string} sitePath site-absolute, `/research/publications/<slug>/<file>.pdf` */
  async pdf(sitePath) {
    const file = path.join(ROOT, "public", sitePath.replace(/^\//, ""));
    const info = await stat(file).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (!info) return null;
    return { size: info.size, sha256: createHash("sha256").update(await readFile(file)).digest("hex") };
  },
};

/** @type {Promise<unknown> | undefined} */
let citedByArtifact;
/** The OpenAlex snapshot the twins' citedBy line is a pure function of. */
export function readCitedBy() {
  citedByArtifact ??= readFile(path.join(ROOT, CITED_BY_PATH), "utf8").then((text) => JSON.parse(text));
  return citedByArtifact;
}

/**
 * Compiles every file in content/publications/, each against the others for uniqueness. A file that does
 * not compile is returned with its errors, never skipped: the caller decides what that means.
 *
 * @param {{ host?: import("../../app/lib/publications/validate.mjs").PublicationHost }} [options]
 */
export async function compileAllPublications(options = {}) {
  const host = options.host ?? repoHost;
  const names = (await readdir(path.join(ROOT, PUBLICATIONS_SOURCE_DIR))).filter((n) => n.endsWith(".md")).sort();
  const sources = await Promise.all(
    names.map(async (name) => ({
      name,
      slug: name.slice(0, -3),
      raw: await readFile(path.join(ROOT, PUBLICATIONS_SOURCE_DIR, name), "utf8"),
    })),
  );
  const cited = await readCitedBy();
  // Each file is judged against the others' ids and DOIs, as the Worker's save judges one against the table.
  const identities = sources.map(({ name, slug, raw }) => {
    const { data } = parsePublication({ file: name, raw });
    return {
      slug,
      id: typeof data.id === "string" ? data.id : "",
      doi: typeof data.doi === "string" ? data.doi : null,
    };
  });
  return Promise.all(
    sources.map(async ({ name, slug, raw }) => ({
      file: `${PUBLICATIONS_SOURCE_DIR}/${name}`.replaceAll("\\", "/"),
      slug,
      raw,
      compiled: await compilePublication({
        slug,
        raw,
        host,
        others: identities.filter((other) => other.slug !== slug),
        citedByArtifact: cited,
      }),
    })),
  );
}

/**
 * The D1 rows sync:content writes and the records the build reads. Throws on the first file that does
 * not compile: a build never ships a paper CI would refuse.
 */
export async function buildPublications() {
  const compiled = await compileAllPublications();
  const failed = compiled.filter((c) => !c.compiled.ok);
  if (failed.length > 0) {
    throw new Error(
      failed.map((c) => `${c.file} does not compile:\n  ${c.compiled.errors.join("\n  ")}`).join("\n"),
    );
  }
  const ok = compiled.flatMap((c) => (c.compiled.ok ? [{ file: c.file, ...c.compiled }] : []));
  const rows = ok.map((c) => ({
    slug: c.record.slug,
    doiKey: c.record.doi ? c.record.doi.trim().toLowerCase() : null,
    status: c.draft ? "draft" : "published",
    stage: c.record.stage,
    type: c.record.type,
    title: c.record.title,
    year: c.record.year,
    selected: c.record.selected ? 1 : 0,
    record: JSON.stringify(c.record),
    csl: c.csl ? JSON.stringify(c.csl) : null,
    markdown: c.twin,
    sourcePath: c.sourcePath,
    sourceBlobSha: c.sourceBlobSha,
  }));
  const published = ok.filter((c) => !c.draft);
  const records = sortPublications(published.map((c) => c.record));
  const searchInputs = published.map((c) => c.searchInput);
  return { rows, records, searchInputs };
}

/** @type {Promise<import("../../app/lib/cv/entries.mjs").Cv> | undefined} */
let cv;

/** The CV resolved against the published records, the way the page resolves it (app/lib/cv/current.ts). */
export function loadCv() {
  cv ??= buildPublications().then(({ records }) => buildCv(records));
  return cv;
}

/**
 * The citation counts the committed OpenAlex snapshot holds, as publication_citations rows, so a count is
 * never blank on a database that has none yet. The lower-cased DOI is the key, as the table keys it.
 */
export async function citationSeeds() {
  const artifact = /** @type {{ fetchedAt?: unknown, works?: Record<string, { openalexId?: string | null, total?: number }> }} */ (
    await readCitedBy()
  );
  const fetchedAt = typeof artifact.fetchedAt === "string" ? artifact.fetchedAt : "";
  if (!/^d{4}-d{2}-d{2}$/.test(fetchedAt) || !artifact.works) {
    throw new Error(`${CITED_BY_PATH} carries no fetchedAt date or no works, so the citation counts cannot be seeded.`);
  }
  return Object.entries(artifact.works).map(([doi, work]) => ({
    doi: doi.trim().toLowerCase(),
    count: Number(work.total ?? 0),
    url: work.openalexId ? `https://openalex.org/${work.openalexId}` : null,
    fetchedAt,
  }));
}
