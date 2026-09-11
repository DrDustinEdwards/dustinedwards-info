/**
 * Dependency lean-out measurement. REPORTS, never changes anything.
 *
 *   node scripts/measure/deps.mjs
 *   node scripts/measure/deps.mjs --json
 *
 * ## NOT A GATE, AND DELIBERATELY NOT IN `scripts/`
 *
 * It lives under `scripts/measure/` because `check-all.mjs` derives the gate
 * list from package.json's `check:*` scripts, and this has no `check:` script
 * and no floor. It asserts nothing and cannot fail a build. It exists so the
 * next dependency session re-measures rather than re-reads a stale table: the
 * queued item that produced it carried counts from 2026-09-06 that were already
 * wrong by the time it ran (50 direct against a real 51).
 *
 * ## WHAT EACH COLUMN IS MEASURED WITH, because the methods differ in strength
 *
 *   pin          package.json, verbatim. The repo pins exact by policy.
 *   kind         which dependency block it sits in. NOT where it is used;
 *                the `used` column is what says that, and the two disagreeing
 *                is one of the findings this script exists to surface.
 *   transitive   distinct packages reachable from it in `npm ls --all --json`,
 *                excluding itself. Counted over the REAL install, so it is the
 *                tree that exists rather than what the lockfile would resolve.
 *   disk         the package's OWN directory, recursively. NOT its unique
 *                subtree: npm hoists, so a transitive dependency shared by
 *                three parents sits once at the top level and belongs to none
 *                of them. A "unique subtree" number would double-count across
 *                rows and sum to more than node_modules. Stated rather than
 *                computed wrong.
 *   used         the first import site found in app/, workers/, scripts/ or
 *                test/, with file and line, or NOTHING IMPORTS IT.
 *   reach        derived from `used`: does any importer ship in the Worker.
 *
 * ## WHY THERE IS NO PER-PACKAGE BYTE COLUMN
 *
 * Because there is no honest way to fill one from a single build here, and a
 * number in that column would be believed. Measured 2026-09-11: the Worker
 * build emits 24 minified chunks with NO source maps and no per-module banners,
 * so bytes cannot be attributed by reading the output. The chunks do contain
 * incidental `node_modules/<pkg>` strings, which look attributable and are not:
 * they are string literals, not module boundaries.
 *
 * The only precise method available is a SIZE-BY-IMPORT DIFF, stubbing one
 * package and rebuilding, and at roughly 90 seconds a build that is over an
 * hour for 51 rows. So this script reports REACHABILITY, which is the question
 * that actually decides a lean-out (does this cost Worker bytes at all), and
 * the session runs exact diffs for the handful of candidates. The distinction
 * is the point: `reach: build` is a measured zero, not an unknown.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const AS_JSON = process.argv.includes("--json");

/**
 * Directories scanned for imports, and whether code there ships in the Worker.
 *
 * THE ROOT IS IN THE LIST, and leaving it out was the first version's bug.
 * `vite.config.ts`, `vitest.config.ts` and `react-router.config.ts` sit at the
 * repository root, so a scan of app/workers/scripts/test reported
 * `@cloudflare/vite-plugin` and `@cloudflare/vitest-plugin` as NOTHING IMPORTS
 * IT while both are imported by the configs that make the build work. A
 * lean-out table that says "unused" about the build tool is worse than no
 * table, because the reader acts on it.
 */
const CONSUMERS = [
  { dir: "app", ships: true },
  { dir: "workers", ships: true },
  { dir: "scripts", ships: false },
  { dir: "test", ships: false },
  { dir: ".", ships: false, shallow: true },
];

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const direct = [
  ...Object.entries(pkg.dependencies ?? {}).map(([name, pin]) => ({ name, pin, kind: "runtime" })),
  ...Object.entries(pkg.devDependencies ?? {}).map(([name, pin]) => ({ name, pin, kind: "dev" })),
].sort((a, b) => a.name.localeCompare(b.name));

/* -------------------------------------------------- the installed tree ---- */

/*
 * `npm ls` EXITS NONZERO ON ELSPROBLEMS and still prints a complete tree, so
 * the exit code is deliberately not the gate here. It exited 1 on the first run
 * of this script because node_modules was one Renovate bump behind
 * package.json, which is exactly the condition that would have made every
 * number below describe a tree nobody has. The mismatch is REPORTED rather than
 * swallowed.
 */
let lsRaw = "";
/** @type {string[]} */
let lsProblems = [];
try {
  lsRaw = execFileSync("npm", ["ls", "--all", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === "win32",
  });
} catch (error) {
  const e = /** @type {{ stdout?: string, stderr?: string }} */ (error);
  lsRaw = e.stdout ?? "";
  lsProblems = String(e.stderr ?? "")
    .split("\n")
    .filter((l) => /invalid:|extraneous:|missing:/.test(l))
    .map((l) => l.replace(/^npm error\s*/, "").trim());
}
if (!lsRaw.trim()) {
  console.error("npm ls produced no tree. Nothing below could be measured; refusing to print a table.");
  process.exit(1);
}
const tree = JSON.parse(lsRaw);

/** Distinct `name@version` reachable below a node, excluding the node itself. */
function transitiveCount(/** @type {any} */ node) {
  const seen = new Set();
  const walk = (/** @type {any} */ n) => {
    for (const [name, child] of Object.entries(n?.dependencies ?? {})) {
      const id = `${name}@${child?.version ?? "?"}`;
      if (seen.has(id)) continue;
      seen.add(id);
      walk(child);
    }
  };
  walk(node);
  return seen.size;
}

const wholeTree = transitiveCount(tree);

/* ------------------------------------------------------------- on disk ---- */

