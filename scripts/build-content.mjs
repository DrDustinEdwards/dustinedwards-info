/**
 * Renders the corpus into the LOCAL build product.
 *
 *   npm run build:content
 *
 * BOUNDARY: gitignored, because git holds the markdown and D1 holds the only rendered copy;
 * everything that reads this file runs after a build.
 */

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

/** The About page's prose. Markdown, so it edits the way a post does. */
export const ABOUT_SOURCE = path.join("content", "about.md");
export const ABOUT_ARTIFACT_PATH = path.join("content", "generated", "about.json");

/**
 * Renders every post and returns the artifact exactly as it should sit on disk. Sorted by slug, so
 * the output depends on content alone rather than on filesystem order.
 *
 * @returns {Promise<string>}
 */
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

  /*
   * The page half of the corpus. Read rather than imported, a JSON import needing an attribute this
   * repo's compiler settings reject; the Worker's copy imports them instead. BUILD ORDER: this
   * depends on the stack artifact, so that build runs FIRST, a stale one producing page records the
   * next build will not reproduce.
   */
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

  /*
   * THE PAPERS COME FROM A COMMITTED MODULE, not the JSON read above: that module is generated from
   * the two data files and byte-gated against them. Reading the JSON again would be a second
   * assembly of the same records.
   */
  return serializeArtifact(
    // Both run over the COMPLETE corpus, because relatedness and being linked to are properties of
    // the set. Order between them does not matter: neither reads what the other writes.
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
 * The date of the last commit that touched a file. Deliberately NOT written into the build product:
 * a render must be a pure function of the sources, and the Worker writer has no git.
 *
 * @param {string} file
 * @returns {string | null}
 */
export function lastCommitDate(file) {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cd", "--date=format:%Y-%m-%d", "--", file],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return out || null;
  } catch {
    // No git, no history, or a shallow clone. Absence is the honest answer.
    return null;
  }
}

/**
 * The revision date a post's row carries, or null. ONE OWNER for the rule, which decides whether a
 * reader sees an "Updated" line: the gate that renders that markup offline feeds the component the
 * value production would write, and computing it there would be a second statement, where a
 * measured value goes to one place or to nowhere, which is hard rule 17. A `Date` rather than a
 * string, because returning the string leaves both consumers parsing, which is where a timezone
 * gets in. NULL IS A REAL ANSWER: a shallow clone has no history for most files, so the gate
 * asserts the PAIRING rather than the presence.
 *
 * @param {{ updated?: string | null, sourcePath: string }} post
 * @returns {Date | null}
 */
export function revisedDate(post) {
  const revised = post.updated ?? lastCommitDate(post.sourcePath);
  return revised ? new Date(`${revised}T00:00:00.000Z`) : null;
}

/**
 * The About page, rendered from markdown into the shape its route imports.
 *
 * WHY MARKDOWN AND NOT JSX: this one is a person's description of themselves, revised on taste,
 * and they should not have to edit a component to move a comma. WHY RENDERED HERE AND NOT IN THE
 * WORKER: the public plane must not grow a second markdown renderer, nor pay for the first on a
 * static page. THE SAME RENDERER THE CORPUS USES, or the page drifts from the posts beside it in
 * exactly the ways nobody checks. The image resolver REFUSES: one here would need a build-time
 * measurement this function does not do, and would render unsized.
 *
 * @returns {Promise<string>} the artifact exactly as it should sit on disk
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
