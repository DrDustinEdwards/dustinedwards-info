/**
 * Renders content/posts/*.md into the LOCAL build product at
 * content/generated/posts.json.
 *
 * Gitignored since the artifact arc: git holds markdown, D1 holds the only
 * rendered copy, and everything that reads this file (sync-content, the
 * gates, build:og and build:diagrams) runs after a build. `check:content`
 * proves the render is valid and deterministic; ship's drift report compares
 * D1's hashes against what this wrote.
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
import { renderBody, withRelated } from "../app/lib/content/pipeline.mjs";
import { ContentError, renderPost } from "./lib/content.mjs";

export const CONTENT_DIR = path.join("content", "posts");
export const ARTIFACT_PATH = path.join("content", "generated", "posts.json");

/** The About page's prose. Markdown, so it edits the way a post does. */
export const ABOUT_SOURCE = path.join("content", "about.md");
export const ABOUT_ARTIFACT_PATH = path.join("content", "generated", "about.json");

/**
 * Renders every post and returns the artifact exactly as it should sit on disk.
 * Sorted by slug so the output depends on content alone, never on the order the
 * filesystem happened to hand back.
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
   * The page half of the corpus. Ruling 3 of colophon-page.md.
   *
   * Read with `readFileSync` rather than imported: a JSON import needs
   * `with { type: "json" }` for Node, and that attribute is rejected by this
   * repo's tsc `module` setting, so the two would disagree about whether the
   * file even compiles. The Worker's copy of this call imports them instead,
   * which is the same environment split `makeResolveImage` has.
   *
   * BUILD ORDER: this now depends on `content/generated/stack.json`, so
   * `build:stack` runs BEFORE `build:content`. A stale stack.json here produces
   * page records that the next build will not reproduce, which `check:content`
   * reports as a byte difference.
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

  return serializeArtifact(withRelated(posts), [
    ...colophonPages(stack, features),
    ...projectsPages(projects),
    ...playgroundPages(playground),
  ]);
}

/**
 * The date of the last commit that touched a file, as YYYY-MM-DD.
 *
 * Deliberately NOT written into the build product. A render must be a pure
 * function of the sources (the determinism pass renders twice and compares,
 * and the Worker writer has no git to consult), so git dates are applied at
 * sync time instead, where the two writers already legitimately differ.
 *
 * Exported for `sync:content`.
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
 * The revision date a post's row carries, or null.
 *
 * ONE OWNER for `post.updated ?? lastCommitDate(post.sourcePath)`. That
 * expression was written once, inline in `sync-content.mjs`, and it is what
 * decides whether a reader sees an "Updated" line and what `dt-updated`
 * publishes. `check:microformats` renders that markup offline and has to feed
 * the component the value production would write; computing it there would have
 * been a second statement of the rule, and hard rule 17 gives a measured value
 * to one place or to nowhere.
 *
 * A `Date` rather than the `YYYY-MM-DD` string, because the two consumers want
 * different shapes of it: the sync converts to epoch seconds for the column,
 * the gate hands it to a component that calls `new Date()` on it. Returning the
 * string would leave both of them parsing, which is where a timezone gets in.
 *
 * MIDNIGHT UTC, explicitly. `new Date("2026-09-09")` is already UTC by spec,
 * but the sync spelled the time out and this keeps that spelling rather than
 * relying on a default nobody should have to look up.
 *
 * NULL IS A REAL ANSWER AND NOT A FAILURE. A shallow clone has no history for
 * most files, so CI legitimately gets null here where a full local clone gets a
 * date. Both are correct: the row then carries no `updated_at`, the page shows
 * no revision, and `dt-updated` is absent. The gate asserts the PAIRING rather
 * than the presence, so it holds in both environments.
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
 * ## WHY IT IS MARKDOWN AND NOT JSX
 *
 * `/privacy` and `/colophon` are prose in JSX, which is fine for pages whose
 * sentences are each tied to a file the reader can go and check. About is not
 * that: it is one person's description of themselves, it will be revised on
 * taste rather than on a code change, and the person revising it should not
 * have to edit a component to move a comma. So it edits the way a post does.
 *
 * ## WHY IT IS RENDERED HERE AND NOT IN THE WORKER
 *
 * The public plane must not grow a second markdown renderer, and it must not
 * pay for the first one on a static page: `renderBody` pulls shiki, KaTeX and
 * the directive plugins, which is most of the build's weight for four
 * paragraphs that contain none of them. Rendering at build time means the
 * route imports a string.
 *
 * THE SAME `renderBody` THE CORPUS USES, never a lighter second pass. A page
 * rendered by a different pipeline would drift from the posts beside it in
 * exactly the ways nobody checks: heading ids, link handling, the URL
 * allowlist. The mailto in the contact line is live because `isAllowedUrl`
 * permits `mailto:`, which is a property of the shared renderer and not of a
 * special case written here.
 *
 * `resolveImage` REFUSES. This page has no images and must not acquire one by
 * accident: an image here would need a build-time measurement this function
 * does not do, and would render without `width` and `height` (check:invariants
 * section 28). A named throw is a better answer than a silent unsized image.
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
