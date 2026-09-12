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
 * not small. Some offline gates cannot run in an extraction at all, for reasons
 * measured rather than assumed; this gate excludes itself and `check:floors` to
 * stop two kinds of recursion; and since ruling 51 one gate is excluded that
 * COULD run, because CI already runs it against a checkout of the same sha. Each
 * exclusion carries its own grounds at EXCLUDED below. A green check:head
 * therefore means "the ones that CAN run and are not answered elsewhere, do",
 * which is a narrower claim than "HEAD is good".
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
 * RE-MEASURED 2026-09-09 by RUNNING it, after ruling 51 dropped `check:worker`
 * from the nested tier: 22 gates in 121.5s. The slowest are now `check:types`
 * at 31.3s and `check:tests` at 25.5s. The saving is memory rather than time,
 * and it is the whole reason for the exclusion: `check:worker` nested here ran
 * a vitest and three workerd INSIDE the extraction, about 880MB at the peak.
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
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";

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
   * RECURSION OF THE SECOND KIND, and it squares rather than looping forever.
   *
   * `check:floors` runs every counting gate to read its floor lines. This gate
   * runs the offline tier, which contains `check:floors`. Left in, one
   * extraction would run every counting gate once for the tier and once more
   * inside check:floors, and the whole tier would be paid twice inside a gate
   * that already costs three minutes.
   *
   * Nothing is lost. `check:floors` compares a floor against a count, and both
   * numbers are properties of the GATE, not of the checkout: an extraction of
   * HEAD reports the same floors as disk unless disk is dirty, and a dirty tree
   * is what the rest of this gate is for. `check-floors.mjs`'s own NOT_RUN
   * carries the matching entry in the other direction.
   */
  "check:floors": "recursion: it runs the whole offline tier, which this gate is running.",
  /*
   * MEASURED 2026-08-10, not guessed. `bootstrap-config.mjs` creates
   * `wrangler.jsonc` BY COPYING `wrangler.jsonc.example`, because the real one
   * is gitignored and absent from any extraction. That makes real == example by
   * construction, and check:config's whole job is asserting they DIFFER in the
   * redacted values. RE-MEASURED 2026-08-31 by running the gate in an
   * extraction, verbatim and in full:
   *
   *   FAIL  wrangler.jsonc redacted var CLOUDFLARE_ACCOUNT_ID is NOT the real value in the example
   *   FAIL  example's database_id is not the real one
   *   FAIL  example's KV id is not the real one
   *   FAIL  wrangler.watchdog.jsonc redacted var ALERT_EMAIL is NOT the real value in the example
   *   FAIL  no redacted value from a real config appears in a tracked file
   *
   * This paragraph said "the two account-scoped ids" and quoted the middle two
   * lines. It went stale twice underneath itself and in the same direction, by
   * omission: `CLOUDFLARE_ACCOUNT_ID` joined the redacted set on 2026-08-28
   * (`apply-config-ids.mjs`), and the whole watchdog pair joined on 2026-08-29.
   * Hard rule 17. The count is deliberately not restated in prose above; the
   * list is the copy, and re-taking it means running the gate.
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
  /*
   * Reads build/client, which is gitignored build output and absent from any
   * extraction. Building inside the worktree to satisfy it would measure a
   * build of HEAD that nothing deploys, at a full client build's cost per run.
   * Same class as check:backup: the input is state a checkout does not have.
   */
  "check:page-payload": "reads the gitignored build/client output, absent from an extraction.",
  /*
   * RULING 51, 2026-09-09. NOT a can-it-run exclusion like the four above: this
   * one CAN run in an extraction and is excluded because the property it proves
   * is already proven twice over by the time this gate runs.
   *
   * This gate exists to catch DISK VERSUS HEAD DIVERGENCE. Ship refuses a dirty
   * tree at step 1, so at the moment it matters disk EQUALS HEAD and nesting a
   * gate here answers a question that cannot have a different answer. The other
   * half is CI, which runs check:worker on a clean checkout of the same sha, on
   * a machine that has never seen this repo, which is strictly the stronger
   * reading of the same property.
   *
   * What it buys is memory, and that is the reason it was found. check:head
   * runs the whole tier inside a temp checkout, so check:worker's vitest plus
   * its three workerd processes ran INSIDE this gate's extraction: 2.1GB on top
   * of 2.0GB. Measured at ~880MB off the peak. The starve was real, not
   * theoretical: it killed five check:all runs, which read as "killed
   * externally" until the memory instrument landed.
   */
  "check:worker": "ruling 51: a clean tree makes disk == HEAD, and CI runs it on a checkout of the same sha.",
};

