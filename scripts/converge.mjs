// After the deploy (deploy.yml's `converge` job, once devkit's worker-deploy has deployed the site and its live gate
// passed): everything that brings the deployed site's data and its helpers into step with the build. These were the
// second half of the retired `npm run ship`; the first half (the D1 bookmark, the migrations, the build and the deploy itself,
// with the live gate and its rollback) is worker-deploy's, called as the network's other Worker sites call it.
//
// The order is ship's: readiness, the uptime monitors, the content build and its gate, the D1 sync, the
// Ask index, the CV PDF, the share cards, the media index, the deferred drift checks, then the browser test. Deploy
// before sync, so `llms.txt` never advertises unserved pages. `check:content` runs before sync because
// `sync-content.mjs` runs no gate. A refusal stops before the first write it would make unsafe; a miss is a later step
// that did not converge, with the deploy left standing, and exits 1 once every step has run.
//
//   OPERATOR_TOKEN_FILE=<file> CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/converge.mjs

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_ORIGIN } from "../app/lib/seo.ts";
import {
  DEFERRED_CHECKS,
  deferredMisses,
  fetchHealth,
  readinessLines,
  readinessVerdict,
} from "./lib/readiness.mjs";
import { spawnSyncBounded } from "./lib/retry.mjs";
import { driftCount, searchCounts, standingRun } from "./lib/sync-verdict.mjs";
import { convergeAsk, convergeCvPdf, convergeMedia, readAskDrift } from "./lib/operator-sync.mjs";
import { ASK_POLL_WINDOW_MS, settleAskDrift } from "../app/lib/health/ask-converge.mjs";
import { readOperatorToken } from "./lib/operator-token.mjs";
import { INDEX_ADVICE, RENDER_ADVICE, missReport } from "./lib/converge-misses.mjs";
import { uptimeStepOutcome } from "./lib/uptime-step.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Imported from `app/lib/seo.ts`, never restated: a stale copy would read the wrong host. */
const ORIGIN = SITE_ORIGIN;
const READINESS_PATH = "/health";

/* The commit worker-deploy shipped: the run's own, as /health reports it. */
const shaFull =
  process.env.GITHUB_SHA ??
  spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
const sha = shaFull.slice(0, 12);

let step = 0;

/** @param {string} title */
function announce(title) {
  step += 1;
  console.log(`\n${"=".repeat(64)}\n  ${step}. ${title}\n${"=".repeat(64)}`);
}

/**
 * @param {string} why @param {string} remedy
 * @returns {never}
 */
function refuse(why, remedy) {
  console.error(`\n  REFUSED at step ${step}: ${why}\n  ${remedy}\n`);
  process.exit(1);
}

/**
 * A spawn error (npx not found, a timeout) is printed and carried in `text`, so a refusal names it.
 * `timeoutMs` bounds a read: retryRead's own timer cannot fire while spawnSync blocks.
 * @param {string} command @param {string[]} args
 * @param {{ capture?: boolean, timeoutMs?: number }} [options]
 */
function run(command, args, { capture = false, timeoutMs } = {}) {
  const options = {
    cwd: root,
    shell: process.platform === "win32",
    stdio: /** @type {any} */ (capture ? ["inherit", "pipe", "pipe"] : "inherit"),
    encoding: /** @type {const} */ ("utf8"),
  };
  const result =
    timeoutMs === undefined
      ? (() => {
          const r = spawnSync(command, args, options);
          return {
            stdout: String(r.stdout ?? ""),
            stderr: String(r.stderr ?? ""),
            status: r.error ? null : r.status,
            error: r.error ? `${command} could not run: ${r.error.message}` : "",
          };
        })()
      : spawnSyncBounded(command, args, { ...options, timeoutMs });
  const failure = result.error ? `\n  converge: ${result.error}\n` : "";
  if (failure) process.stderr.write(failure);
  if (capture) {
    const text = `${result.stdout}${result.stderr}${failure}`;
    process.stdout.write(text);
    return { code: result.status ?? 1, text };
  }
  return { code: result.status ?? 1, text: failure };
}

/* Read before anything writes, so a missing token costs no half-converged run. Never an argument or printed. */
const operatorToken = readOperatorToken(process.env.OPERATOR_TOKEN_FILE);
if (operatorToken.why) refuse(operatorToken.why, operatorToken.remedy);
const OPERATOR_TOKEN = operatorToken.token;

