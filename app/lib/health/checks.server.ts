// Every decision lives in verdicts.mjs: check:tests cannot reach a module that imports a binding.

import {
  CHECK_TIMEOUT_MS,
  askDriftVerdict,
  contentDriftVerdict,
  procedureDriftVerdict,
  cvDriftVerdict,
  dictionaryDriftVerdict,
  pageDriftVerdict,
  publicationDriftVerdict,
  llmsDriftVerdict,
  ftsEqualityVerdict,
  mediaDriftVerdict,
  mediaBackupDriftVerdict,
  withTimeout,
} from "~/lib/health/verdicts.mjs";
import { askIndexStatus } from "~/lib/search/ask.server";
import { listDirectory, listPostFiles } from "~/lib/editor/github.server";
import { PROCEDURES_DIR } from "~/lib/procedures/parse.mjs";
import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { LLMS_PATH, LLMS_SETTING_KEY } from "~/lib/llms/validate.mjs";
import { CV_DIR } from "~/lib/cv/parse.mjs";
import { DICTIONARY_DIR } from "~/lib/dictionary/parse.mjs";
import { PAGES_DIR } from "~/lib/pages/compile.mjs";
import { PUBLICATIONS_DIR } from "~/lib/publications/parse.mjs";
import { mediaIndexStatus } from "~/lib/media/rebuild.server";
import { backupStatus } from "~/lib/media/backup.server";

/**
 * The two sides the content-drift comparison reads: the repository's post files with their blob
 * shas, and D1's rows with the sha each was rendered from. The health check and sync_posts both
 * read them here, so they cannot compare different things.
 */
export async function readContentSides(env: Env & { GITHUB_TOKEN?: string }) {
  const files = (await listPostFiles(env)).map((e) => ({ slug: e.slug, sha: e.sha, path: e.path }));
  const rows = await env.DB.prepare(
    "SELECT slug, source_blob_sha FROM posts WHERE source_path IS NOT NULL",
  ).all<{ slug: string; source_blob_sha: string | null }>();
  return { files, rows: rows.results ?? [] };
}

/**
 * The same two sides for procedures: `content/procedures/*.md` with their blob shas, and the table's
 * rows with the sha each was compiled from. The check and sync_procedures both read them here.
 */
export async function readProcedureSides(env: Env & { GITHUB_TOKEN?: string }) {
  const files = await listMarkdownFiles(env, PROCEDURES_DIR);
  const rows = await env.DB.prepare(
    "SELECT slug, path, source_blob_sha FROM procedures WHERE source_path IS NOT NULL",
  ).all<{ slug: string; path: string; source_blob_sha: string | null }>();
  return { files, rows: rows.results ?? [] };
}

/** The markdown files of a directory, each with its blob sha, the slug being the file name without .md. */
async function listMarkdownFiles(env: Env & { GITHUB_TOKEN?: string }, dir: string) {
  return (await listDirectory(env, dir))
    .filter((e) => e.type === "file" && e.name.endsWith(".md"))
    .map((e) => ({ slug: e.name.slice(0, -".md".length), sha: e.sha, path: e.path }));
}

/** The same two sides for dictionary entries: `content/dictionary/*.md` and the dictionary_entries table's rows. */
export async function readDictionarySides(env: Env & { GITHUB_TOKEN?: string }) {
  const files = await listMarkdownFiles(env, DICTIONARY_DIR);
  // `key` answers as `slug`, the name every kind's drift comparison and convergence loop reads a row by.
  const rows = await env.DB.prepare(
    "SELECT key AS slug, path, source_blob_sha FROM dictionary_entries",
  ).all<{ slug: string; path: string; source_blob_sha: string | null }>();
  return { files, rows: rows.results ?? [] };
}

/** The same two sides for pages: `content/pages/*.md` and the pages table's rows. */
export async function readPageSides(env: Env & { GITHUB_TOKEN?: string }) {
  const files = await listMarkdownFiles(env, PAGES_DIR);
  const rows = await env.DB.prepare(
    "SELECT slug, path, source_blob_sha FROM pages",
  ).all<{ slug: string; path: string; source_blob_sha: string | null }>();
  return { files, rows: rows.results ?? [] };
}

/** The same two sides for the CV: `content/cv/*.md` and the cv table's rows. */
export async function readCvSides(env: Env & { GITHUB_TOKEN?: string }) {
  const files = await listMarkdownFiles(env, CV_DIR);
  const rows = await env.DB.prepare("SELECT slug, source_blob_sha FROM cv").all<{
    slug: string;
    source_blob_sha: string | null;
  }>();
  return { files, rows: rows.results ?? [] };
}

/** The same two sides for publications: `content/publications/*.md` and the publications table's rows. */
export async function readPublicationSides(env: Env & { GITHUB_TOKEN?: string }) {
  const files = await listMarkdownFiles(env, PUBLICATIONS_DIR);
  const rows = await env.DB.prepare(
    "SELECT slug, doi_key, source_blob_sha FROM publications",
  ).all<{ slug: string; doi_key: string | null; source_blob_sha: string | null }>();
  return { files, rows: rows.results ?? [] };
}