/** Floor. Fails closed below this; moves only by deliberate edit. */
const MINIMUM_EXECUTED = 20;

/*
 * HOW MUCH OF AN INNER GATE'S OUTPUT REACHES THIS ONE'S.
 *
 * ## What was lost, measured 2026-08-31
 *
 * This matched the inner gate's output against a multiline regex anchored on
 * FAIL and kept the FIRST line it matched, throwing the rest away. Every gate
 * here prints a failure as a LABEL line followed by an INDENTED DETAIL, so the
 * one line that survived was always the label and the detail never was.
 *
 * The cost was paid on 2026-08-31. `check:worker` failed in `ship` inside this
 * gate and the log carried exactly `FAIL  no worker test failed`, which is
 * `check-worker.mjs`'s assertion label. Its detail composes `N failing, runner
 * exit X` plus up to twelve failing case lines, and that is the half naming the
 * test. Diagnosing it cost a session and three clean re-runs, and the failure
 * was never reproduced, so the case names are gone for good.
 *
 * ## The cap, and why there is one at all
 *
 * A gate that fails in an extraction can print a great deal, and this gate
 * reports up to twenty-one of them above a summary somebody has to read. So the
 * forward is bounded at FORWARDED_LINES lines and FORWARDED_CHARS characters,
 * whichever binds first, and it SAYS SO IN THE OUTPUT when it truncates rather
 * than trailing off. A silent truncation reads as "that was all of it", which
 * is the failure this whole block exists to stop repeating.
 *
 * The numbers are sized off the widest producer rather than guessed: the twelve
 * case lines `check-worker.mjs` forwards, plus its label, header and the
 * runner's own tail, fit inside forty lines comfortably.
 */
const FORWARDED_LINES = 40;
const FORWARDED_CHARS = 4000;

/**
 * The inner gate's failure detail, from its first FAIL line onward.
 *
 * Falls back to the last non-empty line when nothing matched, which is the case
 * for a gate that died without printing a verdict at all.
 *
 * @param {string} out
 * @returns {string}
 */
function failureDetail(out) {
  const lines = out.split("\n");
  const first = lines.findIndex((line) => /^\s*FAIL/.test(line));
  if (first < 0) {
    return (lines.filter((line) => line.trim()).slice(-1)[0] ?? "").trim();
  }

  const kept = lines.slice(first, first + FORWARDED_LINES);
  const droppedLines = Math.max(0, lines.length - first - FORWARDED_LINES);
  let text = kept.join("\n");
  const droppedChars = Math.max(0, text.length - FORWARDED_CHARS);
  if (droppedChars > 0) text = text.slice(0, FORWARDED_CHARS);

  if (droppedLines > 0 || droppedChars > 0) {
    text +=
      `\n[forwarded output truncated at ${FORWARDED_LINES} lines / ${FORWARDED_CHARS} chars; ` +
      `${droppedLines} more line(s) not shown. Run the gate directly for the rest.]`;
  }
  return text;
}

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
/*
 * `test` JOINED 2026-08-31, after the class it guards was found living there.
 *
 * `test/worker/publish.test.ts` carried two literal NUL bytes for two days, in
 * a comment that meant to write the escape `\0` and wrote the byte. Everything
 * this preflight exists to prevent followed: `git ls-files --eol` reported the
 * file `-text` while every sibling reported `lf`, so it was the one file in
 * that directory exempt from `.gitattributes`, and a directory-scoped ripgrep
 * over `test/` skipped it entirely.
 *
 * It was invisible here because this list named the three roots the two earlier
 * instances happened to live in. A scan scoped to where the last defect was
 * found is a scan that can only ever catch the last defect.
 */
const NUL_ROOTS = ["scripts", "app", "workers", "test"];
const SKIP_DIRS = new Set(["node_modules", ".git", "build", ".wrangler", ".react-router"]);

