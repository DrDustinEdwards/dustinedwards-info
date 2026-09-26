// Unmapped paths fall back to the whole offline tier: skipping a path it did not recognize would
// report a clean run over checks that never executed.
// Tests: only those whose imports reach a changed file (ruling 151). Types, the full suites and the
// browser test run in CI.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { gateNames } from "./build-stack.mjs";
import { CI_AFTER_BUILD, CI_EXCLUDED, TIERS, runGate } from "./check-all.mjs";
import { reachableAssets } from "./lib/page-payload.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Not a gate: the node tests and worker tests that import a changed file. */
export const RELATED = "related tests";

/**
 * A gate belongs on a rule when it would notice the edit, not when it merely runs nearby.
 *
 * @type {Array<{what: string, test: RegExp, gates: string[]}>}
 */
export const MAP = [
  {
    what: "a stylesheet",
    test: /^app\/(app\.css|styles\/.+\.css)$/,
    gates: ["check:contrast", "check:page-payload"],
  },
  {
    what: "a route, component or other app source",
    test: /^app\/.+\.(ts|tsx|mjs)$/,
    gates: ["check:features", "check:machine-readable", "check:urls", RELATED],
  },
  {
    /* check-policy, check-ask-guards and check-headers read route files by name and scan app/routes;
       check-page-payload walks every route module for its hydration flag, editor handle and
       stylesheet set. */
    what: "a route module",
    test: /^app\/routes\/.+\.(ts|tsx)$/,
    gates: ["check:policy", "check:ask-guards", "check:headers", "check:page-payload"],
  },
  {
    /* check-ask-guards reads the origin predicate, the operator bearer and API, and the Ask corpus. */
    what: "a module the Ask and origin guards read",
    test: /^app\/lib\/(origin\.mjs|operator\/.+\.ts|search\/(ask\.server\.ts|search\.server\.ts|visibility\.mjs))$/,
    gates: ["check:ask-guards"],
  },
  {
    /* check-enhance-a11y reads the blog enhancement's source for its dialog and 1.4.13 behavior. */
    what: "an enhancement module",
    test: /^app\/enhance\/.+\.ts$/,
    gates: ["check:enhance-a11y"],
  },
  {
    /* check-migrations reads the operator API and its sync tools behind the sync_ask and sync_media ship calls. */
    what: "the operator API ship calls",
    test: /^app\/lib\/operator\/(api|sync-tools)\.server\.ts$/,
    gates: ["check:migrations"],
  },
  {
    /* check-page-payload reads root.tsx for the <Scripts> guard and the site-wide stylesheets. */
    what: "the root route",
    test: /^app\/root\.tsx$/,
    gates: ["check:page-payload"],
  },
  {
    /* check-headers asserts where the admin nonce goes and that public scripts need none: the server
       entry, the loader root renders, the marker <Enhance> renders and the speculation block. */
    what: "the server entry or a script the CSP trusts",
    test: /^app\/(entry\.server\.tsx|root\.tsx|lib\/(context\.ts|enhance-loader\.mjs)|components\/(enhance|site-speculation)\.tsx)$/,
    gates: ["check:headers"],
  },
  {
    what: "the schema or a migration",
    test: /^(app\/db\/schema\.ts|drizzle\/.+)$/,
    gates: ["check:migrations", RELATED],
  },
  {
    what: "a Worker entry",
    test: /^workers\/.+\.ts$/,
    gates: ["check:headers", "check:policy", "check:secrets", RELATED],
  },
  {
    what: "a post or other content",
    test: /^content\/.+/,
    gates: ["check:content", "check:diagrams", "check:machine-readable", "check:features"],
  },
  {
    what: "publication data",
    test: /^data\/.+/,
    gates: ["check:machine-readable", "check:content"],
  },
  {
    what: "a served asset",
    test: /^public\/.+/,
    gates: ["check:urls", "check:page-payload", "check:fonts"],
  },
  {
    /* check-headers asserts which entrypoint wrangler.jsonc.example lets the platform cache. */
    what: "the wrangler config example",
    test: /^wrangler\..*jsonc?(\.example)?$/,
    gates: ["check:secrets", "check:headers"],
  },
  {
    what: "a test",
    test: /^test\/.+/,
    gates: [RELATED],
  },
  {
    /* No gate or test reads these (the last hook test went with stop-typecheck.sh), so a change here
       runs nothing rather than falling through to the whole tier. */
    what: "a document, skill or hook, which no gate reads",
    test: /^(\.claude\/.+|[A-Za-z-]+\.md|docs\/.+\.md|\.design-sync\/.+)$/,
    gates: [],
  },
];

/**
 * A rule rather than a map row because the gate name comes out of the path.
 *
 * @param {string} file
 * @returns {string[] | null}
 */
function ownGate(file) {
  const m = /^scripts\/check-([a-z0-9-]+)\.mjs$/.exec(file);
  return m ? [`check:${m[1]}`] : null;
}

