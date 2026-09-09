/*
 * RELATIVE IMPORTS, DELIBERATELY, where the rest of workers/ uses `~/`.
 *
 * `workers/app.ts` and `workers/media-events.ts` are built by Vite through the
 * React Router build, which resolves the `~/*` tsconfig path. This Worker is
 * built by `wrangler deploy -c wrangler.watchdog.jsonc`, which bundles with
 * esbuild directly and does not read that mapping. A `~/` specifier here would
 * typecheck and fail at deploy.
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
 * The Worker the error rate is asked about.
 *
 * The SITE, never this watchdog. Written out rather than derived from
 * SITE_ORIGIN, because the origin is a hostname and this is a script name: they
 * are equal today by coincidence of naming and the cutover changes one of them.
 * `check:config` binds it to the site config's `name`.
 */
const SITE_SCRIPT_NAME = "dustinedwards";

/**
 * THE WATCHDOG. A separate Worker whose only job is to notice that this site
 * has stopped being healthy, repair what it can, and wake somebody otherwise.
 *
 * Ruled 2026-08-29. `.github/workflows/health.yml` has done this since
 * 2026-08-23 and its own docblock explains why an in-Worker watcher was
 * rejected: a watcher that runs inside the thing it watches dies with it. That
 * argument is still correct and this Worker does not contradict it. **A
 * SEPARATE Worker on the same account has the property the rejection wanted**
 * against everything except a Cloudflare-wide outage, in which case the site is
 * down anyway and there is nothing to report.
 *
 * ## WHY IT EXISTS AT ALL: THE GITHUB SCHEDULE IS NOT RUNNING
 *
 * MEASURED 2026-08-28 over the run history. Against 96 expected firings a day,
 * the every-fifteen-minutes schedule fired **38 times on 08-23 and 2 times on
 * 08-28**. Every run that fires succeeds; the daily browser cron decays the
 * same way. `health.yml`'s own note (2) predicted this in prose ("a 15-minute
 * cadence is a request, not a promise") and note (1) named the failure mode
 * that makes it invisible. Self-repair was effectively not running, and the
 * inbox looked exactly as it does when everything is fine.
 *
 * A Cron Trigger is not best-effort in the same way. It is the platform's own
 * scheduler on the account that runs the site.
 *
 * ## THE MEASUREMENT THAT DECIDED THE TRANSPORT, AND IT IS NOT WHAT WAS SPECCED
 *
 * This was specified as "GET the site's /api/health". **A Worker cannot do
 * that to this site.** Measured 2026-08-29 from a throwaway Worker on the edge,
 * with a control:
 *
 *     fetch("https://example.com/")                    200   <- control
 *     fetch("<site>/")                                 404, Cloudflare 1042
 *     fetch("<site>/api/health")                       404, Cloudflare 1042
 *     env.SITE.fetch("<site>/api/health")              200, the real body
 *
 * Error 1042 is the Worker-to-Worker-on-one-zone restriction, and the docs say
 * the replacement outright: "Using global fetch() to call another Worker on the
 * same zone without service bindings fails. Workers accept requests sent to a
 * Custom Domain." This site is on `*.workers.dev` and has no custom domain
 * until the DNS cutover, so a service binding is the ONLY mechanism available.
 * The control matters: it proves the probe's `fetch` worked, so the two 1042s
 * are a fact about this host rather than about the instrument.
 *
 * **WHAT THAT COSTS, STATED RATHER THAN BURIED.** A service binding invokes the
 * site Worker directly. It therefore proves the health suite RUNS and that
 * every invariant holds; it does NOT prove the site is reachable from the
 * internet. A broken route or a DNS fault with a healthy Worker is invisible
 * here. That coverage is why `health.yml` survives at all: it now runs hourly,
 * off-platform, as the second and slower opinion, and it is the only instrument
 * that speaks from outside Cloudflare. The cutover retires the gap.
 *
 * ## THE HEALTH CALL IS THE LIVENESS SIGNAL, AND IT IS ALREADY ON THE PAGE
 *
 * `/api/health` writes the KV snapshot on the way out, for both verdicts. The
 * home page's health tile renders that snapshot's AGE and nothing else. So
 * **the tile's freshness IS this Worker's liveness**: if the watchdog stops
 * firing, the snapshot ages and the front page says so, with no second timer
 * and nothing new to monitor. That is also what the production freshness
 * assertion in `check:browser` reads, which is why it can prove this Worker
 * fired since a deploy without ever talking to it.
 *
 * The corollary is the part worth remembering: nothing here writes the snapshot
 * itself, and nothing may. The snapshot is a byproduct of a run that happened
 * anyway (`app/lib/health/snapshot.mjs`), and a watchdog that stamped it
 * directly would be manufacturing its own alibi.
 *
 * ## THROTTLING, MEASURED RATHER THAN ASSUMED
 *
 * `/api/health` is rate limited at 20 per 60 seconds per caller identity, and
 * there is NO bypass and no authenticated shape: the endpoint is
 * unauthenticated and takes no credential at all. So this Worker grows neither.
 *
 * Measured 2026-08-29 by bursting the service binding: calls share ONE bucket
 * and the eighteenth was refused. This fires once per 900 seconds against an
 * allowance of 20 per 60, which is roughly three orders of magnitude of
 * headroom, and the bucket is not shared with public traffic because every
 * request off the edge carries its own `cf-connecting-ip`.
 *
 * And the failure is LOUD rather than silent. A refusal answers 429 with a body
 * naming `rate-limited`, which is deliberately not a repairable class, so it
 * reaches the unknown arm and sends mail naming the throttle. A throttled
 * watchdog wakes somebody; it does not quietly report health.
 *
 * ## WHAT IS DECIDED HERE: NOTHING
 *
 * Every decision is in `app/lib/health/repair.mjs`, which is pure, imports
 * nothing and never fetches. This file is the I/O half, on the same split as
 * `scripts/health-repair.mjs`, and for the reason that split exists: a Cron
 * Trigger fires unattended and the only firings whose behaviour matters are the
 * ones nobody is watching. What can be tested is, and this walks an action list
 * rather than branching on a verdict, so a step removed from the list is a step
 * this Worker stops taking.
 *
 * ## THE SECRET
 *
 * `OPERATOR_TOKEN`, a wrangler secret on THIS Worker, set separately from the
 * one on the site. It is the same value and there are now THREE holders of it
 * (the site Worker, this Worker, and the GitHub repository secret), so rotation
 * touches all three; CLAUDE.md's bindings section carries that note.
 *
 * Its absence is a NAMED configuration state, never silence: `repairPlan`
 * returns alert-only and the run still mails. A monitor that quietly lost the
 * ability to act looks exactly like one that never needed to.
 */

