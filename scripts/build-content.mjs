import { execFileSync } from "node:child_process";
import { readdir, readFile, mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

import { serializeArtifact } from "./lib/artifact.mjs";
import { colophonPages } from "../app/lib/colophon-sections.mjs";
import {
  CONTENT_PAGE_PATHS,
  CONTENT_PAGES_FROM_DATA,
  contentPageFile,
  contentPageMarkdownBody,
  contentPageMarkdownPath,
  contentPageSearchInputs,
} from "../app/lib/content-pages.mjs";
import { buildCv } from "../app/lib/cv/entries.mjs";
import { cvMarkdownDocument } from "../app/lib/cv/markdown.mjs";
import { compilePage, pageSlug } from "../app/lib/pages/compile.mjs";
import { findWideDashes, renderBody, withBacklinks, withRelated } from "../app/lib/content/pipeline.mjs";
import { ContentError, renderPost } from "./lib/content.mjs";
import { isMain } from "./lib/is-main.mjs";
import { buildProcedures, PROCEDURES_ARTIFACT_PATH } from "./lib/procedures.mjs";
import { buildPublications, PUBLICATIONS_ARTIFACT_PATH, PUBLICATION_RECORDS_PATH } from "./lib/publications.mjs";

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

export const ABOUT_SOURCE = path.join("content", "about.md");
export const ABOUT_ARTIFACT_PATH = path.join("content", "generated", "about.json");

const PAGES_DIR = path.join("content", "pages");
export const PAGES_ARTIFACT_PATH = path.join("content", "generated", "pages.json");

/**
 * The Research, Teaching and Software pages, compiled the one way the page save (app/lib/pages/save.server.ts) compiles
 * them (app/lib/pages/compile.mjs): a refused link, a missing field or a broken invariant fails the build
 * instead of shipping an empty tag. Every file must be one of CONTENT_PAGE_PATHS and every path must have
 * its file, so routes, sitemap and pages cannot drift. The CV is generated from data and compiled by the
 * same door, but has no row in D1.
 *
 * @typedef {import("../app/lib/pages/compile.mjs").CompiledPage & { draft: boolean }} BuiltPage
 * @typedef {{ page: BuiltPage, compiled: Extract<Awaited<ReturnType<typeof compilePage>>, { ok: true }>, name: string }} BuiltSource
 */

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
    sources.push({ name: contentPageFile(pagePath), file: path.join("app", "data", "cv.ts"), raw: cvMarkdownDocument(buildCv((await publications()).records)), generated: true });
  }

  /** @type {BuiltSource[]} */
  const built = [];
  for (const { name, file, raw, generated } of sources) {
    const compiled = await compilePage({
      slug: name.slice(0, -3),
      raw,
      pipeline: { renderBody, findWideDashes },
      sourcePath: file.split(path.sep).join("/"),
      // A page written from data states other authors' titles, dashes included; the house style is for prose.
      generated,
    });
    if (!compiled.ok) {
      throw new ContentError(file.split(path.sep).join("/"), `does not compile:\n  ${compiled.errors.join("\n  ")}`);
    }
    built.push({ name, compiled, page: { ...compiled.page, draft: compiled.draft } });
  }

  const missing = CONTENT_PAGE_PATHS.filter((p) => !built.some(({ page }) => page.path === p));
  if (missing.length > 0) {
    throw new ContentError(PAGES_DIR, `has no page for ${missing.join(", ")}.`);
  }
  return built;
}

