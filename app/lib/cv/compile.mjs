// One door from the CV's files to everything derived from them: parse and validate a file, assemble the files
// into one CV, join it to the publications, and compile the page a search record is made from. build:content,
// sync:content, the CV save and the sync_cv tool all call these, so a file CI passes is the file a save accepts
// and the CV draws (docs/CV.md).

import { gitBlobSha } from "../content/hashes.mjs";
import { compilePage } from "../pages/compile.mjs";
import { buildCv } from "./entries.mjs";
import { cvMarkdownDocument } from "./markdown.mjs";
import { CV_DIR, CV_FILES, cvFileFor, cvSourcePath } from "./parse.mjs";
import { orderErrors, paperRefErrors, parseCvFile } from "./validate.mjs";

/** @typedef {import("./types.ts").CvFileRecord} CvFileRecord */
/** @typedef {import("../publications/types.ts").Publication} Publication */

/**
 * The published records by lower-cased DOI, the join key the CV's paper references use.
 *
 * @param {Publication[]} publications
 * @returns {Map<string, Publication>}
 */
export function publicationsByDoi(publications) {
  return new Map(publications.flatMap((p) => (p.doi ? [[p.doi.toLowerCase(), p]] : [])));
}

/**
 * One file, judged on its own: its shape, its privacy and style rules and, for the publications file, that
 * each paper it cites is a published record that lists the owner.
 *
 * @param {{ slug: string, raw: string, publications: Publication[] }} input
 * @returns {Promise<
 *   | { ok: false, errors: string[] }
 *   | { ok: true, errors: [], record: CvFileRecord, sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compileCvFile({ slug, raw, publications }) {
  const file = cvFileFor(slug);
  if (!file) {
    return {
      ok: false,
      errors: [
        `"${slug}" is not a CV file. The files are ${CV_FILES.map((f) => f.slug).join(", ")} (CV_FILES, ` +
          "app/lib/cv/parse.mjs); a save cannot create a new one, because the set of files is structure.",
      ],
    };
  }
  const parsed = parseCvFile(file, raw);
  if (!parsed.ok) return parsed;
  const { record } = parsed;
  if (record.type === "publication") {
    const errors = paperRefErrors(record.entries, publicationsByDoi(publications));
    if (errors.length > 0) return { ok: false, errors };
  }
  return { ok: true, errors: [], record, sourcePath: cvSourcePath(slug), sourceBlobSha: await gitBlobSha(raw) };
}

/**
 * The files' records as one source, in CV_FILES order. Every file must be present, and none twice.
 *
 * @param {CvFileRecord[]} records
 * @returns {{ ok: false, errors: string[] } | { ok: true, source: import("./types.ts").CvSource }}
 */
export function assembleCvSource(records) {
  /** @type {string[]} */
  const errors = [];
  const bySlug = new Map();
  for (const record of records) {
    if (bySlug.has(record.slug)) errors.push(`${record.slug} is present twice`);
    bySlug.set(record.slug, record);
  }
  for (const { slug } of CV_FILES) {
    if (!bySlug.has(slug)) errors.push(`${cvSourcePath(slug)} has no record`);
  }
  for (const slug of bySlug.keys()) {
    if (!cvFileFor(slug)) errors.push(`${slug} is not a CV file`);
  }
  if (errors.length > 0) return { ok: false, errors };
  const profile = bySlug.get("profile");
  if (!profile || profile.type !== "profile") return { ok: false, errors: ["the profile record is not a profile"] };
  return {
    ok: true,
    source: {
      edition: profile.edition,
      person: profile.person,
      presentations: profile.presentations,
      entries: CV_FILES.flatMap(({ slug }) => {
        const record = bySlug.get(slug);
        return record && record.type !== "profile" ? record.entries : [];
      }),
    },
  };
}

/**
 * The whole CV, the rules that need every file at once: assembled, every paper joined, every section in
 * order. A save runs this over D1's other files with its own in place, so a change that breaks the whole is
 * refused even when its own file is sound.
 *
 * @param {{ records: CvFileRecord[], publications: Publication[] }} input
 * @returns {{ ok: false, errors: string[] } | { ok: true, errors: [], cv: import("./entries.mjs").Cv }}
 */
export function compileCv({ records, publications }) {
  const assembled = assembleCvSource(records);
  if (!assembled.ok) return assembled;
  const errors = paperRefErrors(assembled.source.entries, publicationsByDoi(publications));
  if (errors.length > 0) return { ok: false, errors };
  let cv;
  try {
    cv = buildCv(assembled.source, publications);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
  const ordering = orderErrors(cv.entries);
  if (ordering.length > 0) return { ok: false, errors: ordering };
  return { ok: true, errors: [], cv };
}

/**
 * The CV's page as the pipeline compiles it, for the search records and the link check: the same compile
 * every other page goes through (app/lib/pages/compile.mjs), over the markdown the twin is made of. A paper's
 * title may carry another author's punctuation, so the dash rule is not applied to what a record supplies.
 *
 * @param {{ cv: import("./entries.mjs").Cv, pipeline: Parameters<typeof compilePage>[0]["pipeline"] }} input
 */
export function compileCvPage({ cv, pipeline }) {
  return compilePage({
    slug: "cv",
    raw: cvMarkdownDocument(cv),
    pipeline,
    sourcePath: CV_DIR,
    generated: true,
  });
}
