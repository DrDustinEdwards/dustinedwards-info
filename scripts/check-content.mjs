/**
 * Gate for the generated content artifact.
 *
 * Regenerates from content/posts in memory and compares against the committed
 * content/generated/posts.json. Any difference fails, which is what stops a
 * hand-edited artifact or a stale build from shipping.
 *
 * This check fails closed: an unreadable artifact, a missing artifact, and a
 * generator that throws are all failures, never a pass.
 */

import { readFile } from "node:fs/promises";

import { ARTIFACT_PATH, buildArtifact } from "./build-content.mjs";

/**
 * Reports the first line that differs, so the failure names a location rather
 * than just asserting inequality.
 *
 * @param {string} committed
 * @param {string} fresh
 */
function firstDifference(committed, fresh) {
  const a = committed.split("\n");
  const b = fresh.split("\n");
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) {
      return {
        line: i + 1,
        committed: a[i] ?? "(end of file)",
        fresh: b[i] ?? "(end of file)",
      };
    }
  }
  return null;
}

async function main() {
  const fresh = await buildArtifact();

  /** @type {string} */
  let committed;
  try {
    committed = await readFile(ARTIFACT_PATH, "utf8");
  } catch {
    console.error(
      `check:content failed. ${ARTIFACT_PATH} is missing or unreadable. Run npm run build:content.`,
    );
    process.exit(1);
    return;
  }

  if (committed === fresh) {
    const { posts } = JSON.parse(committed);
    console.log(`check:content ok. ${ARTIFACT_PATH} matches source (${posts.length} posts).`);
    return;
  }

  const diff = firstDifference(committed, fresh);
  console.error(`check:content failed. ${ARTIFACT_PATH} differs from a fresh generation.`);
  if (diff) {
    console.error(`  first difference at line ${diff.line}`);
    console.error(`  committed: ${diff.committed.trim().slice(0, 200)}`);
    console.error(`  fresh:     ${diff.fresh.trim().slice(0, 200)}`);
  }
  console.error("  Run npm run build:content and commit the result.");
  process.exit(1);
}

main().catch((/** @type {unknown} */ error) => {
  console.error(
    `check:content failed. ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
