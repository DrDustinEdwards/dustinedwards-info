// A dictionary entry's write path, run for the Carrel adapter (app/lib/carrel/dictionary-handler.server.ts):
// compile the file the way CI does (compile.mjs), refuse it with the validator's own messages if it fails,
// commit it unless it is unchanged (commitUnlessUnchanged), then write the derived stores, so the page changes
// on the next request with no build or deploy. The commit is never reverted when a derived write fails (hard
// rule 18): the error says the commit landed and how to repair it.
//
// A page's lead is drawn from this entry at request time, but its markdown twin and its search record carry
// the entry too, and those live in the page's own row. So a write refreshes that page row FIRST, through the
// page compile door, and the entry's own row LAST: the entry row's blob sha is what the drift check reads as
// "current", so a failure between the two leaves the entry reading stale and the repair re-runs both. The
// purge is the pages tag, because the page's HTML and its twin both embed the entry.

import { listDictionaryRows } from "~/db/dictionary";
import { ContentInvalid } from "~/lib/carrel/errors.server";
import { purgePages, type PurgeOutcome } from "~/lib/cache-purge.server";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import type { DictionaryEntry } from "~/lib/dictionary-entries.mjs";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { commitFiles, GitHubError, listDirectory, readFile } from "~/lib/editor/github.server";
import { decideFileWrite, type Actor } from "~/lib/editor/publish-policy.mjs";
import { commitUnlessUnchanged, UNCHANGED_NOTE } from "~/lib/editor/write-path.server";
import { pageSlug, pageSourcePath } from "~/lib/pages/compile.mjs";
import { compile as compilePageFile, writeRow as writePageRow } from "~/lib/pages/save.server";

import { compileDictionaryEntry, type DictionaryHost } from "./compile.mjs";
import { dictionaryPath, parseDictionaryEntry } from "./parse.mjs";

type DictionaryEnv = Env & { GITHUB_TOKEN?: string };

/** A file the validator refused: carries every message, so the caller can fix its own edit. */
export class DictionaryInvalid extends ContentInvalid {
  constructor(key: string, errors: string[]) {
    super(`The dictionary entry "${key}" was not saved: it fails ${errors.length} check(s). Nothing was committed.`, errors);
    this.name = "DictionaryInvalid";
  }
}

/** The repository's clips, asked of GitHub: existence and size, never the bytes, which are binary. */
function githubHost(env: DictionaryEnv): DictionaryHost {
  return {
    async audio(sitePath) {
      const at = sitePath.lastIndexOf("/");
      const dir = `public${sitePath.slice(0, at)}`;
      const name = sitePath.slice(at + 1);
      try {
        const entry = (await listDirectory(env, dir)).find((e) => e.type === "file" && e.name === name);
        return entry ? { size: entry.size } : null;
      } catch (error) {
        if (error instanceof GitHubError && error.status === 404) return null;
        throw error;
      }
    },
  };
}

/** Every other entry's key and path, from D1: CI re-checks the whole set on the commit this makes. */
async function otherEntries(env: DictionaryEnv, key: string) {
  return (await listDictionaryRows(env)).filter((row) => row.key !== key).map(({ key: other, path }) => ({ key: other, path }));
}

/** The one compile door: the save, sync_dictionary and the reads all go through it. */
export async function compile(env: DictionaryEnv, key: string, raw: string) {
  const { findWideDashes } = await loadPipeline();
  return compileDictionaryEntry({ key, raw, pipeline: { findWideDashes }, host: githubHost(env), others: await otherEntries(env, key) });
}

type Compiled = Extract<Awaited<ReturnType<typeof compile>>, { ok: true }>;

/** Whether a stored file is a draft, read from the file itself, the only authority. */
export function fileIsDraft(raw: string) {
  return parseDictionaryEntry({ file: "", raw }).data.draft === true;
}

/** The file, as the operator's get_dictionary reads it: raw, the entry when it compiles, every error when not. */
export async function readDictionary(env: DictionaryEnv, key: string) {
  const file = await readFile(env, dictionaryPath(key));
  if (!file) return null;
  const compiled = await compile(env, key, file.content);
  return {
    key,
    raw: file.content,
    draft: compiled.ok ? compiled.draft : fileIsDraft(file.content),
    entry: compiled.ok ? compiled.entry : null,
    errors: compiled.ok ? [] : compiled.errors,
  };
}

/**
 * Re-derives the page an entry opens: its twin and its search records, compiled from the page's file with
 * `entry` (null for none) in place of whatever D1 holds. A page with no file has nothing derived to refresh. A
 * page whose file no longer compiles is an error, never skipped: the entry would otherwise read as converged
 * while the page's twin is stale.
 */
async function refreshPage(env: DictionaryEnv, path: string, entry: DictionaryEntry | null) {
  const slug = pageSlug(path);
  const file = await readFile(env, pageSourcePath(slug));
  if (!file) return;
  const compiled = await compilePageFile(env, slug, file.content, entry);
  if (!compiled.ok) {
    throw new Error(`the page ${path} does not compile, so its twin and search record were not refreshed: ${compiled.errors.join("; ")}`);
  }
  await writePageRow(env, compiled);
}