/*
 * Before the sync, the first write: every check but the deferred ones (which the sync repairs) must be ok. A warn
 * counts here though it does not roll a deploy back (devkit-verify-deploy). `ok` is read from the body; a 429
 * is reported apart.
 */
announce(`Readiness: ${READINESS_PATH} reports ok`);

{
  const {
    status,
    text,
    error: unreachable,
  } = await fetchHealth(`${ORIGIN}${READINESS_PATH}?converge=${sha}-${step}`);
  if (unreachable) {
    refuse(
      `${READINESS_PATH} could not be reached: ${unreachable}`,
      "The deploy landed and its live gate passed, so this is a network problem or the " +
        "endpoint is gone. NOTHING WAS SYNCED.",
    );
  }

  const verdict = readinessVerdict(status, text, READINESS_PATH, Object.keys(DEFERRED_CHECKS));

  // Printed for BOTH outcomes, before the verdict is acted on, so a reader
  // never has to run the endpoint by hand to see which check failed.
  for (const line of readinessLines(verdict.checks)) console.log(line);

  if (!verdict.ok) refuse(verdict.why, verdict.remedy);

  /* A failing deferred check is printed, not refused; it is asserted after its repair step. */
  const deferredFailing = verdict.deferredFailing ?? [];
  for (const name of deferredFailing) {
    console.log(
      `  deferred: ${name} is failing now, and ${DEFERRED_CHECKS[name]} is what ` +
        `converges it. Asserted again after that step.`,
    );
  }
  console.log(
    `  ${verdict.checks.length} check(s) read, ${verdict.checks.length - deferredFailing.length} gating and ok.`,
  );
}

/* After readiness. URLs derive from `SITE_ORIGIN`. A failure is a miss; a
   keyless run on a GitHub runner, and only that, is a skip. A missing key locally is a miss. */
announce("Point the uptime monitors at this deploy");

let uptimeMiss = "";
let uptimeSkip = "";

{
  const ensured = run("node", ["scripts/uptime-ensure.mjs"], { capture: true });
  const outcome = uptimeStepOutcome(ensured.code, ensured.text);
  if (outcome.state === "skipped") {
    uptimeSkip = outcome.note;
    console.log(`  SKIPPED: ${uptimeSkip}`);
  } else if (outcome.state === "missed") {
    uptimeMiss = outcome.miss;
    console.log(`  MISSED: ${uptimeMiss}`);
  } else {
    console.log(`  monitors reconciled, ${outcome.changes} change(s)`);
  }
}

announce("The content's source, from D1");
/*
 * D1 is the source (scripts/lib/content-source.mjs): a path it has never held is seeded from the repository, then
 * its files are written over the checkout, so the content build below is made from what the site holds, as the
 * deploy's own build was (its pre-deploy guard ran the same two steps).
 */
for (const step of [
  ["scripts/seed-sources.mjs", "--remote"],
  ["scripts/pull-sources.mjs", "--remote"],
]) {
  if (run("node", step).code !== 0) refuse(`${step[0]} failed`, "Nothing was synced.");
}

/* Rebuilt so the sync reads this deploy's content, not whatever a previous step left. */
announce("build:content, the local build product the sync reads");
/* build:content reads stack.json, a build product, and this job starts from a fresh checkout. */
if (
  run("npm", ["run", "build:stack"]).code !== 0 ||
  run("npm", ["run", "build:content"]).code !== 0
) {
  refuse("the content build failed", "NOTHING WAS SYNCED.");
}

announce("check:content, because sync runs no gate of its own");
if (run("npm", ["run", "check:content"]).code !== 0) {
  refuse(
    "the content gate is red: the corpus fails validation or renders nondeterministically",
    "Fix the content or the pipeline. NOTHING WAS SYNCED. " +
      "sync-content.mjs would have pushed a corpus the gate refused into production D1.",
  );
}

announce("Sync content to remote D1");

let renderDriftMiss = "";

