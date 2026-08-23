/**
 * The scheduled health run, and the only thing on this site that reaches a
 * human without a human going and looking.
 *
 * ## What this exists for, precisely
 *
 * The Ask index lost nine records on 31 July 2026 and it was noticed on 21
 * August, because a badge on `/admin/posts` said so and somebody happened to
 * open that page. `askIndexStatus` had been computing the number 9 the whole
 * time. Nothing was broken about the detection; there was no PATH from the
 * number to a person. This file is that path and nothing more.
 *
 * ## THE SCOPE IS DELIBERATELY SMALL, and the omissions are the design
 *
 * Three checks, not a monitoring platform:
 *
 *   1. `ask-index-drift`   the failure above, by name
 *   2. `media-unbacked`    the R2 acceptance in RECOVERY.md section 3, which
 *                          holds only while the MEDIA bucket is empty
 *   3. `fts-equality`      the docsize equalities the ship asserts after a sync
 *
 * **`fts-equality` was argued OUT of this file on 2026-08-22 and is now in it**,
 * so the reasoning is recorded rather than quietly reversed. The objection was
 * that `check:invariants` and `check:search` already own the FTS invariants and
 * a second implementation of an invariant is the drift this repo keeps paying
 * for. What that argument missed is WHICH invariant each one owns. The gates
 * assert things about SOURCE: that no statement counts an index directly, that
 * no statement DELETEs from one. `sync-content.mjs` asserts the equality itself,
 * but only at the end of a sync, so between syncs nothing measures it. The Ask
 * index lost nine records with no commit anywhere near it, and the FTS indexes
 * can go stale the same way. **A gate sees disk; this sees the live database
 * between commits**, and that is a different question rather than a second copy
 * of the same one.
 *
 * ## WHAT THIS DOES NOT COVER, which matters more than what it does
 *
 * **It cannot report its own death.** If the cron stops firing, if the Worker
 * fails to deploy, or if `scheduled` throws before reaching the delivery, then
 * nothing is sent and the silence is indistinguishable from health. This is the
 * absence-reads-as-health shape this repo has hit repeatedly, and no amount of
 * code INSIDE the Worker can close it, because the code and the thing it
 * watches die together.
 *
 * So the heartbeat below is the load-bearing half, and it is only load-bearing
 * if something OUTSIDE Cloudflare is watching for it to stop. See
 * `ALERT_HEARTBEAT_URL`. **Until that destination exists, a quiet inbox means
 * nothing.**
 *
 * It also does not cover: anything a reader sees (this never fetches a public
 * URL), layout, the admin plane, billing, or whether a deploy happened. Those
 * are `verify-live`, `check:browser` and the dashboard.
 */

import {
  HEARTBEAT_KEY,
  alertText,
  askDriftVerdict,
  ftsEqualityVerdict,
  mediaUnbackedVerdict,
} from "~/lib/health/verdicts.mjs";
import { askIndexStatus } from "~/lib/search/ask.server";

export { HEARTBEAT_KEY };

