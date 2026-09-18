// Trusted scoring glue, run from the DEFAULT branch from a copy stashed before any untrusted byte
// exists on the runner. IT NEVER RUNS ATTEMPT-CONTROLLED CODE: it counts TOP-LEVEL ok / not ok
// lines in the TAP, never an exit code, an early `process.exit(0)` leaving the ok line unwritten.
// THE STREAM MODE has no destination file, the runner capturing the container's stdout from
// outside, because a file inside the attempt's filesystem could be rewritten after the flush.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Matched at column 0, which a test cannot reach: node's reporter prefixes its lines with "# ".
export const CASE_MARKER = "##CAPSID-CASE ";

// THE NONCE: TAP escaping protects only output that went through node's reporter, and the
// secondary phases pipe a lint tool's RAW stdout into the same stream. Held in a shell variable
// and unset from the environment before any attempt code runs.
/** @param {string} nonce */
export function markers(nonce = "") {
  const p = nonce ? `##CAPSID-${nonce}` : "##CAPSID";
  return { case: `${p}-CASE `, test: `${p}-TEST`, lint: `${p}-LINT`, status: `${p}-STATUS `, end: `${p}-END` };
}

// One segment of the container's output stream with the status the trusted shell printed.
/**
 * @typedef {object} Segment
 * @property {string} kind
 * @property {string} name
 * @property {string[]} lines
 * @property {number | null} status
 */

// The per-repo command map. The secondaries used to be measured by the job that runs attempt code
// by design, and a plant set every one of them in a signed report. The two that CAN be recomputed
// are recomputed inside the same `--network none --read-only` container as the holdout, and EVERY
// COMMAND MUST RUN OFFLINE: one that does not run yields NULL, never the forgeable value.
export const SECONDARY_COMMANDS = {
  capsid: {
    trees: ["src"],
    test: 'node --test --test-reporter=tap --import ./test/resolve-ts.mjs "test/*.test.ts"',
    lint: "node_modules/.bin/tsc -p tsconfig.test.json --noEmit --pretty false",
    lint_pattern: "error TS[0-9]+",
    verified: "2026-09-07",
  },
  dustinedwards: {
    trees: ["app", "workers"],
    test: "node_modules/.bin/vitest run --reporter=tap",
    lint: null,
    lint_pattern: null,
    verified: "2026-09-08",
  },
  foxhound: {
    trees: ["app", "workers"],
    test: "node_modules/.bin/vitest run --reporter=tap",
    lint: "node_modules/.bin/eslint .",
    lint_pattern: "^[ \t]+[0-9]+:[0-9]+",
    verified: "2026-09-08",
  },
  foxing: {
    trees: ["packages/core", "packages/api", "apps/web"],
    // UNIT TESTS ONLY, which took two exclusions: the bare runner swept in playwright specs that
    // cannot run behind `--network none`, and excluding them by folder revealed integration tests
    // outside it. Neither is excluded to make a number go up, and both are UNSCORED on the record.
    test:
      'node_modules/.bin/vitest run --reporter=tap --exclude "**/e2e/**" --exclude "**/*.integration.test.ts"',
    lint: "node_modules/.bin/biome check .",
    lint_pattern: "(lint|assist|format)/",
    verified: "2026-09-08",
  },
  germomics: {
    trees: ["app", "workers"],
    // No test or lint script in this repo. Both metrics stay null and the holdout
    // is the only behavioural signal, which is what its scores.md already says.
    test: null,
    lint: null,
    lint_pattern: null,
    verified: "2026-09-07",
  },
};

// The holdout import manifest: every name the hidden suite imports out of the repo's source. NOT
// A SECURITY CONTROL and deliberately not secret. WHAT IT BUYS: a bloat pass removed two exports
// on a scan that found no caller, and the holdout imports both while being invisible to anything
// running in the repo. TWO CONSUMERS pull opposite ways, the dead-export check reading a name
// here as a caller and the sync job refusing a case importing a name that is not.
export const HOLDOUT_IMPORTS_FILE = "imports.txt";