/**
 * Where the alert goes, and where the repair door is.
 *
 * `ALERT_EMAIL` is a VAR rather than a secret, on the `CLOUDFLARE_ACCOUNT_ID`
 * precedent: an inbox address is not a credential, so making it a secret would
 * spend `check:secrets`' signal on a value that grants nothing. It is still
 * kept out of git, because this repo is meant to be copied as a template and a
 * personal address in a tracked config is the thing that leaks on the day it is
 * copied. Real value in the gitignored `wrangler.watchdog.jsonc`, placeholder
 * in the tracked example, reconciled in both directions by `check:config`.
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
   *
   * `CLOUDFLARE_ACCOUNT_ID` is a VAR on the `ALERT_EMAIL` precedent: an account
   * id is an identifier rather than a credential. `CLOUDFLARE_API_TOKEN` IS a
   * credential and is a wrangler secret, scoped to Account Analytics Read and
   * nothing else, because all it does is run one read-only GraphQL query.
   *
   * BOTH OPTIONAL, and their absence is a NAMED state rather than silence, the
   * same shape `OPERATOR_TOKEN` takes above: `errorRateReading` reports "not
   * configured" and the firing says so, so a watchdog that quietly lost the
   * ability to see errors does not look like one seeing none.
   */
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

/**
 * Where the last firing's verdict is kept.
 *
 * Namespaced with a `watchdog:` prefix because this shares the site's KV with
 * Better Auth sessions and the Ask answer cache, and a bare key in a shared
 * namespace is how two subsystems come to own one string.
 */
const STATE_KEY = "watchdog:alert-state";

