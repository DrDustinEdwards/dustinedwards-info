/**
 * The health checks, and the I/O that feeds them.
 *
 * MOVED HERE 2026-08-23 from `workers/health.ts`, which kept them while the
 * only caller was the scheduled handler. `/api/health` is now a second caller,
 * and a route cannot reasonably reach into `workers/`. The alternative was a
 * second implementation, which is the shape this repo keeps paying for: two
 * copies of an invariant, one of them wrong, and nobody knows which.
 *
 * ## What this exists for, precisely
 *
 * The Ask index lost nine records on 31 July 2026 and it was noticed on 21
 * August, because a badge on `/admin/posts` said so and somebody happened to
 * open that page. `askIndexStatus` had been computing the number 9 the whole
 * time. Nothing was broken about the detection; there was no PATH from the
 * number to a person.
 *
 * ## THE SCOPE IS DELIBERATELY SMALL
 *
 *   1. `ask-index-drift`    the failure above, by name
 *   2. `media-index-drift`  the media index against R2 and the asset manifest,
 *                           the same reconciliation `sync_media` proves
 *   3. `media-unbacked`     the R2 acceptance in RECOVERY.md section 3, which
 *                           holds only while the MEDIA bucket is empty
 *   4. `fts-equality`       the docsize equalities the ship asserts after a sync
 *   5. `content-drift`      posts.source_blob_sha against the repository's own
 *                           blob shas, from one Contents directory listing.
 *                           Since the artifact arc D1 is the ONLY rendered
 *                           copy, and this is what watches it converge to git.
 *
 * The three drift checks are the ones the workflow can REPAIR by itself,
 * through the same operator operations ship calls. Everything else here alerts
 * a human.
 *
 * A gate sees disk; these see the LIVE state between commits, which is a
 * different question rather than a second copy of one a gate already answers.
 *
 * ## Every decision lives in `verdicts.mjs`
 *
 * This file reads bindings. What counts as a breach, what a timeout means, and
 * what reaches the wire are next door in a pure module, because `check:tests`
 * runs `node --test` over those and cannot reach anything importing a binding.
 * If it can be wrong, it must be testable.
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
  mediaUnbackedVerdict,
  withTimeout,
} from "~/lib/health/verdicts.mjs";
import { askIndexStatus } from "~/lib/search/ask.server";
import { listDirectory } from "~/lib/editor/github.server";
import { mediaIndexStatus } from "~/lib/media/rebuild.server";

/** One check's verdict. `ok: false` is what turns into an alert. */
export interface HealthCheck {
  name: string;
  ok: boolean;
  /** One sentence a person reads at 2am, with the numbers in it. */
  detail: string;
  /**
   * The two counts a drift check compares, present only when it FAILED.
   *
   * These are the only part of a failing check that reaches the wire besides
   * its name. Grounds are on `publicHealthBody`: a flap that says which check
   * failed and not how far apart the sides were cannot be triaged.
   */
  counts?: { expected: number; present: number };
}

export interface HealthRun {
  checks: HealthCheck[];
  failed: HealthCheck[];
}

/**
 * Runs every check and returns all verdicts, never throwing for a failed check.
 *
 * A check that THROWS is reported as a failed check rather than allowed to
 * abort the run, because the alternative is that one broken check silences
 * every other one. That is the same fail-open-by-accident shape as a listing
 * that errors and returns zero.
 */
export async function runHealthChecks(env: Env): Promise<HealthRun> {
  const checks: HealthCheck[] = [];

  checks.push(
    await guard("ask-index-drift", async () => askDriftVerdict(await askIndexStatus(env))),
  );

  /*
   * ADDED 2026-08-24 with the media sync at ship. Before it, the media index
   * was the one derived store nothing watched between commits: a gate saw it
   * only when somebody ran the gate. It is placed before `media-unbacked`
   * because the two are easy to confuse and this is the reconciliation; that
   * one is the recovery acceptance.
   */
  checks.push(
    await guard("media-index-drift", async () => mediaDriftVerdict(await mediaIndexStatus(env))),
  );

  checks.push(
    await guard("media-unbacked", async () => {
      /*
       * NOT a reconciliation. `check:media --remote` owns that and does it in
       * four directions. This asks the one question that gate does not: is the
       * bucket still EMPTY? A reconciler is perfectly happy for there to be
       * more objects, as long as they all have rows.
       */
      const listed = await env.MEDIA.list({ limit: 1 });
      return mediaUnbackedVerdict(listed.objects);
    }),
  );

  checks.push(
    await guard("content-drift", async () => {
      /*
       * ADDED with the artifact arc, and it is the arrangement's other half:
       * the committed corpus artifact could leave the repository because THIS
       * watches D1 converge to it. A markdown commit from any machine is live
       * within one health poll with NO DEPLOY, by design: the scheduled
       * workflow reads this check, and its repair (`sync_posts`, through the
       * operator door) fetches the drifted files and re-renders them through
       * the one door to a rendered row.
       *
       * One Contents directory listing, which carries every file's git blob
       * sha for free; blob shas are content-addressed, so nothing fetches a
       * file to know whether it changed. Needs the editor's GITHUB_TOKEN,
       * already in env; its absence, a GitHub outage, or the three second
       * timeout all surface as this check failing, which the repair plan then
       * refuses to act on alone (an unreadable repository is not drift).
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
       * ONE ROUND TRIP, five subqueries. `search_docs` is the real content
       * table and is counted directly; the three index counts are taken on the
       * `_docsize` shadows, because COUNT(*) on an external-content fts5 table
       * reads through to its content table and can never disagree with it.
       * `check:invariants` section 7 enforces that distinction on this source.
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
 * Runs one check under a timeout, turning a throw OR a hang into a failing
 * check rather than into a missing one or a hung response.
 *
 * `withTimeout` already converts a rejection into a failed verdict, so there is
 * no try/catch here: one place decides what a broken check looks like. What
 * this adds is the name, so every path below reports a check that exists.
 */
async function guard(
  name: string,
  run: () => Promise<{ ok: boolean; detail: string; counts?: { expected: number; present: number } }>,
): Promise<HealthCheck> {
  // The extra async wrapper turns a SYNCHRONOUS throw inside `run` into a
  // rejection. Without it such a throw escapes before `withTimeout` has a
  // promise to guard, and one broken check would silence every later one.
  const started = (async () => run())();
  const { ok, detail, counts } = await withTimeout(started, CHECK_TIMEOUT_MS, name);
  return counts ? { name, ok, detail, counts } : { name, ok, detail };
}