/** @param {string} namespace */
export function holdoutImportsPath(namespace) {
  return `improve/holdout/${namespace}/${HOLDOUT_IMPORTS_FILE}`;
}

// Names only. Blank lines and `#` comments are allowed so the file can say what it
// is; anything else is a name.
/** @param {string} text */
export function parseImportsManifest(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

// Matched on the specifier being RELATIVE: a builtin or a package says nothing about this repo's
// exports. Default and namespace imports are reported under the names they bind.
/** @param {string} text */
export function importedNames(text) {
  /** @type {Set<string>} */
  const names = new Set();
  // ANCHORED AT A STATEMENT START, and the clause may not cross a `;`: a lazy match swallowed the
  // builtin imports above the first relative one and reported names like `from` and `import`.
  const re = /(?:^|\n)\s*import\s+([^;]*?)\s+from\s+["'](\.[^"']*)["']/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const clause = m[1].trim();
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (braces) {
      for (const part of braces[1].split(",")) {
        const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (name) names.add(name);
      }
    }
    const bare = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, " ").trim();
    for (const part of bare.split(/\s+/)) {
      const name = part.replace(/^\*$/, "").replace(/^type$/, "").trim();
      if (name && name !== "as") names.add(name);
    }
  }
  // A name is a JavaScript identifier and nothing else. A second check after the regex
  // above: a token that is not one is a parse artefact.
  //
  // THE SNAPSHOT IS LOAD-BEARING, and it is a NAMED CONST rather than a spread in the
  // for-of head. The loop DELETES from `names` while walking it, so it has to walk a
  // copy; written inline as `for (const name of [...names])` that is the exact shape
  // unicorn/no-useless-spread reports, because the rule cannot see the iterable is
  // mutated underneath it.
  //
  // NO SUPPRESSION COMMENT. This file is copied BYTE-IDENTICAL into five repos and they
  // do not all load the same lint plugins: an `eslint-disable` naming
  // unicorn/no-useless-spread is itself an error ("Definition for rule was not found")
  // in every repo whose config lacks the plugin, which turned foxhound's main red. A
  // disable comment is a dependency on another repo's plugin list.
  const scanned = [...names];
  for (const name of scanned) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) names.delete(name);
  }
  return names;
}

// The gate on the holdout import manifest. It NEVER names a case file, a filename being part of
// the hidden suite and this log readable; it names the missing IMPORTS, which are export names.
/**
 * @param {string[]} caseTexts
 * @param {string[] | null} declared
 * @param {string} namespace
 */
export function holdoutImportRefusal(caseTexts, declared, namespace) {
  /** @type {Set<string>} */
  const used = new Set();
  for (const text of caseTexts) for (const name of importedNames(text)) used.add(name);
  const sorted = [...used].sort();
  if (declared === null) {
    return (
      `no ${holdoutImportsPath(namespace)} in this repo. The hidden suite imports names out of this repo's source, ` +
      `and nothing that runs here can see which, so a bloat pass removing one is a broken anchor nobody predicted. ` +
      `Create the file with these ${sorted.length} names, one per line:
${sorted.join("\n")}`
    );
  }
  const missing = sorted.filter((n) => !declared.includes(n));
  if (missing.length > 0) {
    return (
      `the hidden suite imports ${missing.length} name(s) that ${holdoutImportsPath(namespace)} does not list: ` +
      `${missing.join(", ")}. Add them, or stop importing them. The list is what makes those exports undeletable.`
    );
  }
  return null;
}

// Files rather than an inlined string: the container command is a single-quoted shell literal.
// `trees.txt` is the OTHER half of the trusted map, so an attempt cannot decide which of its own
// trees are believed, and taking each declared tree WHOLE keeps a file it deleted deleted.
/** @param {string} namespace */
export function secondaryScripts(namespace) {
  const spec = /** @type {Record<string, any>} */ (SECONDARY_COMMANDS)[namespace];
  if (!spec) return {};
  /** @type {Record<string, string>} */
  const out = { "trees.txt": (spec.trees ?? []).join("\n") + "\n" };
  if (spec.test) out["secondary-test.sh"] = `${spec.test}\n`;
  if (spec.lint) out["secondary-lint.sh"] = `${spec.lint}\n`;
  return out;
}