/** @returns {Promise<BuiltPage[]>} */
export async function renderContentPages() {
  return (await pageSources()).map(({ page }) => page).sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * The rows sync:content writes into D1's pages table: every file-sourced page, the CV excluded, as the
 * the page save would write it.
 */
export async function buildPages() {
  return (await pageSources())
    .filter(({ page }) => !CONTENT_PAGES_FROM_DATA.includes(page.path))
    .map(({ name, compiled }) => ({
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
      ...contentPageSearchInputs((await renderContentPages()).filter((page) => !page.draft)),
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

/**
 * Rendered at build time so the Worker never ships a second markdown renderer. The image resolver
 * refuses, because an image here would need a build-time measurement and would render unsized.
 *
 * @returns {Promise<string>}
 */
export async function buildAbout() {
  const raw = await readFile(fromRoot(ABOUT_SOURCE), "utf8");
  const parsed = matter(raw);
  const title = String(parsed.data.title ?? "");
  const description = String(parsed.data.description ?? "");
  if (!title || !description) {
    throw new ContentError(
      ABOUT_SOURCE,
      "must carry a title and a description in its frontmatter. They are the " +
        "page's <title> and its meta description, and a missing one would ship " +
        "as an empty tag rather than as a build failure.",
    );
  }

  const rendered = await renderBody({
    file: ABOUT_SOURCE,
    body: parsed.content,
    resolveImage: async (src) => {
      throw new ContentError(
        ABOUT_SOURCE,
        `references an image ("${src}") and this page has no image pipeline. Put ` +
          `the picture in a post, or give this build a real resolver.`,
      );
    },
  });

  if (rendered.blockedUrls.length > 0) {
    throw new ContentError(
      ABOUT_SOURCE,
      `carries ${rendered.blockedUrls.length} link(s) the URL allowlist refused: ` +
        `${rendered.blockedUrls.map((b) => b.url).join(", ")}`,
    );
  }

  return `${JSON.stringify({ title, description, html: rendered.html }, null, 2)}\n`;
}

async function main() {
  const artifact = await buildArtifact();
  await mkdir(path.dirname(fromRoot(ARTIFACT_PATH)), { recursive: true });
  await writeFile(fromRoot(ARTIFACT_PATH), artifact, "utf8");
  const { posts } = JSON.parse(artifact);

  const about = await buildAbout();
  await writeFile(fromRoot(ABOUT_ARTIFACT_PATH), about, "utf8");

  // The pages' rows, which sync:content writes to D1; their pages and twins are drawn from there
  // (docs/PAGES.md). Only the CV's twin is still a file, because the CV is generated from data.
  const pageRows = await buildPages();
  await writeFile(fromRoot(PAGES_ARTIFACT_PATH), `${JSON.stringify({ pages: pageRows }, null, 2)}\n`, "utf8");
  await writeContentPageTwins(await renderContentPages());

  // The procedures' rows, which sync:content writes to D1; their pages and twins are drawn from there.
  const { rows } = await procedures();
  await writeFile(fromRoot(PROCEDURES_ARTIFACT_PATH), `${JSON.stringify({ procedures: rows }, null, 2)}
`, "utf8");

  // The papers' rows, which sync:content writes to D1, and the published records alone, which the CV page
  // imports. Both come from the compile the search records and the CV markdown above came from.
  const compiled = await publications();
  await writeFile(fromRoot(PUBLICATIONS_ARTIFACT_PATH), `${JSON.stringify({ publications: compiled.rows }, null, 2)}
`, "utf8");
  await writeFile(fromRoot(PUBLICATION_RECORDS_PATH), `${JSON.stringify({ records: compiled.records }, null, 2)}
`, "utf8");

  console.log(
    `build:content wrote ${ARTIFACT_PATH} (${posts.length} posts), ${ABOUT_ARTIFACT_PATH}, ${PAGES_ARTIFACT_PATH} (${pageRows.length} pages), ` +
      `${PROCEDURES_ARTIFACT_PATH} (${rows.length} procedures) and ${PUBLICATIONS_ARTIFACT_PATH} (${compiled.rows.length} publications)`,
  );
}

/**
 * The twins of the pages in CONTENT_PAGES_FROM_DATA, at `public<path>.md`. Every other page's twin is
 * served from D1 (app/routes/content-page[.md].ts), and a static file at its address would win over that
 * route, so any left from an earlier build is deleted. The paper twins are served from D1
 * (app/routes/publications.$slug[.md].ts), not written here.
 *
 * @param {Awaited<ReturnType<typeof renderContentPages>>} pages
 */
async function writeContentPageTwins(pages) {
  const generated = pages.filter((page) => CONTENT_PAGES_FROM_DATA.includes(page.path));
  const expected = new Set(generated.map((page) => contentPageMarkdownPath(page.path)));
  for (const page of generated) {
    const rel = contentPageMarkdownPath(page.path).slice(1);
    const dest = fromRoot(path.join("public", rel));
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, contentPageMarkdownBody(page), "utf8");
  }
  for (const rootName of ["research", "teaching", "software"]) {
    await pruneContentTwins(fromRoot(path.join("public", rootName)), `/${rootName}`, expected);
  }
  for (const hub of ["/research.md", "/teaching.md", "/software.md", "/cv.md"]) {
    if (!expected.has(hub)) await unlink(fromRoot(path.join("public", hub.slice(1)))).catch(() => {});
  }
}

/**
 * @param {string} dir
 * @param {string} urlDir
 * @param {Set<string>} expected
 */
async function pruneContentTwins(dir, urlDir, expected) {
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
      await pruneContentTwins(path.join(dir, entry.name), urlPath, expected);
      continue;
    }
    if (!entry.name.endsWith(".md") || expected.has(urlPath)) continue;
    await unlink(path.join(dir, entry.name));
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