/** One check's verdict. `ok: false` is what turns into an alert. */
export interface HealthCheck {
  name: string;
  ok: boolean;
  /** One sentence a person reads at 2am, with the numbers in it. */
  detail: string;
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

/** Turns a throwing check into a failing one, never into a missing one. */
async function guard(
  name: string,
  run: () => Promise<{ ok: boolean; detail: string }>,
): Promise<HealthCheck> {
  try {
    const { ok, detail } = await run();
    return { name, ok, detail };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: `check threw: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * The whole scheduled run: check, alert on breach, then heartbeat.
 *
 * **ORDER IS LOAD-BEARING. The heartbeat is LAST and only on a clean pass of
 * the delivery.** A heartbeat sent before the checks would keep an external
 * dead-man's switch quiet while this handler was failing to deliver anything,
 * which is the worst of both: a silent breach and a green light saying so.
 */
export async function runScheduledHealth(env: Env): Promise<HealthRun> {
  const run = await runHealthChecks(env);
  let delivered = true;

  if (run.failed.length > 0) {
    /*
     * Logged FIRST and unconditionally, before any network call. Workers Logs
     * keeps custom logs for 7 days with `observability.enabled` true, and
     * `invocation_logs: false` does not touch them: it drops the automatic
     * per-request record, which is a privacy setting, not this. So a breach is
     * recoverable from the dashboard even when the webhook is unset or the
     * destination is down, which are the two cases where the alert itself is
     * the thing that failed.
     */
    console.error(
      JSON.stringify({
        alert: "health-check-failed",
        failed: run.failed.map((c) => c.name),
        detail: run.failed.map((c) => c.detail),
      }),
    );
    delivered = await deliver(env, run.failed);
  }

  await heartbeat(env, run, delivered);
  return run;
}

/**
 * Sends the breach to `ALERT_WEBHOOK_URL`, or says loudly that it cannot.
 *
 * OPTIONAL BY CONTRACT, on the `ANALYTICS_READ_TOKEN` precedent: a local dev
 * machine will never have it and an unprovisioned secret must not throw. But
 * absence is logged at error level rather than passed over, because "no
 * webhook configured" and "no breach to report" are the same silence otherwise,
 * and this whole file exists because a silence was read as health once already.
 */
async function deliver(env: Env, failed: HealthCheck[]): Promise<boolean> {
  if (!env.ALERT_WEBHOOK_URL) {
    console.error(
      JSON.stringify({
        alert: "health-alert-undeliverable",
        reason: "ALERT_WEBHOOK_URL is not set, so this breach reached nobody",
        failed: failed.map((c) => c.name),
      }),
    );
    return false;
  }

  const body = JSON.stringify({
    source: "dustinedwards.info",
    failed: failed.length,
    text: alertText(failed),
    checks: failed,
  });

  try {
    const response = await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    if (!response.ok) {
      console.error(
        JSON.stringify({
          alert: "health-alert-rejected",
          status: response.status,
          failed: failed.map((c) => c.name),
        }),
      );
      return false;
    }
    return true;
  } catch (error) {
    /*
     * A destination that is unreachable must not throw out of this function.
     * It is reported and turned into `false`, which is what withholds the
     * heartbeat: see `heartbeat` for why that is the correct escalation rather
     * than a second failure.
     */
    console.error(
      JSON.stringify({
        alert: "health-alert-threw",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  }
}

/**
 * The dead-man's switch ping, and the only defence against this file dying
 * quietly.
 *
 * **NOTHING IN THIS REPOSITORY CAN WATCH FOR THIS TO STOP.** Any watcher written
 * here would run in the Worker whose failure is the event being watched for, so
 * it would go silent at exactly the moment it was needed. The watcher has to be
 * outside Cloudflare, and `ALERT_HEARTBEAT_URL` is where it plugs in: a
 * destination that alerts when an expected ping does NOT arrive within a grace
 * window. Absence detection is the entire feature, and it is the reason that
 * category of destination is worth more here than a chat webhook.
 *
 * Unset, this degrades to the KV write below, which is not an alert. It makes
 * the last run's AGE readable by anything that asks, so a human who looks can
 * tell a healthy quiet from a dead one. A human who does not look learns
 * nothing, which is the honest description of the state before this file
 * existed.
 */
async function heartbeat(env: Env, run: HealthRun, delivered: boolean): Promise<void> {
  /*
   * The KV write happens EITHER WAY, including on an undelivered breach. It is
   * a record of "this handler reached the end", not a claim that all is well,
   * and it carries `failed` so a reader can tell the difference. Withholding it
   * would lose the one piece of evidence that the run happened at all.
   */
  await env.APP_KV.put(
    HEARTBEAT_KEY,
    JSON.stringify({
      at: new Date().toISOString(),
      checks: run.checks.length,
      failed: run.failed.length,
      delivered,
    }),
  );

  /*
   * THE PING IS WITHHELD WHEN A BREACH COULD NOT BE DELIVERED, and this is the
   * one piece of real escalation in the file.
   *
   * If the webhook is unset or its destination is down, the breach has reached
   * nobody and the external watchdog is the only channel left. Staying silent
   * makes it fire. That converts "the alert path is broken" into an alarm,
   * which is exactly the case that would otherwise be invisible: a failure to
   * deliver is itself undeliverable by the thing that failed to deliver.
   *
   * The cost is honest and worth stating: the watchdog's message will say this
   * Worker is not running, when in truth it ran and could not get a word out.
   * A misleading alarm beats a correct silence.
   */
  if (!delivered) return;

  if (!env.ALERT_HEARTBEAT_URL) return;

  try {
    await fetch(env.ALERT_HEARTBEAT_URL, { method: "POST" });
  } catch (error) {
    console.error(
      JSON.stringify({
        alert: "health-heartbeat-threw",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
