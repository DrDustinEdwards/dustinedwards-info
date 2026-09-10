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

import { serializeArtifact } from "./lib/artifact.mjs";
import { colophonPages } from "../app/lib/colophon-sections.mjs";
import { playgroundPages } from "../app/lib/playground-page.mjs";
import { projectsPages } from "../app/lib/projects-page.mjs";
import { withRelated } from "../app/lib/content/pipeline.mjs";
import { ContentError, renderPost } from "./lib/content.mjs";

export const CONTENT_DIR = path.join("content", "posts");
export const ARTIFACT_PATH = path.join("content", "generated", "posts.json");

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

async function main() {
  const artifact = await buildArtifact();
  await mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
  await writeFile(ARTIFACT_PATH, artifact, "utf8");
  const { posts } = JSON.parse(artifact);
  console.log(`build:content wrote ${ARTIFACT_PATH} (${posts.length} posts)`);
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
