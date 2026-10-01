// Every roster file compiled the one way the Carrel adapter's roster save compiles it
// (app/lib/roster/compile.mjs), for build:content, sync:content, the gates and the tests.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findWideDashes } from "../../app/lib/content/pipeline.mjs";
import { ROSTER_DIR, compileCohort, rosterSetErrors, sortCohorts } from "../../app/lib/roster/compile.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
/** The D1 rows sync:content writes. */
export const ROSTER_ARTIFACT_PATH = path.join("content", "generated", "roster.json");

/** The repository's photographs, read from public/ as a clone has them. */
export const repoHost = {
  /** @param {string} src site-absolute, `/phage-hunters/<file>.webp` */
  async photo(src) {
    const info = await stat(path.join(ROOT, "public", src.replace(/^\//, ""))).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    return info !== null && info.isFile();
  },
};

/**
 * Compiles every file in content/roster/. A file that does not compile is returned with its errors, never
 * skipped: the caller decides what that means.
 *
 * @param {{ host?: import("../../app/lib/roster/compile.mjs").RosterHost }} [options]
 */
export async function compileAllRoster(options = {}) {
  const host = options.host ?? repoHost;
  const names = (await readdir(path.join(ROOT, ROSTER_DIR))).filter((n) => n.endsWith(".md")).sort();
  return Promise.all(
    names.map(async (name) => {
      const slug = name.slice(0, -3);
      const raw = await readFile(path.join(ROOT, ROSTER_DIR, name), "utf8");
      return {
        file: `${ROSTER_DIR}/${name}`,
        slug,
        raw,
        compiled: await compileCohort({ slug, raw, host, pipeline: { findWideDashes } }),
      };
    }),
  );
}

/**
 * The D1 rows sync:content writes and the cohorts the gates read. Throws on the first file that does not
 * compile: a build never ships a cohort CI would refuse.
 */
export async function buildRoster() {
  const compiled = await compileAllRoster();
  const failed = compiled.filter((c) => !c.compiled.ok);
  if (failed.length > 0) {
    throw new Error(failed.map((c) => `${c.file} does not compile:\n  ${c.compiled.errors.join("\n  ")}`).join("\n"));
  }
  const ok = compiled.flatMap((c) => (c.compiled.ok ? [c.compiled] : []));
  const setErrors = rosterSetErrors(ok.map((c) => c.cohort));
  if (setErrors.length > 0) throw new Error(`${ROSTER_DIR} is not a roster:\n  ${setErrors.join("\n  ")}`);
  const rows = ok
    .map((c) => ({
      slug: String(c.cohort.year),
      year: c.cohort.year,
      record: c.record,
      sourcePath: c.sourcePath,
      sourceBlobSha: c.sourceBlobSha,
    }))
    .sort((a, b) => b.year - a.year);
  return { rows, cohorts: sortCohorts(ok.map((c) => c.cohort)) };
}