/**
 * Extensions that are BINARY BY NATURE, so a NUL in them is not the defect.
 *
 * Added 2026-08-21, when the Inter subsets moved from `public/fonts/` into
 * `app/fonts/` so the build could content-hash them. That put two legitimately
 * binary files inside a root this preflight walks, and it FAILED, correctly by
 * its own rule and wrongly about the world.
 *
 * The class it guards is a file that LOOKS like source and defeats text tooling:
 * `app/db/index.ts` and `scripts/check-config.mjs` each carried a NUL for over a
 * week and were invisible to ripgrep. A woff2 is not that. Nobody expects to
 * grep it, git already treats it as binary by content, and `.gitattributes`
 * lists the binary formats explicitly.
 *
 * **NAMED BY EXTENSION, not "skip anything that looks binary".** The tempting
 * version is to exempt any file whose first bytes fail a UTF-8 decode, and that
 * is a catch-all that fails OPEN on exactly the case this exists for: a `.ts`
 * with a NUL in it is a file that looks binary. This list is two extensions and
 * anything else still gets read as bytes and still fails.
 */
const BINARY_BY_NATURE = new Set([".woff2", ".woff"]);

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

const walked = NUL_ROOTS.flatMap((r) => (existsSync(join(root, r)) ? walkAll(join(root, r)) : []));
const binaryByNature = walked.filter((f) => BINARY_BY_NATURE.has(extname(f).toLowerCase()));
const scanned = walked.filter((f) => !BINARY_BY_NATURE.has(extname(f).toLowerCase()));
const nulFiles = scanned.filter((f) => readFileSync(f).includes(0));

/*
 * THE EXEMPTION POLICES ITSELF. If the fonts move again, or the extension list
 * outlives the files it was written for, this says so rather than sitting there
 * quietly widening the scan's blind spot by two file types.
 */
ok(
  "every binary-by-nature exemption still names a file that exists",
  binaryByNature.length > 0,
  `no .woff2 or .woff found under ${NUL_ROOTS.join(", ")}, so BINARY_BY_NATURE ` +
    `now exempts nothing and should be deleted rather than left as a standing hole.`,
);

/*
 * FLOOR: RE-MEASURED 2026-08-31 through this walk by running the gate: 350,
 * with `test` newly in NUL_ROOTS. Now >= 320, about eight percent under. It was
 * 220 against a claimed 239, and 138 against 158, and 50 before that.
 *
 * 50 left a 68 percent blind zone: `scripts/` and `workers/` could both drop
 * out and `app/` alone would clear it. 138 had drifted back to a 42 percent
 * one as the tree grew. The class this preflight guards is a file whose bytes
 * defeat text tooling, so a scan that quietly stops covering a third of the
 * tree is precisely the failure it must not have.
 *
 * The 239 above is recorded as CLAIMED rather than measured: this gate printed
 * 277 for the same three roots on 2026-08-31, so the figure in the comment had
 * drifted 14 percent under the walk it described while the floor beneath it
 * went on passing. A floor that is never re-taken stops being eight percent of
 * anything.
 */