/**
 * @param {string} file
 * @param {Set<string>} declared
 * @returns {{ own: string[] | null, rules: typeof MAP, gates: string[] }}
 */
export function gatesFor(file, declared) {
  const own = ownGate(file);
  const rules = MAP.filter((r) => r.test.test(file));
  const gates = [...(own ?? []), ...rules.flatMap((r) => r.gates)].filter(
    (g) => g === RELATED || declared.has(g),
  );
  return { own, rules, gates: [...new Set(gates)] };
}

// A runner, a shared library or the stack builder is read by every gate, so it maps to the whole tier.
const TIER_WIDE = /^scripts\/(check-all|check-changed|build-stack)\.mjs$|^scripts\/lib\//;

/** @param {string[]} argv */
function parseArgs(argv) {
  const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "origin/main";
  return { base, dry: argv.includes("--dry") };
}

/**
 * @typedef {(args: string[]) => { status: number | null, stdout?: string | null, stderr?: string | null, error?: Error }} GitRunner
 */

/** @type {GitRunner} */
const realGit = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });

/**
 * Staged and unstaged too, because a gate verifies disk. A failed git call throws: read as an empty
 * list it would report "nothing changed" over a tree nobody looked at. The base probe is the one
 * call whose exit 1 is an answer (the ref does not exist here), not a failure.
 *
 * @param {string} base
 * @param {GitRunner} [git]
 * @returns {{files: string[], baseUsed: string | null}}
 */
export function changedFiles(base, git = realGit) {
  /** @param {string[]} args @returns {string} */
  const lines = (args) => {
    const r = git(args);
    if (r.error || r.status !== 0) {
      const why = r.error ? r.error.message : `exit ${r.status}: ${String(r.stderr ?? "").trim().slice(0, 300)}`;
      throw new Error(`git ${args.join(" ")} failed (${why})`);
    }
    return String(r.stdout ?? "");
  };

  const probe = git(["rev-parse", "--verify", "--quiet", base]);
  if (probe.error || (probe.status !== 0 && probe.status !== 1)) {
    const why = probe.error ? probe.error.message : `exit ${probe.status}`;
    throw new Error(`git rev-parse --verify ${base} failed (${why})`);
  }
  const known = probe.status === 0;

  const out = new Set();
  const add = (/** @type {string} */ text) => {
    for (const f of text.split("\n")) if (f.trim()) out.add(f.trim());
  };
  if (known) add(lines(["diff", "--name-only", `${base}...HEAD`]));
  // Untracked too: a new file is the most touched file there is.
  add(lines(["diff", "--name-only"]));
  add(lines(["diff", "--name-only", "--cached"]));
  add(lines(["ls-files", "--others", "--exclude-standard"]));
  return { files: [...out].sort(), baseUsed: known ? base : null };
}

