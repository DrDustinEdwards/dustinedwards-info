import { execFileSync } from "node:child_process";
import { readdir, readFile, mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { serializeArtifact } from "./lib/artifact.mjs";
import { colophonPages } from "../app/lib/colophon-sections.mjs";
import {
  CONTENT_PAGES_FROM_DATA,
  CONTENT_PAGES_OWN_ROUTE,
  PAGE_FILE_PATHS,
  contentPageFile,
  contentPageSearchInputs,
} from "../app/lib/content-pages.mjs";
import { cvMarkdownDocument } from "../app/lib/cv/markdown.mjs";
import { CV_DIR } from "../app/lib/cv/parse.mjs";
import { compilePage, pagePathForSlug, pageSlug } from "../app/lib/pages/compile.mjs";
import { findWideDashes, renderBody, withBacklinks, withRelated } from "../app/lib/content/pipeline.mjs";
import { ContentError, renderPost } from "./lib/content.mjs";
import { buildCvFrom, CV_ARTIFACT_PATH } from "./lib/cv.mjs";
import { buildDictionary, DICTIONARY_ARTIFACT_PATH } from "./lib/dictionary.mjs";
import { isMain } from "./lib/is-main.mjs";
import { buildProcedures, PROCEDURES_ARTIFACT_PATH } from "./lib/procedures.mjs";
import { buildPublications, PUBLICATIONS_ARTIFACT_PATH } from "./lib/publications.mjs";
import { buildRoster, ROSTER_ARTIFACT_PATH } from "./lib/roster.mjs";

/**
 * The paths below stay repo-relative because they name files in messages and in the render; every
 * read and write goes through `fromRoot`, so the result does not depend on the working directory.
 */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} repoPath */
export function fromRoot(repoPath) {
  return path.join(ROOT, repoPath);
}

const CONTENT_DIR = path.join("content", "posts");
export const ARTIFACT_PATH = path.join("content", "generated", "posts.json");

const PAGES_DIR = path.join("content", "pages");
export const PAGES_ARTIFACT_PATH = path.join("content", "generated", "pages.json");

/**
 * The Research, Teaching and Software pages, compiled the one way the page save (app/lib/pages/save.server.ts) compiles
 * them (app/lib/pages/compile.mjs): a refused link, a missing field or a broken invariant fails the build
 * instead of shipping an empty tag. Every file must be one of PAGE_FILE_PATHS and every path must have
 * its file, so routes, sitemap and pages cannot drift. The CV is generated from content/cv/ (docs/CV.md) and
 * compiled by the same door, but has no row in the pages table: its rows are the cv table's (buildCvRows).
 *
 * @typedef {import("../app/lib/pages/compile.mjs").CompiledPage & { draft: boolean }} BuiltPage
 * @typedef {{ page: BuiltPage, compiled: Extract<Awaited<ReturnType<typeof compilePage>>, { ok: true }>, name: string }} BuiltSource
 */

/** @type {ReturnType<typeof buildDictionary> | undefined} */
let compiledDictionary;

/** Compiled once per run: the pages' twins and search records, and the rows, come from the same compile. */
function dictionary() {
  compiledDictionary ??= buildDictionary();
  return compiledDictionary;
}

/** @type {Promise<BuiltSource[]> | undefined} */
let builtSources;

/** Compiled once per run: the pages, the rows and the search inputs come from the same compile. */
function pageSources() {
  builtSources ??= compilePages();
  return builtSources;
}

