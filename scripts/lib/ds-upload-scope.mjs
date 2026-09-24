/**
 * THE ONLY PATHS A DESIGN-SYNC UPLOAD MAY WRITE OR DELETE in the design system project.
 *
 * Ruling 137: the design system project's authoritative files are the canvas's, and the sync only
 * mirrors what the build produces. A written "never delete these" list lagged the canvas by one
 * directory once (NOTES.md: `part-c/` was missing from it for days), so the rule is now an
 * allowlist in code: a path is uploadable only because the build owns it, never because nobody
 * remembered to forbid it.
 *
 * `scripts/ds-resync.mjs` applies it to the driver's verdict before any caller sees the verdict,
 * and `node scripts/lib/ds-upload-scope.mjs <plan.json>` applies it to a hand-built plan (the
 * no-anchor case, where the deletes come from a reviewed `list_files`, not from the diff).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Build-owned paths. `_ds_needs_recompile` is the sentinel the upload writes FIRST and re-arms
 * LAST (the /design-sync skill's upload sequence), so a list without it fails every sync.
 * `_preview/` is build-owned only for the compiled component scripts directly in it: the
 * screenshots that used to sit beside them were canvas work.
 */
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
  // The preview cards `.design-sync/build-cards.mjs` renders: one HTML file per directory, three
  // deep, and nothing else, so the folder cannot become a place the sync writes anything.
  /^cards\/[a-z]+\/[a-z0-9-]+\/[a-z0-9-]+\.html$/,
];

/**
 * Never written or deleted, whatever the list above ever grows to hold. `templates/visual-system/`
 * is the approved visual system made on the canvas (ruling 137), and `github.md` is the canvas's.
 */
const NEVER = [/^templates(\/|$)/, /^github\.md$/];

/**
 * What stays local in the output folder and is never uploaded: dot-prefixed entries at the root,
 * `_screenshots/` and `_sb/` (the skill's "What stays local").
 */
const STAYS_LOCAL = [/^\./, /^_screenshots(\/|$)/, /^_sb(\/|$)/];

/**
 * One path's verdict. A path that is not a plain relative path is refused rather than normalized:
 * `..` or an absolute path in an upload plan is a defect, and guessing what it meant is how it
 * would land somewhere unintended.
 *
 * @param {string} path a project-relative path
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
 * Check a whole plan. Every path is checked, not just the first bad one, so a refusal names all
 * of them at once.
 *
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
 * The files an atomic upload writes: everything under the output folder that does not stay local.
 * Paths come back project-relative with forward slashes, as the upload names them.
 *
 * @param {string} outDir the driver's `--out` folder
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
 * Apply the scope to the driver's verdict. When the verdict plans an upload, its writes are the
 * output folder's uploadable files and its deletes are `upload.deletePaths` verbatim. A plan with
 * any path outside scope comes back REFUSED: `ok: false` and `upload: null`, which is the shape the
 * driver itself uses for "do not upload", so the skill stops on it without knowing this check
 * exists.
 *
 * @param {any} verdict the driver's parsed verdict
 * @param {string} outDir the driver's `--out` folder
 * @returns {{ verdict: any, violations: string[] }}
 */
export function enforceVerdict(verdict, outDir) {
  const upload = verdict?.upload;
  if (!upload || !upload.any) return { verdict, violations: [] };
  const writes = existsSync(outDir) ? plannedWrites(outDir) : [];
  const violations = planViolations({ writes, deletes: upload.deletePaths ?? [] });
  if (violations.length === 0) return { verdict, violations };
  return {
    verdict: { ...verdict, ok: false, upload: null, uploadScopeRefused: violations },
    violations,
  };
}

/*
 * The hand-built-plan check: `node scripts/lib/ds-upload-scope.mjs plan.json`, where plan.json is
 * `{ "writes": [...], "deletes": [...] }`. Exit 1 names every refused path.
 */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node scripts/lib/ds-upload-scope.mjs <plan.json>");
    process.exit(2);
  }
  const violations = planViolations(JSON.parse(readFileSync(file, "utf8")));
  if (violations.length) {
    console.error(`✗ upload plan refused, ${violations.length} path(s) outside the build's scope:`);
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
  }
  console.log("✓ upload plan is inside the build's scope");
}
