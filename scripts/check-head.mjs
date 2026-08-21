/**
 * Gate: run the offline tier against a FRESH CHECKOUT OF HEAD, not the disk.
 *
 *   npm run check:head
 *   node scripts/check-head.mjs --ref <branch|sha>
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT OBSERVES A CHECKOUT, NOT THE DEPLOY.** It extracts a ref into a
 * throwaway worktree and runs gates there, so it catches two things nothing
 * else in this repo catches: work that is on disk and not committed, and
 * line-ending divergence between what you have and what a clone gets.
 *
 * It cannot see the running Worker. A build deployed from a dirty tree is
 * invisible here, exactly as it is to every other gate; proving which build
 * answered is `verify-live`'s job and needs the wire.
 *
 * **It also inherits every excluded gate's blindness**, and the excluded set is
 * not small. Two of the offline gates cannot run in an extraction at all, for
 * reasons measured rather than assumed (see EXCLUDED below), and this gate
 * excludes itself for a third. A green check:head therefore means "the ones
 * that CAN run, do", which is a narrower claim than "HEAD is good".
 *
 * The counts are DELIBERATELY not written here. They were, and they went stale:
 * this paragraph said "nineteen offline gates" and "the seventeen that CAN run"
 * while the real numbers were twenty-three and twenty. The gate PRINTS both
 * every run, which is the copy that cannot drift.
 *
 * ## Why this exists
 *
 * Ranked first in dustinedwards/gate-backlog.md. Measured twice:
 *
 * 1. `584557f` committed five `check:headers` assertions whose SUBJECT was
 *    uncommitted. `check:all` was green for two commits. Extracting HEAD and
 *    running those assertions read 5 of 5 FAIL.
 * 2. `check:claude-md` shipped green on disk and RED in an extraction of the
 *    identical commit, because its heading needle was `\n## Hard rules\n` and a
 *    checkout produced CRLF.
 *
 * Both were found by hand, by doing what this file now does. Neither was
 * findable any other way: the gates read disk, and disk was not HEAD.
 *
 * ## Cost
 *
 * Measured 2026-08-10: roughly 50s of gates plus worktree creation, against a
 * 121s offline-tier norm, so `npm run check` goes to roughly 3 minutes. That is
 * the price of the only instrument that can see this class.
 *
 * RE-MEASURED 2026-08-20 by RUNNING it: 23 gates in 174.2s, 179s wall. The
 * slowest are `check:charts` at 64.9s and `check:types` at 35.0s. The old
 * figure is kept above rather than overwritten, because the difference is the
 * subject of the next paragraph.
 *
 * **THE TYPECHECK IS COLD HERE, ALWAYS, AND THAT IS CORRECT.** `check:types`
 * costs 35.0s in the extraction against 15s warm on the working tree. The
 * difference is `tsc -b` incremental state: `tsconfig.node.tsbuildinfo` and
 * `tsconfig.cloudflare.tsbuildinfo` sit at the repo root, are matched by
 * `.gitignore:4:*.tsbuildinfo`, and are tracked by nothing, so an extraction
 * never receives them.
 *
 * Copying them in would halve it and would be WRONG. `tsc -b` uses that state
 * to decide which files it can skip, and it would be deciding against
 * timestamps and hashes taken from DISK while checking the sources of HEAD. A
 * gate whose entire purpose is that disk and HEAD may differ must not accept an
 * oracle built from disk. The 20s is the price of the answer being about HEAD.
 *
 * ## A 2881s READING THAT WAS NOT THIS GATE
 *
 * On 2026-08-20 a `npm run check` recorded `check:head` at 2881.6s, and every
 * one of the fourteen gates after it failed in 0.0 to 0.2s. Those were spawn
 * failures on a saturated machine, not results, and re-running each one
 * individually showed them all green.
 *
 * The cause was the session's own debris rather than anything here: several
 * `vite preview` servers and Puppeteer browsers from `check:browser` were still
 * running, because a run killed mid-flight skips the `finally` that stops them.
 * Recorded because the reading looked exactly like a 32x regression in this
 * file, and it was a measurement taken through a busy machine. Re-measured on a
 * quiet one: 179s.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The gates run inside the extraction.
 *
 * DERIVED from the offline tier minus EXCLUDED, rather than hardcoded, so a
 * gate added to `check-all.mjs` and forgotten here shows up as a mismatch
 * rather than being silently skipped.
 */