/** @returns {Promise<BuiltSource[]>} */
async function compilePages() {
  const names = (await readdir(fromRoot(PAGES_DIR))).filter((name) => name.endsWith(".md")).sort();

  /*
   * A page generated from data has no file here, and a file for one would be a second source that
   * silently loses to the data, so it is refused.
   */
  /** @type {Array<{ name: string, file: string, raw: string, generated?: boolean }>} */
  const sources = [];
  for (const name of names) {
    if (CONTENT_PAGES_FROM_DATA.some((p) => contentPageFile(p) === name)) {
      throw new ContentError(
        path.join(PAGES_DIR, name),
        "is generated from structured data (CONTENT_PAGES_FROM_DATA); edit the data, not a markdown copy.",
      );
    }
    const file = path.join(PAGES_DIR, name);
    sources.push({ name, file, raw: await readFile(fromRoot(file), "utf8") });
  }
  for (const pagePath of CONTENT_PAGES_FROM_DATA) {
    if (pagePath !== "/cv") throw new Error(`build:content has no generator for ${pagePath}.`);
    sources.push({ name: contentPageFile(pagePath), file: CV_DIR, raw: cvMarkdownDocument((await cvBuild()).cv), generated: true });
  }

  /** @type {BuiltSource[]} */
  const built = [];
  for (const { name, file, raw, generated } of sources) {
    const compiled = await compilePage({
      slug: name.slice(0, -3),
      raw,
      pipeline: { renderBody, findWideDashes },
      sourcePath: file.split(path.sep).join("/"),
      // The entry that leads the page (docs/DICTIONARY.md), compiled from content/dictionary like the Worker reads it from D1.
      entry: (await dictionary()).entryFor(pagePathForSlug(name.slice(0, -3)) ?? ""),
      // A page written from data states other authors' titles, dashes included; the house style is for prose.
      generated,
    });
    if (!compiled.ok) {
      throw new ContentError(file.split(path.sep).join("/"), `does not compile:\n  ${compiled.errors.join("\n  ")}`);
    }
    built.push({ name, compiled, page: { ...compiled.page, draft: compiled.draft } });
  }

  const missing = PAGE_FILE_PATHS.filter((p) => !built.some(({ page }) => page.path === p));
  if (missing.length > 0) {
    throw new ContentError(PAGES_DIR, `has no page for ${missing.join(", ")}.`);
  }
  return built;
}

/**
 * The listed pages (CONTENT_PAGE_PATHS): what the twins, the search records and the social cards are made
 * from. About has a route of its own and none of those, so it is in renderOwnRoutePages instead.
 *
 * @returns {Promise<BuiltPage[]>}
 */
