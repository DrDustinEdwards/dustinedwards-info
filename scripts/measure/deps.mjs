/**
 * Reports reachability rather than bytes: the only precise per-package byte method is a
 * size-by-import diff over every dependency, and a rough number in that column would be believed.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const AS_JSON = process.argv.includes("--json");

/** The root is in the list: the build configs there are what import the build plugins. */
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

// `npm ls` exits nonzero on tree problems and still prints a complete tree.
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
          // The root pass must not descend, or it would re-walk every directory above.
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

/** Matches the specifier, not the bare name, which also appears in prose and comments. */
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
        // A type-only import ships nothing.
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
