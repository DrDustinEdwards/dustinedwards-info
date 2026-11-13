// The one roster save, called by the site-api adapter for Carrel (app/lib/carrel/roster-handler.server.ts), and
// the reads sync_roster and its drift check use. The roster is edited through Carrel and nothing else:
// there is no save tool and no admin editor. A save compiles the file the way CI does (compile.mjs), refuses
// it with every message if it fails, commits it to the repository (unless it is byte-identical,
// commitUnlessUnchanged), then writes its D1 row and purges the pages that embed the roster, so the roster
// changes on the next request with no build or deploy. The commit is never reverted when the D1 write
// fails: the error says the commit landed and how to repair the row.

import { ContentInvalid } from "~/lib/carrel/errors.server";
import { purgeRoster, type PurgeOutcome } from "~/lib/cache-purge.server";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import { readFile } from "~/lib/source/store.server";
import { decideFileWrite, type Actor } from "~/lib/editor/publish-policy.mjs";
import {
  actorTag,
  assertStoredBytes,
  commitUnlessUnchanged,
  UNCHANGED_NOTE,
} from "~/lib/editor/write-path.server";

import { compileCohort, rosterPath, type Cohort, type RosterHost } from "./compile.mjs";

type RosterEnv = Env;

/** A cohort's file key is its four-digit year, which is also what keeps an id from naming any other path. */
export const COHORT_SLUG = /^\d{4}$/;

/** A file the validator refused: carries every message, so the caller can fix its own edit. */
class RosterInvalid extends ContentInvalid {
  constructor(slug: string, errors: string[]) {
    super(
      `The ${slug} cohort was not saved: it fails ${errors.length} check(s). Nothing was saved.`,
      errors,
    );
    this.name = "RosterInvalid";
  }
}

/** The photographs are media library files: one exists when its object is in the MEDIA bucket. */
function sourceHost(env: RosterEnv): RosterHost {
  return { photo: async (src) => (await env.MEDIA.head(src.slice("/media/".length))) !== null };
}

/** The one compile door: the save and sync_roster both read a file through it. */
export async function compile(env: RosterEnv, slug: string, raw: string) {
  const { findWideDashes } = await loadPipeline();
  return compileCohort({ slug, raw, host: sourceHost(env), pipeline: { findWideDashes } });
}

type Compiled = Extract<Awaited<ReturnType<typeof compile>>, { ok: true }>;

/** The slug of an id, or a refusal: nothing but a year names a cohort file. */
function registered(slug: string) {
  if (!COHORT_SLUG.test(slug)) {
    throw new RosterInvalid(slug, [
      `"${slug}" is not a cohort file key; a cohort's file is named for its year, such as 2025`,
    ]);
  }
  return { slug, file: rosterPath(slug) };
}

/** The D1 row, in one statement: a cohort is one row, so it moves whole. */
export async function writeRosterRow(env: RosterEnv, compiled: Compiled) {
  const cohort: Cohort = compiled.cohort;
  await env.DB.prepare(
    `INSERT INTO roster (slug, year, record, source_path, source_blob_sha, synced_at)
     VALUES (?1, ?2, ?3, ?4, ?5, unixepoch())
     ON CONFLICT(slug) DO UPDATE SET year = excluded.year, record = excluded.record,
       source_path = excluded.source_path, source_blob_sha = excluded.source_blob_sha,
       synced_at = excluded.synced_at`,
  )
    .bind(
      String(cohort.year),
      cohort.year,
      compiled.record,
      compiled.sourcePath,
      compiled.sourceBlobSha,
    )
    .run();
}

/** The row of a cohort whose file is gone: the one removal sync_roster makes. */
export async function deleteRosterRow(env: RosterEnv, row: { slug: string }) {
  await env.DB.prepare(`DELETE FROM roster WHERE slug = ?1`).bind(row.slug).run();
}

/** True when D1's row for the cohort was compiled from exactly this file (the git blob sha matches). */
async function rowIsCurrent(env: RosterEnv, slug: string, blobSha: string) {
  const row = await env.DB.prepare("SELECT source_blob_sha FROM roster WHERE slug = ?1")
    .bind(slug)
    .first<{ source_blob_sha: string | null }>();
  return row?.source_blob_sha === blobSha;
}

export type SavedCohort = {
  slug: string;
  commitSha: string;
  /** The git blob sha of the committed file: Carrel's version of the item. */
  sourceBlobSha: string;
  unchanged: boolean;
  created: boolean;
  purged: PurgeOutcome;
  note?: string;
};

/** validate -> policy -> commitUnlessUnchanged -> blob verify -> D1 write (convergeWithRetry) -> purge by tag. */
export async function saveRoster(
  env: RosterEnv,
  options: {
    slug: string;
    raw: string;
    expectedHeadSha?: string | null;
    /** The blob sha of this file as Carrel loaded it; undefined means no check. */
    expectedBlobSha?: string | null;
    isNew: boolean;
    actor: Actor;
  },
): Promise<SavedCohort> {
  const { raw, actor } = options;
  const { slug, file } = registered(options.slug);
  const existing = await readFile(env, file);
  if (options.isNew && existing)
    throw new RosterInvalid(slug, [
      `the ${slug} cohort already has a file (${file}); pass isNew false to edit it`,
    ]);
  if (!options.isNew && !existing)
    throw new RosterInvalid(slug, [`the ${slug} cohort has no file yet; pass isNew to create it`]);

  const compiled = await compile(env, slug, raw);
  if (!compiled.ok) throw new RosterInvalid(slug, compiled.errors);
  // A cohort has no draft state: it is public when it is saved, so the policy reads it as published.
  decideFileWrite({
    actor,
    noun: "roster cohort",
    incomingDraft: false,
    priorRaw: existing?.content ?? null,
    isDraft: () => false,
  });

  // After the gate, so a file that fails validation is still refused even when it is unchanged.
  const written = await commitUnlessUnchanged(env, {
    existing,
    raw,
    rowIsCurrent: () => rowIsCurrent(env, slug, compiled.sourceBlobSha),
    path: file,
    message: `${options.isNew ? "Add" : "Update"} roster: ${slug} cohort${actorTag(actor)}`,
    expectedHeadSha: options.expectedHeadSha,
    expectedBlobSha: options.expectedBlobSha,
  });
  if (written.action === "noop") {
    return {
      slug,
      commitSha: written.commitSha,
      sourceBlobSha: compiled.sourceBlobSha,
      unchanged: true,
      created: false,
      purged: null,
      note: UNCHANGED_NOTE,
    };
  }
  assertStoredBytes(written, file, compiled.sourceBlobSha, `The ${slug} cohort`);
  const { commitSha } = written;

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      await writeRosterRow(env, compiled);
      purged = await purgeRoster(`save roster ${slug}`);
    },
    // Nothing kept in KV for a cohort: the thrown error names the commit and the repair (the content sync),
    // and the next ship's sync converges the row from the repository anyway.
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
    purged,
  };
}
