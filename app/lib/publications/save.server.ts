// A publication's write path, run for the Carrel adapter (app/lib/carrel/publication-handler.server.ts):
// compile the file the way CI does (compile.mjs), refuse it with the validator's own messages if it fails,
// commit it unless it is unchanged (commitUnlessUnchanged), then write its D1 row, its search record and
// its cache purge, so the page changes on the next request with no build or deploy. The commit is never
// reverted when a derived write fails (hard rule 18): the error says the commit landed and how to repair it.

import citedByArtifact from "../../../data/publications.cited-by.json";

import { listCvCitedDois } from "~/db/cv";
import { getPublicationRow, listPublicationIdentities } from "~/db/publications";
import { textChunks } from "~/lib/content/chunks.mjs";
import { ContentInvalid } from "~/lib/carrel/errors.server";
import { combinePurges, purgeCv, purgePublications, type PurgeOutcome } from "~/lib/cache-purge.server";
import { refreshCvSearch } from "~/lib/cv/save.server";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { blobGuard, commitFiles, publicFileEntry, readFile } from "~/lib/editor/github.server";
import { decideFileWrite, type Actor } from "~/lib/editor/publish-policy.mjs";
import { commitUnlessUnchanged, UNCHANGED_NOTE } from "~/lib/editor/write-path.server";
import { errorMessage } from "~/lib/error-message.mjs";
import { recordsForPapers } from "~/lib/search/records.mjs";
import { askAvailable, syncAskPaper } from "~/lib/search/ask.server";

import { citationSeedsFrom } from "./cited-by.mjs";
import { compilePublication } from "./compile.mjs";
import { parsePublication, publicationPath } from "./parse.mjs";
import { paperSearchUid } from "./search-inputs.mjs";
import type { OtherPublication, PublicationHost } from "./validate.mjs";

type PublicationEnv = Env & { GITHUB_TOKEN?: string };

/** A file the validator refused: carries every message, so the caller can fix its own edit. */
class PublicationInvalid extends ContentInvalid {
  constructor(slug: string, errors: string[]) {
    super(`The publication "${slug}" was not saved: it fails ${errors.length} check(s). Nothing was committed.`, errors);
    this.name = "PublicationInvalid";
  }
}

/** The repository's PDFs, asked of GitHub: existence and size, never the bytes. */
function githubHost(env: PublicationEnv): PublicationHost {
  return { pdf: (sitePath) => publicFileEntry(env, sitePath) };
}

/** Every other publication's identity, from D1: CI re-checks the whole corpus on the commit this makes. */
async function otherPublications(env: PublicationEnv, slug: string): Promise<OtherPublication[]> {
  const rows = await listPublicationIdentities(env);
  return rows
    .filter((row) => row.slug !== slug)
    .map((row) => {
      const record = JSON.parse(row.record) as { id: string; doi: string | null };
      return { slug: row.slug, doi: record.doi, id: record.id };
    });
}

async function compile(env: PublicationEnv, slug: string, raw: string) {
  return compilePublication({
    slug,
    raw,
    host: githubHost(env),
    others: await otherPublications(env, slug),
    citedByArtifact,
  });
}

type Compiled = Extract<Awaited<ReturnType<typeof compile>>, { ok: true }>;

/** A compile for a read or a preview: the same door, so what a reader sees is what a save would write. */
export async function compilePublicationFor(env: PublicationEnv, slug: string, raw: string) {
  return compile(env, slug, raw);
}

/**
 * The D1 row, its search record and the FTS rebuild, in one batch so they move together. D1 refuses a
 * statement over 100 KB and a twin with the PDF's full text passes it, so the twin goes in as chunks (the
 * way sync:content writes it): the row is inserted with the first chunk and a blank blob sha, the rest are
 * appended, and the real sha lands last, so nothing reads a truncated twin as current. The batch is one
 * transaction, so a failure leaves the previous row.
 */
