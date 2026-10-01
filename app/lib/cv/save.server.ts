// The one CV save, called by the site-api adapter for Carrel (app/lib/carrel/cv-handler.server.ts), and the reads
// the operator's list_cv and get_cv tools answer. The CV is edited through Carrel and nothing else: there is no
// save tool and no admin editor. A save judges the file the way CI does (compile.mjs), joins it to the other
// files D1 holds and to the publications, compiles the page its search records come from, refuses it with every
// message if any of that fails, commits it to the repository (unless it is byte-identical, commitUnlessUnchanged),
// then writes its D1 row and the CV's search records, so the page, its twin and its charts change on the next
// request with no build or deploy. The commit is never reverted when the D1 write fails (hard rule 18); the error
// says the commit landed and how to repair the row. A save cannot create a file: the set of files is structure
// and lives in CV_FILES.

import matter from "gray-matter";

import { listCvRows, readCv } from "~/db/cv";
import { listPublishedPublications } from "~/db/publications";
import { ContentInvalid } from "~/lib/carrel/errors.server";
import { purgeCv, type PurgeOutcome } from "~/lib/cache-purge.server";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { contentPageSearchUid } from "~/lib/content-pages.mjs";
import { compileCv, compileCvFile, compileCvPage } from "~/lib/cv/compile.mjs";
import { CV_FILES, cvFileFor, cvSourcePath } from "~/lib/cv/parse.mjs";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { commitFiles, readFile } from "~/lib/editor/github.server";
import { commitUnlessUnchanged, UNCHANGED_NOTE } from "~/lib/editor/write-path.server";
import { PolicyError, WRITE_CAPABILITIES, type Actor } from "~/lib/editor/publish-policy.mjs";
import { recordsForPages } from "~/lib/search/records.mjs";
import { replaceSearchRecords } from "~/lib/search/replace.server";

type CvEnv = Env & { GITHUB_TOKEN?: string };

/** A file the validator refused: 422, with every message, so the caller can fix its own edit. */
export class CvInvalid extends ContentInvalid {
  constructor(slug: string, errors: string[]) {
    super(`The CV file "${slug}" was not saved: it fails ${errors.length} check(s). Nothing was committed.`, errors);
    this.name = "CvInvalid";
  }
}

/** The file a slug names. A slug outside CV_FILES is refused before any read or write: a save cannot create a file. */
export function registeredCvFile(slug: string) {
  const clean = slug.trim();
  const file = cvFileFor(clean);
  if (!file) {
    throw new CvInvalid(clean, [
      `"${clean}" is not a CV file. A save cannot create a new one: the set of files is structure, so a new ` +
        `section is added to CV_FILES (app/lib/cv/parse.mjs) in code first. The files are ${CV_FILES.map((f) => f.slug).join(", ")}.`,
    ]);
  }
  return { slug: clean, file, path: cvSourcePath(clean) };
}

/** The one compile door for a file: the save and sync_cv both read a file through it (judged alone, against D1's papers). */
export async function compile(env: CvEnv, slug: string, raw: string) {
  return compileCvFile({ slug, raw, publications: await listPublishedPublications(env) });
}

/**
 * Compile, then the rules that need the whole CV, then the page the search records come from: every message
 * the file has now, which is what CI and a save both refuse. The whole is D1's other files with this one in place.
 */
async function judge(env: CvEnv, slug: string, raw: string) {
  const publications = await listPublishedPublications(env);
  const compiled = await compileCvFile({ slug, raw, publications });
  if (!compiled.ok) return compiled;
  const others = (await listCvRows(env)).filter((row) => row.slug !== slug).map((row) => row.record);
  const whole = compileCv({ records: [...others, compiled.record], publications });
  if (!whole.ok) return whole;
  const { renderBody, findWideDashes } = await loadPipeline();
  const page = await compileCvPage({ cv: whole.cv, pipeline: { renderBody, findWideDashes } });
  return page.ok ? compiled : page;
}

/** The file, and its front matter as parsed, with what the validator says of it now. */
export async function readCvFile(env: CvEnv, slug: string) {
  const { path } = registeredCvFile(slug);
  const existing = await readFile(env, path);
  if (!existing) return null;
  const judged = await judge(env, slug, existing.content);
  return {
    slug,
    raw: existing.content,
    record: matter(existing.content).data,
    errors: judged.ok ? [] : judged.errors,
  };
}

