// Re-polls once and exits, because a loop here would be a monitor arguing with itself.
// The exit code is the alert: 0 repaired and healthy, 1 emails a person.

import { readFileSync } from "node:fs";

import { failingCheckNames, refusalMiss, repairPlan } from "../app/lib/health/repair.mjs";

const args = process.argv.slice(2);
const flag = (/** @type {string} */ name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? "" : (args[at + 1] ?? "");
};

/** GitHub Actions renders this as an annotation, which is what reaches the email. */
const annotate = (/** @type {string} */ message) => console.log(`::error::${message}`);

/** @returns {Promise<{ miss: string, unrepairable: boolean }>} */
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

  // The status rule lives in the decision module because the watchdog makes the identical call.
  if (!response.ok) return refusalMiss(tool, response.status, payload);

  const report = payload && typeof payload === "object" ? (payload.data ?? payload) : null;
  // The verdict is read, never assumed from a 200.
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

/** @returns {Promise<number>} */
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

    // A refusal abandons the rest of the plan: the Ask upload reads the store the content repair
    // rewrites, so after a refusal that store is known-stale.
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
