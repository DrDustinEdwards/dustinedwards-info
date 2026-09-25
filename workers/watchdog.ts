// Relative imports on purpose: this Worker's esbuild bundle does not read the `~/` tsconfig mapping,
// so `~/` here would typecheck and then fail at deploy.
import {
  failingCheckNames,
  refusalMiss,
  watchdogActions,
  watchdogOutcome,
} from "../app/lib/health/repair.mjs";
import {
  alertTransition,
  deliverTransition,
  formatDuration,
} from "../app/lib/health/alert-state.mjs";
import {
  ERROR_WINDOW_MINUTES,
  errorRateQuery,
  errorRateVerdict,
} from "../app/lib/health/error-rate.mjs";
import { SITE_ORIGIN } from "../app/lib/seo";

// A script name, not a hostname, so not derived from SITE_ORIGIN. Must equal the site config's `name`.
const SITE_SCRIPT_NAME = "dustinedwards";

/**
 * A separate Worker because a watcher inside the site dies with it. It reaches the site only through
 * the `SITE` service binding (error 1042 refuses same-zone Worker fetch), so it cannot prove the site
 * is reachable from outside. It must never write the health snapshot, whose age is its liveness.
 */

// `ALERT_EMAIL` is a var, not a secret: an inbox address grants nothing.
interface WatchdogEnv {
  SITE: Fetcher;
  EMAIL: SendEmail;
  ALERT_EMAIL: string;
  OPERATOR_TOKEN?: string;
  APP_KV: KVNamespace;
  // Optional, and absence is reported by name so losing sight of errors never looks like seeing none.
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

// Namespaced because this KV is shared with Better Auth sessions and the Ask cache.
const STATE_KEY = "watchdog:alert-state";

// Absent and unreadable differ: unreadable means the dedupe is blind, and it must not stay quiet.
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

// Never throws: a failed write costs at worst one duplicate mail, a throw would cost this alert.
async function writeState(
  env: WatchdogEnv,
  state: { red: boolean; since: string; checks: string[] },
): Promise<void> {
  try {
    await env.APP_KV.put(STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error(
      JSON.stringify({
        alert: "watchdog-state-write-failed",
        watchdog: "state-write-failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

// Not derived from SITE_ORIGIN: that is `*.workers.dev`, which Email Sending would refuse as a sender.
const ALERT_FROM = { email: "watchdog@dustinedwards.info", name: "dustinedwards.info watchdog" };

type Reading = { status: number; body: unknown; error?: string };

// Never throws, and keeps the cause: a timeout is a site problem, a 1042 is a misdirected binding.
// Exported only so the worker test can drive the catch.
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

// The verdict is read, never inferred from a 200. The token is never logged or put in the mail.
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

  if (!response.ok) return refusalMiss(tool, response.status, payload);

  const report = (
    payload && typeof payload === "object"
      ? ((payload as { data?: unknown }).data ?? payload)
      : null
  ) as { converged?: unknown; expected?: unknown; present?: unknown } | null;
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
 * Not a health check: `ship` refuses unless `/api/health` is ok, so an error spike there would block
 * deploying the fix. Never throws, and any failure to read the rate is reported as not ok.
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

  // A GraphQL 200 can carry errors; an absent `data` would otherwise sum to zero errors.
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

const renderBody = (reading: Reading | null): string =>
  reading === null
    ? "(no reading was taken)"
    : reading.status === 0
      ? // No body reached us, so print the cause rather than "null".
        `HTTP 0 (the request did not complete)\n${reading.error ?? "(no cause was recorded)"}`
      : `HTTP ${reading.status}\n${JSON.stringify(reading.body, null, 2)}`;

export default {
  // Re-raised: a throwing Cron Trigger is recorded as a failed invocation, the last signal left.
  async scheduled(_controller: ScheduledController, env: WatchdogEnv): Promise<void> {
    try {
      const token = env.OPERATOR_TOKEN ?? "";
      const reading = await readHealth(env);
      const actions = watchdogActions(reading, { hasToken: token.length > 0 });

      // Repairs run every firing and only the mail is deduplicated, so `alerting` is where it ended.
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
          const attempted: string[] = [];
          const misses: string[] = [];
          // A refusal abandons the rest: the Ask corpus is read from what content repair writes.
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

      // Read every firing, whatever health said: checks can all be green while the Worker throws.
      // Never repaired; a rebuild aimed at a throwing Worker treats an unclassified symptom.
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
          subject = "dustinedwards.info is throwing";
          lines = [errorRate.detail];
        } else {
          lines = [...lines, "", `Error rate: ${errorRate.detail}`];
        }
        alerting = true;
        failing = [...failing, "error-rate"];
      }
      // An unconfigured rate reads ok, so every mail says it was not checked rather than implying it was.
      const errorRateNote = errorRate.configured ? [] : ["", errorRate.detail];

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

      const email = transition.email;
      const delivered = await deliverTransition(transition, {
        send: () =>
          email?.kind === "opened"
            ? alert(env, subject, [
                `Changed to unhealthy. Failing now: ${email.checks.join(", ") || "(the endpoint named none)"}.`,
                "",
                "You will not be mailed again about this until it recovers.",
                "",
                ...lines,
                ...errorRateNote,
              ])
            : alert(env, "dustinedwards.info recovered", [
                `Health is green again after ${formatDuration(email?.durationMs ?? null)}.`,
                "",
                `Was failing: ${email?.checks.join(", ") || "(the endpoint named none)"}.`,
                "",
                renderBody(reading),
                ...errorRateNote,
              ]),
        write: () => writeState(env, transition.state),
      });
      // Thrown so the firing is recorded as failed; the unchanged state makes the next one retry.
      if (!delivered) {
        throw new Error(`the ${email?.kind} mail did not send, so the alert state was left unchanged`);
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
