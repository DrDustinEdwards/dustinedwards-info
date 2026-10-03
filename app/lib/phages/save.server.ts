// The one phage save, called by the site-api adapter for Carrel (app/lib/carrel/phage-handler.server.ts), and
// the read the operator's get_phage tool answers. The phage table is edited through Carrel and nothing else:
// there is no save tool and no admin editor. A save compiles the file the way CI does (compile.mjs), refuses
// it with every message if it fails, commits it to the repository (unless it is byte-identical,
// commitUnlessUnchanged), then writes its D1 row and re-derives the page that is drawn from the rows, so the
// table changes on the next request with no build or deploy. The commit is never reverted when a derived write
// fails (hard rule 18): the error says the commit landed and how to repair it.
//
// /research/phages is compiled from these rows (its table, its sections, its twin, its search records), and
// those live in the page's own row. So a write refreshes that page row FIRST, through the page compile door,
// and the phage's own row LAST: the phage row's blob sha is what the drift check reads as "current", so a
// failure between the two leaves the phage reading stale and the repair re-runs both. The purge is the pages
// tag, because the page's HTML and its twin both embed the table.

import { listPhages } from "~/db/phages";
import { ContentInvalid } from "~/lib/carrel/errors.server";
import { purgePhages, type PurgeOutcome } from "~/lib/cache-purge.server";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { commitFiles, readFile } from "~/lib/editor/github.server";
import { decideFileWrite, type Actor } from "~/lib/editor/publish-policy.mjs";
import { commitUnlessUnchanged, UNCHANGED_NOTE } from "~/lib/editor/write-path.server";
import { pageSlug, pageSourcePath } from "~/lib/pages/compile.mjs";
import { PUBLICATIONS_DIR } from "~/lib/publications/parse.mjs";
import { compile as compilePageFile, writeRow as writePageRow } from "~/lib/pages/save.server";

import { PHAGES_PAGE_PATH, PHAGE_FACT_PAGES, compilePhage, phagePath, phageSetErrors, phageSlug, sortPhages, type Phage, type PhageHost } from "./compile.mjs";

type PhageEnv = Env & { GITHUB_TOKEN?: string };

/** A phage's file key is its name in lower case, which is also what keeps an id from naming any other path. */
export const PHAGE_SLUG = /^[a-z][a-z0-9]*$/;

/** A file the validator refused: carries every message, so the caller can fix its own edit. */
export class PhageInvalid extends ContentInvalid {
  constructor(slug: string, errors: string[]) {
    super(`The phage "${slug}" was not saved: it fails ${errors.length} check(s). Nothing was committed.`, errors);
    this.name = "PhageInvalid";
  }
}

/**
 * The papers the site holds, asked of the repository, which is what CI asks too: a genome announcement is a paper
 * this site has a file, and so a page, for. Asking the repository rather than D1 keeps a phage save and a
 * sync_phages independent of whether the publications have been synced yet.
 */
function githubHost(env: PhageEnv): PhageHost {
  return { paper: async (slug) => (await readFile(env, `${PUBLICATIONS_DIR}/${slug}.md`)) !== null };
}

/** The one compile door: the save, get_phage and sync_phages all read a file through it. */
export async function compile(env: PhageEnv, slug: string, raw: string) {
  const { findWideDashes } = await loadPipeline();
  return compilePhage({ slug, raw, host: githubHost(env), pipeline: { findWideDashes } });
}

type Compiled = Extract<Awaited<ReturnType<typeof compile>>, { ok: true }>;

/** The slug of an id, or a refusal: nothing but a lower-case name names a phage file. */
function registered(slug: string) {
  if (!PHAGE_SLUG.test(slug)) {
    throw new PhageInvalid(slug, [`"${slug}" is not a phage file key; a phage's file is named for its name in lower case, such as acorn15`]);
  }
  return { slug, file: phagePath(slug) };
}

/** The phage the committed file holds, judged by the same validator, for get_phage. */
export async function readPhage(env: PhageEnv, slug: string) {
  const { file } = registered(slug);
  const existing = await readFile(env, file);
  if (!existing) return null;
  const compiled = await compile(env, slug, existing.content);
  return { slug, path: file, raw: existing.content, phage: compiled.ok ? compiled.phage : null, errors: compiled.ok ? [] : compiled.errors };
}

/** Every other phage's row, from D1: CI re-checks the whole set on the commit a save makes. */
async function otherPhages(env: PhageEnv, slug: string) {
  return (await listPhages(env)).filter((phage) => phageSlug(phage.name) !== slug);
}

/**
 * Re-derives the page the table is drawn into: its HTML, twin and search records, compiled from the page's file
 * with `phages` in place of whatever D1 holds. A page with no file has nothing derived to refresh, and that is an
 * error here: the table has nowhere to be drawn. A page whose file no longer compiles is an error too, never
 * skipped: the phage would otherwise read as converged while the page is stale.
 */
export async function refreshPage(env: PhageEnv, phages: Phage[]) {
  // The table's page, then every page that states a phage fact by token ({{phages.count}}): each is derived from
  // the same rows, so a phage write leaves none of them stale.
  for (const path of [PHAGES_PAGE_PATH, ...PHAGE_FACT_PAGES]) {
    const slug = pageSlug(path);
    const file = await readFile(env, pageSourcePath(slug));
    if (!file) throw new Error(`the page ${path} has no file (${pageSourcePath(slug)}), so what it draws from the phages has nowhere to be drawn`);
    const compiled = await compilePageFile(env, slug, file.content, undefined, sortPhages(phages));
    if (!compiled.ok) {
      throw new Error(`the page ${path} does not compile with these phages, so its table, twin and search record were not refreshed: ${compiled.errors.join("; ")}`);
    }
    await writePageRow(env, compiled);
  }
}