// Count the TOP-LEVEL TAP results. A top-level pass is `ok N` at column 0; a
// top-level failure is `not ok N` at column 0. Indented lines (subtests), the plan
// (`1..N`), diagnostics (`#`) and YAML blocks (`  ---`) are all ignored.
/** @param {string} text */
export function parseTestReport(text) {
  let pass = 0;
  let fail = 0;
  for (const line of text.split("\n")) {
    if (/^not ok \d+/.test(line)) fail += 1;
    else if (/^ok \d+/.test(line)) pass += 1;
  }
  return { pass, fail };
}

// A pass rate in [0, 1], or null when nothing ran (which the Worker treats as
// "not reported" rather than as a catastrophic zero).
/** @param {string} text */
export function testPassRate(text) {
  const { pass, fail } = parseTestReport(text);
  const total = pass + fail;
  return total > 0 ? pass / total : null;
}

// One case passes iff its report has a top-level ok and no not-ok. Silence cannot score.
/** @param {string} text */
export function holdoutFilePassed(text) {
  const { pass, fail } = parseTestReport(text);
  return pass > 0 && fail === 0;
}

// Split a concatenated stream into its trusted segments, discarding the preamble. `##CAPSID-END`
// bounds it, so a truncated stream is visible rather than scored on partial output. Four kinds,
// the three phases plus "status", so a phase that could not run is distinguishable from one that
// ran and found nothing.
/**
 * @param {string} text
 * @param {string} nonce
 */
export function splitStream(text, nonce = "") {
  const m = markers(nonce);
  /** @type {Segment[]} */
  const segments = [];
  /** @type {Segment | null} */
  let current = null;
  let terminated = false;
  // `open` RETURNS the segment and the loop assigns `current`: a checker cannot follow an
  // assignment made in a callback and narrowed it to `never` at every later use.
  /**
   * @param {string} kind
   * @param {string} name
   * @returns {Segment}
   */
  const open = (kind, name) => {
    /** @type {Segment} */
    const segment = { kind, name, lines: [], status: null };
    segments.push(segment);
    return segment;
  };
  for (const line of text.split("\n")) {
    if (line.startsWith(m.case)) {
      current = open("case", line.slice(m.case.length).trim());
      continue;
    }
    if (line === m.test) {
      current = open("test", "test");
      continue;
    }
    if (line === m.lint) {
      current = open("lint", "lint");
      continue;
    }
    if (line.startsWith(m.status)) {
      const code = Number.parseInt(line.slice(m.status.length).trim(), 10);
      if (current) current.status = Number.isFinite(code) ? code : null;
      current = null;
      continue;
    }
    if (line === m.end) {
      current = null;
      terminated = true;
      continue;
    }
    if (current !== null) current.lines.push(line);
  }
  return { segments, terminated };
}

// The holdout view of the stream: one judgement per case file, with the same rule
// as a single report.
/**
 * @param {string} text
 * @param {string} nonce
 */
export function parseHoldoutStream(text, nonce = "") {
  const { segments, terminated } = splitStream(text, nonce);
  const cases = segments
    .filter((s) => s.kind === "case")
    .map((s) => ({ name: s.name, passed: holdoutFilePassed(s.lines.join("\n")) }));
  return { cases, terminated };
}

// An unterminated stream scores ZERO, not a partial count: a failed measurement must never look
// like a good one.
/**
 * @param {string} text
 * @param {string} nonce
 */
export function holdoutPassCount(text, nonce = "") {
  const { cases, terminated } = parseHoldoutStream(text, nonce);
  if (!terminated) return 0;
  return cases.filter((c) => c.passed).length;
}

