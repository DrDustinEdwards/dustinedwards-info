import { execFileSync } from "node:child_process";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";

import { serializeArtifact } from "./lib/artifact.mjs";
import { colophonPages } from "../app/lib/colophon-sections.mjs";
import { playgroundPages } from "../app/lib/playground-page.mjs";
import { projectsPages } from "../app/lib/projects-page.mjs";
import { PUBLICATIONS } from "../app/data/publications.ts";
import { paperSearchInputs } from "../app/lib/publications/search-inputs.mjs";
import { renderBody, withBacklinks, withRelated } from "../app/lib/content/pipeline.mjs";
import { ContentError, renderPost } from "./lib/content.mjs";

export const CONTENT_DIR = path.join("content", "posts");
export const ARTIFACT_PATH = path.join("content", "generated", "posts.json");

export const ABOUT_SOURCE = path.join("content", "about.md");
export const ABOUT_ARTIFACT_PATH = path.join("content", "generated", "about.json");

/** @returns {Promise<string>} */
export async function buildArtifact() {
  /** @type {string[]} */
  let entries;
  try {
    entries = await readdir(CONTENT_DIR);
  } catch {
    throw new Error(
      `${CONTENT_DIR} does not exist. Create it and add at least one markdown post.`,
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
    const raw = await readFile(file, "utf8");
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
    await readFile(path.join("content", "generated", "stack.json"), "utf8"),
  );
  const features = JSON.parse(
    await readFile(path.join("content", "features.json"), "utf8"),
  );

  const projects = JSON.parse(
    await readFile(path.join("content", "projects.json"), "utf8"),
  );

  const playground = JSON.parse(
    await readFile(path.join("content", "playground.json"), "utf8"),
  );

  return serializeArtifact(
    // Both need the complete corpus: relatedness and being linked to are properties of the set.
    withBacklinks(withRelated(posts)),
    [
      ...colophonPages(stack, features),
      ...projectsPages(projects),
      ...playgroundPages(playground),
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
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
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
  const raw = await readFile(ABOUT_SOURCE, "utf8");
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
  await mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
  await writeFile(ARTIFACT_PATH, artifact, "utf8");
  const { posts } = JSON.parse(artifact);

  const about = await buildAbout();
  await writeFile(ABOUT_ARTIFACT_PATH, about, "utf8");

  console.log(
    `build:content wrote ${ARTIFACT_PATH} (${posts.length} posts) and ${ABOUT_ARTIFACT_PATH}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((/** @type {unknown} */ error) => {
    if (error instanceof ContentError) {
      console.error(`build:content failed. ${error.message}`);
    } else {
      console.error(
        `build:content failed. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    process.exit(1);
  });
}
