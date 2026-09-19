/*
 * RELATIVE IMPORTS, DELIBERATELY, where the rest of workers/ uses `~/`. This Worker is built by
 * `wrangler deploy -c wrangler.watchdog.jsonc`, which bundles with esbuild and does not read that
 * tsconfig mapping, so a `~/` specifier here would typecheck and fail at deploy.
 */
import {
  failingCheckNames,
  refusalMiss,
  watchdogActions,
  watchdogOutcome,
} from "../app/lib/health/repair.mjs";
import { alertTransition, formatDuration } from "../app/lib/health/alert-state.mjs";
import {
  ERROR_WINDOW_MINUTES,
  errorRateQuery,
  errorRateVerdict,
} from "../app/lib/health/error-rate.mjs";
import { SITE_ORIGIN } from "../app/lib/seo";

/**
 * The Worker the error rate is asked about: the SITE, never this watchdog. Written out rather than
 * derived from SITE_ORIGIN, because the origin is a hostname and this is a script name, equal today
 * only by naming. `check:config` binds it to the site config's `name`.
 */
const SITE_SCRIPT_NAME = "dustinedwards";

/**
 * THE WATCHDOG. A separate Worker whose only job is to notice that this site has stopped being
 * healthy, repair what it can, and wake somebody otherwise.
 *
 * A WORKER CANNOT `fetch()` THIS SITE. Cloudflare error 1042 refuses Worker-to-Worker on one zone
 * without a service binding, and this site has no custom domain until the DNS cutover, so
 * `env.SITE.fetch` is the only mechanism available.
 *
 * WHAT THAT COSTS: the binding invokes the site Worker directly, so it proves the health suite RUNS
 * and that every invariant holds. It does NOT prove the site is reachable from the internet, and
 * `.github/workflows/health.yml` survives as the only instrument speaking from outside Cloudflare.
 *
 * NOTHING HERE WRITES THE HEALTH SNAPSHOT, AND NOTHING MAY. It is a byproduct of a run that happened
 * anyway, and a watchdog that stamped it directly would be manufacturing its own alibi. The home
 * page's tile renders its age, so the tile's freshness IS this Worker's liveness.
 *
 * WHAT IS DECIDED HERE: NOTHING. Every decision is in `app/lib/health/repair.mjs`, which is pure and
 * never fetches. This file is the I/O half and walks an action list rather than branching on a
 * verdict, so a step removed from the list is a step this Worker stops taking.
 *
 * `OPERATOR_TOKEN` is a wrangler secret on THIS Worker, the same value the site Worker and the
 * GitHub repository secret hold, so rotation touches all three. Its absence is a NAMED state rather
 * than silence: `repairPlan` returns alert-only and the run still mails.
 */

/**
 * Where the alert goes, and where the repair door is.
 *
 * `ALERT_EMAIL` is a VAR rather than a secret: an inbox address is not a credential, so making it
 * one would spend `check:secrets`' signal on a value that grants nothing. It is still kept out of
 * git, because this repo is meant to be copied as a template. `check:config` reconciles the real
 * config and the tracked example in both directions.
 */