/**
 * The same two sides for llms.txt: the one file with its blob sha, and the settings row /llms.txt is served
 * from, given the blob sha of the bytes it holds (the row has no column for one). The slug is a name for the
 * pair, so the shared comparison applies.
 */
export async function readLlmsSides(env: Env & { GITHUB_TOKEN?: string }) {
  const dir = LLMS_PATH.slice(0, LLMS_PATH.lastIndexOf("/"));
  const file = (await listDirectory(env, dir)).find((e) => e.type === "file" && e.path === LLMS_PATH);
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?1")
    .bind(LLMS_SETTING_KEY)
    .first<{ value: string }>();
  return {
    files: file ? [{ slug: "llms", sha: file.sha, path: file.path }] : [],
    rows: row ? [{ slug: "llms", source_blob_sha: await gitBlobSha(row.value) }] : [],
  };
}

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
  /** Only on failure: the one part of a failing check besides its name that reaches the wire. */
  counts?: { expected: number; present: number };
}

interface HealthRun {
  checks: HealthCheck[];
  failed: HealthCheck[];
}

/** A check that throws is reported as failed, or one broken check would silence every other. */
export async function runHealthChecks(env: Env): Promise<HealthRun> {
  const checks: HealthCheck[] = [];

  checks.push(
    await guard("ask-index-drift", async () => askDriftVerdict(await askIndexStatus(env))),
  );

  // The INDEX; media-backup-drift below compares BYTES. Easy to confuse.
  checks.push(
    await guard("media-index-drift", async () => mediaDriftVerdict(await mediaIndexStatus(env))),
  );

  checks.push(
    await guard("media-backup-drift", async () => {
      // Both buckets listed in full: a truncated read would report a clean sweep of the part it saw.
      return mediaBackupDriftVerdict(await backupStatus(env));
    }),
  );

  checks.push(
    await guard("content-drift", async () => {
      // An unreadable repository fails this check, which the repair plan refuses to act on alone.
      const { files, rows } = await readContentSides(env);
      return contentDriftVerdict(files, rows);
    }),
  );

  checks.push(
    await guard("procedures-drift", async () => {
      // A procedure edited, added or deleted through git, or a save whose D1 write failed, shows here.
      const { files, rows } = await readProcedureSides(env);
      return procedureDriftVerdict(files, rows);
    }),
  );

  checks.push(
    await guard("dictionary-drift", async () => {
      // An entry edited, added or deleted through git, or a save whose D1 write failed, shows here.
      const { files, rows } = await readDictionarySides(env);
      return dictionaryDriftVerdict(files, rows);
    }),
  );

  checks.push(
    await guard("pages-drift", async () => {
      // A page edited, added or deleted through git, or a save whose D1 write failed, shows here.
      const { files, rows } = await readPageSides(env);
      return pageDriftVerdict(files, rows);
    }),
  );

  checks.push(
    await guard("cv-drift", async () => {
      // A CV file edited through git, or a save whose D1 write failed, shows here.
      const { files, rows } = await readCvSides(env);
      return cvDriftVerdict(files, rows);
    }),
  );

  checks.push(
    await guard("publications-drift", async () => {
      const { files, rows } = await readPublicationSides(env);
      return publicationDriftVerdict(files, rows);
    }),
  );

  checks.push(
    await guard("llms-drift", async () => {
      // A file edited through git, or a save whose D1 write failed, shows here; the served row is derived.
      const { files, rows } = await readLlmsSides(env);
      return llmsDriftVerdict(files, rows);
    }),
  );

  checks.push(
    await guard("fts-equality", async () => {
      // Index counts come from the _docsize shadows: COUNT(*) on an external-content fts5 table reads
      // through to its content table and can never disagree with it.
      const row = await env.DB.prepare(
        "SELECT (SELECT COUNT(*) FROM posts) AS posts, " +
          "(SELECT COUNT(*) FROM posts_fts_docsize) AS postsFts, " +
          "(SELECT COUNT(*) FROM search_docs) AS docs, " +
          "(SELECT COUNT(*) FROM search_identity_docsize) AS identity, " +
          "(SELECT COUNT(*) FROM search_prose_docsize) AS prose",
      ).first<Record<string, unknown>>();

      // A null row reaches the verdict as unreadable counts: a sentence, not a stack.
      return ftsEqualityVerdict(row ?? {});
    }),
  );

  return { checks, failed: checks.filter((c) => !c.ok) };
}

async function guard(
  name: string,
  run: () => Promise<{ ok: boolean; detail: string; counts?: { expected: number; present: number } }>,
): Promise<HealthCheck> {
  // The async wrapper turns a SYNCHRONOUS throw in run into a rejection withTimeout can guard.
  const started = (async () => run())();
  const { ok, detail, counts } = await withTimeout(started, CHECK_TIMEOUT_MS, name);
  return counts ? { name, ok, detail, counts } : { name, ok, detail };
}

