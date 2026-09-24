/**
 * The health checks, and the I/O that feeds them.
 *
 * WHAT THIS EXISTS FOR: a derived store can drift and nothing has to notice. The drift was being
 * COMPUTED correctly the whole time and there was no PATH from the number to a person.
 *
 * THE SCOPE IS DELIBERATELY SMALL:
 *
 *   1. `ask-index-drift`    the answer index against the corpus
 *   2. `media-index-drift`  the media index against R2 and the asset manifest
 *   3. `media-backup-drift` every MEDIA object against its twin, which RECOVERY.md rests on
 *   4. `fts-equality`       the docsize equalities ship asserts after a sync
 *   5. `content-drift`      posts.source_blob_sha against the repository's own blob shas
 *
 * The DRIFT checks are the ones the workflow can REPAIR by itself, through the operator operations
 * ship calls; everything else alerts a human. The authoritative list is `REPAIRABLE` in
 * `app/lib/health/repair.mjs`, and this sentence describes it rather than restating it.
 *
 * A GATE SEES DISK; THESE SEE THE LIVE STATE BETWEEN COMMITS, which is a different question rather
 * than a second copy of one a gate already answers.
 *
 * EVERY DECISION LIVES IN `verdicts.mjs`. This file reads bindings; what counts as a breach and what
 * reaches the wire are next door in a pure module, because `check:tests` cannot reach anything
 * importing a binding. If it can be wrong, it must be testable.
 *
 * @see app/lib/health/verdicts.mjs
 * @see app/routes/api.health.ts
 * @see .github/workflows/health.yml
 */

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
import { listDirectory } from "~/lib/editor/github.server";
import { mediaIndexStatus } from "~/lib/media/rebuild.server";
import { backupStatus } from "~/lib/media/backup.server";

/** One check's verdict. `ok: false` is what turns into an alert. */
export interface HealthCheck {
  name: string;
  ok: boolean;
  /** One sentence a person reads at 2am, with the numbers in it. */
  detail: string;
  /**
   * The two counts a drift check compares, present only when it FAILED. These are the only part of a
   * failing check that reaches the wire besides its name: a flap that says which check failed and not
   * how far apart the sides were cannot be triaged.
   */
  counts?: { expected: number; present: number };
}

export interface HealthRun {
  checks: HealthCheck[];
  failed: HealthCheck[];
}

/**
 * Runs every check and returns all verdicts, never throwing for a failed check. A check that
 * THROWS is reported as a failed check rather than allowed to abort the run, because the alternative
 * is that one broken check silences every other one.
 */
export async function runHealthChecks(env: Env): Promise<HealthRun> {
  const checks: HealthCheck[] = [];

  checks.push(
    await guard("ask-index-drift", async () => askDriftVerdict(await askIndexStatus(env))),
  );

  /*
   * Placed before `media-backup-drift` because the two are easy to confuse: this is the
   * reconciliation of the INDEX, and that one is the recovery acceptance and compares BYTES.
   */
  checks.push(
    await guard("media-index-drift", async () => mediaDriftVerdict(await mediaIndexStatus(env))),
  );

  checks.push(
    await guard("media-backup-drift", async () => {
      /*
       * NOT a reconciliation of the INDEX. `media-index-drift` above watches that. This asks the question neither can: does a second copy of
       * every byte exist?
       *
       * BOTH BUCKETS ARE LISTED IN FULL, not with `limit: 1`. This compares two key sets and every etag in
       * them, so a truncated read would report a clean sweep of the part it saw.
       */
      return mediaBackupDriftVerdict(await backupStatus(env));
    }),
  );

  checks.push(
    await guard("content-drift", async () => {
      /*
       * The artifact arc's other half: the committed corpus artifact could leave the repository because
       * THIS watches D1 converge to it. A markdown commit from any machine is live within one health poll
       * with NO DEPLOY, because the scheduled workflow reads this check and its repair re-renders the
       * drifted files through the one door to a rendered row.
       *
       * One Contents directory listing, which carries every file's git blob sha for free, so nothing
       * fetches a file to know whether it changed. A missing token, a GitHub outage or the timeout all
       * surface as this check FAILING, which the repair plan then refuses to act on alone: an unreadable
       * repository is not drift.
       */
      const entries = await listDirectory(env, "content/posts");
      const files = entries
        .filter((e) => e.type === "file" && e.name.endsWith(".md"))
        .map((e) => ({ slug: e.name.slice(0, -".md".length), sha: e.sha }));
      const rows = await env.DB.prepare(
        "SELECT slug, source_blob_sha FROM posts WHERE source_path IS NOT NULL",
      ).all<{ slug: string; source_blob_sha: string | null }>();
      return contentDriftVerdict(files, rows.results ?? []);
    }),
  );

  checks.push(
    await guard("fts-equality", async () => {
      /*
       * ONE ROUND TRIP, five subqueries. `search_docs` is the real content table and is counted
       * directly; the three index counts are taken on the `_docsize` shadows, because COUNT(*) on an
       * external-content fts5 table reads through to its content table and can never disagree with it.
       * `test/worker/publish.test.ts` plants index drift and expects this check to report it.
       */
      const row = await env.DB.prepare(
        "SELECT (SELECT COUNT(*) FROM posts) AS posts, " +
          "(SELECT COUNT(*) FROM posts_fts_docsize) AS postsFts, " +
          "(SELECT COUNT(*) FROM search_docs) AS docs, " +
          "(SELECT COUNT(*) FROM search_identity_docsize) AS identity, " +
          "(SELECT COUNT(*) FROM search_prose_docsize) AS prose",
      ).first<Record<string, unknown>>();

      // `?? {}` rather than a throw, so a null row reaches the verdict and is
      // reported as unreadable counts. Fail closed with a sentence, not a stack.
      return ftsEqualityVerdict(row ?? {});
    }),
  );

  return { checks, failed: checks.filter((c) => !c.ok) };
}

/**
 * Runs one check under a timeout, turning a throw OR a hang into a failing check rather than a
 * missing one. `withTimeout` already converts a rejection into a failed verdict, so there is no
 * try/catch here: one place decides what a broken check looks like. What this adds is the name.
 */
async function guard(
  name: string,
  run: () => Promise<{ ok: boolean; detail: string; counts?: { expected: number; present: number } }>,
): Promise<HealthCheck> {
  // The extra async wrapper turns a SYNCHRONOUS throw inside `run` into a rejection. Without it such
  // a throw escapes before `withTimeout` has a promise to guard, and one broken check would silence
  // every later one.
  const started = (async () => run())();
  const { ok, detail, counts } = await withTimeout(started, CHECK_TIMEOUT_MS, name);
  return counts ? { name, ok, detail, counts } : { name, ok, detail };
}

