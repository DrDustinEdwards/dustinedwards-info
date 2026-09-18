/**
 * SELF-REPAIR FOR A FAILING HEALTH RUN. The I/O half.
 *
 *   node scripts/health-repair.mjs --origin <origin> --body body.json
 *
 * Called by the health workflow when `/api/health` reports unhealthy. Decides through the shared
 * decision module, performs the repairs that decision allows, re-polls ONCE, and exits.
 *
 * EXIT CODES ARE THE ALERT: 0 means something drifted, this repaired it and the re-poll came back
 * healthy; 1 means a person is emailed. There is no third state.
 *
 * **`process.exitCode`, NEVER `process.exit()`**, measured: exiting immediately after a fetch
 * terminated node with a Windows exception rather than with the code, because the exit raced the
 * socket teardown, and an exit code nobody can explain is a bad thing to hand a monitor.
 *
 * ONE RE-POLL, NOT A LOOP. Both repairs derive their own converged verdict, so a successful call
 * has ALREADY proved the index agrees; the re-poll confirms the endpoint agrees too. A loop would
 * be a monitor arguing with itself. Ship polls because it reads counts back within milliseconds of
 * an upload; this runs at least one scheduled interval later.
 *
 * THE TOKEN is read from the environment, never logged, never an argument, and its ABSENCE is
 * reported as a named configuration state rather than as a failure to repair.
 */

import { readFileSync } from "node:fs";

import { failingCheckNames, refusalMiss, repairPlan } from "../app/lib/health/repair.mjs";

const args = process.argv.slice(2);
const flag = (/** @type {string} */ name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? "" : (args[at + 1] ?? "");
};

/** GitHub Actions renders this as an annotation, which is what reaches the email. */
const annotate = (/** @type {string} */ message) => console.log(`::error::${message}`);

/**
 * One repair call.
 *
 * @returns {Promise<{ miss: string, unrepairable: boolean }>} `miss` is empty
 * when the tool converged. `unrepairable` marks a refusal that repeating this
 * call cannot fix, which is a different thing from a repair that did not work.
 */
async function repair(/** @type {string} */ origin, /** @type {string} */ token, /** @type {string} */ tool) {
  let response = null;
  let payload = null;
  try {
    response = await fetch(`${origin}/api/operator`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "health-repair",
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

  // The server's own sentence and the status rule both live in the decision module, because the
  // watchdog makes the identical call and the two copies of this had already drifted.
  if (!response.ok) return refusalMiss(tool, response.status, payload);

  const report = payload && typeof payload === "object" ? (payload.data ?? payload) : null;
  // The same rule ship applies: the verdict is READ, never assumed from a 200.
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

/** @returns {Promise<number>} the exit code */
async function main() {
  const origin = flag("origin").replace(/\/+$/, "");
  const bodyPath = flag("body");
  const token = process.env.OPERATOR_TOKEN ?? "";

  if (!origin || !bodyPath) {
    annotate("health-repair was called without --origin and --body. Nothing was attempted.");
    return 1;
  }

  let body = null;
  try {
    body = JSON.parse(readFileSync(bodyPath, "utf8"));
  } catch (error) {
    annotate(
      `health-repair could not read the health body at ${bodyPath}: ` +
        `${error instanceof Error ? error.message : String(error)}. Alerting.`,
    );
    return 1;
  }

  const failing = failingCheckNames(body);
  const plan = repairPlan(failing, { hasToken: token.length > 0 });

  console.log(`failing checks: ${failing.length ? failing.join(", ") : "(none named)"}`);
  console.log(plan.reason);

  if (plan.alertOnly) {
    annotate(plan.reason);
    return 1;
  }

  const misses = [];
  let refused = false;
  for (const [index, tool] of plan.repair.entries()) {
    console.log(`repairing: ${tool}`);
    const outcome = await repair(origin, token, tool);
    if (!outcome.miss) {
      console.log(`  ${tool} converged.`);
      continue;
    }
    misses.push(outcome.miss);

    /*
     * A REFUSAL ABANDONS THE REST OF THE PLAN: the Ask upload reads the store the content repair
     * rewrites, so when the content repair REFUSED the store is not merely stale, it is known-stale,
     * and uploading it is a write made on a premise the previous call just denied.
     */
    if (outcome.unrepairable) {
      refused = true;
      const skipped = plan.repair.slice(index + 1);
      if (skipped.length > 0) {
        console.log(`  not attempted, the refusal stands: ${skipped.join(", ")}`);
      }
      break;
    }
  }

  if (misses.length > 0) {
    annotate(
      refused
        ? `Self-repair REFUSED: ${misses.join("; ")}. A repair cannot fix this and ` +
            `repeating it cannot converge: the operator API rejected the content itself, ` +
            `which is what a repository ahead of the deployed build looks like. Deploy ` +
            `the build that renders this content (npm run ship), then let the next poll ` +
            `converge it.`
        : `Self-repair FAILED: ${misses.join("; ")}. The drift stands.`,
    );
    return 1;
  }

  /*
   * THE RE-POLL. The repair proved its own index; this proves the ENDPOINT is healthy, which is a
   * wider claim and the one the workflow reports on.
   */
  let status = 0;
  let after = null;
  try {
    const response = await fetch(`${origin}/api/health`, {
      headers: { "user-agent": "health-repair", "cache-control": "no-cache" },
    });
    status = response.status;
    after = await response.json().catch(() => null);
  } catch (error) {
    annotate(
      `Self-repair ran, but the re-poll failed: ` +
        `${error instanceof Error ? error.message : String(error)}.`,
    );
    return 1;
  }

  const stillFailing = failingCheckNames(after);
  if (status !== 200 || after?.ok !== true) {
    annotate(
      `Self-repair ran and the endpoint is still unhealthy (HTTP ${status}` +
        `${stillFailing.length ? `, failing: ${stillFailing.join(", ")}` : ""}).`,
    );
    return 1;
  }

  console.log(`Repaired: ${plan.repair.join(", ")}. Re-poll healthy (HTTP ${status}).`);
  return 0;
}

process.exitCode = await main();