const EXCLUDED = {
  /*
   * ITSELF. Same shape as check:all excluding the runners: without this it
   * extracts a worktree, which runs check:head, which extracts a worktree.
   */
  "check:head": "recursion. It would extract a worktree inside a worktree, forever.",
  /*
   * MEASURED 2026-08-10, not guessed. `bootstrap-config.mjs` creates
   * `wrangler.jsonc` BY COPYING `wrangler.jsonc.example`, because the real one
   * is gitignored and absent from any extraction. That makes real == example by
   * construction, and check:config's whole job is asserting they DIFFER in the
   * two account-scoped ids. Verbatim from the probe:
   *
   *   FAIL  example's database_id is not the real one
   *   FAIL  example's KV id is not the real one
   *
   * It can never pass in an extraction. That is the gate being correct, not a
   * limitation to work around, and it is why check:config is load-bearing on
   * exactly one machine.
   */
  "check:config": "cannot pass in any extraction: bootstrap copies the example, so real == example.",
  /*
   * MEASURED 2026-08-10. Defaults to `--local`, which reads miniflare state
   * under `.wrangler/`. That directory is gitignored and absent. Verbatim:
   *
   *   failed: SENTRY_DO SQLite failed; unable to open database file: SQLITE_CANTOPEN
   *   check:backup failed. could not read sqlite_master
   */
  "check:backup": "needs the gitignored .wrangler/ miniflare state, absent from a checkout.",
};

/** Floor. Fails closed below this; moves only by deliberate edit. */
const MINIMUM_EXECUTED = 15;

const args = process.argv.slice(2);
const refFlag = args.indexOf("--ref");
const REF = refFlag >= 0 ? args[refFlag + 1] : "HEAD";

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

console.log(`\ncheck:head  (ref: ${REF})\n`);

/* ------------------------------------------------------------ NUL preflight */

/*
 * GATE BACKLOG ITEM 9, as a STANDING assertion rather than a one-off cleanup.
 *
 * A NUL byte makes git render a file as `Bin n -> m` and makes ripgrep skip it
 * in a directory search, so a change to it rides into a commit unreviewed and
 * is invisible to every text search. `app/db/index.ts` and
 * `scripts/check-config.mjs` both carried one, for seven and eight days, and
 * were only found by reading `git ls-files --eol`.
 *
 * **This reads BYTES, not text.** Reading the file as utf8 and searching for a
 * NUL escape would work, but the whole class is about files whose byte content
 * defeats text tooling, so the check that guards it must not be a text check.
 */
const NUL_ROOTS = ["scripts", "app", "workers"];
const SKIP_DIRS = new Set(["node_modules", ".git", "build", ".wrangler", ".react-router"]);

/** @param {string} dir @param {string[]} out */
function walkAll(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkAll(full, out);
    else out.push(full);
  }
  return out;
}

const scanned = NUL_ROOTS.flatMap((r) => (existsSync(join(root, r)) ? walkAll(join(root, r)) : []));
const nulFiles = scanned.filter((f) => readFileSync(f).includes(0));

/*
 * FLOOR: was >= 50, MEASURED 158 this session through this walk, now >= 138
 * (about 13 percent under).
 *
 * 50 left a 68 percent blind zone: `scripts/` and `workers/` could both drop
 * out and `app/` alone would clear it. The class this preflight guards is a
 * file whose bytes defeat text tooling, so a scan that quietly stops covering
 * two thirds of the tree is precisely the failure it must not have.
 */
ok(
  "the NUL scan examined files",
  scanned.length >= 138,
  `${scanned.length} found under ${NUL_ROOTS.join(", ")}; expected at least 138. A root ` +
    `has stopped being walked, or the walk stopped descending.`,
);
console.log(`  NUL preflight: ${scanned.length} file(s) under ${NUL_ROOTS.join(", ")}`);
ok(
  "no source file contains a NUL byte",
  nulFiles.length === 0,
  nulFiles.map((f) => relative(root, f).split(sep).join("/")).join("\n        ") +
    "\n        A NUL makes git render the file binary and makes ripgrep skip it in a " +
    "directory search, so changes ride in unreviewed. Write the escape, not the byte.",
);

/* ------------------------------------------------- the runnable gate set --- */

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const allGates = Object.keys(pkg.scripts ?? {})
  .filter((n) => n.startsWith("check:") && n !== "check:all")
  .sort();

const checkAllSource = readFileSync(join(root, "scripts", "check-all.mjs"), "utf8");
const offline = allGates.filter((n) =>
  new RegExp(`"${n.replace(":", ":")}"\\s*:\\s*"offline"`).test(checkAllSource),
);
const runnable = offline.filter((n) => !(n in EXCLUDED));

ok(
  "the offline tier was parsed from check-all.mjs",
  offline.length >= 15,
  `parsed ${offline.length}; the TIERS table did not read, so the set below is wrong`,
);
ok(
  "every exclusion names a gate that exists",
  Object.keys(EXCLUDED).every((n) => n === "check:head" || allGates.includes(n)),
  `EXCLUDED names something package.json does not declare: ${Object.keys(EXCLUDED)
    .filter((n) => n !== "check:head" && !allGates.includes(n))
    .join(", ")}`,
);
ok(
  "check:head excludes ITSELF",
  !runnable.includes("check:head"),
  "without this it extracts a worktree inside a worktree, forever",
);

/* ------------------------------------------------------- the extraction --- */

const git = spawnSync("git", ["--version"], { cwd: root, encoding: "utf8" });
ok("git is available", git.status === 0, "cannot extract a ref without it");

