// check:web-vitals: a lab Core Web Vitals run on four representative pages of a deployed origin.
//
//   node scripts/check-web-vitals.mjs [origin] [--runs N]
//
// Replaces the byte budgets (job_e89fda4818a6): bytes were a stand-in for speed, and this
// measures the speed. Lighthouse, performance category only, with its DEFAULT config, which is
// the mobile form factor with its default simulated mobile throttling (slow 4G, 4x CPU). The
// browser is puppeteer's bundled chrome-headless-shell (which `npm ci` already downloads beside
// its Chrome), and Lighthouse drives it over its debugging port, so there is no second browser.
//
// WHY THE SHELL AND NOT puppeteer's DEFAULT HEADLESS: MEASURED on 2026-09-27, the default
// (new) headless mode made Lighthouse fail on / with NO_NAVSTART on 3 runs of 3, and handing
// Lighthouse a puppeteer page failed the same way 6 of 6. The shell measured 3 of 3.
// chrome-launcher was not used: on Windows its kill() throws EPERM removing its temp profile.
//
// SIMULATED throttling scales the CPU time the host really spent, so a busy host inflates TBT.
// Each page prints Lighthouse's benchmark index for the host that measured it (higher is faster;
// under about 1000 the numbers are suspect), and CI takes the median of three runs.
//
// WHAT IT CANNOT MEASURE: INP. INP needs a real person's input and a lab run has none, so this
// reports Total Blocking Time as Lighthouse's lab proxy for it, graded against Lighthouse's own
// mobile TBT "good" boundary of 200ms, and prints that it is a proxy. It is not INP.
//
// VERDICT: per metric, ok / WARN (over the threshold) / FAIL (over twice it). Exit 0 when
// nothing FAILs (warnings print and do not block), exit 1 on any FAIL, exit 2 when any page
// could not be measured. An unmeasured page is never reported as a pass.
//
// The origin is the first positional argument, else WEB_VITALS_ORIGIN, else SITE_ORIGIN read
// from app/lib/seo.ts (the one place the repo states it). Pages are measured one at a time and
// the browser is closed at the end, to keep memory modest on a small host.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import lighthouse from "lighthouse";
import puppeteer from "puppeteer";

import { METRICS, exitCode, firstArticlePath, gradeRuns } from "./lib/web-vitals.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const FIXED_PAGES = ["/", "/research/retroviruses", "/research/protocols/phage-isolation"];