// THE RECOMPUTED SECONDARIES, out of the container and never out of the attempt's own artifact.
//
//   test_pass_rate  the top-level TAP ratio of the repo's own test command, in the sandbox
//   lint_count      how many lines of the lint output match this repo's pattern
//
// A phase that could not run yields null: an unmeasured metric must never read as the number the
// attempt wrote down.
/**
 * @param {string} text
 * @param {string} namespace
 * @param {string} nonce
 */
export function secondaryFromStream(text, namespace, nonce = "") {
  const { segments, terminated } = splitStream(text, nonce);
  const spec = /** @type {Record<string, any>} */ (SECONDARY_COMMANDS)[namespace] ?? {};
  /** @param {string} kind @returns {Segment | null} */
  const find = (kind) => segments.find((/** @type {Segment} */ s) => s.kind === kind) ?? null;
  // A phase RAN if the container finished with a status that is not "could not execute". An
  // explicit null check rather than a predicate helper, so the narrowing is visible to a checker.
  /** @param {Segment | null} seg */
  const ran = (seg) => terminated && seg !== null && seg.status !== null && seg.status < 126;

  const testSeg = find("test");
  const test_pass_rate = testSeg !== null && ran(testSeg) ? testPassRate(testSeg.lines.join("\n")) : null;

  const lintSeg = find("lint");
  /** @type {number | null} */
  let lint_count = null;
  if (lintSeg !== null && ran(lintSeg) && spec.lint_pattern) {
    const re = new RegExp(spec.lint_pattern);
    const matches = lintSeg.lines.filter((/** @type {string} */ l) => re.test(l)).length;
    // A CRASH IS NOT A CLEAN LINT: a linter that could not resolve its binary exited nonzero and
    // matched no count pattern, so "zero matches" read as "zero problems". Nonzero with no matches
    // is neither, so it is null.
    lint_count = matches > 0 || lintSeg.status === 0 ? matches : null;
  }
  return { test_pass_rate, lint_count };
}

// THE SECONDARY METRICS THIS SCORER REPORTS, in report order. It was five: two were emitted as a
// literal null by every repo while being declared as signals. The test derives that document's
// list from this array and fails BOTH ways.
export const REPORTED_SECONDARY = ["test_pass_rate", "lint_count", "bundle_size_bytes"];