let worktree = "";
let executed = [];
let started = Date.now();

try {
  if (failures > 0) throw new Error("preflight failed; not extracting");

  worktree = mkdtempSync(join(tmpdir(), "check-head-"));
  rmSync(worktree, { recursive: true, force: true });

  const add = spawnSync("git", ["worktree", "add", "--detach", worktree, REF], {
    cwd: root,
    encoding: "utf8",
  });
  ok(
    `a worktree was created at ${REF}`,
    add.status === 0 && existsSync(worktree),
    (add.stderr || add.stdout || "").trim().split("\n").slice(-2).join(" "),
  );
  if (add.status !== 0) throw new Error("worktree creation failed");

  /*
   * `ln -s` COPIES on this host, and npm install in a throwaway tree would cost
   * minutes. A junction is the one primitive that links without copying, and
   * node's symlinkSync with type "junction" is the only reliable way to make
   * one from here: `mklink /J` through the shell loses its arguments to path
   * conversion.
   */
  symlinkSync(join(root, "node_modules"), join(worktree, "node_modules"), "junction");
  ok(
    "node_modules is reachable in the worktree",
    existsSync(join(worktree, "node_modules", ".bin")),
    "the junction did not take, so every gate would fail on module resolution",
  );

  // The real wrangler.jsonc is gitignored, so a checkout has none and anything
  // reading it dies. bootstrap copies the example, which is what a fresh clone
  // does on install.
  const boot = spawnSync("node", ["scripts/bootstrap-config.mjs"], {
    cwd: worktree,
    encoding: "utf8",
  });
  ok(
    "bootstrap:config produced a wrangler.jsonc in the worktree",
    boot.status === 0 && existsSync(join(worktree, "wrangler.jsonc")),
    (boot.stderr || boot.stdout || "").trim().slice(-160),
  );

  started = Date.now();
  /** @type {Array<{name: string, ok: boolean, ms: number, tail: string}>} */
  const results = [];
  for (const name of runnable) {
    const t0 = Date.now();
    const r = spawnSync(`npm run ${name}`, {
      cwd: worktree,
      encoding: "utf8",
      shell: true,
      maxBuffer: 64 * 1024 * 1024,
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    results.push({
      name,
      ok: r.status === 0,
      ms: Date.now() - t0,
      tail: (out.match(/^\s*FAIL[^\n]*/m) ?? out.split("\n").filter(Boolean).slice(-1))[0] ?? "",
    });
    console.log(
      `  ${r.status === 0 ? "PASS" : "FAIL"}  ${name.padEnd(18)} ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
  executed = results;

  ok(
    `at least ${MINIMUM_EXECUTED} gates ran inside the extraction`,
    executed.length >= MINIMUM_EXECUTED,
    `${executed.length} ran. A run that executes almost nothing reports the same "0 failures" ` +
      `as a clean checkout, which is the failure this floor exists to prevent.`,
  );

  for (const r of executed) {
    ok(
      `${r.name} passes against a fresh checkout of ${REF}`,
      r.ok,
      `${r.tail.trim()}\n        This gate is GREEN on disk and RED at ${REF}. Either work is ` +
        `uncommitted, or the checkout differs from disk (line endings are the usual cause).`,
    );
  }
} catch (error) {
  ok("check:head completed without throwing", false, error instanceof Error ? error.message : String(error));
} finally {
  /*
   * Cleanup MUST survive a crash. A stale worktree is invisible: `git status`
   * stays clean, and the next run fails to create one at a path that already
   * exists. Prune runs regardless, because `remove` fails if the directory was
   * already gone.
   */
  if (worktree) {
    try {
      rmSync(join(worktree, "node_modules"), { force: true });
    } catch {
      /* the junction may already be gone */
    }
    spawnSync("git", ["worktree", "remove", "--force", worktree], { cwd: root, encoding: "utf8" });
    spawnSync("git", ["worktree", "prune"], { cwd: root, encoding: "utf8" });
    try {
      rmSync(worktree, { recursive: true, force: true });
    } catch {
      /* already removed */
    }
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `\n  ${executed.length} gate(s) run against ${REF} in ${seconds}s, ` +
    `${Object.keys(EXCLUDED).length} excluded (${Object.keys(EXCLUDED).join(", ")})`,
);

/*
 * EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS.
 *
 * MINIMUM_EXECUTED above floors the GATES that ran inside the extraction, which
 * is the headline number and not this one. This floors the assertions this gate
 * makes AROUND that run: the preflight, the extraction, the NUL scan, the
 * exclusions and the per-gate verdicts. If those stopped running, the gate floor
 * above would stop being consulted and the run would still report clean.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 30,
 * with 20 gates executed and 3 excluded. Never summed. Floored at 27, slack of
 * three: most of the count is one assertion per gate run, so it steps by one
 * when a gate is added and by more only when the tier is re-tiered.
 */
const MINIMUM_CHECKS = 27;
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was SKIPPED ` +
      `rather than failing. Measured: 30.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