/** The phage's D1 row alone: the derived store the drift check reads. One row, in one statement. */
export async function writePhageRow(env: PhageEnv, compiled: Compiled) {
  const phage: Phage = compiled.phage;
  await env.DB.prepare(
    `INSERT INTO phages (slug, name, year, record, source_path, source_blob_sha, synced_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, unixepoch())
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name, year = excluded.year, record = excluded.record,
       source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha,
       synced_at = excluded.synced_at`,
  )
    .bind(phageSlug(phage.name), phage.name, phage.year, compiled.record, compiled.sourcePath, compiled.sourceBlobSha)
    .run();
}

/**
 * Every derived store a phage feeds: the page's row first, then its own (see the header). Shared by the save,
 * so a repair that re-runs it writes what a save writes.
 */
export async function writeRow(env: PhageEnv, compiled: Compiled) {
  const slug = phageSlug(compiled.phage.name);
  await refreshPage(env, [...(await otherPhages(env, slug)), compiled.phage]);
  await writePhageRow(env, compiled);
}

/** A phage whose file is gone: the page loses it first, then its row goes (the row is the drift marker). */
export async function deletePhageRow(env: PhageEnv, row: { slug: string }) {
  await refreshPage(env, await otherPhages(env, row.slug));
  await env.DB.prepare(`DELETE FROM phages WHERE slug = ?1`).bind(row.slug).run();
}

/** True when D1's row for the phage was compiled from exactly this file (the git blob sha matches). */
async function rowIsCurrent(env: PhageEnv, slug: string, blobSha: string) {
  const row = await env.DB.prepare("SELECT source_blob_sha FROM phages WHERE slug = ?1")
    .bind(slug)
    .first<{ source_blob_sha: string | null }>();
  return row?.source_blob_sha === blobSha;
}

export type SavedPhage = {
  slug: string;
  commitSha: string;
  unchanged: boolean;
  created: boolean;
  purged: PurgeOutcome;
  note?: string;
};

/** validate -> policy -> commitUnlessUnchanged -> blob verify -> derived writes (convergeWithRetry) -> purge by tag. */
export async function savePhage(
  env: PhageEnv,
  options: { slug: string; raw: string; expectedHeadSha: string | null; isNew: boolean; actor: Actor },
): Promise<SavedPhage> {
  const { raw, actor } = options;
  const { slug, file } = registered(options.slug);
  const existing = await readFile(env, file);
  if (options.isNew && existing) throw new PhageInvalid(slug, [`the phage ${slug} already has a file (${file}); pass isNew false to edit it`]);
  if (!options.isNew && !existing) throw new PhageInvalid(slug, [`the phage ${slug} has no file yet; pass isNew to create it`]);

  const compiled = await compile(env, slug, raw);
  if (!compiled.ok) throw new PhageInvalid(slug, compiled.errors);
  // The set as it will stand: this phage against every other, so a record two phages claim is refused here.
  const setErrors = phageSetErrors([...(await otherPhages(env, slug)), compiled.phage]);
  if (setErrors.length > 0) throw new PhageInvalid(slug, setErrors);
  // A phage has no draft state: it is public when it is saved, so the policy reads it as published.
  decideFileWrite({ actor, noun: "phage", incomingDraft: false, priorRaw: existing?.content ?? null, isDraft: () => false });

  const tag = actor.kind === "operator" ? ` [operator:${actor.id}]` : actor.kind === "carrel" ? ` [carrel:${actor.changeId}]` : "";
  // After the gate, so a file that fails validation is still refused even when it is unchanged.
  const written = await commitUnlessUnchanged(env, {
    existing,
    raw,
    rowIsCurrent: () => rowIsCurrent(env, slug, compiled.sourceBlobSha),
    commit: () =>
      commitFiles(env, {
        expectedHeadSha: options.expectedHeadSha,
        message: `${options.isNew ? "Add" : "Update"} phage: ${compiled.phage.name}${tag}`,
        changes: [{ path: file, content: raw }],
      }),
  });
  if (written.action === "noop") {
    return { slug, commitSha: written.commitSha, unchanged: true, created: false, purged: null, note: UNCHANGED_NOTE };
  }
  const { commitSha } = written;
  const blobSha = written.blobShas[file];
  if (blobSha && blobSha !== compiled.sourceBlobSha) {
    throw new Error(
      `The phage "${slug}" WAS committed as ${commitSha}, but the committed bytes (${blobSha}) are not ` +
        `the bytes compiled (${compiled.sourceBlobSha}), so its page was not updated. Run the content sync to ` +
        `rebuild the row from the repository.`,
    );
  }

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      await writeRow(env, compiled);
      // The pages tag: the page's HTML embeds the table and its twin embeds the rows, and both carry it.
      purged = await purgePhages(`save phage ${slug}`);
    },
    // Nothing kept in KV for a phage: the thrown error names the commit and the repair (the content sync),
    // and the next ship's sync converges the rows from the repository anyway.
    recordDivergence: async () => undefined,
    slug,
    commitSha,
  });

  return { slug, commitSha, unchanged: written.action === "repair", created: options.isNew, purged };
}