/**
 * Reads the last firing's state.
 *
 * **ABSENT AND UNREADABLE ARE DIFFERENT ANSWERS**, and collapsing them is the
 * failure this signature exists to prevent. Absent means nothing has run yet,
 * which is a baseline and mails nothing. Unreadable means the dedupe is blind,
 * and a blind dedupe that stays quiet is a monitor that silently stopped
 * monitoring. `alertTransition` mails on the second and not the first.
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
 * Writes the state. NEVER THROWS.
 *
 * A failed write costs the NEXT firing its dedupe, which at worst means one
 * duplicate mail. Letting it throw would cost THIS firing its alert, which is
 * the thing the whole Worker exists to deliver. The cheap failure is the right
 * one to take.
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
 * The sender. On `dustinedwards.info`, which is onboarded to Email Sending
 * (measured 2026-08-29: `wrangler email sending list` reports it enabled).
 *
 * NOT derived from `SITE_ORIGIN`, and that is deliberate rather than an
 * oversight. `SITE_ORIGIN` is `*.workers.dev` until the cutover, and a
 * `workers.dev` sender would be refused: the from-domain must be one onboarded
 * for sending. The mail domain and the serving origin are separate facts that
 * happen to converge later.
 */
const ALERT_FROM = { email: "watchdog@dustinedwards.info", name: "dustinedwards.info watchdog" };

/** One reading of the health endpoint. */
type Reading = { status: number; body: unknown };

/**
 * Reads `/api/health` through the service binding.
 *
 * NEVER THROWS. A transport failure is returned as status 0 with a null body,
 * which `watchdogActions` turns into a notify: an endpoint that could not be
 * reached is a reason to wake somebody, and it must not be a reason for this
 * handler to die before it can send the mail saying so.
 *
 * `cache-control: no-cache` is belt only. The route declares `no-store` and a
 * service binding does not go through the edge cache at all, but a reading that
 * could be served from anywhere is not a health check, and stating it costs a
 * header.
 */
