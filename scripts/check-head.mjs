/**
 * Gate: run the offline tier against a FRESH CHECKOUT OF HEAD, not the disk.
 *
 *   npm run check:head
 *   node scripts/check-head.mjs --ref <branch|sha>
 *
 * BOUNDARY: it observes a CHECKOUT, not the deploy, and it inherits every excluded gate's
 * blindness, each carrying its grounds at EXCLUDED.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * DERIVED from the offline tier minus EXCLUDED, so a gate added to `check-all.mjs` and forgotten
 * here shows up as a mismatch rather than being silently skipped.
 */
const EXCLUDED = {
  /*
   * ITSELF. Same shape as check:all excluding the runners: without this it
   * extracts a worktree, which runs check:head, which extracts a worktree.
   */
  "check:head": "recursion. It would extract a worktree inside a worktree, forever.",
  /*
   * RECURSION OF THE SECOND KIND, and it squares rather than looping: `check:floors` runs every
   * counting gate and this runs the tier containing it. Nothing is lost, both numbers being
   * properties of the GATE rather than of the checkout.
   */
  "check:floors": "recursion: it runs the whole offline tier, which this gate is running.",
  /*
   * `bootstrap-config.mjs` creates the real config BY COPYING the example, so real == example by
   * construction, and this gate's job is asserting they DIFFER. It can never pass in an extraction,
   * which is the gate being correct rather than a limitation, and is why check:config is
   * load-bearing on exactly one machine. The list is not restated here, on the one-owner rule.
   */
  "check:config": "cannot pass in any extraction: bootstrap copies the example, so real == example.",
  /* Defaults to `--local`, which reads miniflare state a checkout does not have. */
  "check:backup": "needs the gitignored .wrangler/ miniflare state, absent from a checkout.",
  /*
   * Reads gitignored build output. Building inside the worktree would measure a build of HEAD that
   * nothing deploys, at a full client build's cost per run.
   */
  "check:page-payload": "reads the gitignored build/client output, absent from an extraction.",
  /*
   * NOT a can-it-run exclusion: this one CAN run and its property is proven twice by then, ship
   * refusing a dirty tree and CI running it on a clean checkout of the same sha. What it buys is
   * MEMORY: nested here it ran a vitest and three workerd INSIDE this gate's extraction.
   */
  "check:worker": "ruling 51: a clean tree makes disk == HEAD, and CI runs it on a checkout of the same sha.",
};

/** Floor. Fails closed below this; moves only by deliberate edit. */
const MINIMUM_EXECUTED = 20;

/*
 * HOW MUCH OF AN INNER GATE'S OUTPUT REACHES THIS ONE'S. This kept the FIRST matching line, and
 * every gate prints a LABEL then an INDENTED DETAIL, so the detail never survived. THE CAP binds
 * on lines or characters, whichever comes first, and SAYS SO: silence reads as "that was all".
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

/* NUL preflight */

/*
 * A NUL byte makes git render a file as binary and ripgrep skip it, so a change rides into a
 * commit unreviewed. **This reads BYTES, not text**: the class is about files whose byte content
 * defeats text tooling, so the check guarding it must not be a text check.
 */
/*
 * `test` JOINED after the class was found living there. A scan scoped to where the last defect
 * was found is a scan that can only ever catch the last defect.
 */
const NUL_ROOTS = ["scripts", "app", "workers", "test"];
const SKIP_DIRS = new Set(["node_modules", ".git", "build", ".wrangler", ".react-router"]);

/**
 * Extensions that are BINARY BY NATURE, so a NUL in them is not the defect. **NAMED BY
 * EXTENSION**, because exempting anything whose bytes fail a UTF-8 decode fails OPEN on exactly
 * the case this exists for: a `.ts` with a NUL in it is a file that looks binary.
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

/* THE EXEMPTION POLICES ITSELF: if the fonts move, this says so rather than widening the scan. */
ok(
  "every binary-by-nature exemption still names a file that exists",
  binaryByNature.length > 0,
  `no .woff2 or .woff found under ${NUL_ROOTS.join(", ")}, so BINARY_BY_NATURE ` +
    `now exempts nothing and should be deleted rather than left as a standing hole.`,
);

/*
 * FLOOR, RE-MEASURED THROUGH THIS WALK by running the gate. Earlier values had drifted far enough
 * under the tree that whole roots could have dropped out and it would still have cleared.
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

/* the runnable gate set */

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

/* the extraction */

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
   * `ln -s` COPIES on this host. A junction is the one primitive that links without copying, and
   * node's `symlinkSync` with type "junction" is the only reliable way to make one from here.
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
   * THE STACK ARTIFACT, built IN THE WORKTREE and BEFORE the content build, which reads it: it is
   * gitignored, so without this step the build fails on a file that is not HEAD's fault.
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

  /* THE LOCAL BUILD PRODUCT, built IN THE WORKTREE against HEAD's own sources, for the same reason. */
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
   * THE PUBLICATION TWINS, same reason, found on the day they landed: the gate comparing them
   * reported a missing build step rather than anything about HEAD.
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

  /* THE ENHANCEMENT BUNDLES, same reason: HEAD's `?url` imports name files that would not exist. */
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
   * Cleanup MUST survive a crash: a stale worktree is invisible, `git status` stays clean, and the
   * next run fails at a path that already exists. Prune runs regardless.
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
 * EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS, because if those stopped the gate floor
 * would stop being consulted and the run would still report clean. RE-MEASURED BY RUNNING IT.
 */
const MINIMUM_CHECKS = 34;
const floorBreach = assertFloor("check:head", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
