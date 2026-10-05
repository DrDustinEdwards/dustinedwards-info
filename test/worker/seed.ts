import { env } from "cloudflare:test";

import cvArtifact from "../../content/generated/cv.json";
import dictionaryArtifact from "../../content/generated/dictionary.json";
import pagesArtifact from "../../content/generated/pages.json";
import phagesArtifact from "../../content/generated/phages.json";
import proceduresArtifact from "../../content/generated/procedures.json";
import registryArtifact from "../../content/generated/registry.json";

type PageArtifactRow = {
  slug: string;
  path: string;
  title: string;
  description: string;
  status: string;
  record: string;
  markdown: string;
  sourcePath: string;
  sourceBlobSha: string;
};

/**
 * Rows written straight into D1, for cases whose subject reads them rather than writes them.
 * The publish path is not involved, so nothing here renders, hashes or reaches GitHub.
 */

/** 2026-01-01: a publish_at already in the past, so the post is live. */
const NEW_YEAR = Math.floor(Date.UTC(2026, 0, 1) / 1000);

/** One post row. Seeding a slug again restates its status and publish_at. */
export async function seedPost(
  slug: string,
  {
    status = "published",
    title = `Title for ${slug}`,
    body = "A body.",
    publishAt = NEW_YEAR,
  }: {
    status?: "draft" | "published";
    title?: string;
    body?: string;
    publishAt?: number | null;
  } = {},
) {
  await env.DB.prepare(
    `INSERT INTO posts (slug, kind, title, body, status, publish_at)
     VALUES (?1, 'post', ?2, ?3, ?4, ?5)
     ON CONFLICT(slug) DO UPDATE SET status = excluded.status, publish_at = excluded.publish_at`,
  )
    .bind(slug, title, body, status, publishAt)
    .run();
}

/** One webmention row, returning its id. Unset fields are NULL, which is also their default. */
export async function seedMention(
  sourceUrl: string,
  targetSlug: string,
  fields: {
    status: string;
    receivedAt: number;
    authorName?: string | null;
    authorUrl?: string | null;
    excerpt?: string | null;
    verifiedAt?: number | null;
    decidedAt?: number | null;
  },
): Promise<number> {
  await env.DB.prepare(
    `INSERT INTO webmentions
       (source_url, target_slug, status, author_name, author_url, excerpt, received_at, verified_at, decided_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  )
    .bind(
      sourceUrl,
      targetSlug,
      fields.status,
      fields.authorName ?? null,
      fields.authorUrl ?? null,
      fields.excerpt === undefined ? "An excerpt." : fields.excerpt,
      fields.receivedAt,
      fields.verifiedAt ?? null,
      fields.decidedAt ?? null,
    )
    .run();
  const row = await env.DB.prepare(`SELECT id FROM webmentions WHERE source_url = ?1`)
    .bind(sourceUrl)
    .first<{ id: number }>();
  return row?.id ?? -1;
}

/**
 * Every publication file in the repository, compiled by the door the Carrel adapter's save uses and written
 * to D1 as sync:content writes it, so a case that reads the papers reads the whole corpus. The PDFs are not
 * in this isolate, so the host says every one is there; check:machine-readable holds the real ones.
 */
const PUBLICATION_FILES = import.meta.glob("../../content/publications/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export async function seedPublications() {
  const { compilePublication } = await import("~/lib/publications/compile.mjs");
  const { writePublicationRow } = await import("~/lib/publications/save.server");
  const { default: citedByArtifact } = await import("../../data/publications.cited-by.json");
  for (const [file, raw] of Object.entries(PUBLICATION_FILES)) {
    const slug = file.split("/").pop()!.replace(/\.md$/, "");
    const compiled = await compilePublication({
      slug,
      raw,
      host: { pdf: async () => ({ size: 1 }) },
      citedByArtifact,
    });
    if (!compiled.ok) throw new Error(`${file} does not compile:\n  ${compiled.errors.join("\n  ")}`);
    await writePublicationRow(env as never, compiled);
  }
  return Object.keys(PUBLICATION_FILES).length;
}

/** The citation counts the committed snapshot holds, in the table the pages read. */
export async function seedCitations() {
  const { default: artifact } = await import("../../data/publications.cited-by.json");
  const works = (artifact as unknown as { works: Record<string, { openalexId: string; total: number }> }).works;
  for (const [doi, work] of Object.entries(works)) {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO publication_citations (doi, count, url, fetched_at) VALUES (?1, ?2, ?3, '2026-09-12')`,
    )
      .bind(doi.toLowerCase(), work.total, `https://openalex.org/${work.openalexId}`)
      .run();
  }
}

