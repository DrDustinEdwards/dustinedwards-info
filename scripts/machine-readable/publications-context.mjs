import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assertFloor } from "../lib/floor.mjs";
import { compileAllPublications, readCitedBy } from "../lib/publications.mjs";
import { createTally } from "../lib/tally.mjs";
import { stripTsxComments } from "../lib/strip-comments.mjs";

/*
 * What every publications part reads, loaded once: a module is evaluated once however many parts
 * import it. It asserts nothing itself; each part counts its own checks against its own floor.
 *
 * The files in content/publications/ are the source. Each is compiled by the same door the Carrel adapter's
 * save uses (app/lib/publications/compile.mjs), against the repository's own PDFs, so what these parts read
 * is what a save would accept. The per-file rules (required fields, DOI and slug, access and pdfPath, the
 * PDF on disk and its hash, the text, the summary, the notice, the accessions, the citation tags, the
 * exports, the twin) live in validate.mjs and compile.mjs, not here; this gate reports them by category and
 * adds the checks that need the whole corpus or the rest of the repository.
 */

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The paper route, read once and stripped by the TSX parser: the route discusses the builders it
 * calls in prose, and a `//` regex also ate every `https://` inside a string.
 */
export const SLUG_ROUTE = stripTsxComments(
  readFileSync(join(root, "app", "routes", "publications.$slug.tsx"), "utf8"),
);

/** Every file, compiled or refused. */
export const files = await compileAllPublications();

if (files.length === 0) {
  console.log("  FAIL  publications: content/publications/ carries no files");
  throw new Error("publications: the scope is empty; nothing below would mean anything");
}

/** The files that compiled, with what they compiled to. */
export const compiled = files.flatMap((f) => (f.compiled.ok ? [{ file: f.file, slug: f.slug, raw: f.raw, ...f.compiled }] : []));

/** @type {Array<{ file: string, slug: string, errors: string[] }>} */
export const refused = files.flatMap((f) => (f.compiled.ok ? [] : [{ file: f.file, slug: f.slug, errors: f.compiled.errors }]));

/** Every record that compiled, drafts included: a draft is a file the corpus rules still hold to. */
export const records = compiled.map((c) => c.record);

/** The files that host their PDF here. */
export const hosted = compiled.filter((c) => c.record.access === "self-hosted");

export const citedBy = /** @type {any} */ (await readCitedBy());

/**
 * The refusals whose message starts with one of the fields, so a part can report a rule by name while the
 * rule itself stays in the validator.
 *
 * @param {...string} fields
 * @returns {string[]}
 */
export function refusalsFor(...fields) {
  return refused.flatMap((r) =>
    r.errors
      .filter((e) => fields.some((f) => e === f || e.startsWith(`${f}:`) || e.startsWith(`${f}[`) || e.startsWith(`${f}.`)))
      .map((e) => `${r.slug}: ${e}`),
  );
}

/**
 * The tally a part counts on, after its heading.
 *
 * @param {string} name
 */
export function openPart(name) {
  const tally = createTally({ printPass: true });
  console.log(`\n  publications: ${name}\n`);
  return { tally, ok: tally.ok };
}

/**
 * The part's floor, failed without counting a check so the count is the sweeps alone, and the
 * outcome the runner reads. The runner fails a part only on zero checks, so without a floor a
 * refactor could drop most of a part's sweeps and still pass.
 *
 * @param {ReturnType<typeof createTally>} tally
 * @param {string} name
 * @param {number} minimum
 */
export function closePart(tally, name, minimum) {
  const breach = assertFloor(
    `check:machine-readable/publications-${name}`,
    "checks",
    tally.checks,
    minimum,
    "The runner fails a part only on zero checks, so without this a refactor could drop " +
      "most of its sweeps and still pass.",
  );
  if (breach) {
    console.log(`  FAIL  ${breach}`);
    tally.fail(breach);
  }
  return { checks: tally.checks, failures: tally.failures };
}
