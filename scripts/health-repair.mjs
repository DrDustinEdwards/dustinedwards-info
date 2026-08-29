/**
 * SELF-REPAIR FOR A FAILING HEALTH RUN. The I/O half.
 *
 *   node scripts/health-repair.mjs --origin <origin> --body body.json
 *
 * Called by `.github/workflows/health.yml` when `/api/health` reports
 * unhealthy. Decides through `app/lib/health/repair.mjs`, performs the
 * repairs that decision allows, re-polls ONCE, and exits.
 *
 * ## EXIT CODES ARE THE ALERT
 *
 * Exit 0 means the run may pass: something drifted, this repaired it, and the
 * re-poll came back healthy. Exit 1 means a person is emailed. There is no
 * third state, because a scheduled workflow has exactly two outcomes a human
 * ever sees.
 *
 * **`process.exitCode`, NEVER `process.exit()`.** Measured 2026-08-24 while
 * driving this against a stub: calling `process.exit(1)` immediately after a
 * fetch terminated node with 0xC0000409 on Windows rather than with 1, because
 * the exit raced the HTTP socket teardown. The annotation had already printed,
 * so the run would still have failed and the cause would have been invisible;
 * an exit code nobody can explain is a bad thing to hand a monitor. Setting the
 * code and returning lets node drain and exit normally.
 *
 * ## ONE RE-POLL, NOT A LOOP
 *
 * Both repairs derive their own converged verdict before answering, so a
 * successful call has ALREADY proved the index agrees; the re-poll exists to
 * confirm the endpoint agrees too, and to catch anything else that broke while
 * this ran. A loop here would be a monitor arguing with itself: if one repair
 * through the front door did not fix it, the next thing to happen should be a
 * person reading the log, not a second write.
 *
 * That is a deliberate difference from `ship`'s Ask step, which DOES poll. Ship
 * polls because it read the counts back within milliseconds of the upload and
 * AI Search is eventually consistent. This runs at least one scheduled interval
 * after any such write, so there is no visibility lag left to wait out.
 *
 * ## THE TOKEN
 *
 * Read from OPERATOR_TOKEN in the environment, which the workflow sets from a
 * repository secret. It is never logged, never an argument, and its ABSENCE is
 * reported as a named configuration state rather than as a failure to repair.
 */

import { readFileSync } from "node:fs";

import { failingCheckNames, repairPlan } from "../app/lib/health/repair.mjs";

const args = process.argv.slice(2);
const flag = (/** @type {string} */ name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? "" : (args[at + 1] ?? "");
};

/** GitHub Actions renders this as an annotation, which is what reaches the email. */
const annotate = (/** @type {string} */ message) => console.log(`::error::${message}`);

/** One repair call. Returns a miss string, empty when it converged. */
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
    return `${tool} did not complete: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (!response.ok) return `${tool} answered ${response.status}`;

  const report = payload && typeof payload === "object" ? (payload.data ?? payload) : null;
  // The same rule ship applies: the verdict is READ, never assumed from a 200.
  if (!report || typeof report.converged !== "boolean") {
    return `${tool} answered without a converged verdict, so nothing was proven`;
  }
  if (report.converged !== true) {
    return `${tool} ran and did not converge (${report.expected} expected, ${report.present} present)`;
  }
  return "";
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
  for (const tool of plan.repair) {
    console.log(`repairing: ${tool}`);
    const miss = await repair(origin, token, tool);
    if (miss) misses.push(miss);
    else console.log(`  ${tool} converged.`);
  }

  if (misses.length > 0) {
    annotate(`Self-repair FAILED: ${misses.join("; ")}. The drift stands.`);
    return 1;
  }

  /*
   * THE RE-POLL. The repair proved its own index; this proves the ENDPOINT is
   * healthy, which is a wider claim and the one the workflow reports on.
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
