// The operator API's procedure tools: read a procedure as its file and as structured data, and save an
// edited file. A save compiles the file the way CI does (compile.mjs), refuses it with the validator's
// own messages if it fails, commits it to the repository, then writes its D1 row and search records, so
// the page changes on the next request with no build or deploy. The commit is never reverted when the
// D1 write fails (hard rule 18); the error says the commit landed and how to repair the row.

import { ContentInvalid } from "~/lib/carrel/errors.server";
import { purgeProcedures, type PurgeOutcome } from "~/lib/cache-purge.server";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { blobGuard, commitFiles, readFile } from "~/lib/editor/github.server";
import { makeResolveImage } from "~/lib/editor/publish.server";
import { commitUnlessUnchanged, UNCHANGED_NOTE } from "~/lib/editor/write-path.server";
import { decideFileWrite, type Actor } from "~/lib/editor/publish-policy.mjs";
import { recordsForPages } from "~/lib/search/records.mjs";

import { freezeStatement, frozenBlobSha } from "~/db/procedure-versions";

import { needsFreeze, versionPath } from "./cite.mjs";
import { compileProcedure } from "./compile.mjs";
import { parseProcedure, procedurePath } from "./parse.mjs";
import { procedureSearchUid } from "./render.mjs";

type ProcedureEnv = Env & { GITHUB_TOKEN?: string };
/** A file the validator refused: 422, with every message, so the caller can fix its own edit. */
export class ProcedureInvalid extends ContentInvalid {
  constructor(slug: string, errors: string[]) {
    super(`The procedure "${slug}" was not saved: it fails ${errors.length} check(s). Nothing was committed.`, errors);
    this.name = "ProcedureInvalid";
  }
}

/**
 * The one compile door: save_procedure, get_procedure and sync_procedures all read a file through it. A file that
 * changes the words of a version already frozen does not compile here, so a save is refused before it commits, a
 * sync names the file and converges the rest, and get_procedure shows the error; the frozen copy is never touched.
 */
export async function compile(env: ProcedureEnv, slug: string, raw: string) {
  const { renderBody, findWideDashes } = await loadPipeline();
  const compiled = await compileProcedure({ slug, raw, pipeline: { renderBody, findWideDashes }, resolveImage: makeResolveImage(env) });
  if (!compiled.ok || !needsFreeze(compiled.record)) return compiled;
  const frozen = await frozenBlobSha(env, slug, String(compiled.record.version));
  if (frozen === null || frozen === compiled.sourceBlobSha) return compiled;
  return { ok: false as const, errors: [frozenEditMessage(compiled.record)], gaps: compiled.gaps };
}

/** get_procedure: the file, its structure as parsed, and the gaps it records. */
export async function readProcedure(env: ProcedureEnv, slug: string) {
  const file = await readFile(env, procedurePath(slug));
  if (!file) return null;
  const parsed = parseProcedure({ file: procedurePath(slug), raw: file.content });
  const compiled = await compile(env, slug, file.content);
  return {
    slug,
    path: typeof parsed.data.path === "string" ? parsed.data.path : null,
    raw: file.content,
    draft: parsed.data.draft === true,
    record: { data: parsed.data, intro: parsed.intro, sections: parsed.sections },
    gaps: compiled.gaps,
    errors: compiled.ok ? [] : compiled.errors,
  };
}

/**
 * An operator may edit, unpublish and republish a procedure, never publish one for the first time:
 * the same rule as posts (ruling 37), read from the prior FILE, the only authority.
 */
function decideProcedure(actor: Actor, incomingDraft: boolean, prior: string | null) {
  decideFileWrite({
    actor,
    noun: "procedure",
    incomingDraft,
    priorRaw: prior,
    isDraft: (raw) => parseProcedure({ file: "", raw }).data.draft === true,
  });
}

/**
 * What a refused or flagged edit to a frozen version says: the words of a published version never change, so a
 * correction is a new version with a history entry that says what changed.
 */
function frozenEditMessage(record: { version: string | null; path: string }) {
  return (
    `Version ${record.version} is already published and frozen at ${versionPath(record.path, String(record.version))}, so its words cannot change. ` +
    `Set a new version in the file and add a history entry that says what changed.`
  );
}

/**
 * The one write door for a procedure's row and search records: a save and the sync both end here. A published
 * procedure with a version is also frozen, in the same batch: the copy is written once and the database refuses to
 * change it. `compile` has already refused a file that would change a frozen version, so the check after the batch
 * is the last line of defence: it fails loudly if the sealed copy is not made from this file.
 */