/** The CV's search records, compiled from D1's rows as they stand. */
async function searchRecords(env: CvEnv) {
  const { renderBody, findWideDashes } = await loadPipeline();
  const page = await compileCvPage({ cv: await readCv(env), pipeline: { renderBody, findWideDashes } });
  if (!page.ok) throw new Error(`The CV page does not compile: ${page.errors.join("; ")}`);
  return recordsForPages([page.searchInput]);
}

/**
 * Rewrites the CV's search records from D1's rows. They depend on every file and on the papers the CV cites,
 * so the file save, sync_cv and a publication save all call it after they write.
 */
export async function refreshCvSearch(env: CvEnv) {
  const records = await searchRecords(env);
  await env.DB.batch(replaceSearchRecords(env.DB, contentPageSearchUid("/cv"), records));
}

export async function writeCvRow(env: CvEnv, compiled: Extract<Awaited<ReturnType<typeof compile>>, { ok: true }>) {
  await env.DB.prepare(
    `INSERT INTO cv (slug, type, record, source_path, source_blob_sha, synced_at)
     VALUES (?1, ?2, ?3, ?4, ?5, unixepoch())
     ON CONFLICT(slug) DO UPDATE SET type = excluded.type, record = excluded.record,
       source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha,
       synced_at = excluded.synced_at`,
  )
    .bind(compiled.record.slug, compiled.record.type, JSON.stringify(compiled.record), compiled.sourcePath, compiled.sourceBlobSha)
    .run();
}

/** The row of a file that is gone: the one removal sync_cv makes. */
export async function deleteCvRow(env: CvEnv, row: { slug: string }) {
  await env.DB.prepare(`DELETE FROM cv WHERE slug = ?1`).bind(row.slug).run();
}

/** True when D1's row for the file was compiled from exactly this file (the git blob sha matches). */
async function rowIsCurrent(env: CvEnv, slug: string, blobSha: string) {
  const row = await env.DB.prepare("SELECT source_blob_sha FROM cv WHERE slug = ?1").bind(slug).first<{ source_blob_sha: string | null }>();
  return row?.source_blob_sha === blobSha;
}

/** A credential that may not write is refused; the CV has no draft state, so there is no first-publication rule. */
function decide(actor: Actor) {
  if (!WRITE_CAPABILITIES[actor.kind].write) {
    throw new PolicyError("Refused: this credential is READ ONLY and may not save a CV file.", "smoke-is-read-only");
  }
}

/** The CV save. */
export async function saveCvFile(
  env: CvEnv,
  options: { slug: string; raw: string; expectedHeadSha: string | null; actor: Actor },
) {
  const { raw, actor } = options;
  const { slug, path } = registeredCvFile(options.slug);
  const existing = await readFile(env, path);
  if (!existing) throw new CvInvalid(slug, [`${path} is missing from the repository, so the CV file cannot be saved; restore it first`]);

  const compiled = await judge(env, slug, raw);
  if (!compiled.ok) throw new CvInvalid(slug, compiled.errors);
  decide(actor);

  const tag = actor.kind === "operator" ? ` [operator:${actor.id}]` : actor.kind === "carrel" ? ` [carrel:${actor.changeId}]` : "";
  // After the gate, so a file that fails validation is still refused even when it is unchanged.
  const written = await commitUnlessUnchanged(env, {
    existing,
    raw,
    rowIsCurrent: () => rowIsCurrent(env, slug, compiled.sourceBlobSha),
    commit: () =>
      commitFiles(env, {
        expectedHeadSha: options.expectedHeadSha,
        message: `Update CV: ${slug}${tag}`,
        changes: [{ path, content: raw }],
      }),
  });
  if (written.action === "noop") {
    return { slug, commitSha: written.commitSha, unchanged: true, note: UNCHANGED_NOTE, purged: null as PurgeOutcome };
  }
  const { commitSha, blobShas } = written;
  if (blobShas[path] && blobShas[path] !== compiled.sourceBlobSha) {
    throw new Error(
      `The CV file "${slug}" WAS committed as ${commitSha}, but the committed bytes (${blobShas[path]}) are not ` +
        `the bytes compiled (${compiled.sourceBlobSha}), so its row was not updated. Run the content sync to ` +
        `rebuild the row from the repository.`,
    );
  }

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      await writeCvRow(env, compiled);
      await refreshCvSearch(env);
      purged = await purgeCv(`save CV ${slug}`);
    },
    // Nothing kept in KV for the CV: the thrown error names the commit and the repair (the content sync), and
    // the next ship's sync converges the row from the repository anyway.
    recordDivergence: async () => undefined,
    slug,
    commitSha,
  });

  return { slug, commitSha, unchanged: written.action !== "commit", purged };
}
