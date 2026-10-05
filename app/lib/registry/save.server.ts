// The one registry save, called by the site-api adapter for Carrel (app/lib/carrel/registry-handler.server.ts), and
// the read the operator's get_registry tool answers. A save compiles the file the way CI does (compile.mjs), refuses
// it with every message if it fails, commits it to the repository (unless it is byte-identical,
// commitUnlessUnchanged), then writes its D1 row, so the registry changes on the next request with no build or
// deploy. The commit is never reverted when a derived write fails (hard rule 18): the error says the commit landed
// and how to repair it (sync_registry).
//
// Nothing else is derived from a registry row yet, so a write is one statement: the item's own row, whose blob sha
// is what the registry-drift check reads as current. The purge is the registry's tag.

import matter from "gray-matter";

import { listRegistry } from "~/db/registry";
import { ContentInvalid } from "~/lib/carrel/errors.server";
import { purgeRegistry, type PurgeOutcome } from "~/lib/cache-purge.server";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { blobGuard, commitFiles, readFile } from "~/lib/editor/github.server";
import { decideFileWrite, type Actor } from "~/lib/editor/publish-policy.mjs";
import { commitUnlessUnchanged, UNCHANGED_NOTE } from "~/lib/editor/write-path.server";
import { refreshProceduresNaming } from "~/lib/procedures/primer-dependents.server";
import { recordsForPapers } from "~/lib/search/records.mjs";

import {
  parseRegistrySlug,
  registryPath,
  registrySetErrors,
  registrySlug,
  type RegistryItem,
} from "./compile.mjs";
import { compile } from "./host.server";
import { KINDS, type KindSpec } from "./kinds.mjs";
import { registrySearchInput, registrySearchUid } from "./search-inputs.mjs";

type RegistryEnv = Env & { GITHUB_TOKEN?: string };
type Kinds = Readonly<Record<string, KindSpec>>;

/** A file the validator refused: carries every message, so the caller can fix its own edit. */
export class RegistryInvalid extends ContentInvalid {
  constructor(slug: string, errors: string[]) {
    super(`The registry item "${slug}" was not saved: it fails ${errors.length} check(s). Nothing was committed.`, errors);
    this.name = "RegistryInvalid";
  }
}

/** The one compile door (host.server.ts): the save, get_registry and sync_registry all read a file through it. */
export { compile };

type Compiled = Extract<Awaited<ReturnType<typeof compile>>, { ok: true }>;

/** The address of a slug, or a refusal: nothing but `<kind>/<id>` in the allowed shapes names a registry file. */
function registered(slug: string, kinds: Kinds) {
  const address = parseRegistrySlug(slug);
  if (!address) {
    throw new RegistryInvalid(slug, [`"${slug}" is not a registry address; it is <kind>/<id>, in lower-case letters, digits and hyphens`]);
  }
  if (!kinds[address.kind]) {
    throw new RegistryInvalid(slug, [`"${address.kind}" is not a registry kind; the kinds are ${Object.keys(kinds).join(", ") || "none yet"}`]);
  }
  return { ...address, slug, file: registryPath(slug) };
}

/** The item the committed file holds, judged by the same validator, for get_registry. */
export async function readRegistryItem(env: RegistryEnv, slug: string, kinds: Kinds = KINDS) {
  const { file } = registered(slug, kinds);
  const existing = await readFile(env, file);
  if (!existing) return null;
  const compiled = await compile(env, slug, existing.content, kinds);
  return {
    slug,
    path: file,
    raw: existing.content,
    item: compiled.ok ? compiled.item : null,
    gaps: compiled.ok ? compiled.gaps : [],
    errors: compiled.ok ? [] : compiled.errors,
  };
}

/** Every other item, from D1: CI re-checks the whole set on the commit a save makes. */
async function otherItems(env: RegistryEnv, slug: string): Promise<RegistryItem[]> {
  return (await listRegistry(env)).filter((item) => registrySlug(item.kind, item.id) !== slug);
}

/** The statements that rebuild the two full-text indexes after a change to search_docs, as every kind's write does. */
function rebuildStatements(db: D1Database) {
  return [
    db.prepare(`INSERT INTO search_identity (search_identity) VALUES ('rebuild')`),
    db.prepare(`INSERT INTO search_prose (search_prose) VALUES ('rebuild')`),
  ];
}

/**
 * The item's D1 row, the derived store the drift check reads, and its search record (search-inputs.mjs), in one batch so
 * they move together: a search for a primer's sequence finds the primer's own page as well as the protocols that use it. A
 * draft has a row and no record.
 */