async function readHealth(env: WatchdogEnv): Promise<Reading> {
  try {
    const response = await env.SITE.fetch(`${SITE_ORIGIN}/api/health`, {
      headers: { "user-agent": "watchdog", "cache-control": "no-cache" },
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch {
    return { status: 0, body: null };
  }
}

/**
 * One repair call through the operator API. `miss` is empty when it converged;
 * `unrepairable` marks a refusal that repeating this call cannot fix.
 *
 * THE VERDICT IS READ, NEVER INFERRED FROM A 200. Same rule ship applies, and
 * the same four refusals in the same order, because this is an unattended write
 * and "the call returned" is not "the index agrees".
 *
 * The token goes in a header on a request this Worker builds. It is never
 * logged and never echoed into the mail body.
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

  // The server's own sentence and the 422 rule live in the decision module,
  // shared with `scripts/health-repair.mjs`, which makes the identical call.
  // Grounds on `refusalMiss`.
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
 * THE BODY CARRIES THE HEALTH JSON AND WHAT WAS ATTEMPTED, because a
 * notification that says only "unhealthy" costs the reader the entire triage,
 * which is the defect the 2026-08-23 flap was diagnosed as: "which check
 * failed" was all anyone had, and one record apart during a rebuild and a
 * hundred apart are the same alert while only one of them is an incident.
 *
 * `text` only, no `html`. There is one reader, the content is a JSON blob and a
 * list, and an HTML part would be a second copy of the same words to keep in
 * step for no gain.
 *
 * Returns whether it sent, so a failure to notify is at least a log line rather
 * than nothing at all. There is no further escalation to reach for: if the mail
 * cannot go, the remaining signal is the home page's ageing health tile and the
 * hourly GitHub run.
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
 * The site's error rate over the last window, read from Cloudflare's own
 * numbers rather than from anything the site says about itself.
 *
 * ## WHY THIS IS HERE AND NOT A SIXTH HEALTH CHECK
 *
 * `/api/health`'s five checks are all DRIFT checks: a derived store against its
 * source, each one repairable through the operator door. An error rate is a
 * SYMPTOM, it is not repairable, and folding it into that endpoint would have
 * two costs worth refusing. It would add a GraphQL round trip to a route
 * already measured at 1.2 to 4.6 seconds and rate limited at 20 per minute; and
 * because `ship` refuses to proceed unless `/api/health` reports ok, a transient
 * error spike would start blocking DEPLOYS, which is the opposite of useful
 * when the thing you want to ship is the fix.
 *
 * So it lives where the alerting lives. The watchdog already fires every
 * fifteen minutes, already deduplicates its mail, and already knows how to
 * report a failing check by name.
 *
 * NEVER THROWS, on this file's standing rule. Every failure returns a verdict:
 * an unreachable API or a GraphQL error is reported as NOT OK, because an
 * error-rate check that could not read the error rate has not established that
 * it is fine. That is the fail-closed direction, and `errorRateVerdict` takes
 * the same stance about an unreadable body.
 *
 * NOT CONFIGURED IS ITS OWN ANSWER, and it is `ok: true` with a detail saying
 * so. It is a state to report rather than an alert to send: mailing every
 * fifteen minutes about a missing var would train the reader to filter the
 * watchdog, and the run log names it on every firing either way.
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
   * A GraphQL 200 CARRYING ERRORS IS A FAILURE, and this is the trap that shape
   * of API sets: the transport succeeded and the query did not, so a reader
   * that only checked the status code would go on to sum an absent `data` field
   * to zero errors and report perfect health.
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
    : `HTTP ${reading.status}\n${JSON.stringify(reading.body, null, 2)}`;

export default {
  /**
   * One firing.
   *
   * WRAPPED, AND THE THROW IS RE-RAISED. Everything inside is written not to
   * throw, so reaching the catch means an assumption broke rather than a
   * dependency failed. It tries to mail, then rethrows: a Cron Trigger that
   * throws is recorded by the platform as a failed invocation, and swallowing
   * that would trade the last remaining signal for a tidy log.
   */
  async scheduled(_controller: ScheduledController, env: WatchdogEnv): Promise<void> {
    try {
      const token = env.OPERATOR_TOKEN ?? "";
      const reading = await readHealth(env);
      const actions = watchdogActions(reading, { hasToken: token.length > 0 });

      /*
       * WHAT THIS FIRING CONCLUDED, decided before anything is mailed.
       *
       * THE REPAIRS STILL RUN EVERY FIRING. Only the MAIL is deduplicated: a
       * condition that can be fixed is fixed on every poll exactly as before,
       * and `alerting` describes where the firing ENDED, after any repair, not
       * what the first reading looked like. Fixing something silently is the
       * behaviour the repair path was built for and is untouched here.
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
           * THE ACTION LIST IS WALKED, NEVER SECOND-GUESSED. The repairs run in
           * the order the module gave them (content before Ask, because the Ask
           * corpus is read out of what the content repair rewrites), and the
           * recheck runs only because the list asked for one. Deleting it there
           * stops it happening here, which is the coupling that makes the plant
           * meaningful.
           */
          const attempted: string[] = [];
          const misses: string[] = [];
          /*
           * A REFUSAL ABANDONS THE REST OF THE LIST. The ordering note above is
           * the reason: the Ask corpus is read out of what the content repair
           * rewrites, so once that repair has been REFUSED the corpus is
           * known-stale and uploading it is a write on a premise the previous
           * call just denied.
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
       * ## THE ERROR RATE, FOLDED IN AS ONE MORE FAILING CHECK
       *
       * READ EVERY FIRING, whatever the health verdict said, because the two
       * are independent: the defect this was written for had all five health
       * checks green while the Worker threw 24 times a day for fifteen days.
       * Reading it only when health was already red would have found nothing.
       *
       * IT JOINS `failing` RATHER THAN MAILING ON ITS OWN. That is what buys
       * the dedupe for free: `alertTransition` mails on the way into red, on
       * recovery, and when the failing set GROWS, so a rate that stays high for
       * an afternoon sends one mail rather than sixteen. A second mail path
       * would have had to reimplement that, and would have got it wrong,
       * because the 27-email flap is exactly what that module exists about.
       *
       * IT IS NOT REPAIRABLE and deliberately not in `REPAIRABLE`. Firing a
       * corpus rebuild at a Worker that is throwing would be acting on a
       * symptom whose cause nobody has classified, which `repairPlan`'s first
       * refusal already says in full.
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
          // Health already had something to say. Both are reported, on the
          // N-1-of-N rule: a mail naming only the drift would send somebody to
          // re-run a sync while the Worker was crashing.
          lines = [...lines, "", `Error rate: ${errorRate.detail}`];
        }
        alerting = true;
        failing = [...failing, "error-rate"];
      }

      /*
       * ONE MAIL PER CHANGE OF STATE. Every decision is in `alert-state.mjs`,
       * which is pure and covered by `check:tests`; this reads KV, writes KV and
       * sends, and decides nothing.
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