/**
 * The pages table, from the rows build:content compiles (content/generated/pages.json), which is what
 * sync:content writes at ship: the same compile the page save runs, so a case that reads a page reads
 * the page the site serves. No search records: nothing here reads them.
 */
export async function seedPages(only?: readonly string[]) {
  const rows = (pagesArtifact.pages as PageArtifactRow[]).filter((row) => !only || only.includes(row.path));
  if (rows.length === 0) throw new Error("seedPages found no page rows. Run npm run build:content first.");
  await env.DB.batch(
    rows.map((r) =>
      env.DB.prepare(
        `INSERT INTO pages (slug, path, title, description, status, record, markdown, source_path, source_blob_sha)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(slug) DO UPDATE SET title = excluded.title, description = excluded.description,
           status = excluded.status, record = excluded.record, markdown = excluded.markdown,
           source_blob_sha = excluded.source_blob_sha`,
      ).bind(r.slug, r.path, r.title, r.description, r.status, r.record, r.markdown, r.sourcePath, r.sourceBlobSha),
    ),
  );
}

/**
 * The procedures table, from the rows build:content compiles (content/generated/procedures.json), which
 * is what sync:content writes at ship. For a case whose subject reads the procedures' paths, such as the
 * llms.txt rules, which hold the file to the pages the site has. No search records.
 */
export async function seedProcedures() {
  const rows = proceduresArtifact.procedures;
  if (rows.length === 0) throw new Error("seedProcedures found no procedure rows. Run npm run build:content first.");
  await env.DB.batch(
    rows.map((r) =>
      env.DB.prepare(
        `INSERT INTO procedures (slug, path, profile, title, description, status, version, updated, record,
           markdown, source_path, source_blob_sha)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(slug) DO UPDATE SET path = excluded.path, status = excluded.status, record = excluded.record,
           markdown = excluded.markdown, source_blob_sha = excluded.source_blob_sha`,
      ).bind(r.slug, r.path, r.profile, r.title, r.description, r.status, r.version, r.updated, r.record, r.markdown, r.sourcePath, r.sourceBlobSha),
    ),
  );
}

/**
 * The cv table, from the rows build:content compiles (content/generated/cv.json), which is what sync:content
 * writes at ship: the same compile the CV save runs, so a case that reads the CV reads the CV the site serves.
 * Seed the publications first: the CV is joined to them at read time. No search records.
 */
export async function seedCv() {
  const rows = cvArtifact.cv;
  if (rows.length === 0) throw new Error("seedCv found no CV rows. Run npm run build:content first.");
  await env.DB.batch(
    rows.map((r) =>
      env.DB.prepare(
        `INSERT INTO cv (slug, type, record, source_path, source_blob_sha) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(slug) DO UPDATE SET type = excluded.type, record = excluded.record,
           source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha`,
      ).bind(r.slug, r.type, r.record, r.sourcePath, r.sourceBlobSha),
    ),
  );
}

/**
 * The dictionary_entries table, from the rows build:content compiles (content/generated/dictionary.json), which
 * is what sync:content writes at ship, so a case that reads a named Software page reads the page the site
 * serves, lead included. Seed it with the pages: the pages' twins already carry the entries.
 */
export async function seedDictionary(only?: readonly string[]) {
  const rows = dictionaryArtifact.dictionary.filter((row) => !only || only.includes(row.path));
  if (rows.length === 0) throw new Error("seedDictionary found no entry rows. Run npm run build:content first.");
  await env.DB.batch(
    rows.map((r) =>
      env.DB.prepare(
        `INSERT INTO dictionary_entries (key, path, term, status, record, source_path, source_blob_sha)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(key) DO UPDATE SET term = excluded.term, status = excluded.status, record = excluded.record,
           source_blob_sha = excluded.source_blob_sha`,
      ).bind(r.key, r.path, r.term, r.status, r.record, r.sourcePath, r.sourceBlobSha),
    ),
  );
}

