/**
 * Renders content/posts/*.md into the committed artifact at
 * content/generated/posts.json.
 *
 * `npm run build:content` regenerates it. `npm run check:content` fails when the
 * committed copy differs from a fresh generation, so the artifact cannot drift
 * from its source without someone noticing.
 */

import { execFileSync } from "node:child_process";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { serializeArtifact } from "../app/lib/content/artifact.mjs";
import { colophonPages } from "../app/lib/colophon-sections.mjs";
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

  return serializeArtifact(withRelated(posts), [
    ...colophonPages(stack, features),
    ...projectsPages(projects),
  ]);
}

/**
 * The date of the last commit that touched a file, as YYYY-MM-DD.
 *
 * Deliberately NOT written into the gated artifact. The artifact is generated
 * before the commit that contains it, so it would record the file's PREVIOUS
 * commit date, and the next build would compute the new one. Every ordinary
 * content commit from a clone would then leave `check:content` red. Git dates
 * are applied at sync time instead, where nothing compares them byte for byte.
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
