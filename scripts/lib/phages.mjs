// Every phage file compiled the one way the Carrel adapter's phage save compiles it
// (app/lib/phages/compile.mjs), for build:content, sync:content, the gates and the tests.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findWideDashes } from "../../app/lib/content/pipeline.mjs";
import { PHAGES_DIR, compilePhage, phageSetErrors, sortPhages } from "../../app/lib/phages/compile.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
/** The D1 rows sync:content writes. */
export const PHAGES_ARTIFACT_PATH = path.join("content", "generated", "phages.json");

/** The repository's papers, read from content/publications as a clone has them. */
export const repoHost = {
  /** @param {string} slug a publication's file key */
  async paper(slug) {
    const info = await stat(path.join(ROOT, "content", "publications", `${slug}.md`)).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    return info !== null && info.isFile();
  },
};

/**
 * Compiles every file in content/phages/. A file that does not compile is returned with its errors, never
 * skipped: the caller decides what that means.
 *
 * @param {{ host?: import("../../app/lib/phages/compile.mjs").PhageHost }} [options]
 */
export async function compileAllPhages(options = {}) {
  const host = options.host ?? repoHost;
  const names = (await readdir(path.join(ROOT, PHAGES_DIR))).filter((n) => n.endsWith(".md")).sort();
  return Promise.all(
    names.map(async (name) => {
      const slug = name.slice(0, -3);
      const raw = await readFile(path.join(ROOT, PHAGES_DIR, name), "utf8");
      return {
        file: `${PHAGES_DIR}/${name}`,
        slug,
        raw,
        compiled: await compilePhage({ slug, raw, host, pipeline: { findWideDashes } }),
      };
    }),
  );
}

/**
 * The D1 rows sync:content writes and the phages the page compile draws its table from. Throws on the first file
 * that does not compile: a build never ships a phage CI would refuse.
 */
export async function buildPhages() {
  const compiled = await compileAllPhages();
  const failed = compiled.filter((c) => !c.compiled.ok);
  if (failed.length > 0) {
    throw new Error(failed.map((c) => `${c.file} does not compile:\n  ${c.compiled.errors.join("\n  ")}`).join("\n"));
  }
  const ok = compiled.flatMap((c) => (c.compiled.ok ? [c.compiled] : []));
  const setErrors = phageSetErrors(ok.map((c) => c.phage));
  if (setErrors.length > 0) throw new Error(`${PHAGES_DIR} is not a phage table:\n  ${setErrors.join("\n  ")}`);
  const phages = sortPhages(ok.map((c) => c.phage));
  const order = new Map(phages.map((p, i) => [p.name, i]));
  const rows = ok
    .map((c) => ({
      slug: c.phage.name.toLowerCase(),
      year: c.phage.year,
      name: c.phage.name,
      record: c.record,
      sourcePath: c.sourcePath,
      sourceBlobSha: c.sourceBlobSha,
    }))
    .sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
  return { rows, phages };
}