/** The entry's D1 row alone: the derived store the page reads its lead and JSON-LD from. */
async function writeEntryRow(env: DictionaryEnv, compiled: Compiled) {
  await env.DB.prepare(
    `INSERT INTO dictionary_entries (key, path, term, status, record, source_path, source_blob_sha, synced_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, unixepoch())
     ON CONFLICT(key) DO UPDATE SET path = excluded.path, term = excluded.term, status = excluded.status,
       record = excluded.record, source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha,
       synced_at = excluded.synced_at`,
  )
    .bind(
      compiled.key,
      compiled.entry.path,
      compiled.entry.term,
      compiled.draft ? "draft" : "published",
      JSON.stringify(compiled.entry),
      compiled.sourcePath,
      compiled.sourceBlobSha,
    )
    .run();
}

/**
 * Every derived store an entry feeds: its page's row first, then its own (see the header). Shared by the save
 * and sync_dictionary, so a repair writes what a save writes.
 */
export async function writeRow(env: DictionaryEnv, compiled: Compiled) {
  await refreshPage(env, compiled.entry.path, compiled.draft ? null : compiled.entry);
  await writeEntryRow(env, compiled);
}

/** An entry whose file is gone: its page loses the lead first, then its row goes (the row is the drift marker). */
export async function deleteRow(env: DictionaryEnv, row: { key: string; path: string }) {
  await refreshPage(env, row.path, null);
  await env.DB.prepare(`DELETE FROM dictionary_entries WHERE key = ?1`).bind(row.key).run();
}

/** True when D1's row for the entry was compiled from exactly this file (the git blob sha matches). */
async function rowIsCurrent(env: DictionaryEnv, key: string, blobSha: string) {
  const row = await env.DB.prepare("SELECT source_blob_sha FROM dictionary_entries WHERE key = ?1")
    .bind(key)
    .first<{ source_blob_sha: string | null }>();
  return row?.source_blob_sha === blobSha;
}

export type SavedDictionaryEntry = {
  key: string;
  commitSha: string;
  unchanged: boolean;
  created: boolean;
  draft: boolean;
  purged: PurgeOutcome;
  note?: string;
};

/** validate -> policy -> commitUnlessUnchanged -> blob verify -> derived writes (convergeWithRetry) -> purge by tag. */
export async function saveDictionaryEntry(
  env: DictionaryEnv,
  options: { key: string; raw: string; expectedHeadSha: string | null; isNew: boolean; actor: Actor },
): Promise<SavedDictionaryEntry> {
  const { key, raw, actor } = options;
  const path = dictionaryPath(key);
  const existing = await readFile(env, path);
  if (options.isNew && existing) throw new DictionaryInvalid(key, [`a dictionary entry named ${key} already exists`]);
  if (!options.isNew && !existing) throw new DictionaryInvalid(key, [`no dictionary entry named ${key} exists; pass isNew to create it`]);

  const compiled = await compile(env, key, raw);
  if (!compiled.ok) throw new DictionaryInvalid(key, compiled.errors);
  decideFileWrite({
    actor,
    noun: "dictionary entry",
    incomingDraft: compiled.draft,
    priorRaw: existing?.content ?? null,
    isDraft: fileIsDraft,
  });

  const tag = actor.kind === "operator" ? ` [operator:${actor.id}]` : actor.kind === "carrel" ? ` [carrel:${actor.changeId}]` : "";
  // After the gate, so a file that fails validation is still refused even when it is unchanged.
  const written = await commitUnlessUnchanged(env, {
    existing,
    raw,
    rowIsCurrent: () => rowIsCurrent(env, key, compiled.sourceBlobSha),
    commit: () =>
      commitFiles(env, {
        expectedHeadSha: options.expectedHeadSha,
        message: `${options.isNew ? "Add" : "Update"} dictionary entry: ${compiled.entry.term}${tag}`,
        changes: [{ path, content: raw }],
      }),
  });
  if (written.action === "noop") {
    return { key, commitSha: written.commitSha, unchanged: true, created: false, draft: compiled.draft, purged: null, note: UNCHANGED_NOTE };
  }
  const { commitSha } = written;
  const blobSha = written.blobShas[path];
  if (blobSha && blobSha !== compiled.sourceBlobSha) {
    throw new Error(
      `The dictionary entry "${key}" WAS committed as ${commitSha}, but the committed bytes (${blobSha}) are not ` +
        `the bytes compiled (${compiled.sourceBlobSha}), so its page was not updated. Run the content sync to ` +
        `rebuild the row from the repository.`,
    );
  }

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      await writeRow(env, compiled);
      // The pages tag: the page's HTML embeds the lead and its twin embeds the entry, and both carry it.
      purged = await purgePages(`save dictionary entry ${key}`);
    },
    // Nothing kept in KV for an entry: the thrown error names the commit and the repair (the content sync),
    // and the next ship's sync converges the rows from the repository anyway.
    recordDivergence: async () => undefined,
    slug: key,
    commitSha,
  });

  return {
    key,
    commitSha,
    unchanged: written.action === "repair",
    created: options.isNew,
    draft: compiled.draft,
    purged,
  };
}