function siteOriginFromRepo() {
  const src = readFileSync(path.join(ROOT, "app/lib/seo.ts"), "utf8");
  const m = /SITE_ORIGIN\s*=\s*["'`]([^"'`]+)/.exec(src);
  if (!m) throw new Error("SITE_ORIGIN not found in app/lib/seo.ts");
  return m[1];
}

/** @param {string[]} argv */
function parseArgs(argv) {
  let origin;
  let runs = 1;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs") {
      runs = Number(argv[++i]);
    } else if (arg.startsWith("--runs=")) {
      runs = Number(arg.slice("--runs=".length));
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown flag ${arg}`);
    } else if (origin === undefined) {
      origin = arg;
    } else {
      throw new Error(`unexpected argument ${arg}`);
    }
  }
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs takes a whole number, 1 or more");
  origin ??= process.env.WEB_VITALS_ORIGIN || siteOriginFromRepo();
  return { origin: new URL(origin).origin, runs };
}

/**
 * The newest article is the first one /writing lists on the deployed site.
 *
 * @param {string} origin
 */
async function articlePath(origin) {
  const response = await fetch(`${origin}/writing`);
  if (!response.ok) throw new Error(`GET ${origin}/writing answered ${response.status}`);
  const found = firstArticlePath(await response.text());
  if (!found) throw new Error(`${origin}/writing lists no article link`);
  return found;
}

/**
 * One Lighthouse run. Throws on anything short of three numbers, so a failed load, an error
 * page or a missing audit is an unmeasured page and never a zero.
 *
 * @param {string} url
 * @param {number} port
 */
async function measure(url, port) {
  const result = await lighthouse(url, {
    port,
    logLevel: "error",
    output: "json",
    onlyCategories: ["performance"],
  });
  const lhr = result?.lhr;
  if (!lhr) throw new Error("Lighthouse returned no result");
  if (lhr.runtimeError) throw new Error(`${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
  const audit = (/** @type {string} */ id) => {
    const value = lhr.audits[id]?.numericValue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      const why = lhr.audits[id]?.errorMessage ?? "no numeric value";
      throw new Error(`audit ${id} did not measure: ${why}`);
    }
    return value;
  };
  if (lhr.configSettings.formFactor !== "mobile") {
    throw new Error(`Lighthouse ran as ${lhr.configSettings.formFactor}, not mobile`);
  }
  return {
    lcp: audit("largest-contentful-paint"),
    cls: audit("cumulative-layout-shift"),
    tbt: audit("total-blocking-time"),
    benchmark: lhr.environment?.benchmarkIndex,
  };
}

async function main() {
  const { origin, runs } = parseArgs(process.argv.slice(2));
  console.log(`check:web-vitals: ${origin}, Lighthouse mobile profile (simulated slow 4G, 4x CPU)`);
  console.log(`${runs} run${runs === 1 ? "" : "s"} per page${runs > 1 ? ", median reported" : ""}`);
  console.log(
    "Thresholds: " +
      METRICS.map((m) => `${m.label} WARN over ${m.format(m.threshold)}, FAIL over ${m.format(m.threshold * 2)}`).join("; "),
  );
  console.log(
    "INP is NOT measured: it needs real user input, which a lab run has none of. TBT is shown as\n" +
      "Lighthouse's lab proxy for it, against Lighthouse's own mobile TBT 'good' boundary.\n",
  );

  /** @type {Array<{ path: string, grades?: ReturnType<typeof gradeRuns>, error?: unknown }>} */
  const pages = [];
  /** Printed as each page finishes, so a slow CI log shows progress rather than silence. */
  const report = (/** @type {(typeof pages)[number]} */ page, /** @type {number[]} */ benchmarks = []) => {
    pages.push(page);
    console.log(page.path);
    if (page.error !== undefined) {
      const message = page.error instanceof Error ? page.error.message : String(page.error);
      console.log(`  UNMEASURED  ${message}`);
      return;
    }
    for (const { metric, value, grade } of page.grades ?? []) {
      console.log(`  ${grade.padEnd(4)}  ${metric.label.padEnd(24)} ${metric.format(value)}`);
    }
    if (benchmarks.length) console.log(`        host benchmark index ${benchmarks.map(Math.round).join(", ")}`);
  };

  /** @type {string[]} */
  const paths = [...FIXED_PAGES];
  try {
    paths.push(await articlePath(origin));
  } catch (error) {
    report({ path: "/writing/<newest article>", error });
  }

  const browser = await puppeteer.launch({ headless: "shell" });
  try {
    const port = Number(new URL(browser.wsEndpoint()).port);
    for (const pagePath of paths) {
      try {
        const results = [];
        for (let i = 0; i < runs; i++) results.push(await measure(origin + pagePath, port));
        const benchmarks = results.flatMap((r) => (typeof r.benchmark === "number" ? [r.benchmark] : []));
        report({ path: pagePath, grades: gradeRuns(results) }, benchmarks);
      } catch (error) {
        report({ path: pagePath, error });
      }
    }
  } finally {
    await browser.close();
  }

  const code = exitCode(pages);
  const warned = pages.some((p) => p.grades?.some((g) => g.grade === "WARN"));
  console.log(
    code === 2
      ? "\nFAILED TO MEASURE: at least one page has no numbers, so this run is no verdict on it."
      : code === 1
        ? "\nFAIL: at least one metric is more than twice its threshold."
        : warned
          ? "\nok with warnings: nothing is over twice a threshold, so this does not block."
          : "\nok: every page is within every threshold.",
  );
  process.exitCode = code;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 2;
});
