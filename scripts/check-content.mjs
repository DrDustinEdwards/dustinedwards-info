/**
 * Gate for the generated artifacts under `content/generated/`.
 *
 * OBSERVATION BOUNDARY: byte-compares each artifact against a fresh generation
 * of itself. It never renders a page, never queries D1, and cannot tell whether
 * the rows an artifact syncs INTO match it. A correct artifact and a stale
 * database look identical here.
 *
 * THREE artifacts, one rule: an artifact derived from something in this
 * repository must equal a fresh derivation, offline, before it can ship.
 * `posts.json` from `content/posts`, `template-refs.json` from a source scan,
 * and `assets.json` from a walk of `public/`. The third arrived here on
 * 2026-08-18 and the reason is the whole point of the rule: it was the only one
 * of the three reconciled by a NETWORK gate, so `public/_headers` was committed
 * and deployed inside a ship window with every offline gate green. Nothing
 * offline had ever looked at `public/`.
 *
 * What that third section still cannot see is stated at its definition, and it
 * is not a detail: manifest-to-D1 is not here and is not offline.
 *
 * Regenerates from content/posts in memory and compares against the committed
 * content/generated/posts.json. Any difference fails, which is what stops a
 * hand-edited artifact or a stale build from shipping.
 *
 * This check fails closed: an unreadable artifact, a missing artifact, and a
 * generator that throws are all failures, never a pass.
 */

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { ARTIFACT_READ_CEILING_BYTES } from "../app/lib/editor/artifact-limits.mjs";
import { ARTIFACT_PATH, buildArtifact } from "./build-content.mjs";
import { TEMPLATE_REFS_PATH, scanTemplateRefs } from "./build-template-refs.mjs";
import { ASSET_MANIFEST_PATH, PUBLIC_DIR, walkPublic } from "./build-assets.mjs";

/**
 * Names, not a count. A failure that says "3 file(s) missing" sends the reader
 * to run a command and compare two lists by eye; a failure that says which
 * files is already the answer. Capped, because a first run against a fresh
 * checkout could otherwise print sixty lines.
 *
 * @param {string[]} names
 */