function main() {
  const { base, dry } = parseArgs(process.argv.slice(2));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const declared = new Set(gateNames(pkg));

  // A row naming a gate that no longer exists would silently contribute nothing.
  const named = new Set(MAP.flatMap((r) => r.gates).filter((g) => g !== RELATED));
  const unknown = [...named].filter((g) => !declared.has(g));
  if (unknown.length) {
    console.error(`check:changed maps to gate(s) package.json does not declare: ${unknown.join(", ")}`);
    process.exit(2);
  }

  /** @type {{files: string[], baseUsed: string | null}} */
  let changed;
  try {
    changed = changedFiles(base);
  } catch (error) {
    console.error(
      `check:changed could not list what changed, so it cannot say what to check: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  }
  const { files, baseUsed } = changed;

  /** @param {string} why */
  function offlineTier(why) {
    console.log(`\n  ${why}\n`);
    if (dry) process.exit(0);
    const r = spawnSync("npm run check", { cwd: root, stdio: "inherit", shell: true });
    process.exit(r.status === 0 ? 0 : 1);
  }

  console.log("check:changed");
  console.log(`  ${files.length} changed path(s) against ${baseUsed ?? "HEAD"}\n`);

  // Without the base, committed changes on this branch are invisible, so a mapped subset would be a guess.
  if (!baseUsed) {
    offlineTier(
      `base ${base} is not a known ref here, so the branch's committed changes cannot be listed ` +
        "and the whole offline tier runs.",
    );
  }

  if (files.length === 0) {
    console.log("  nothing changed against the base, in the index, the working tree or untracked files.");
    console.log("  0 gates run, because there is nothing to check.");
    process.exit(0);
  }

  const tierWide = files.filter((f) => TIER_WIDE.test(f));
  if (tierWide.length) {
    console.log(`  ${tierWide.join("\n  ")}`);
    offlineTier(
      "the tier's own machinery changed, and every gate reads it, so the whole offline tier runs.",
    );
  }

  /** @type {Map<string, string[]>} */
  const wanted = new Map();
  /** @type {string[]} */
  const unmapped = [];
  /** @type {string[]} */
  const argued = [];

  for (const file of files) {
    const { own, rules, gates } = gatesFor(file, declared);
    if (gates.length === 0) {
      /* A row with no gates is a path argued safe to skip; only a path no row names is unmapped. */
      if (!own && rules.length > 0 && rules.every((r) => r.gates.length === 0)) {
        console.log(`  ${file}\n    ${rules.map((r) => r.what).join(", ")} -> nothing to run`);
        argued.push(file);
      } else {
        unmapped.push(file);
      }
      continue;
    }
    const what = own ? "its own gate" : rules.map((r) => r.what).join(", ");
    console.log(`  ${file}\n    ${what} -> ${gates.join(", ")}`);
    for (const g of gates) wanted.set(g, [...(wanted.get(g) ?? []), file]);
  }

  if (unmapped.length) {
    console.log(`\n  ${unmapped.length} path(s) map to no gate:\n    ${unmapped.join("\n    ")}`);
    offlineTier(
      "a path nobody mapped is a path nobody has argued is safe to skip, so the offline tier runs.",
    );
  }

  // CI-excluded gates run here too: most are excluded because CI cannot run them, so a local run is
  // the only run they get. CI_AFTER_BUILD ones (check:page-payload) CI does run, in its own step after
  // `npm run build`; here they read whatever build is on disk, so a stale local build reads stale.
  const gateKeys = [...wanted.keys()].filter((g) => g !== RELATED);
  const selected = gateKeys.filter((g) => TIERS[g] === "offline").sort();
  const deferred = gateKeys.filter((g) => TIERS[g] !== "offline").sort();
  const onlyHere = selected.filter((g) => CI_EXCLUDED[g] && !CI_AFTER_BUILD.includes(g));

  /** @param {string} path */
  const readSource = (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch (error) {
      const code = /** @type {NodeJS.ErrnoException} */ (error).code;
      if (code === "ENOENT" || code === "EISDIR") return null;
      throw error;
    }
  };

  /** A node test is related when its import walk reaches a changed file, itself included. */
  function relatedNodeTests() {
    const changedPaths = new Set(files.map((f) => join(root, f)));
    return readdirSync(join(root, "test"), { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => join(root, "test", f))
      .filter((t) =>
        [...reachableAssets(t, join(root, "app"), readSource).visited].some((v) => changedPaths.has(v)),
      )
      .sort();
  }

  // vitest follows its own module graph from these; deleted paths would be an error, not a match.
  const workerSources = wanted.has(RELATED)
    ? files.filter((f) => /^(app|workers|test\/worker)\//.test(f) && existsSync(join(root, f)))
    : [];
  const nodeTests = wanted.has(RELATED) ? relatedNodeTests() : [];

  const ran = selected.length + (nodeTests.length ? 1 : 0) + (workerSources.length ? 1 : 0);
  if (ran === 0) {
    if (wanted.size === 0) {
      console.log(
        `\n  0 gates run: all ${argued.length} changed path(s) are ones no gate or test reads, ` +
          "so this run checked nothing, by design.",
      );
      process.exit(0);
    }
    // Mapped to something, yet nothing local would run: a green line over that would check nothing.
    offlineTier(
      `the changed paths map to ${[...wanted.keys()].join(", ")}, but nothing of that runs here ` +
        "(no related test was found, or the gates need a deployed resource), so the offline tier runs.",
    );
  }

  console.log(`\n  running ${selected.length} gate(s): ${selected.join(", ")}`);
  if (wanted.has(RELATED)) {
    console.log(
      `  related tests: ${nodeTests.length} node test file(s)` +
        (workerSources.length ? `, and worker tests related to ${workerSources.length} file(s)` : ""),
    );
    for (const t of nodeTests) console.log(`    ${t.slice(root.length + 1).replace(/\\/g, "/")}`);
  }
  if (onlyHere.length) console.log(`  CI cannot run these, so this is their only run: ${onlyHere.join(", ")}`);
  if (deferred.length) console.log(`  needs a deployed resource, not run here: ${deferred.join(", ")}`);
  console.log("");

  if (dry) process.exit(0);

  let failed = 0;
  for (const name of selected) {
    const result = runGate(name, []);
    const mark = result.ok ? "ok  " : "FAIL";
    console.log(`  ${mark} ${name} (${Math.round(result.ms / 1000)}s)`);
    if (!result.ok) {
      failed += 1;
      console.log(`       ${result.reason}`);
      console.log(result.output ?? "");
    }
  }

  /** @param {string} label @param {string} command @param {string[]} args */
  function runTests(label, command, args) {
    const started = Date.now();
    const r = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    const ok = r.status === 0;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${label} (${Math.round((Date.now() - started) / 1000)}s)`);
    if (!ok) failed += 1;
  }

  if (nodeTests.length) runTests("related node tests", "node", ["--test", ...nodeTests]);
  if (workerSources.length) {
    runTests("related worker tests", "npx", ["vitest", "related", "--run", "--passWithNoTests", ...workerSources]);
  }

  console.log(`\n${ran} gate(s) and test run(s), ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

/* Main guard, so a test can import the map and the file lister without running a check. */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