const sync = run("npm", ["run", "sync:content", "--", "--remote"], { capture: true });
/** @type {typeof sync | null} The second sync, run only to confirm render drift. */
let confirm = null;
if (sync.code !== 0) {
  /*
   * Render drift finishes every write and stands as a miss; any other nonzero refuses.
   * Told apart by the drift line's count, since the exit code carries one bit.
   */
  const drift = driftCount(sync.text);
  if (drift !== null && drift > 0) {
    const slugs = sync.text.match(/RENDER DRIFT on \d+ slug\(s\): ([^.]*)\./);
    const named = slugs ? slugs[1] : "unnamed slug(s)";

    /*
     * First-run drift is usually the old Worker's poll writing an old-renderer hash. A second
     * sync reads zero unless the converge write did not take, so only confirmed drift fails.
     */
    console.log(`  render drift on ${named}: converged, confirming with a second sync`);
    confirm = run("npm", ["run", "sync:content", "--", "--remote"], { capture: true });
    const confirmDrift = driftCount(confirm.text);

    if (confirmDrift === null) {
      refuse(
        "the confirming sync did not report a drift line",
        "The first sync converged D1 and the second could not be read, so whether " +
          "the drift cleared is UNKNOWN. Re-run the deploy's converge job.",
      );
    } else if (confirmDrift === 0) {
      if (confirm.code !== 0) {
        refuse(
          "the confirming sync failed",
          "D1 may be partially written. Re-run the deploy's converge job.",
        );
      }
      console.log(
        `  confirmed benign: the second sync reads render-drift=0, so D1 carried a ` +
          `render from the previously deployed Worker (the first-sync ordering artifact) and the converge ` +
          `write took. Not a pipeline defect.`,
      );
    } else {
      renderDriftMiss =
        `render drift on ${named} SURVIVED a converge write: the first sync wrote ` +
        `the build's render to every row and a second sync still reads ` +
        `render-drift=${confirmDrift}. This is not the first-sync ordering artifact ` +
        `(a render from the previously deployed Worker), which clears on the second run. Either the write is not taking or ` +
        `something is rewriting render_hash behind the sync.`;
      console.log(`  MISSED: ${renderDriftMiss}`);
    }
  } else {
    refuse("the sync failed", "D1 may be partially written. Re-run the deploy's converge job.");
  }
}

/*
 * The counts line is the proof, read from the sync that wrote last. `COUNT(*)` on an FTS index
 * reads through to its content table.
 */
const counts = searchCounts(standingRun(sync, confirm).text);
if (!counts) {
  refuse(
    "the sync printed no search_docs/identity/prose line",
    "The write may have landed. Verify the index by hand before trusting it.",
  );
}
const [docs, identity, prose] = counts;
if (!(docs === identity && identity === prose)) {
  refuse(
    `the search index disagrees with its source: docs=${docs} identity=${identity} prose=${prose}`,
    "Rebuild the indexes. Do NOT `DELETE FROM` either one; the repair is ('rebuild').",
  );
}

/*
 * `sync:content` does not rebuild AI Search. It uploads through the deployed Worker, so a miss
 * leaves the deploy standing.
 */

announce("Bring the Ask index into step");

const askMiss = await convergeAsk({ origin: ORIGIN, token: OPERATOR_TOKEN });

/*
 * After the D1 sync (the PDF is drawn from the CV rows) and before the media index (a first render adds a
 * `derived/` key). A miss leaves the deploy standing.
 */

announce("Bring the CV PDF into step");

const cvPdfMiss = await convergeCvPdf({ origin: ORIGIN, token: OPERATOR_TOKEN });

/*
 * After the D1 sync, which wrote every post's og_image key: build:og draws the cards those keys name and
 * prunes the old ones, its coupling check passing now that D1 points at the new keys. Before the media
 * index, which lists the bucket's objects. A miss leaves the deploy standing: a missing card falls
 * back to no image.
 */

announce("Draw the share cards");

let cardsMiss = "";
{
  const cards = run("npm", ["run", "build:og", "--", "--remote"], { capture: true });
  if (cards.code !== 0) {
    cardsMiss =
      "build:og failed, so new or retitled pages have no share card. Run `npm run build:og -- --remote`.";
    console.log(`  MISSED: ${cardsMiss}`);
  }
}

/* After the deploy, since the rebuild reads the serving build. No poll: D1 reads its own writes. */

announce("Bring the media index into step");

const mediaMiss = await convergeMedia({ origin: ORIGIN, token: OPERATOR_TOKEN });

/*
 * Deferred checks are asserted here, after their repair: refusing before the sync would
 * deadlock. A failure here means the sync did not converge. A miss, not a refusal.
 */
