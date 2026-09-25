// An allowlist, not a deny list: the design system project's files are the canvas's, and a path is
// uploadable only because the build owns it.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { isMain } from "./is-main.mjs";

// `_ds_needs_recompile` is the sentinel the upload writes first and re-arms last, so it must be here.
const BUILD_OWNED = [
  /^_ds_bundle\.[a-z]+$/,
  /^styles\.css$/,
  /^_ds_manifest\.json$/,
  /^_ds_sync\.json$/,
  /^_ds_needs_recompile$/,
  /^README\.md$/,
  /^_adherence\.oxlintrc\.json$/,
  /^components\/.+/,
  /^fonts\/.+/,
  /^guidelines\/.+/,
  /^_vendor\/.+/,
  /^_preview\/[^/]+\.js$/,
  /^cards\/[a-z]+\/[a-z0-9-]+\/[a-z0-9-]+\.html$/,
];

// Canvas-made, so protected whatever BUILD_OWNED grows to hold.
const NEVER = [/^templates(\/|$)/, /^github\.md$/];

const STAYS_LOCAL = [/^\./, /^_screenshots(\/|$)/, /^_sb(\/|$)/];

/**
 * Refused, not normalized: guessing what a `..` or absolute path meant is how it lands elsewhere.
 *
 * @param {string} path
 * @returns {string | null} why it is refused, or null when the build owns it
 */
export function refusal(path) {
  if (typeof path !== "string" || path.length === 0) return "not a path";
  if (/\\/.test(path) || path.startsWith("/") || /^[a-z]:/i.test(path)) {
    return "not a plain relative path";
  }
  if (path.split("/").some((s) => s === ".." || s === "." || s === "")) {
    return "not a plain relative path";
  }
  if (NEVER.some((re) => re.test(path))) return "protected: never written or deleted by a sync";
  if (!BUILD_OWNED.some((re) => re.test(path))) return "not a build-owned path";
  return null;
}

/**
 * @param {{ writes?: string[], deletes?: string[] }} plan
 * @returns {string[]} one line per refused path; empty when the plan is inside scope
 */
export function planViolations({ writes = [], deletes = [] }) {
  const out = [];
  for (const p of writes) {
    const why = refusal(p);
    if (why) out.push(`write ${p}: ${why}`);
  }
  for (const p of deletes) {
    const why = refusal(p);
    if (why) out.push(`delete ${p}: ${why}`);
  }
  return out;
}

/**
 * @param {string} outDir
 * @returns {string[]}
 */
export function plannedWrites(outDir) {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = relative(outDir, full).split(sep).join("/");
      if (STAYS_LOCAL.some((re) => re.test(rel))) continue;
      if (entry.isDirectory()) walk(full);
      else found.push(rel);
    }
  };
  walk(outDir);
  return found.sort();
}

/**
 * A refusal reuses the driver's own do-not-upload shape (`ok: false`, `upload: null`), so the
 * skill stops on it without knowing this check exists.
 *
 * @param {any} verdict
 * @param {string} outDir
 * @returns {{ verdict: any, violations: string[] }}
 */
export function enforceVerdict(verdict, outDir) {
  const upload = verdict?.upload;
  if (!upload || !upload.any) return { verdict, violations: [] };
  // An upload whose writes or deletes cannot be read is refused: read as "none", it would pass
  // unchecked, and the deletes are to the canvas.
  /** @type {string[]} */
  const unreadable = [];
  if (!existsSync(outDir)) unreadable.push(`write ${outDir}: the build output is missing`);
  if (upload.deletePaths !== undefined && !Array.isArray(upload.deletePaths)) {
    unreadable.push("delete: the plan's deletePaths is not a list");
  }
  const writes = existsSync(outDir) ? plannedWrites(outDir) : [];
  const deletes = Array.isArray(upload.deletePaths) ? upload.deletePaths : [];
  const violations = [...unreadable, ...planViolations({ writes, deletes })];
  if (violations.length === 0) return { verdict, violations };
  return {
    verdict: { ...verdict, ok: false, upload: null, uploadScopeRefused: violations },
    violations,
  };
}

if (isMain(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node scripts/lib/ds-upload-scope.mjs <plan.json>");
    process.exit(2);
  }
  const plan = JSON.parse(readFileSync(file, "utf8"));
  // A plan with neither list is a misspelled or empty file, not a plan inside scope.
  if (!Array.isArray(plan?.writes) && !Array.isArray(plan?.deletes)) {
    console.error(`${file} carries neither a writes nor a deletes list, so there is no plan to check.`);
    process.exit(1);
  }
  const violations = planViolations(plan);
  if (violations.length) {
    console.error(`✗ upload plan refused, ${violations.length} path(s) outside the build's scope:`);
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
  }
  console.log("✓ upload plan is inside the build's scope");
}