ok(
  "the NUL scan examined files",
  scanned.length >= 320,
  `${scanned.length} found under ${NUL_ROOTS.join(", ")}, floor 320, measured 350. A root ` +
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
  offline.length >= 21,
  `parsed ${offline.length}, floor 21, measured 23; the TIERS table did not read, so the set below is wrong`,
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

  /*
   * THE STACK ARTIFACT, built IN THE WORKTREE and BEFORE build:content, which
   * reads it to emit the colophon's page records. Gitignored since ruling 39a,
   * so an extraction has its sources and not it, exactly like the two build
   * products below. Without this step build:content fails on a missing file
   * that is not HEAD's fault, which is the failure mode this whole block
   * exists to prevent.
   */
  const bs = spawnSync("npm run build:stack", {
    cwd: worktree,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  ok(
    "build:stack produced the worktree's stack artifact",
    bs.status === 0,
    `${(bs.stdout ?? "")}${(bs.stderr ?? "")}`.trim().slice(-200),
  );
  if (bs.status !== 0) throw new Error("the worktree stack build failed; the tier has no subject");

  /*
   * THE LOCAL BUILD PRODUCT, built IN THE WORKTREE. posts.json is gitignored
   * since the artifact arc, so an extraction has markdown and no build
   * product; the gates that read it would otherwise fail on a missing file
   * that is not HEAD's fault. Built here for the same reason check-all.mjs
   * builds before its tier, against HEAD's own sources.
   */
  const bc = spawnSync("npm run build:content", {
    cwd: worktree,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  ok(
    "build:content produced the worktree's build product",
    bc.status === 0,
    `${(bc.stdout ?? "")}${(bc.stderr ?? "")}`.trim().slice(-200),
  );
  if (bc.status !== 0) throw new Error("the worktree build failed; the tier has no subject");

  /*
   * THE PUBLICATION TWINS, built in the worktree for the same reason and found
   * by this gate on the day they landed: public/publications/*.md is gitignored
   * build product, so an extraction of HEAD has 36 PDFs and no twins, and
   * `check:publications` compares what is on disk against a fresh generation.
   * It reported "run npm run build:publication-twins" against a checkout where
   * nothing had, which is a missing build step rather than anything about HEAD.
   */
  const bt = spawnSync("npm run build:publication-twins", {
    cwd: worktree,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  ok(
    "build:publication-twins produced the worktree's markdown twins",
    bt.status === 0,
    `${(bt.stdout ?? "")}${(bt.stderr ?? "")}`.trim().slice(-200),
  );
  if (bt.status !== 0) throw new Error("the worktree twin build failed; the tier has no subject");

  /*
   * THE ENHANCEMENT BUNDLES, built in the worktree for the same reason:
   * app/enhance/dist/ is gitignored, so an extraction has the enhancement
   * source and no bundles, and HEAD's ?url imports name files that would not
   * exist. Built against HEAD's own sources, like build:content above.
   */
  const be = spawnSync("npm run build:enhance", {
    cwd: worktree,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  ok(
    "build:enhance produced the worktree's enhancement bundles",
    be.status === 0,
    `${(be.stdout ?? "")}${(be.stderr ?? "")}`.trim().slice(-200),
  );
  if (be.status !== 0) throw new Error("the worktree bundle build failed; the tier has no subject");

  started = Date.now();
  /** @type {Array<{name: string, ok: boolean, ms: number, detail: string}>} */
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
      detail: failureDetail(out),
    });
    console.log(
      `  ${r.status === 0 ? "PASS" : "FAIL"}  ${name.padEnd(18)} ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
  executed = results;

  const executedFloorBreach = assertFloor(
    "check:head",
    "gates-executed",
    executed.length,
    MINIMUM_EXECUTED,
    'A run that executes almost nothing reports the same "0 failures" as a clean ' +
      "checkout, which is the failure this floor exists to prevent.",
  );
  ok(
    `at least ${MINIMUM_EXECUTED} gates ran inside the extraction`,
    !executedFloorBreach,
    executedFloorBreach ?? "",
  );

  for (const r of executed) {
    ok(
      `${r.name} passes against a fresh checkout of ${REF}`,
      r.ok,
      `${r.detail.trim().split("\n").join("\n        ")}\n        This gate is RED at ${REF}. ` +
        `Run it on disk before concluding anything about the difference: work may be ` +
        `uncommitted, the checkout may differ from disk, or the gate may be red in both ` +
        `places. This gate never measured the disk half.`,
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
 * RE-MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-09-08 by RUNNING it:
 * 37, with 23 gates executed. Never summed. Floored at 34, slack of three: most
 * of the count is one assertion per gate run, so it steps by one when a gate is
 * added and by more only when the tier is re-tiered.
 *
 * RE-MEASURED THE SAME WAY on 2026-09-09, after ruling 51 excluded
 * `check:worker`: 36, with 22 gates executed. Both numbers fell by exactly one,
 * which is what removing one gate from the nested tier should do and is the
 * reason the floor did not move: 34 still bites, now with a slack of two, and
 * lowering it to chase the count would give up the assertion.
 *
 * The prose here said 30 measured and 27 floored while the constant read 33,
 * which is rule 17's rot in its ordinary form: the constant was raised as the
 * tier grew and the sentence justifying it was not. The number above is what
 * the gate printed on the run that set it, and the floor line the gate emits is
 * what owns it from here.
 */
const MINIMUM_CHECKS = 34;
const floorBreach = assertFloor("check:head", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