/**
 * Synthetic cohorts: NO real name, ever. The year, photo path and names are placeholders, so a test of the roster
 * touches nothing a student gave. The photograph path is a real shape (a .webp under /phage-hunters/) because the
 * validator holds it to one; the stub host below answers that it exists.
 */
export const SYNTHETIC_COHORTS = [
  {
    year: 2031,
    photo: { src: "/phage-hunters/synthetic-2031.webp", width: 1080, height: 720, alt: "Group photo of the 2031 Phage Discovery Program cohort" },
    researchers: ["Example Person One", "Example Person Two", "Example Person Three"],
  },
  {
    year: 2030,
    photo: null,
    researchers: ["Example Person Four", "Example Person Five"],
  },
] as const;

/** A cohort's file, as the repository holds it: front matter and no body. */
export async function cohortFile(cohort: { year: number; photo: unknown; researchers: readonly string[] }) {
  const { default: matter } = await import("gray-matter");
  return matter.stringify("", { year: cohort.year, photo: cohort.photo, researchers: [...cohort.researchers] }).replace(/\n+$/, "\n");
}

/** The roster table, from the synthetic cohorts (or the ones given), written through the save's own row writer. */
export async function seedRoster(cohorts: ReadonlyArray<{ year: number; photo: unknown; researchers: readonly string[] }> = SYNTHETIC_COHORTS) {
  const { compileCohort } = await import("~/lib/roster/compile.mjs");
  const { writeRosterRow } = await import("~/lib/roster/save.server");
  for (const cohort of cohorts) {
    const compiled = await compileCohort({
      slug: String(cohort.year),
      raw: await cohortFile(cohort),
      host: { photo: async () => true },
      pipeline: { findWideDashes: () => [] },
    });
    if (!compiled.ok) throw new Error(`the ${cohort.year} cohort does not compile:\n  ${compiled.errors.join("\n  ")}`);
    await writeRosterRow(env as never, compiled);
  }
  return cohorts.length;
}

/**
 * The phages table, from the rows build:content compiles (content/generated/phages.json), which is what
 * sync:content writes at ship, so a case that saves a phage draws its page from the whole table. Seed it with
 * the pages: the page's row already carries the table as the same compile drew it.
 */
export async function seedPhages() {
  const rows = phagesArtifact.phages;
  if (rows.length === 0) throw new Error("seedPhages found no phage rows. Run npm run build:content first.");
  await env.DB.batch(
    rows.map((r) =>
      env.DB.prepare(
        `INSERT INTO phages (slug, name, year, record, source_path, source_blob_sha)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(slug) DO UPDATE SET name = excluded.name, year = excluded.year, record = excluded.record,
           source_blob_sha = excluded.source_blob_sha`,
      ).bind(r.slug, r.name, r.year, r.record, r.sourcePath, r.sourceBlobSha),
    ),
  );
  return rows.length;
}

/**
 * The registry table, from the rows build:content compiles (content/generated/registry.json), which is what
 * sync:content writes at ship, so a case that reads the registry's pages reads the registry the site serves.
 */
export async function seedRegistry() {
  const rows = registryArtifact.registry;
  if (rows.length === 0) throw new Error("seedRegistry found no registry rows. Run npm run build:content first.");
  await env.DB.batch(
    rows.map((r) =>
      env.DB.prepare(
        `INSERT INTO registry (kind, id, name, status, record, source_path, source_blob_sha)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(kind, id) DO UPDATE SET name = excluded.name, status = excluded.status, record = excluded.record,
           source_blob_sha = excluded.source_blob_sha`,
      ).bind(r.kind, r.id, r.name, r.status, r.record, r.sourcePath, r.sourceBlobSha),
    ),
  );
  return rows.length;
}

/* The strain records as the repository holds them, by repo path: a protocol that names its host strains by id (docs/REGISTRY.md)
 * compiles only where the repository holds those strains, so a case that saves one adds these to its stubbed GitHub. */
const STRAIN_FILES = import.meta.glob("../../content/registry/strain/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
export const strainRepoFiles: Record<string, string> = Object.fromEntries(
  Object.entries(STRAIN_FILES).map(([path, raw]) => [`content/registry/strain/${path.split("/").pop()}`, raw]),
);
