// The operator API's procedure tools: read a procedure as its file and as structured data, and save an
// edited file. A save compiles the file the way CI does (compile.mjs), refuses it with the validator's
// own messages if it fails, commits it to the repository, then writes its D1 row and search records, so
// the page changes on the next request with no build or deploy. The commit is never reverted when the
// D1 write fails (hard rule 18); the error says the commit landed and how to repair the row.

import { purgeProcedures, type PurgeOutcome } from "~/lib/cache-purge.server";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { commitFiles, readFile } from "~/lib/editor/github.server";
import { makeResolveImage } from "~/lib/editor/publish.server";
import { PolicyError, WRITE_CAPABILITIES, type Actor } from "~/lib/editor/publish-policy.mjs";
import { recordsForPages } from "~/lib/search/records.mjs";

import { compileProcedure } from "./compile.mjs";
import { parseProcedure, procedurePath } from "./parse.mjs";

type ProcedureEnv = Env & { GITHUB_TOKEN?: string };

/** A file the validator refused: 422, with every message, so the caller can fix its own edit. */
export class ProcedureInvalid extends Error {
  errors: string[];
  constructor(slug: string, errors: string[]) {
    super(`The procedure "${slug}" was not saved: it fails ${errors.length} check(s). Nothing was committed.`);
    this.name = "ProcedureInvalid";
    this.errors = errors;
  }
}

async function compile(env: ProcedureEnv, slug: string, raw: string) {
  const { renderBody, findWideDashes } = await loadPipeline();
  return compileProcedure({ slug, raw, pipeline: { renderBody, findWideDashes }, resolveImage: makeResolveImage(env) });
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
  const may = WRITE_CAPABILITIES[actor.kind];
  if (!may.write) {
    throw new PolicyError("Refused: this credential is READ ONLY and may not save a procedure.", "smoke-is-read-only");
  }
  const everPublished = prior !== null && parseProcedure({ file: "", raw: prior }).data.draft !== true;
  if (!may.firstPublish && !incomingDraft && !everPublished) {
    throw new PolicyError(
      "Refused: publishing a procedure for the first time is reserved to the human admin. Save it with " +
        "draft: true, and ask Dustin to publish it.",
      "first-publish-requires-admin",
    );
  }
}

async function writeRow(env: ProcedureEnv, compiled: Extract<Awaited<ReturnType<typeof compile>>, { ok: true }>) {
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
}

/** save_procedure. */
export async function saveProcedure(
  env: ProcedureEnv,
  options: { slug: string; raw: string; expectedHeadSha: string | null; isNew: boolean; actor: Actor },
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
  const { commitSha, blobShas } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    message: `${options.isNew ? "Add" : "Update"} procedure: ${compiled.record.title}${tag}`,
    changes: [{ path, content: raw }],
  });
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
    created: options.isNew,
    draft: compiled.record.draft,
    gaps: compiled.gaps,
    purged,
  };
}