export async function writePublicationRow(env: PublicationEnv, compiled: Compiled) {
  const db = env.DB;
  const r = compiled.record;
  const uid = compiled.searchInput.uid;
  const records = compiled.draft ? [] : recordsForPapers([compiled.searchInput]);
  const [firstChunk = "", ...laterChunks] = textChunks(compiled.twin);
  await db.batch([
    db
      .prepare(
        `INSERT INTO publications (slug, doi_key, status, stage, type, title, year, selected, record, csl,
           markdown, source_path, source_blob_sha, synced_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, unixepoch())
         ON CONFLICT(slug) DO UPDATE SET doi_key = excluded.doi_key, status = excluded.status, stage = excluded.stage,
           type = excluded.type, title = excluded.title, year = excluded.year, selected = excluded.selected,
           record = excluded.record, csl = excluded.csl, markdown = excluded.markdown,
           source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha,
           synced_at = excluded.synced_at`,
      )
      .bind(
        r.slug,
        r.doi ? r.doi.trim().toLowerCase() : null,
        compiled.draft ? "draft" : "published",
        r.stage,
        r.type,
        r.title,
        r.year,
        r.selected ? 1 : 0,
        JSON.stringify(r),
        compiled.csl ? JSON.stringify(compiled.csl) : null,
        firstChunk,
        compiled.sourcePath,
        "",
      ),
    ...laterChunks.map((chunk) =>
      db.prepare(`UPDATE publications SET markdown = markdown || ?1 WHERE slug = ?2`).bind(chunk, r.slug),
    ),
    db.prepare(`UPDATE publications SET source_blob_sha = ?1 WHERE slug = ?2`).bind(compiled.sourceBlobSha, r.slug),
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

/**
 * The row of a paper whose file is gone, its search record, and its citation row when no remaining paper
 * carries that DOI. A paper that still has a file is never passed here.
 */
export async function deletePublicationRow(env: PublicationEnv, row: { slug: string; doi_key: string | null }) {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM publications WHERE slug = ?1`).bind(row.slug),
    env.DB.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(paperSearchUid(row.slug)),
    env.DB.prepare(
      `DELETE FROM publication_citations WHERE doi = ?1 AND NOT EXISTS (SELECT 1 FROM publications WHERE doi_key = ?1)`,
    ).bind(row.doi_key),
    env.DB.prepare(`INSERT INTO search_identity (search_identity) VALUES ('rebuild')`),
    env.DB.prepare(`INSERT INTO search_prose (search_prose) VALUES ('rebuild')`),
  ]);
}

/**
 * Seeds the committed OpenAlex snapshot's citation row for each DOI that has none. A row that exists is
 * never touched: its count came from a refresh, which is newer than any snapshot.
 */
export async function seedMissingCitations(env: PublicationEnv, dois: Array<string | null>) {
  const wanted = new Set(dois.filter((d): d is string => !!d).map((d) => d.trim().toLowerCase()));
  const seeds = citationSeedsFrom(citedByArtifact, "data/publications.cited-by.json").filter((s) => wanted.has(s.doi));
  if (seeds.length === 0) return;
  await env.DB.batch(
    seeds.map((s) =>
      env.DB
        .prepare(
          `INSERT INTO publication_citations (doi, count, url, fetched_at) VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(doi) DO NOTHING`,
        )
        .bind(s.doi, s.count, s.url, s.fetchedAt),
    ),
  );
}

/** True when D1's row for the paper was compiled from exactly this file (the git blob sha matches). */
async function rowIsCurrent(env: PublicationEnv, slug: string, blobSha: string) {
  const row = await env.DB.prepare("SELECT source_blob_sha FROM publications WHERE slug = ?1")
    .bind(slug)
    .first<{ source_blob_sha: string | null }>();
  return row?.source_blob_sha === blobSha;
}

/** The Ask index must not fail a save: the commit has landed. A failure is returned, never dropped. */
async function syncAsk(env: PublicationEnv, compiled: Compiled) {
  if (!askAvailable(env)) return null;
  try {
    const result = await syncAskPaper(env, compiled.record.slug, compiled.draft ? null : compiled.twin);
    return { ok: true as const, ...result };
  } catch (error) {
    console.error("ask index sync failed after a publication save", error);
    return {
      ok: false as const,
      message:
        `The publication saved, but its Ask record did not update: ${errorMessage(error)}. ` +
        `The next ship's Ask sync converges it from the repository.`,
    };
  }
}

/**
 * What the CV (content/cv/publications.md) makes of this save. The CV cites a paper by DOI and is joined to the
 * publications at read time, so a paper that stops being published, or whose DOI changes, would leave the CV
 * citing a paper no record answers for: that is refused, naming the repair. A save of a paper the CV cites
 * changes the CV, so `cited` tells the write to refresh the CV's search records and purge its cache tag.
 */
async function cvCitation(env: PublicationEnv, slug: string, compiled: Compiled) {
  const cited = await listCvCitedDois(env);
  const stored = cited.size === 0 ? null : await getPublicationRow(env, slug);
  const storedKey = stored ? ((JSON.parse(stored.record) as { doi: string | null }).doi?.trim().toLowerCase() ?? null) : null;
  if (!storedKey || !cited.has(storedKey)) return { cited: false, refusal: null };
  const newKey = compiled.record.doi?.trim().toLowerCase() ?? null;
  const refusal =
    compiled.draft || newKey !== storedKey
      ? `The CV cites this paper by DOI ${storedKey} (content/cv/publications.md), so it must stay published with that DOI. ` +
        "Remove the reference from the CV first, or keep the paper published."
      : null;
  return { cited: true, refusal };
}

/** Whether a stored file is a draft, read from the file itself, the only authority. */
export function fileIsDraft(raw: string) {
  return parsePublication({ file: "", raw }).data.draft === true;
}

export type SavedPublication = {
  slug: string;
  commitSha: string;
  /** The git blob sha of the committed file: Carrel's version of the item. */
  sourceBlobSha: string;
  unchanged: boolean;
  created: boolean;
  draft: boolean;
  purged: PurgeOutcome;
  askSync: Awaited<ReturnType<typeof syncAsk>>;
  note?: string;
};

/**
 * validate -> policy -> commitUnlessUnchanged -> blob verify -> D1 write (convergeWithRetry) -> cache
 * purge by tag, as saveProcedure does it.
 */
export async function savePublication(
  env: PublicationEnv,
  options: { slug: string; raw: string; expectedHeadSha?: string | null;
    /** The blob sha of this file as Carrel loaded it; undefined means no check. */
    expectedBlobSha?: string | null; isNew: boolean; actor: Actor },
): Promise<SavedPublication> {
  const { slug, raw, actor } = options;
  const path = publicationPath(slug);
  const existing = await readFile(env, path);
  if (options.isNew && existing) throw new PublicationInvalid(slug, [`a publication named ${slug} already exists`]);
  if (!options.isNew && !existing) throw new PublicationInvalid(slug, [`no publication named ${slug} exists; pass isNew to create it`]);

  const compiled = await compile(env, slug, raw);
  if (!compiled.ok) throw new PublicationInvalid(slug, compiled.errors);
  decideFileWrite({
    actor,
    noun: "publication",
    incomingDraft: compiled.draft,
    priorRaw: existing?.content ?? null,
    isDraft: fileIsDraft,
  });

  const cv = await cvCitation(env, slug, compiled);
  if (cv.refusal) throw new PublicationInvalid(slug, [cv.refusal]);

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
        message: `${options.isNew ? "Add" : "Update"} publication: ${compiled.record.title}${tag}`,
        changes: [{ path, content: raw }],
      }),
  });
  if (written.action === "noop") {
    return {
      slug,
      commitSha: written.commitSha,
      sourceBlobSha: compiled.sourceBlobSha,
      unchanged: true,
      created: false,
      draft: compiled.draft,
      purged: null,
      askSync: null,
      note: UNCHANGED_NOTE,
    };
  }
  const { commitSha } = written;
  const blobSha = written.blobShas[path];
  if (blobSha && blobSha !== compiled.sourceBlobSha) {
    throw new Error(
      `The publication "${slug}" WAS committed as ${commitSha}, but the committed bytes (${blobSha}) are not ` +
        `the bytes compiled (${compiled.sourceBlobSha}), so its page was not updated. Run the content sync to ` +
        `rebuild the row from the repository.`,
    );
  }

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      await writePublicationRow(env, compiled);
      purged = await purgePublications(`save_publication ${slug}`);
      // The CV is joined to this paper at read time, so its page reads the new row already; its search
      // records and its cache are what a save has to refresh.
      if (cv.cited) {
        await refreshCvSearch(env);
        purged = combinePurges(purged, await purgeCv(`save_publication ${slug}`));
      }
    },
    // Nothing kept in KV for a publication: the thrown error names the commit and the repair (the content
    // sync), and the next ship's sync converges the row from the repository anyway.
    recordDivergence: async () => undefined,
    slug,
    commitSha,
  });

  return {
    slug,
    commitSha,
    sourceBlobSha: compiled.sourceBlobSha,
    unchanged: written.action === "repair",
    created: options.isNew,
    draft: compiled.draft,
    purged,
    askSync: await syncAsk(env, compiled),
  };
}