export async function writeRegistryRow(env: RegistryEnv, compiled: Compiled) {
  const { item } = compiled;
  const db = env.DB;
  const input = registrySearchInput(item);
  const records = item.status === "draft" || !input ? [] : recordsForPapers([input]);
  await db.batch([
    db
      .prepare(
        `INSERT INTO registry (kind, id, name, status, record, source_path, source_blob_sha, synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, unixepoch())
         ON CONFLICT(kind, id) DO UPDATE SET name = excluded.name, status = excluded.status, record = excluded.record,
           source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha,
           synced_at = excluded.synced_at`,
      )
      .bind(item.kind, item.id, item.name, item.status, compiled.record, compiled.sourcePath, compiled.sourceBlobSha),
    db.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(registrySearchUid(item.kind, item.id)),
    ...records.map((r) =>
      db
        .prepare(
          `INSERT INTO search_docs (uid, url, type, title, body, tags, doc_tags, doc_uid,
             doc_title, doc_url, anchor, ordinal, status, publish_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
        )
        .bind(r.uid, r.url, r.type, r.title, r.body, r.tags, r.docTags, r.docUid, r.docTitle, r.docUrl, r.anchor, r.ordinal, r.status, null),
    ),
    ...rebuildStatements(db),
  ]);
}

/** An item whose file is gone: its row and its search record go (the row is the drift marker). */
export async function deleteRegistryRow(env: RegistryEnv, row: { slug: string }) {
  const address = parseRegistrySlug(row.slug);
  if (!address) throw new Error(`"${row.slug}" is not a registry address, so its row cannot be named`);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM registry WHERE kind = ?1 AND id = ?2`).bind(address.kind, address.id),
    env.DB.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(registrySearchUid(address.kind, address.id)),
    ...rebuildStatements(env.DB),
  ]);
}

/** True when D1's row for the item was compiled from exactly this file (the git blob sha matches). */
async function rowIsCurrent(env: RegistryEnv, kind: string, id: string, blobSha: string) {
  const row = await env.DB.prepare("SELECT source_blob_sha FROM registry WHERE kind = ?1 AND id = ?2")
    .bind(kind, id)
    .first<{ source_blob_sha: string | null }>();
  return row?.source_blob_sha === blobSha;
}

export type SavedRegistryItem = {
  slug: string;
  commitSha: string;
  /** The git blob sha of the committed file: Carrel's version of the item. */
  sourceBlobSha: string;
  unchanged: boolean;
  created: boolean;
  purged: PurgeOutcome;
  note?: string;
};

/** validate -> policy -> commitUnlessUnchanged -> blob verify -> derived write (convergeWithRetry) -> purge by tag. */
export async function saveRegistryItem(
  env: RegistryEnv,
  options: {
    slug: string;
    raw: string;
    expectedHeadSha?: string | null;
    /** The blob sha of this file as Carrel loaded it; undefined means no check. */
    expectedBlobSha?: string | null;
    isNew: boolean;
    actor: Actor;
    /** The kinds to judge by; the registry's own unless a test brings its own. */
    kinds?: Kinds;
  },
): Promise<SavedRegistryItem> {
  const { raw, actor } = options;
  const kinds = options.kinds ?? KINDS;
  const { kind, id, slug, file } = registered(options.slug, kinds);
  const existing = await readFile(env, file);
  if (options.isNew && existing) throw new RegistryInvalid(slug, [`the item ${slug} already has a file (${file}); pass isNew false to edit it`]);
  if (!options.isNew && !existing) throw new RegistryInvalid(slug, [`the item ${slug} has no file yet; pass isNew to create it`]);

  const compiled = await compile(env, slug, raw, kinds);
  if (!compiled.ok) throw new RegistryInvalid(slug, compiled.errors);
  // The set as it will stand: this item against every other, so a name two items of a kind claim is refused here.
  const setErrors = registrySetErrors([...(await otherItems(env, slug)), compiled.item], kinds);
  if (setErrors.length > 0) throw new RegistryInvalid(slug, setErrors);
  const isDraft = (text: string) => matter(text, {}).data.draft === true;
  decideFileWrite({ actor, noun: kinds[kind]?.singular ?? "registry item", incomingDraft: compiled.item.status === "draft", priorRaw: existing?.content ?? null, isDraft });

  const tag = actor.kind === "operator" ? ` [operator:${actor.id}]` : actor.kind === "carrel" ? ` [carrel:${actor.changeId}]` : "";
  // After the gate, so a file that fails validation is still refused even when it is unchanged.
  const written = await commitUnlessUnchanged(env, {
    existing,
    raw,
    rowIsCurrent: () => rowIsCurrent(env, kind, id, compiled.sourceBlobSha),
    commit: () =>
      commitFiles(env, {
        expectedHeadSha: options.expectedHeadSha,
        expectedBlobs: blobGuard(file, options.expectedBlobSha),
        message: `${options.isNew ? "Add" : "Update"} ${kinds[kind]?.singular ?? "registry item"}: ${compiled.item.name}${tag}`,
        changes: [{ path: file, content: raw }],
      }),
  });
  if (written.action === "noop") {
    return { slug, commitSha: written.commitSha, sourceBlobSha: compiled.sourceBlobSha, unchanged: true, created: false, purged: null, note: UNCHANGED_NOTE };
  }
  const { commitSha } = written;
  const blobSha = written.blobShas[file];
  if (blobSha && blobSha !== compiled.sourceBlobSha) {
    throw new Error(
      `The registry item "${slug}" WAS committed as ${commitSha}, but the committed bytes (${blobSha}) are not ` +
        `the bytes compiled (${compiled.sourceBlobSha}), so its row was not updated. Run sync_registry to ` +
        `rebuild the row from the repository.`,
    );
  }

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      await writeRegistryRow(env, compiled);
      // The protocols that print this primer carry its facts in their record, so they are recompiled from their files.
      if (kind === "primer" || kind === "strain") await refreshProceduresNaming(env, [id], [kind]);
      purged = await purgeRegistry(`save registry item ${slug}`);
    },
    // Nothing kept in KV for an item: the thrown error names the commit and the repair (sync_registry), and the
    // next ship's sync converges the rows from the repository anyway.
    recordDivergence: async () => undefined,
    slug,
    commitSha,
  });

  return { slug, commitSha, sourceBlobSha: compiled.sourceBlobSha, unchanged: written.action === "repair", created: options.isNew, purged };
}