interface WatchdogEnv {
  /** The site Worker. See the 1042 measurement above for why this is a binding. */
  SITE: Fetcher;
  EMAIL: SendEmail;
  ALERT_EMAIL: string;
  OPERATOR_TOKEN?: string;
  /** Carries ONE fact between firings: what the last one saw. See `STATE_KEY`. */
  APP_KV: KVNamespace;
  /**
   * The account the invocations query is asked of, and the credential for it.
   * `CLOUDFLARE_ACCOUNT_ID` is a var on the `ALERT_EMAIL` precedent; `CLOUDFLARE_API_TOKEN` IS a
   * credential, a wrangler secret scoped to Account Analytics Read and nothing else.
   *
   * BOTH OPTIONAL, and their absence is a NAMED state rather than silence, so a watchdog that lost the
   * ability to see errors does not look like one seeing none.
   */
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

/**
 * Where the last firing's verdict is kept. Namespaced `watchdog:` because this shares the site's
 * KV with Better Auth sessions and the Ask answer cache, and a bare key in a shared namespace is how
 * two subsystems come to own one string.
 */
const STATE_KEY = "watchdog:alert-state";

/**
 * Reads the last firing's state. ABSENT AND UNREADABLE ARE DIFFERENT ANSWERS: absent means nothing
 * has run yet, which is a baseline and mails nothing, and unreadable means the dedupe is blind. A
 * blind dedupe that stays quiet is a monitor that silently stopped monitoring.
 */
async function readState(env: WatchdogEnv): Promise<{ readable: boolean; stored: unknown }> {
  try {
    return { readable: true, stored: await env.APP_KV.get(STATE_KEY, "json") };
  } catch (error) {
    console.error(
      JSON.stringify({
        watchdog: "state-read-failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return { readable: false, stored: null };
  }
}

/**
 * Writes the state. NEVER THROWS. A failed write costs the NEXT firing its dedupe, at worst one
 * duplicate mail; letting it throw would cost THIS firing its alert, which is the thing the Worker
 * exists to deliver.
 */
async function writeState(
  env: WatchdogEnv,
  state: { red: boolean; since: string; checks: string[] },
): Promise<void> {
  try {
    await env.APP_KV.put(STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error(
      JSON.stringify({
        watchdog: "state-write-failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/**
 * The sender, on `dustinedwards.info`, which is onboarded to Email Sending. NOT derived from
 * `SITE_ORIGIN`: that is `*.workers.dev` until the cutover and a `workers.dev` sender would be
 * refused, because the from-domain must be one onboarded for sending.
 */
const ALERT_FROM = { email: "watchdog@dustinedwards.info", name: "dustinedwards.info watchdog" };

/** One reading of the health endpoint. */
type Reading = { status: number; body: unknown; error?: string };

/**
 * Reads `/api/health` through the service binding.
 *
 * NEVER THROWS. A transport failure is returned as status 0 with a null body, which
 * `watchdogActions` turns into a notify: an endpoint that could not be reached must not be a reason
 * for this handler to die before it can say so. AND IT KEEPS THE CAUSE, because a timeout is a site
 * problem and a 1042 is this Worker's binding pointed somewhere it may not go.
 *
 * EXPORTED FOR ONE REASON: the worker test drives it with a `SITE` binding whose `fetch` throws,
 * which is the only way to observe the catch. `scheduled` is still the only caller in the deploy.
 */
export async function readHealth(env: WatchdogEnv): Promise<Reading> {
  try {
    const response = await env.SITE.fetch(`${SITE_ORIGIN}/api/health`, {
      headers: { "user-agent": "watchdog", "cache-control": "no-cache" },
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch (error) {
    return {
      status: 0,
      body: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * One repair call through the operator API. `miss` is empty when it converged; `unrepairable`
 * marks a refusal that repeating this call cannot fix.
 *
 * THE VERDICT IS READ, NEVER INFERRED FROM A 200, the same rule ship applies: this is an unattended
 * write and "the call returned" is not "the index agrees". The token goes in a header on a request
 * this Worker builds, and it is never logged and never echoed into the mail body.
 */
async function repair(
  env: WatchdogEnv,
  token: string,
  tool: string,
): Promise<{ miss: string; unrepairable: boolean }> {
  let response: Response;
  let payload: unknown;
  try {
    response = await env.SITE.fetch(`${SITE_ORIGIN}/api/operator`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "watchdog",
      },
      body: JSON.stringify({ tool, args: {} }),
    });
    payload = await response.json().catch(() => null);
  } catch (error) {
    return {
      miss: `${tool} did not complete: ${error instanceof Error ? error.message : String(error)}`,
      unrepairable: false,
    };
  }

  // The server's own sentence and the 422 rule live in the decision module, shared with
  // `scripts/health-repair.mjs`, which makes the identical call. Grounds on `refusalMiss`.
  if (!response.ok) return refusalMiss(tool, response.status, payload);

  const report = payload && typeof payload === "object" ? ((payload as any).data ?? payload) : null;
  if (!report || typeof report.converged !== "boolean") {
    return {
      miss: `${tool} answered without a converged verdict, so nothing was proven`,
      unrepairable: false,
    };
  }
  if (report.converged !== true) {
    return {
      miss: `${tool} ran and did not converge (${report.expected} expected, ${report.present} present)`,
      unrepairable: false,
    };
  }
  return { miss: "", unrepairable: false };
}

/**
 * Sends the alert.
 *
 * THE BODY CARRIES THE HEALTH JSON AND WHAT WAS ATTEMPTED, because a notification saying only
 * "unhealthy" costs the reader the entire triage. `text` only, no `html`: one reader, a JSON blob,
 * and an HTML part would be a second copy of the same words to keep in step.
 *
 * Returns whether it sent, so a failure to notify is a log line rather than nothing at all. There is
 * no further escalation to reach for: what remains is the ageing health tile and the hourly run.
 */
async function alert(env: WatchdogEnv, subject: string, lines: string[]): Promise<boolean> {
  try {
    await env.EMAIL.send({
      to: env.ALERT_EMAIL,
      from: ALERT_FROM,
      subject,
      text: lines.join("\n"),
    });
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        alert: "watchdog-notify-failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  }
}

/**
 * The site's error rate over the last window, read from Cloudflare's own numbers rather than from
 * anything the site says about itself.
 *
 * NOT A SIXTH HEALTH CHECK. Those five are drift checks, each repairable through the operator door,
 * and an error rate is a SYMPTOM. Folding it in would also add a round trip to a rate-limited route,
 * and since `ship` refuses to proceed unless `/api/health` reports ok, an error spike would start
 * blocking the deploy of the fix.
 *
 * NEVER THROWS, on this file's standing rule, and every failure is reported as NOT OK: a check that
 * could not read the error rate has not established that it is fine.
 *
 * NOT CONFIGURED IS ITS OWN ANSWER and is ok, a state to report rather than an alert to send.
 */
async function readErrorRate(
  env: WatchdogEnv,
): Promise<{ ok: boolean; detail: string; configured: boolean }> {
  const account = env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const token = env.CLOUDFLARE_API_TOKEN ?? "";
  if (!account || !token) {
    return {
      ok: true,
      configured: false,
      detail:
        "error rate NOT CHECKED: " +
        `${!account ? "CLOUDFLARE_ACCOUNT_ID" : "CLOUDFLARE_API_TOKEN"} is not set on this ` +
        "Worker. Set it with `wrangler secret put CLOUDFLARE_API_TOKEN -c " +
        "wrangler.watchdog.jsonc` (Account / Account Analytics / Read).",
    };
  }

  const until = new Date();
  const since = new Date(until.getTime() - ERROR_WINDOW_MINUTES * 60 * 1000);
  const body = errorRateQuery({
    accountId: account,
    scriptName: SITE_SCRIPT_NAME,
    since: since.toISOString(),
    until: until.toISOString(),
  });

  let payload: any;
  try {
    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        detail: `the invocations query answered HTTP ${response.status}, so the error rate is unknown.`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      configured: true,
      detail:
        "the invocations query did not complete, so the error rate is unknown: " +
        `${error instanceof Error ? error.message : String(error)}`,
    };
  }

  /*
   * A GRAPHQL 200 CARRYING ERRORS IS A FAILURE: the transport succeeded and the query did not, so a
   * reader that checked only the status code would sum an absent `data` field to zero errors and
   * report perfect health.
   */
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    return {
      ok: false,
      configured: true,
      detail:
        "the invocations query returned GraphQL errors, so the error rate is unknown: " +
        `${payload.errors.map((e: any) => e?.message).join("; ").slice(0, 200)}`,
    };
  }

  const verdict = errorRateVerdict(
    payload?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive,
  );
  return { ok: verdict.ok, configured: true, detail: verdict.detail };
}

/** The health body, pretty-printed for the mail, or a statement that there was none. */
const renderBody = (reading: Reading | null): string =>
  reading === null
    ? "(no reading was taken)"
    : reading.status === 0
      ? // A reading that never reached the endpoint has no body worth printing
        // and one thing worth printing, so it prints that instead of "null".
        `HTTP 0 (the request did not complete)\n${reading.error ?? "(no cause was recorded)"}`
      : `HTTP ${reading.status}\n${JSON.stringify(reading.body, null, 2)}`;

export default {
  /**
   * One firing. WRAPPED, AND THE THROW IS RE-RAISED: everything inside is written not to throw, so
   * the catch means an assumption broke. A Cron Trigger that throws is recorded as a failed
   * invocation, and swallowing that trades the last remaining signal for a tidy log.
   */
  async scheduled(_controller: ScheduledController, env: WatchdogEnv): Promise<void> {
    try {
      const token = env.OPERATOR_TOKEN ?? "";
      const reading = await readHealth(env);
      const actions = watchdogActions(reading, { hasToken: token.length > 0 });

      /*
       * WHAT THIS FIRING CONCLUDED. THE REPAIRS STILL RUN EVERY FIRING and only the MAIL is
       * deduplicated, so `alerting` describes where the firing ENDED rather than what it first read.
       */
      let alerting = false;
      let subject = "";
      let lines: string[] = [];
      let failing: string[] = [];

      if (actions.length === 0) {
        console.log(JSON.stringify({ watchdog: "healthy", status: reading.status }));
      } else {
        const notify = actions.filter((a) => a.type === "notify");
        if (notify.length > 0) {
          const reasons = notify.map((a) => (a as { reason: string }).reason);
          console.error(JSON.stringify({ watchdog: "alerting", reasons }));
          alerting = true;
          failing = failingCheckNames(reading.body);
          subject = "dustinedwards.info is unhealthy";
          lines = [...reasons, "", "Nothing was repaired.", "", renderBody(reading)];
        } else {
          /*
           * THE ACTION LIST IS WALKED, NEVER SECOND-GUESSED. Content before Ask, because the Ask corpus is
           * read out of what the content repair rewrites, and the recheck runs only because the list asked.
           */
          const attempted: string[] = [];
          const misses: string[] = [];
          /*
           * A REFUSAL ABANDONS THE REST OF THE LIST. Once the content repair has been REFUSED the Ask corpus
           * is known-stale, and uploading it is a write on a premise the previous call just denied.
           */
          let refused = false;
          for (const action of actions) {
            if (action.type !== "repair") continue;
            attempted.push(action.tool);
            const outcome = await repair(env, token, action.tool);
            if (!outcome.miss) continue;
            misses.push(outcome.miss);
            if (outcome.unrepairable) {
              refused = true;
              break;
            }
          }

          const recheck = actions.some((a) => a.type === "recheck") ? await readHealth(env) : null;
          const outcome = watchdogOutcome({ misses, recheck });

          console.log(
            JSON.stringify({
              watchdog: "repaired",
              attempted,
              misses,
              recheckStatus: recheck?.status ?? null,
              alerting: outcome.length > 0,
            }),
          );

          if (outcome.length > 0) {
            alerting = true;
            failing = failingCheckNames((recheck ?? reading).body);
            subject = refused
              ? "dustinedwards.info: self-repair was refused, a deploy is the repair"
              : "dustinedwards.info: self-repair did not settle it";
            lines = [
              ...outcome.map((a) => (a as { reason: string }).reason),
              ...(refused
                ? [
                    "",
                    "The operator API REFUSED the content itself (422), so repeating this " +
                      "cannot converge. That is what a repository ahead of the deployed " +
                      "build looks like: the content is valid and the renderer in " +
                      "production is older than it. Deploy (npm run ship), then let the " +
                      "next poll converge it.",
                  ]
                : []),
              "",
              `Attempted: ${attempted.join(", ") || "(nothing)"}`,
              "",
              "Health BEFORE the repair:",
              renderBody(reading),
              "",
              "Health AFTER the repair:",
              renderBody(recheck),
            ];
          }
        }
      }

      /*
       * THE ERROR RATE, FOLDED IN AS ONE MORE FAILING CHECK. READ EVERY FIRING, whatever health said:
       * the two are independent, and the defect this was written for had every check green while the
       * Worker threw for days. It joins `failing` rather than mailing on its own, which buys the dedupe
       * for free, and it IS NOT REPAIRABLE: a rebuild fired at a throwing Worker acts on a symptom whose
       * cause nobody has classified.
       */
      const errorRate = await readErrorRate(env);
      console.log(
        JSON.stringify({
          watchdog: "error-rate",
          ok: errorRate.ok,
          configured: errorRate.configured,
          detail: errorRate.detail,
        }),
      );
      if (!errorRate.ok) {
        if (!alerting) {
          // First thing to go wrong this firing, so it owns the subject line.
          subject = "dustinedwards.info is throwing";
          lines = [errorRate.detail];
        } else {
          // Health already had something to say. Both are reported, on the N-1-of-N rule: a mail naming only
          // the drift would send somebody to re-run a sync while the Worker was crashing.
          lines = [...lines, "", `Error rate: ${errorRate.detail}`];
        }
        alerting = true;
        failing = [...failing, "error-rate"];
      }

      /*
       * ONE MAIL PER CHANGE OF STATE. Every decision is in `alert-state.mjs`, which is pure and covered
       * by `check:tests`; this reads KV, writes KV and sends, and decides nothing.
       */
      const { readable, stored } = await readState(env);
      const now = new Date().toISOString();
      const transition = alertTransition({ stored, storedReadable: readable, alerting, failing, now });

      console.log(
        JSON.stringify({
          watchdog: "alert-decision",
          alerting,
          failing,
          storedReadable: readable,
          email: transition.email?.kind ?? "none",
          reason: transition.reason,
        }),
      );

      if (transition.write) await writeState(env, transition.state);

      if (transition.email?.kind === "opened") {
        const changed = transition.email.checks;
        await alert(env, subject, [
          `Changed to unhealthy. Failing now: ${changed.join(", ") || "(the endpoint named none)"}.`,
          "",
          "You will not be mailed again about this until it recovers.",
          "",
          ...lines,
        ]);
      } else if (transition.email?.kind === "recovered") {
        const was = transition.email.checks;
        await alert(env, "dustinedwards.info recovered", [
          `Health is green again after ${formatDuration(transition.email.durationMs)}.`,
          "",
          `Was failing: ${was.join(", ") || "(the endpoint named none)"}.`,
          "",
          renderBody(reading),
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ watchdog: "threw", error: message }));
      await alert(env, "dustinedwards.info watchdog THREW", [
        "The watchdog itself failed, so this firing proved nothing about the site.",
        "",
        message,
      ]);
      throw error;
    }
  },
} satisfies ExportedHandler<WatchdogEnv>;