// A finite number or null; coercion is refused so a stray value cannot read as a measurement.
/** @param {unknown} value */
function metric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// CLI. Six modes, all trusted, none of which runs attempt code:
//
//   --holdout <reportPath>              exit 0 if that single report passed, 1 otherwise.
//   --holdout-stream <tapPath> [nonce]  print how many cases passed in a piped stream.
//   --rate <testReportPath>             print the top-level pass rate, or "" if nothing ran.
//   --secondary-scripts <ns> <dir>      write this repo's sandbox commands as shell files.
//   --secondary <tapPath> <ns> <nonce> <metricsPath>
//                                       print the RECOMPUTED secondaries, and any disagreement.
//   <metricsPath> <total> <passed>      emit the score-report body. The key never touches this.
/** @param {string[]} argv */
function main(argv) {
  if (argv[0] === "--holdout") {
    let passed = false;
    try {
      passed = holdoutFilePassed(readFileSync(argv[1], "utf8"));
    } catch {
      passed = false;
    }
    process.exit(passed ? 0 : 1);
  }
  // AN EMPTY STREAM IS NOT A RESULT: 0 means both "every hidden test failed" and "none ever ran",
  // which is correct for a SCORE and useless as a diagnosis.
  if (argv[0] === "--holdout-terminated") {
    let terminated = false;
    try {
      terminated = parseHoldoutStream(readFileSync(argv[1], "utf8"), argv[2] ?? "").terminated;
    } catch {
      terminated = false;
    }
    process.exit(terminated ? 0 : 1);
  }
  if (argv[0] === "--holdout-stream") {
    let count = 0;
    try {
      count = holdoutPassCount(readFileSync(argv[1], "utf8"), argv[2] ?? "");
    } catch {
      count = 0;
    }
    process.stdout.write(String(count));
    return;
  }
  // Job B's gate on the holdout import manifest. Reads the synced holdout directory and
  // this repo's committed list, and exits non-zero with a named refusal when they
  // disagree. It never prints a case FILENAME: a filename is part of the hidden suite
  // and this runs in a job whose log is readable.
  if (argv[0] === "--check-holdout-imports") {
    const [, holdoutDir, namespace, manifestPath] = argv;
    /** @type {string[]} */
    const texts = [];
    try {
      for (const name of readdirSync(holdoutDir)) {
        if (!/\.test\./.test(name)) continue;
        texts.push(readFileSync(join(holdoutDir, name), "utf8"));
      }
    } catch (err) {
      process.stderr.write(`could not read the holdout directory: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
    if (texts.length === 0) {
      process.stderr.write("no holdout cases were synced, so their imports cannot be checked. Refusing rather than passing on an empty read.\n");
      process.exit(1);
    }
    /** @type {string[] | null} */
    let declared = null;
    try {
      declared = parseImportsManifest(readFileSync(manifestPath, "utf8"));
    } catch {
      declared = null;
    }
    const refusal = holdoutImportRefusal(texts, declared, namespace);
    if (refusal) {
      process.stderr.write(`${refusal}\n`);
      process.exit(1);
    }
    process.stdout.write(`holdout imports: ${declared?.length ?? 0} declared, all accounted for across ${texts.length} cases\n`);
    return;
  }
  if (argv[0] === "--secondary-scripts") {
    const [, namespace, dir] = argv;
    const files = secondaryScripts(namespace);
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(dir, name), contents, { mode: 0o755 });
      process.stderr.write(`secondary command for ${namespace}: ${name} = ${contents.trim()}\n`);
    }
    const spec = /** @type {Record<string, any>} */ (SECONDARY_COMMANDS)[namespace];
    if (!spec) process.stderr.write(`no secondary command map for namespace ${namespace}; both metrics will be null\n`);
    else if (!spec.verified) {
      process.stderr.write(
        `the secondary command map for ${namespace} is UNVERIFIED: no run has yet been observed producing a real number in the sandbox. ` +
          `A command that does not run yields null, never Job A's value.\n`
      );
    }
    return;
  }
  if (argv[0] === "--secondary") {
    const [, tapPath, namespace, nonce, metricsPath] = argv;
    let stream = "";
    try {
      stream = readFileSync(tapPath, "utf8");
    } catch {
      stream = "";
    }
    const recomputed = secondaryFromStream(stream, namespace, nonce ?? "");

    // WHY IT IS NULL, IN THE RUN LOG: the log could not tell "the command was not found" from "it
    // ran and produced nothing parseable", which is a typo in the map against a dropped flag.
    const { segments, terminated } = splitStream(stream, nonce ?? "");
    if (!terminated) {
      process.stderr.write("SECONDARY: the container did not finish; every recomputed metric is null.\n");
    }
    for (const kind of ["test", "lint"]) {
      const seg = segments.find((x) => x.kind === kind);
      if (!seg) {
        process.stderr.write(`SECONDARY ${kind}: no phase ran (this namespace declares no ${kind} command).\n`);
        continue;
      }
      const why =
        seg.status === null
          ? "no exit status was printed"
          : seg.status >= 126
            ? `exit ${seg.status}, which is "could not execute": check the command in SECONDARY_COMMANDS`
            : `exit ${seg.status}`;
      // HEAD AND TAIL: a Node crash's tail is the version banner, and the missing-module message is at
      // the TOP, so printing only the tail turned a resolution failure into three closing braces.
      const nonEmpty = seg.lines.filter((l) => l.trim() !== "");
      // ONE LEADING SPACE, AND IT IS DELIBERATE: the problem matcher the runner registers for the whole
      // job anchors at a non-space column, so without it a lint phase that found type errors made every
      // green run carry annotations against a path nobody wrote.
      process.stderr.write(
        ` SECONDARY ${kind}: ${seg.lines.length} lines, ${why}. First: ${JSON.stringify(nonEmpty.slice(0, 3))}\n`
      );
      process.stderr.write(` SECONDARY ${kind}: last: ${JSON.stringify(nonEmpty.slice(-3))}\n`);
    }
    /** @type {Record<string, unknown>} */
    let claimed = {};
    try {
      claimed = JSON.parse(readFileSync(metricsPath, "utf8"));
    } catch {
      claimed = {};
    }
    // THE CROSS-CHECK: the artifact is written on a runner that has already run attempt code, so a
    // disagreement is what a forged one looks like. The container value wins; the disagreement prints.
    for (const name of ["test_pass_rate", "lint_count"]) {
      const mine = /** @type {Record<string, unknown>} */ (recomputed)[name];
      const theirs = metric(claimed[name]);
      if (mine !== theirs) {
        process.stderr.write(
          `SECONDARY MISMATCH ${name}: the artifact claims ${JSON.stringify(theirs)}, the sandbox measured ` +
            `${JSON.stringify(mine)}. The sandbox value is used.\n`
        );
      }
    }
    /**
     * @param {string} name
     * @param {number | null} value
     */
    const line = (name, value) => `${name}=${value === null ? "" : String(value)}\n`;
    process.stdout.write(line("test_pass_rate", recomputed.test_pass_rate) + line("lint_count", recomputed.lint_count));
    return;
  }
  if (argv[0] === "--rate") {
    let rate = null;
    try {
      rate = testPassRate(readFileSync(argv[1], "utf8"));
    } catch {
      rate = null;
    }
    process.stdout.write(rate === null ? "" : String(rate));
    return;
  }
  const [metricsPath, holdoutTotal, holdoutPassed] = argv;
  /** @type {{ build_passes?: unknown, test_pass_rate?: unknown, lint_count?: unknown, bundle_size_bytes?: unknown }} */
  let m = {};
  try {
    m = JSON.parse(readFileSync(metricsPath, "utf8"));
  } catch {
    m = {};
  }
  /** @param {unknown} v */
  const numOrNull = (v) => (v === undefined || v === "" || v === "null" ? null : Number(v));
  // THE ANCHOR IS NOT READ FROM THE ARTIFACT: it comes from the build job's own outcome, the
  // artifact being written on a machine that has executed attempt code. Absent is 0, not 1.
  const buildPasses = process.env.BUILD_PASSES === "1" ? 1 : 0;
  // NOR ARE THE RECOMPUTED SECONDARIES. The artifact is read for bundle_size_bytes and nothing
  // else: that is the one secondary no offline container can recompute.
  const body = {
    namespace: process.env.IMPROVE_NAMESPACE,
    run_id: process.env.RUN_ID,
    attempt_id: process.env.ATTEMPT_ID,
    head_sha: process.env.ATTEMPT_HEAD_SHA,
    jti: randomUUID(),
    anchors: { build_passes: buildPasses },
    secondary: {
      test_pass_rate: metric(numOrNull(process.env.SECONDARY_TEST_PASS_RATE)),
      lint_count: metric(numOrNull(process.env.SECONDARY_LINT_COUNT)),
      bundle_size_bytes: metric(m.bundle_size_bytes),
    },
    holdout: { total: numOrNull(holdoutTotal) ?? 0, passed: numOrNull(holdoutPassed) ?? 0 },
    // WHETHER THE MACHINE WORKED: an attempt carrying `ok: false` is left UNJUDGED rather than
    // reverted, none of the numbers above describing the attempt in that case.
    environment:
      process.env.ENV_FAILURE === "1"
        ? { ok: false, reason: String(process.env.ENV_FAILURE_REASON || "").slice(0, 512) || null }
        : { ok: true, reason: null },
    ci_minutes: Number(process.env.CI_MINUTES ?? "0"),
  };
  process.stdout.write(JSON.stringify(body));
}

// Only run the CLI when invoked directly, so importing the pure functions in a test
// does not trigger it.
if (process.argv[1] && process.argv[1].endsWith("improve-report.mjs")) {
  main(process.argv.slice(2));
}