announce("The drift checks readiness deferred, asserted");

let deferredMiss = "";
{
  /* One read for all: more requests risk the per-IP limiter's 429. */
  const {
    status,
    text,
    error: unreachable,
  } = await fetchHealth(`${ORIGIN}${READINESS_PATH}?converge=${sha}-${step}`);
  if (unreachable) {
    deferredMiss = `${READINESS_PATH} could not be reached after the sync: ${unreachable}`;
  }

  if (!deferredMiss) {
    // Deferred rows are asserted here; a non-deferred row (fts-equality) gone red since readiness is a miss too.
    const verdict = readinessVerdict(status, text, READINESS_PATH, Object.keys(DEFERRED_CHECKS));
    if (!verdict.ok && verdict.checks.length === 0) {
      // A 429 or an unparseable body: name that, not three "reported no check" misses.
      deferredMiss = verdict.why;
    } else {
      // The Ask index can list short seconds after a full write-back, so a failing row is re-read
      // at 10s intervals (well under health's 20 a minute) before it counts as a miss.
      const askAt = verdict.checks.findIndex((c) => c.name === "ask-index-drift");
      if (askAt >= 0 && verdict.checks[askAt].ok !== true) {
        console.log(
          `  ask-index-drift is behind; re-reading ${READINESS_PATH} for up to ` +
            `${ASK_POLL_WINDOW_MS / 1000}s before calling it a miss.`,
        );
        const settled = await settleAskDrift({
          row: verdict.checks[askAt],
          reading: () => readAskDrift(ORIGIN),
          sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
        });
        if (settled) verdict.checks[askAt] = settled;
      }
      const { misses, converged } = deferredMisses(verdict.checks, DEFERRED_CHECKS, READINESS_PATH);
      for (const name of converged) console.log(`  ${name} ok, after ${DEFERRED_CHECKS[name]}.`);
      if (!verdict.ok) misses.unshift(verdict.why);
      deferredMiss = misses.join("; ");
    }
  }

  if (deferredMiss) console.log(`  MISS: ${deferredMiss}`);
}

/*
 * The browser test runs against every deploy, not only on its weekly schedule. Started
 * last, so it tests the synced content. A failure to start it is a miss: the deploy stands.
 */
announce("Start the browser test against this deploy");

let browserMiss = "";
{
  const ref = "main";
  const started = run("gh", ["workflow", "run", "browser.yml", "--ref", ref], { capture: true });
  if (started.code !== 0) {
    browserMiss =
      `gh workflow run browser.yml --ref ${ref} did not start, so nothing is testing this deploy ` +
      "in a browser until the weekly run. Start it with that command";
    console.log(`  MISSED: ${browserMiss}`);
  } else {
    console.log(
      `  started browser.yml on ${ref}; a failed run notifies the account that started it`,
    );
  }
}

announce("Converged");
console.log(`  commit       ${sha}`);
console.log(`  search index ${docs} records, identity and prose agree`);
/* A skip is not a miss, so it stays out of the misses table and the exit code, but is repeated here. */
if (uptimeSkip) console.log(`\n  SKIPPED, uptime monitors: ${uptimeSkip}.`);
console.log(`\n  NOT run here: verify-live (bills per Ask probe) and check:all --remote.\n`);

/* Nonzero on any miss, after the record. Every miss is named: the faults are independent. */
const misses = [
  { key: "ask", title: "THE ASK INDEX", text: askMiss, advice: INDEX_ADVICE },
  { key: "cv-pdf", title: "THE CV PDF", text: cvPdfMiss },
  { key: "cards", title: "THE SHARE CARDS", text: cardsMiss },
  { key: "media", title: "THE MEDIA INDEX", text: mediaMiss, advice: INDEX_ADVICE },
  { key: "render", title: "THE RENDER", text: renderDriftMiss, advice: RENDER_ADVICE },
  { key: "uptime", title: "THE UPTIME MONITORS", text: uptimeMiss },
  { key: "deferred", title: "DEFERRED DRIFT", text: deferredMiss },
  { key: "browser", title: "THE BROWSER TEST", text: browserMiss },
];
const missLines = missReport(misses, sha);
if (missLines.length > 0) {
  console.error(missLines.join("\n"));
  process.exit(1);
}