export async function writeRow(env: ProcedureEnv, compiled: Extract<Awaited<ReturnType<typeof compile>>, { ok: true }>) {
  const db = env.DB;
  const r = compiled.record;
  const uid = compiled.searchInput.uid;
  const records = r.draft ? [] : recordsForPages([compiled.searchInput]);
  await db.batch([
    db
      .prepare(
        `INSERT INTO procedures (slug, path, profile, title, description, status, version, updated, record,
           markdown, source_path, source_blob_sha, synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, unixepoch())
         ON CONFLICT(slug) DO UPDATE SET path = excluded.path, profile = excluded.profile,
           title = excluded.title, description = excluded.description, status = excluded.status,
           version = excluded.version, updated = excluded.updated, record = excluded.record,
           markdown = excluded.markdown, source_path = excluded.source_path,
           source_blob_sha = excluded.source_blob_sha, synced_at = excluded.synced_at`,
      )
      .bind(
        r.slug,
        r.path,
        r.profile,
        r.title,
        r.description,
        r.draft ? "draft" : "published",
        r.version,
        r.updated,
        JSON.stringify(r),
        compiled.markdown,
        compiled.sourcePath,
        compiled.sourceBlobSha,
      ),
    ...(needsFreeze(r)
      ? [
          freezeStatement(db, {
            slug: r.slug,
            version: String(r.version),
            path: r.path,
            profile: r.profile,
            record: JSON.stringify(r),
            markdown: compiled.markdown,
            sourceBlobSha: compiled.sourceBlobSha,
          }),
        ]
      : []),
    db.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(uid),
    ...records.map((s) =>
      db
        .prepare(
          `INSERT INTO search_docs (uid, url, type, title, body, tags, doc_tags, doc_uid,
             doc_title, doc_url, anchor, ordinal, status, publish_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
        )
        .bind(s.uid, s.url, s.type, s.title, s.body, s.tags, s.docTags, s.docUid, s.docTitle, s.docUrl, s.anchor, s.ordinal, s.status, null),
    ),
    db.prepare(`INSERT INTO search_identity (search_identity) VALUES ('rebuild')`),
    db.prepare(`INSERT INTO search_prose (search_prose) VALUES ('rebuild')`),
  ]);
  if (needsFreeze(r)) {
    const frozen = await frozenBlobSha(env, r.slug, String(r.version));
    if (frozen !== compiled.sourceBlobSha) {
      throw new Error(
        `The frozen copy of version ${r.version} is not made from this file. ${frozenEditMessage(r)}`,
      );
    }
  }
}

/**
 * Removes a row whose file is gone, with its search records. The search uid is derived from the row's
 * own path by the function the search input uses, so the two cannot disagree.
 */
export async function deleteProcedureRow(env: ProcedureEnv, row: { slug: string; path: string }) {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM procedures WHERE slug = ?1`).bind(row.slug),
    env.DB.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(procedureSearchUid(row.path)),
    env.DB.prepare(`INSERT INTO search_identity (search_identity) VALUES ('rebuild')`),
    env.DB.prepare(`INSERT INTO search_prose (search_prose) VALUES ('rebuild')`),
  ]);
}

/** True when D1's row for the procedure was compiled from exactly this file (the git blob sha matches). */
async function rowIsCurrent(env: ProcedureEnv, slug: string, blobSha: string) {
  const row = await env.DB.prepare("SELECT status, version, source_blob_sha FROM procedures WHERE slug = ?1")
    .bind(slug)
    .first<{ status: string; version: string | null; source_blob_sha: string | null }>();
  if (row?.source_blob_sha !== blobSha) return false;
  // A published version with no frozen copy yet is not current: the save that writes the row freezes it.
  if (row.status === "published" && row.version) return (await frozenBlobSha(env, slug, row.version)) !== null;
  return true;
}

/** save_procedure. */
export async function saveProcedure(
  env: ProcedureEnv,
  options: { slug: string; raw: string; expectedHeadSha?: string | null;
    /** The blob sha of this file as Carrel loaded it; undefined means no check. */
    expectedBlobSha?: string | null; isNew: boolean; actor: Actor },
) {
  const { slug, raw, actor } = options;
  const path = procedurePath(slug);
  const existing = await readFile(env, path);
  if (options.isNew && existing) throw new ProcedureInvalid(slug, [`a procedure named ${slug} already exists`]);
  if (!options.isNew && !existing) throw new ProcedureInvalid(slug, [`no procedure named ${slug} exists; pass isNew to create it`]);

  const compiled = await compile(env, slug, raw);
  if (!compiled.ok) throw new ProcedureInvalid(slug, compiled.errors);
  decideProcedure(actor, compiled.record.draft, existing?.content ?? null);

  const tag = actor.kind === "operator" ? ` [operator:${actor.id}]` : actor.kind === "carrel" ? ` [carrel:${actor.changeId}]` : "";
  // After the gate, so a file that fails validation is still refused even when it is unchanged.
  const written = await commitUnlessUnchanged(env, {
    existing,
    raw,
    rowIsCurrent: () => rowIsCurrent(env, slug, compiled.sourceBlobSha),
    commit: () =>
      commitFiles(env, {
        expectedHeadSha: options.expectedHeadSha,
        expectedBlobs: blobGuard(path, options.expectedBlobSha),
        message: `${options.isNew ? "Add" : "Update"} procedure: ${compiled.record.title}${tag}`,
        changes: [{ path, content: raw }],
      }),
  });
  const unchanged = written.action !== "commit";
  if (written.action === "noop") {
    return {
      slug,
      path: compiled.record.path,
      commitSha: written.commitSha,
      sourceBlobSha: compiled.sourceBlobSha,
      unchanged: true,
      note: UNCHANGED_NOTE,
      created: false,
      draft: compiled.record.draft,
      gaps: compiled.gaps,
      purged: null as PurgeOutcome,
    };
  }
  const { commitSha, blobShas } = written;
  if (blobShas[path] && blobShas[path] !== compiled.sourceBlobSha) {
    throw new Error(
      `The procedure "${slug}" WAS committed as ${commitSha}, but the committed bytes (${blobShas[path]}) are not ` +
        `the bytes compiled (${compiled.sourceBlobSha}), so its page was not updated. Run the content sync to ` +
        `rebuild the row from the repository.`,
    );
  }

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      await writeRow(env, compiled);
      purged = await purgeProcedures(`save_procedure ${slug}`);
    },
    // Nothing kept in KV for a procedure: the thrown error names the commit and the repair (the content
    // sync), and the next ship's sync converges the row from the repository anyway.
    recordDivergence: async () => undefined,
    slug,
    commitSha,
  });

  return {
    slug,
    path: compiled.record.path,
    commitSha,
    sourceBlobSha: compiled.sourceBlobSha,
    unchanged,
    created: options.isNew,
    draft: compiled.record.draft,
    gaps: compiled.gaps,
    purged,
  };
}