/** Recursive byte size of one directory, or null when it is not installed. */
function dirSize(/** @type {string} */ dir) {
  let total = 0;
  let stack = [dir];
  try {
    statSync(dir);
  } catch {
    return null;
  }
  while (stack.length > 0) {
    const current = /** @type {string} */ (stack.pop());
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        try {
          total += statSync(full).size;
        } catch {
          /* a file that vanished mid-walk contributes nothing rather than throwing */
        }
      }
    }
  }
  return total;
}

/* ------------------------------------------------------------ importers --- */

/** Every source file under the consumer directories, with its ships flag. */
function sourceFiles() {
  /** @type {Array<{ path: string, ships: boolean }>} */
  const out = [];
  for (const { dir, ships, shallow } of CONSUMERS) {
    const base = join(ROOT, dir);
    let stack = [base];
    try {
      statSync(base);
    } catch {
      continue;
    }
    while (stack.length > 0) {
      const current = /** @type {string} */ (stack.pop());
      let entries;
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          // `shallow` is the root pass: it takes the config files sitting there
          // and must not descend, or it would re-walk every directory above.
          if (shallow) continue;
          if (entry.name === "node_modules" || entry.name === "dist") continue;
          stack.push(full);
        } else if (/\.(m?[jt]sx?|mjs|cjs)$/.test(entry.name)) {
          out.push({ path: full, ships });
        }
      }
    }
  }
  return out;
}

const files = sourceFiles().map((f) => ({ ...f, text: readFileSync(f.path, "utf8") }));

/**
 * The first real import of a package, as file and line.
 *
 * MATCHES THE SPECIFIER, NOT THE NAME ANYWHERE IN THE FILE. A bare name scan
 * finds the package in prose, in a comment arguing against it, and in an
 * unrelated string, which is the "anchor every needle" discipline. The needle
 * requires the name to sit inside a quoted module specifier, either exactly or
 * followed by a subpath.
 */
function findImport(/** @type {string} */ name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const needle = new RegExp(
    String.raw`(?:from|import|require\s*\(|import\s*\()\s*["'\`]` + escaped + String.raw`(?:/[^"'\`]*)?["'\`]`,
  );
  /** @type {Array<{ where: string, ships: boolean, typeOnly: boolean }>} */
  const hits = [];
  for (const file of files) {
    const lines = file.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (needle.test(lines[i])) {
        /*
         * A TYPE-ONLY IMPORT SHIPS NOTHING. `import type { RouteConfig } from
         * "@react-router/dev/routes"` is erased by the compiler, so counting it
         * as reaching the Worker would have put `@react-router/dev`, a dev
         * dependency, in the shipping column on the strength of a line that
         * contributes zero bytes. Measured: that is exactly what the first
         * version of this script reported.
         */
        const typeOnly = /^\s*import\s+type\b/.test(lines[i]);
        hits.push({
          where: `${relative(ROOT, file.path).replace(/\\/g, "/")}:${i + 1}`,
          ships: file.ships && !typeOnly,
          typeOnly,
        });
        break;
      }
    }
  }
  return hits;
}

/* ------------------------------------------------------------- the rows --- */

const rows = direct.map(({ name, pin, kind }) => {
  const node = tree.dependencies?.[name];
  const hits = findImport(name);
  const ships = hits.some((h) => h.ships);
  return {
    name,
    kind,
    pin,
    version: node?.version ?? "(not installed)",
    transitive: node ? transitiveCount(node) : null,
    disk: dirSize(join(ROOT, "node_modules", ...name.split("/"))),
    used: hits.length > 0 ? hits[0].where : null,
    importers: hits.length,
    reach:
      hits.length === 0
        ? "unused"
        : ships
          ? "worker"
          : hits.every((h) => h.typeOnly)
            ? "types"
            : "build",
  };
});

const nodeModules = dirSize(join(ROOT, "node_modules"));
const kib = (/** @type {number|null} */ n) => (n === null ? "  n/a" : `${(n / 1024).toFixed(0)}`);

if (AS_JSON) {
  console.log(JSON.stringify({ rows, wholeTree, nodeModules, lsProblems }, null, 2));
} else {
  const w = { name: 34, kind: 8, pin: 12, tr: 5, disk: 9, reach: 7 };
  console.log(
    `${"package".padEnd(w.name)}${"kind".padEnd(w.kind)}${"pin".padEnd(w.pin)}` +
      `${"trans".padStart(w.tr)}${"disk KiB".padStart(w.disk)}  ${"reach".padEnd(w.reach)}imported at`,
  );
  console.log("-".repeat(120));
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(w.name)}${r.kind.padEnd(w.kind)}${String(r.pin).padEnd(w.pin)}` +
        `${String(r.transitive ?? "n/a").padStart(w.tr)}${kib(r.disk).padStart(w.disk)}  ` +
        `${r.reach.padEnd(w.reach)}${r.used ?? "NOTHING IMPORTS IT"}`,
    );
  }
  console.log("-".repeat(120));
  console.log(
    `${direct.length} direct (${direct.filter((d) => d.kind === "runtime").length} runtime, ` +
      `${direct.filter((d) => d.kind === "dev").length} dev), ` +
      `${wholeTree} distinct packages in the installed tree, ` +
      `node_modules ${((nodeModules ?? 0) / 1024 / 1024).toFixed(0)} MiB`,
  );
  if (lsProblems.length > 0) {
    console.log(`\nnpm ls reported ${lsProblems.length} tree problem(s):`);
    for (const p of lsProblems.slice(0, 8)) console.log(`  ${p}`);
    console.log("  A stale or inconsistent install makes every number above describe a tree nobody has.");
  }
}