export async function renderContentPages() {
  return (await pageSources())
    .map(({ page }) => page)
    .filter((page) => !CONTENT_PAGES_OWN_ROUTE.includes(page.path))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * The pages with a route of their own (About), compiled by the same door: check:links reads their links.
 *
 * @returns {Promise<BuiltPage[]>}
 */
export async function renderOwnRoutePages() {
  return (await pageSources()).map(({ page }) => page).filter((page) => CONTENT_PAGES_OWN_ROUTE.includes(page.path));
}

/**
 * The rows sync:content writes into D1's pages table: every file-sourced page, the CV excluded, as
 * the page save would write it.
 */
export async function buildPages() {
  return (await pageSources())
    .filter(({ page }) => !CONTENT_PAGES_FROM_DATA.includes(page.path))
    .map(({ compiled }) => ({
      slug: pageSlug(compiled.page.path),
      path: compiled.page.path,
      title: compiled.page.title,
      description: compiled.page.description,
      status: compiled.draft ? "draft" : "published",
      record: JSON.stringify(compiled.record),
      markdown: compiled.markdown,
      sourcePath: compiled.sourcePath,
      sourceBlobSha: compiled.sourceBlobSha,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** @type {ReturnType<typeof buildCvFrom> | undefined} */
let compiledCv;

/** Compiled once per run, against the same publication records the papers' rows come from. */
async function cvBuild() {
  compiledCv ??= publications().then(({ records }) => buildCvFrom(records));
  return compiledCv;
}

/** The rows sync:content writes into D1's cv table: one per file in content/cv/, as the CV save would write it. */
export async function buildCvRows() {
  return (await cvBuild()).rows;
}

/** @type {ReturnType<typeof buildPublications> | undefined} */
let compiledPublications;

/** Compiled once per run: the CV, the search records and the rows all come from the same compile. */
function publications() {
  compiledPublications ??= buildPublications();
  return compiledPublications;
}

/** @type {ReturnType<typeof buildProcedures> | undefined} */
let compiledProcedures;

/** Compiled once per run: the search inputs and the rows come from the same compile. */
function procedures() {
  compiledProcedures ??= buildProcedures();
  return compiledProcedures;
}

/** @returns {Promise<string>} */
export async function buildArtifact() {
  /** @type {string[]} */
  let entries;
  try {
    entries = await readdir(fromRoot(CONTENT_DIR));
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
    throw new Error(
      `${CONTENT_DIR} does not exist. Create it and add at least one markdown post.`,
      { cause: error },
    );
  }

  const files = entries.filter((name) => name.endsWith(".md")).sort();
  // An empty artifact is what every downstream delete converges production to.
  if (files.length === 0) {
    throw new Error(`${CONTENT_DIR} holds no markdown posts, so no artifact was written.`);
  }

  const posts = [];
  for (const name of files) {
    const file = path.join(CONTENT_DIR, name);
    const raw = await readFile(fromRoot(file), "utf8");
    posts.push(await renderPost(file, raw));
  }

  posts.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  const slugs = new Set();
  for (const post of posts) {
    if (slugs.has(post.slug)) {
      throw new Error(`duplicate slug "${post.slug}" across content/posts`);
    }
    slugs.add(post.slug);
  }

  // Read rather than imported: a JSON import needs an attribute this repo's compiler settings reject.
  // Depends on the stack artifact, so that build must run first.
  const stack = JSON.parse(
    await readFile(fromRoot(path.join("content", "generated", "stack.json")), "utf8"),
  );
  const features = JSON.parse(
    await readFile(fromRoot(path.join("content", "features.json")), "utf8"),
  );

  return serializeArtifact(
    // Both need the complete corpus: relatedness and being linked to are properties of the set.
    withBacklinks(withRelated(posts)),
    [
      ...colophonPages(stack, features),
      // A draft page is never in the index.
      ...contentPageSearchInputs((await renderContentPages()).filter((page) => !page.draft), (await dictionary()).entryFor),
      ...(await procedures()).searchInputs,
    ],
    (await publications()).searchInputs,
  );
}

/**
 * Deliberately not written into the build product: a render must be a pure function of the sources.
 *
 * @param {string} file
 * @returns {string | null}
 */
export function lastCommitDate(file) {
  // A file with no history is git exiting 0 with no output, the null answer. A throw is git missing
  // or not a repository, which used to write a null revision date over every real one in D1.
  let out;
  try {
    out = execFileSync(
      "git",
      ["log", "-1", "--format=%cd", "--date=format:%Y-%m-%d", "--", file],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  } catch (error) {
    throw new Error(
      `git log could not read the history of ${file}, so its revision date is unknown: ` +
        `${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  return out || null;
}

/**
 * Null is a real answer: a shallow clone has no history for most files. A Date, not a string, so
 * no consumer parses it and lets a timezone in.
 *
 * @param {{ updated?: string | null, sourcePath: string }} post
 * @returns {Date | null}
 */
export function revisedDate(post) {
  const revised = post.updated ?? lastCommitDate(post.sourcePath);
  return revised ? new Date(`${revised}T00:00:00.000Z`) : null;
}

async function main() {
  const artifact = await buildArtifact();
  await mkdir(path.dirname(fromRoot(ARTIFACT_PATH)), { recursive: true });
  await writeFile(fromRoot(ARTIFACT_PATH), artifact, "utf8");
  const { posts } = JSON.parse(artifact);

  // The pages' rows, which sync:content writes to D1; their pages and twins are drawn from there
  // (docs/PAGES.md). No twin is a file now: the CV's is drawn from the cv table (docs/CV.md).
  const pageRows = await buildPages();
  await writeFile(fromRoot(PAGES_ARTIFACT_PATH), `${JSON.stringify({ pages: pageRows }, null, 2)}\n`, "utf8");
  await pruneStaleContentTwins();

  // The dictionary entries' rows, which sync:content writes to D1; the page lead and the DefinedTerm are drawn from there
  // (docs/DICTIONARY.md). They come from the compile the pages' twins and search records above were built with.
  const dictionaryRows = (await dictionary()).rows;
  await writeFile(fromRoot(DICTIONARY_ARTIFACT_PATH), `${JSON.stringify({ dictionary: dictionaryRows }, null, 2)}
`, "utf8");

  // The procedures' rows, which sync:content writes to D1; their pages and twins are drawn from there.
  const { rows } = await procedures();
  await writeFile(fromRoot(PROCEDURES_ARTIFACT_PATH), `${JSON.stringify({ procedures: rows }, null, 2)}
`, "utf8");

  // The papers' rows, which sync:content writes to D1, from the compile the search records came from.
  const compiled = await publications();
  await writeFile(fromRoot(PUBLICATIONS_ARTIFACT_PATH), `${JSON.stringify({ publications: compiled.rows }, null, 2)}
`, "utf8");

  // The CV's rows, which sync:content writes to D1; its page, twin and charts are drawn from there (docs/CV.md).
  const cvRows = await buildCvRows();
  await writeFile(fromRoot(CV_ARTIFACT_PATH), `${JSON.stringify({ cv: cvRows }, null, 2)}
`, "utf8");

  // The cohorts' rows, which sync:content writes to D1; the roster is drawn from there (docs/ROSTER.md).
  const roster = await buildRoster();
  await writeFile(fromRoot(ROSTER_ARTIFACT_PATH), `${JSON.stringify({ roster: roster.rows }, null, 2)}\n`, "utf8");

  console.log(
    `build:content wrote ${ARTIFACT_PATH} (${posts.length} posts), ${PAGES_ARTIFACT_PATH} (${pageRows.length} pages), ${DICTIONARY_ARTIFACT_PATH} (${dictionaryRows.length} entries), ` +
      `${PROCEDURES_ARTIFACT_PATH} (${rows.length} procedures), ${PUBLICATIONS_ARTIFACT_PATH} (${compiled.rows.length} publications), ${CV_ARTIFACT_PATH} (${cvRows.length} files) and ${ROSTER_ARTIFACT_PATH} (${roster.rows.length} cohorts)`,
  );
}

/**
 * Deletes any page twin an earlier build left under public/. Every page's twin is served from D1
 * (app/routes/content-page[.md].ts, app/routes/cv[.md].ts), and a static file at its address would win over that
 * route. The paper twins are served from D1 too (app/routes/publications.$slug[.md].ts) and are left to
 * check:machine-readable (publications-twins).
 */
async function pruneStaleContentTwins() {
  for (const rootName of ["research", "teaching", "software"]) {
    await pruneContentTwins(fromRoot(path.join("public", rootName)), `/${rootName}`);
  }
  for (const hub of ["/research.md", "/teaching.md", "/software.md", "/cv.md"]) {
    await unlink(fromRoot(path.join("public", hub.slice(1)))).catch((error) => {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
    });
  }
}

/**
 * @param {string} dir
 * @param {string} urlDir
 */
async function pruneContentTwins(dir, urlDir) {
  let names;
  try {
    names = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return;
    throw error;
  }
  for (const entry of names) {
    const urlPath = `${urlDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (urlPath === "/research/publications") continue;
      await pruneContentTwins(path.join(dir, entry.name), urlPath);
      continue;
    }
    if (entry.name.endsWith(".md")) await unlink(path.join(dir, entry.name));
  }
}

if (isMain(import.meta.url)) {
  main().catch((/** @type {unknown} */ error) => {
    console.error(
      `build:content failed. ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
