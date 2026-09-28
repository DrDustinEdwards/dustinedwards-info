import { execFileSync } from "node:child_process";
import { readdir, readFile, mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

import { serializeArtifact } from "./lib/artifact.mjs";
import { colophonPages } from "../app/lib/colophon-sections.mjs";
import {
  CONTENT_PAGE_PATHS,
  CONTENT_PAGE_SECTIONS,
  DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  contentPageFile,
  contentPageMarkdownBody,
  contentPageMarkdownPath,
  contentPageSearchInputs,
} from "../app/lib/content-pages.mjs";
import { playgroundPages } from "../app/lib/playground-page.mjs";
import { projectsPages } from "../app/lib/projects-page.mjs";
import { PUBLICATIONS } from "../app/data/publications.ts";
import { paperSearchInputs } from "../app/lib/publications/search-inputs.mjs";
import { renderBody, withBacklinks, withRelated } from "../app/lib/content/pipeline.mjs";
import { ContentError, renderPost } from "./lib/content.mjs";
import { isMain } from "./lib/is-main.mjs";

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
 * The Research and Teaching pages, rendered like the About page: no image pipeline, and a refused link
 * or a missing field fails the build instead of shipping an empty tag. Every file must be one of
 * CONTENT_PAGE_PATHS and every path must have its file, so routes, sitemap and pages cannot drift.
 */
export async function renderContentPages() {
  const names = (await readdir(fromRoot(PAGES_DIR))).filter((name) => name.endsWith(".md")).sort();
  const expected = new Map(CONTENT_PAGE_PATHS.map((p) => [contentPageFile(p), p]));

  /** @type {Array<{ path: string, title: string, seoTitle: string, description: string, html: string, markdown: string, toc: Array<{ depth: number, id: string, text: string }> }>} */
  const pages = [];
  for (const name of names) {
    const file = path.join(PAGES_DIR, name);
    const parsed = matter(await readFile(fromRoot(file), "utf8"));
    const fm = parsed.data;
    const page = {
      path: String(fm.path ?? ""),
      title: String(fm.title ?? ""),
      seoTitle: String(fm.seo_title ?? ""),
      description: String(fm.description ?? ""),
    };
    if (expected.get(name) !== page.path) {
      throw new ContentError(
        file,
        `declares path "${page.path}", but the file for that path is ${contentPageFile(page.path)} and ` +
          `every page must be listed in CONTENT_PAGE_PATHS (app/lib/content-pages.mjs).`,
      );
    }
    if (!page.title || !page.seoTitle || !page.description) {
      throw new ContentError(file, "must carry title, seo_title and description in its frontmatter.");
    }
    if (page.seoTitle.length > SEO_TITLE_MAX || page.description.length > DESCRIPTION_MAX) {
      throw new ContentError(
        file,
        `seo_title is ${page.seoTitle.length} characters (at most ${SEO_TITLE_MAX}) and the description ` +
          `${page.description.length} (at most ${DESCRIPTION_MAX}); Google would clip the longer one.`,
      );
    }

    const rendered = await renderBody({
      file,
      body: parsed.content,
      resolveImage: async (src) => {
        throw new ContentError(file, `references an image ("${src}") and these pages have no image pipeline.`);
      },
    });
    if (rendered.blockedUrls.length > 0) {
      throw new ContentError(
        file,
        `carries link(s) the URL allowlist refused: ${rendered.blockedUrls.map((b) => b.url).join(", ")}`,
      );
    }
    pages.push({ ...page, html: rendered.html, markdown: parsed.content, toc: rendered.toc });
  }

  const missing = CONTENT_PAGE_PATHS.filter((p) => !pages.some((page) => page.path === p));
  if (missing.length > 0) {
    throw new ContentError(PAGES_DIR, `has no page for ${missing.join(", ")}.`);
  }
  const headless = CONTENT_PAGE_SECTIONS.filter((section) => {
    const [pagePath, id] = section.split("#");
    return !pages.find((page) => page.path === pagePath)?.toc.some((heading) => heading.id === id);
  });
  if (headless.length > 0) {
    throw new ContentError(
      PAGES_DIR,
      `has no heading for ${headless.join(", ")}, which CONTENT_PAGE_SECTIONS (app/lib/content-pages.mjs) lists.`,
    );
  }
  return pages.sort((a, b) => a.path.localeCompare(b.path));
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

  const projects = JSON.parse(
    await readFile(fromRoot(path.join("content", "projects.json")), "utf8"),
  );

  const playground = JSON.parse(
    await readFile(fromRoot(path.join("content", "playground.json")), "utf8"),
  );

  return serializeArtifact(
    // Both need the complete corpus: relatedness and being linked to are properties of the set.
    withBacklinks(withRelated(posts)),
    [
      ...colophonPages(stack, features),
      ...projectsPages(projects),
      ...playgroundPages(playground),
      ...contentPageSearchInputs(await renderContentPages()),
    ],
    paperSearchInputs(PUBLICATIONS),
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

  // Only what the route renders: the markdown and outline are build inputs for search, not page weight.
  // The twin is a static asset beside the HTML URL, the same trade the paper twins make.
  const renderedPages = await renderContentPages();
  const contentPages = renderedPages.map(({ path: p, title, seoTitle, description, html }) => ({
    path: p,
    title,
    seoTitle,
    description,
    html,
  }));
  await writeFile(fromRoot(PAGES_ARTIFACT_PATH), `${JSON.stringify({ pages: contentPages }, null, 2)}\n`, "utf8");
  await writeContentPageTwins(renderedPages);

  console.log(
    `build:content wrote ${ARTIFACT_PATH} (${posts.length} posts), ${ABOUT_ARTIFACT_PATH} and ${PAGES_ARTIFACT_PATH}`,
  );
}

/**
 * One markdown file per research and teaching page, at `public<path>.md`. Paper twins live under
 * public/research/publications/ and are not touched here.
 *
 * @param {Awaited<ReturnType<typeof renderContentPages>>} pages
 */
async function writeContentPageTwins(pages) {
  const expected = new Set(pages.map((page) => contentPageMarkdownPath(page.path)));
  for (const page of pages) {
    const rel = contentPageMarkdownPath(page.path).slice(1);
    const dest = fromRoot(path.join("public", rel));
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, contentPageMarkdownBody(page), "utf8");
  }
  for (const rootName of ["research", "teaching"]) {
    await pruneContentTwins(fromRoot(path.join("public", rootName)), `/${rootName}`, expected);
  }
  for (const hub of ["/research.md", "/teaching.md"]) {
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
