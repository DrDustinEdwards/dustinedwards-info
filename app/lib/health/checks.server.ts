// Every decision lives in verdicts.mjs: check:tests cannot reach a module that imports a binding.

import {
  CHECK_TIMEOUT_MS,
  askDriftVerdict,
  contentDriftVerdict,
  ftsEqualityVerdict,
  mediaDriftVerdict,
  mediaBackupDriftVerdict,
  withTimeout,
} from "~/lib/health/verdicts.mjs";
import { askIndexStatus } from "~/lib/search/ask.server";
import { listPostFiles } from "~/lib/editor/github.server";
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

