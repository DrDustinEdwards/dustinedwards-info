// The CV's files compiled the one way the CV save compiles them (app/lib/cv/compile.mjs), for build:content,
// sync:content, the PDF build and the gates. A file that does not compile fails the build: it never ships what
// CI would refuse.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileCv, compileCvFile } from "../../app/lib/cv/compile.mjs";
import { CV_DIR, CV_FILES, cvSourcePath } from "../../app/lib/cv/parse.mjs";
import { buildPublications } from "./publications.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The D1 rows sync:content writes, one per file. */
export const CV_ARTIFACT_PATH = path.join("content", "generated", "cv.json");

/**
 * Every file in content/cv/, judged alone and then as the whole CV joined to `publications`. Throws with every
 * message on the first failure, naming the file.
 *
 * @param {import("../../app/lib/publications/types.ts").Publication[]} publications the published records
 */
export async function buildCvFrom(publications) {
  const names = (await readdir(path.join(ROOT, CV_DIR))).filter((name) => name.endsWith(".md")).sort();
  const expected = CV_FILES.map((f) => `${f.slug}.md`).sort();
  if (names.join() !== expected.join()) {
    throw new Error(
      `${CV_DIR} holds ${names.join(", ") || "no files"}, and the CV is exactly ${expected.join(", ")} (CV_FILES, ` +
        "app/lib/cv/parse.mjs): a stray file would be a second source that silently loses, and a missing one a CV with a hole.",
    );
  }
  const rows = [];
  for (const { slug } of CV_FILES) {
    const raw = await readFile(path.join(ROOT, cvSourcePath(slug)), "utf8");
    const compiled = await compileCvFile({ slug, raw, publications });
    if (!compiled.ok) throw new Error(`${cvSourcePath(slug)} does not compile:\n  ${compiled.errors.join("\n  ")}`);
    rows.push({
      slug,
      type: compiled.record.type,
      record: JSON.stringify(compiled.record),
      sourcePath: compiled.sourcePath,
      sourceBlobSha: compiled.sourceBlobSha,
      parsed: compiled.record,
    });
  }
  const whole = compileCv({ records: rows.map((row) => row.parsed), publications });
  if (!whole.ok) throw new Error(`${CV_DIR} does not make a CV:\n  ${whole.errors.join("\n  ")}`);
  return { rows: rows.map(({ parsed: _parsed, ...row }) => row), cv: whole.cv };
}

/** @type {Promise<import("../../app/lib/cv/entries.mjs").Cv> | undefined} */
let cv;

/** The CV resolved against the published records, the way the page resolves it (app/db/cv.ts, readCv). */
export function loadCv() {
  cv ??= buildPublications().then(({ records }) => buildCvFrom(records)).then((built) => built.cv);
  return cv;
}
