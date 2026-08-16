/**
 * Gate for the generated content artifact.
 *
 * OBSERVATION BOUNDARY: byte-compares the artifact against a fresh generation.
 * It never renders a page, never queries D1, and cannot tell whether the rows
 * the artifact syncs INTO match it. A correct artifact and a stale database
 * look identical here.
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
import { TEMPLATE_REFS_PATH, scanTemplateRefs } from "./build-template-refs.mjs";

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
    await checkTemplateRefs();
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

/**
 * THE SECOND GENERATED ARTIFACT, reconciled the same way and for a stronger
 * reason than the first.
 *
 * `template-refs.json` decides which files the media library calls "in
 * template", so a stale copy does not merely go out of date: it prints a
 * SENTENCE ABOUT EVIDENCE that no longer matches the evidence. A file whose
 * last reference was deleted would keep claiming the site places it, next to a
 * delete button that the claim discourages pressing. That is worse than no
 * claim at all.
 *
 * Byte-compared against a fresh scan, both directions, exactly as the posts
 * artifact is. **The scope numbers are asserted too, and separately**: a scan
 * that read zero files and one that found zero references print the same empty
 * `refs`, so the count of files read is what tells a broken walk from a
 * repository that genuinely cites nothing. That is this repo's most-repeated
 * defect class and the artifact carries the control for it.
 */
async function checkTemplateRefs() {
  const fresh = `${JSON.stringify(await scanTemplateRefs(), null, 2)}
`;

  /** @type {string} */
  let committed;
  try {
    committed = await readFile(TEMPLATE_REFS_PATH, "utf8");
  } catch {
    console.error(
      `check:content failed. ${TEMPLATE_REFS_PATH} is missing or unreadable. ` +
        `Run npm run build:template-refs.`,
    );
    process.exit(1);
    return;
  }

  if (committed !== fresh) {
    const diff = firstDifference(committed, fresh);
    console.error(`check:content failed. ${TEMPLATE_REFS_PATH} differs from a fresh scan.`);
    if (diff) {
      console.error(`  first difference at line ${diff.line}`);
      console.error(`  committed: ${diff.committed.trim().slice(0, 200)}`);
      console.error(`  fresh:     ${diff.fresh.trim().slice(0, 200)}`);
    }
    console.error("  Run npm run build:template-refs and commit the result.");
    process.exit(1);
    return;
  }

  const parsed = JSON.parse(committed);
  // SCOPE, ASSERTED. An empty `refs` from a broken walk and an empty `refs` from
  // a repository that cites nothing are the same bytes; these are the numbers
  // that discriminate. Floors rather than equalities, so adding a source file
  // does not fail the gate, but losing the whole tree does.
  if (!(parsed.filesRead >= 100)) {
    console.error(
      `check:content failed. the template scan read ${parsed.filesRead} source file(s), ` +
        `expected at least 100. A zero-scope scan reports "no references" and looks correct.`,
    );
    process.exit(1);
    return;
  }
  if (!(parsed.assetsConsidered >= 50)) {
    console.error(
      `check:content failed. the template scan considered ${parsed.assetsConsidered} asset(s), ` +
        `expected at least 50. The asset manifest is empty or was not loaded.`,
    );
    process.exit(1);
    return;
  }
  /*
   * AND THE ONE CASE THE WHOLE FEATURE EXISTS FOR. The nine cohort photographs
   * are referenced by `app/data/phage-hunters.ts` and by no post. If this
   * assertion ever fails, the media page has silently gone back to calling them
   * unattached, which is the exact falsehood the third state was built to end.
   * Named explicitly rather than left to the byte comparison, because a byte
   * comparison against a fresh scan passes happily when BOTH are wrong.
   */
  const roster = Object.keys(parsed.refs).filter((k) => k.startsWith("/phage-hunters/"));
  if (roster.length < 9) {
    console.error(
      `check:content failed. only ${roster.length} roster photograph(s) are seen as ` +
        `referenced by repository code, expected 9. The media library is calling files ` +
        `unattached that app/data/phage-hunters.ts places on the roster page.`,
    );
    process.exit(1);
    return;
  }

  console.log(
    `check:content ok. ${TEMPLATE_REFS_PATH} matches a fresh scan ` +
      `(${parsed.generated} asset(s) referenced by ${parsed.filesRead} source file(s), ` +
      `${roster.length} of them roster photographs).`,
  );
}

main().catch((/** @type {unknown} */ error) => {
  console.error(
    `check:content failed. ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