function nameThem(names) {
  const shown = names.slice(0, 10).map((n) => `          ${n}`);
  if (names.length > shown.length) shown.push(`          ... and ${names.length - 10} more`);
  return shown.join("\n");
}

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

    /*
     * THE SIZE, PRINTED EVERY RUN AND REFUSED AT HALF THE CEILING.
     *
     * The editor reads this artifact from GitHub through the raw media type,
     * whose documented limit is `ARTIFACT_READ_CEILING_BYTES`; the comment on
     * that constant says plainly that Worker memory binds earlier and is
     * unmeasured. Half is the honest refusal line for a limit whose true
     * position is known only to be somewhere below the documented one. The
     * ceiling is imported and never restated here as a digit, rule 17; the
     * bytes-per-post figure is printed so the reader who meets this failure
     * can estimate how many posts of headroom remain.
     */
    const bytes = Buffer.byteLength(committed, "utf8");
    const perPost = posts.length > 0 ? Math.round(bytes / posts.length) : bytes;
    const refuseAt = ARTIFACT_READ_CEILING_BYTES / 2;
    if (bytes > refuseAt) {
      console.error(
        `check:content failed. ${ARTIFACT_PATH} is ${bytes} bytes ` +
          `(${posts.length} posts, ${perPost} bytes/post), over half the ` +
          `${ARTIFACT_READ_CEILING_BYTES} byte raw-read ceiling (refusal at ` +
          `${refuseAt}). The editor's artifact read is approaching a transport ` +
          `limit; shrink the artifact or move the read off the Contents API ` +
          `before this becomes a production failure.`,
      );
      process.exit(1);
      return;
    }

    console.log(
      `check:content ok. ${ARTIFACT_PATH} matches source ` +
        `(${posts.length} posts, ${bytes} bytes, ${perPost} bytes/post, ` +
        `refusal at ${refuseAt}).`,
    );
    await checkTemplateRefs();
    await checkAssetManifest();
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
  //
  // RE-MEASURED 2026-08-24 through this gate by running it: 183 files read, 59
  // assets considered. Both floors are about eight percent under. The file
  // floor had been 100 against 183, which let nearly half the tree stop being
  // walked while the assertion that exists to notice that reported clean.
  if (!(parsed.filesRead >= 168)) {
    console.error(
      `check:content failed. the template scan read ${parsed.filesRead} source file(s), ` +
        `floor 168, measured 183. A zero-scope scan reports "no references" and looks correct.`,
    );
    process.exit(1);
    return;
  }
  if (!(parsed.assetsConsidered >= 54)) {
    console.error(
      `check:content failed. the template scan considered ${parsed.assetsConsidered} asset(s), ` +
        `floor 54, measured 59. The asset manifest is empty or was not loaded.`,
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

/**
 * THE THIRD GENERATED ARTIFACT, and the one that was reconciled by nothing
 * offline until 2026-08-18.
 *
 * `assets.json` is the list of static files, written by `build:assets` from a
 * walk of `public/`. **A Worker cannot list its own static assets**: the ASSETS
 * binding has `fetch()` and nothing else, so the media rebuild running inside
 * the Worker discovers what exists by reading this file. A manifest missing a
 * file therefore means a file that is never indexed, never appears in
 * /admin/media, and is not missing from anything a reader can see. It is the
 * quietest possible failure.
 *
 * IT MOVED HERE FROM check:media, AND THE TIER IS THE ENTIRE POINT. The
 * comparison is a `readdir` and a JSON read with no network in it at all, and
 * it was the only offline-capable half of a gate tiered `network` because its
 * other four directions list R2 and query D1. So the check existed, was
 * correct, and ran only on `check:all --remote`. `public/_headers` was
 * committed in `f3256e8` and shipped in window 8 with 25 green gates.
 *
 * WHAT THIS SECTION CANNOT SEE, stated plainly because the tier makes it
 * tempting to assume otherwise: it compares the manifest to THE FILESYSTEM. It
 * does not know what rows exist in D1, so a manifest that matches `public/`
 * perfectly while the media index is months stale passes here without comment.
 * Manifest-to-D1 is `check:media`'s, it needs the network, and moving this half
 * out did not shrink that half by one assertion.
 *
 * Ordering note: this runs LAST, after both byte comparisons, because it is the
 * cheapest to fix and the least likely to be what someone is mid-way through
 * debugging.
 */
async function checkAssetManifest() {
  const files = await walkPublic();

  // FAILS CLOSED ON AN EMPTY WALK, the same discipline check:media applies to
  // an empty R2 listing. A broken walk and an empty directory produce the same
  // array, and every comparison below would pass vacuously against it.
  if (files.length === 0) {
    console.error(
      `check:content failed. walked ${PUBLIC_DIR}/ and found 0 file(s), which cannot be right. ` +
        `A zero-scope walk agrees with any manifest.`,
    );
    process.exit(1);
    return;
  }

  /** @type {string[]} */
  let manifestPaths;
  try {
    const parsed = JSON.parse(await readFile(ASSET_MANIFEST_PATH, "utf8"));
    // `?? []` is deliberately absent. A manifest whose `paths` key is missing is
    // a broken artifact, and defaulting it to an empty array would turn that
    // into "every file is missing from the manifest", which is a true statement
    // that names the wrong defect.
    if (!Array.isArray(parsed.paths)) throw new Error("no `paths` array");
    manifestPaths = parsed.paths;
  } catch (error) {
    console.error(
      `check:content failed. ${ASSET_MANIFEST_PATH} is missing or unparseable ` +
        `(${error instanceof Error ? error.message : String(error)}). Run npm run build:assets.`,
    );
    process.exit(1);
    return;
  }

  // Order matters as well as membership: `walkPublic()` sorts, so an unsorted
  // manifest is a hand edit or a generator that stopped sorting, and either is
  // worth failing on. Compared as JSON for that reason rather than as sets.
  if (JSON.stringify(manifestPaths) !== JSON.stringify(files)) {
    const fileSet = new Set(files);
    const missing = files.filter((f) => !manifestPaths.includes(f));
    const extra = manifestPaths.filter((p) => !fileSet.has(p));
    console.error(`check:content failed. ${ASSET_MANIFEST_PATH} disagrees with ${PUBLIC_DIR}/.`);
    if (missing.length > 0) {
      console.error(`  ${missing.length} file(s) on disk and NOT in the manifest:`);
      console.error(nameThem(missing));
      console.error("  These are unindexed: nothing in the Worker can discover them.");
    }
    if (extra.length > 0) {
      console.error(`  ${extra.length} manifest entr(ies) with no file on disk:`);
      console.error(nameThem(extra));
    }
    if (missing.length === 0 && extra.length === 0) {
      console.error(`  same ${files.length} path(s), different ORDER. The manifest is hand-edited.`);
    }
    console.error("  Run npm run build:assets and commit the result.");
    process.exit(1);
    return;
  }

  await checkManifestIsRepoWide(manifestPaths);

  console.log(
    `check:content ok. ${ASSET_MANIFEST_PATH} matches ${PUBLIC_DIR}/ ` +
      `(${files.length} file(s), none of them gitignored).`,
  );
}

/**
 * A path may not be BOTH gitignored and in the manifest.
 *
 * WHY THIS IS A DEFECT AND NOT A CURIOSITY. The manifest is committed, so it
 * describes what the repository contains. A gitignored file under `public/`
 * classifies fine, enters the manifest on whoever's machine holds it, and then
 * exists in no clone: the artifact has quietly started describing A DISK. Two
 * things make that live rather than theoretical here. `npm run deploy` builds
 * from the WORKING TREE, so the file ships from that one machine; and
 * `check:head` extracts a ref into a throwaway worktree, where the file is
 * absent and this same comparison would fail for a reason nobody could
 * reproduce.
 *
 * `.gitignore` carries `/public/phage-hunters/*.jpg`, the roster photo sources
 * whose committed form is the generated WebP. The trap is already written down;
 * nothing has walked into it yet. **This is a tripwire being armed, not a break
 * being fixed**, which is exactly why the scope assertion below matters more
 * than usual: an assertion that has never fired and cannot fire is
 * indistinguishable from one that is merely quiet.
 *
 * `git check-ignore` rather than parsing `.gitignore`: negations, directory
 * rules, precedence and nested ignore files are git's semantics, and a second
 * implementation of them would be wrong in ways this gate could not see.
 *
 * @param {string[]} manifestPaths site-absolute, as the manifest stores them
 */
async function checkManifestIsRepoWide(manifestPaths) {
  // SCOPE, ASSERTED FIRST. This whole check reports "nothing ignored" when the
  // path list is empty, when git cannot answer, and when every path is clean.
  // Only the third is a pass, so the other two are eliminated before the answer
  // is read at all.
  if (manifestPaths.length === 0) {
    console.error(
      "check:content failed. the gitignore tripwire was handed 0 path(s), so its clean " +
        "answer describes nothing.",
    );
    process.exit(1);
    return;
  }

  const repoPaths = manifestPaths.map((p) => `${PUBLIC_DIR}${p}`);
  const result = spawnSync("git", ["check-ignore", "--stdin"], {
    input: `${repoPaths.join("\n")}\n`,
    encoding: "utf8",
  });

  // Exit 0 means at least one path IS ignored, 1 means none are, and anything
  // else is git failing to answer. FAIL CLOSED on the third: an unreadable
  // answer is not a clean one, and this is the branch that would otherwise turn
  // a missing git into a silent pass forever.
  if (result.status !== 0 && result.status !== 1) {
    console.error(
      `check:content failed. git check-ignore could not answer (status ${result.status}). ` +
        `${(result.stderr ?? "").trim()}`,
    );
    process.exit(1);
    return;
  }

  const ignored = (result.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (ignored.length > 0) {
    console.error(
      `check:content failed. ${ignored.length} path(s) are BOTH gitignored and in ` +
        `${ASSET_MANIFEST_PATH}:`,
    );
    console.error(nameThem(ignored));
    console.error(
      "  The manifest now describes a disk rather than the repository: these files exist\n" +
        "  in no clone, they are absent from check:head's extracted worktree, and\n" +
        "  npm run deploy would ship them from this machine alone. Either commit them or\n" +
        "  move them out of public/, then run npm run build:assets.",
    );
    process.exit(1);
  }
}

main().catch((/** @type {unknown} */ error) => {
  console.error(
    `check:content failed. ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
