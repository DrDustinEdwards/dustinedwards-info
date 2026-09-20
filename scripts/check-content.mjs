/**
 * Gate for the content build and the committed artifacts under `content/generated/`.
 *
 *   npm run check:content
 *
 * BOUNDARY: it renders and compares locally, never in a Worker and never against D1, so whether
 * the rows match what it rendered is ship's drift report's.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path, { join } from "node:path";
import { createHash } from "node:crypto";

import { ABOUT_ARTIFACT_PATH, ABOUT_SOURCE, buildAbout, buildArtifact } from "./build-content.mjs";
import { TEMPLATE_REFS_PATH, scanTemplateRefs } from "./build-template-refs.mjs";
import { ASSET_MANIFEST_PATH, PUBLIC_DIR, placeholderPaths, walkPublic } from "./build-assets.mjs";
/* The one statement of what a stored placeholder IS, imported rather than restated. */
import { placeholderProblems } from "./check-image-weight.mjs";
import {
  KATEX_CSS_PATH,
  KATEX_FONT_DIR,
  generateKatexCss,
} from "./build-katex.mjs";
import { internalLinkSlug } from "../app/lib/content/pipeline.mjs";
import { htmlHasMath } from "../app/lib/content/math.mjs";
import { mathToTex } from "../app/lib/rss-feed.mjs";
import { recordsForPosts } from "../app/lib/search/records.mjs";

/**
 * Names, not a count: "3 file(s) missing" sends the reader to compare two lists by eye.
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
  /*
   * TWICE, IN ONE PROCESS: once proves validity, twice proves the render depends on the sources
   * alone. One process on purpose, so a shared memo makes any difference the render's own.
   */
  const first = await buildArtifact();
  const second = await buildArtifact();

  if (first !== second) {
    console.error(
      `check:content failed. Two back-to-back renders of the corpus differ, ` +
        `so the render is NOT deterministic.`,
    );
    const a = JSON.parse(first);
    const b = JSON.parse(second);
    const bBySlug = new Map(b.posts.map((/** @type {any} */ p) => [p.slug, p]));
    const differing = [];
    for (const post of a.posts) {
      const twin = bBySlug.get(post.slug);
      if (!twin || JSON.stringify(post) !== JSON.stringify(twin)) differing.push(post.slug);
    }
    for (const post of b.posts) {
      if (!a.posts.some((/** @type {any} */ p) => p.slug === post.slug)) differing.push(post.slug);
    }
    if (differing.length > 0) {
      console.error(`  slug(s) whose renders differ: ${differing.join(", ")}`);
    } else {
      console.error(`  every post matches; the difference is in the page records.`);
    }
    const diff = firstDifference(first, second);
    if (diff) {
      console.error(`  first difference at line ${diff.line}`);
      console.error(`  run 1: ${diff.committed.trim().slice(0, 200)}`);
      console.error(`  run 2: ${diff.fresh.trim().slice(0, 200)}`);
    }
    process.exit(1);
    return;
  }

  const { posts } = JSON.parse(first);
  const bytes = Buffer.byteLength(first, "utf8");
  const perPost = posts.length > 0 ? Math.round(bytes / posts.length) : bytes;
  console.log(
    `check:content ok. the corpus renders deterministically ` +
      `(${posts.length} posts, ${bytes} bytes, ${perPost} bytes/post, rendered twice).`,
  );

  await checkAbout();

  checkInternalFurtherReading(posts);
  checkMath(posts);
  checkSwatches(posts);
  await checkKatexArtifact();
  await checkTemplateRefs();
  await checkAssetManifest();
}

/**
 * The About page renders, renders the same way twice, and says something. RENDERING AT ALL IS THE
 * VALIDATION, since `buildAbout` throws. TWICE AND BYTE-COMPARED, because `about.json` is
 * imported statically into the Worker bundle. NOT EMPTY: a blank page renders a valid artifact.
 */
async function checkAbout() {
  const first = await buildAbout();
  const second = await buildAbout();

  if (first !== second) {
    console.error(
      `check:content failed. Two back-to-back renders of ${ABOUT_SOURCE} differ, so the ` +
        `render is NOT deterministic, and its bytes go into the Worker bundle.`,
    );
    const diff = firstDifference(first, second);
    if (diff) {
      console.error(`  first difference at line ${diff.line}`);
      console.error(`  run 1: ${diff.committed.trim().slice(0, 200)}`);
      console.error(`  run 2: ${diff.fresh.trim().slice(0, 200)}`);
    }
    process.exit(1);
  }

  const about = JSON.parse(first);
  if (about.html.length < 200) {
    console.error(
      `check:content failed. ${ABOUT_SOURCE} rendered ${about.html.length} character(s) of ` +
        `HTML, floor 200. An empty or near-empty render is a valid artifact describing a ` +
        `blank page, which is the one failure here that looks like success.`,
    );
    process.exit(1);
  }

  console.log(
    `check:content ok. ${ABOUT_ARTIFACT_PATH} renders deterministically ` +
      `(${about.html.length} bytes of HTML, rendered twice).`,
  );
}

/**
 * THE FOURTH SUBJECT: math. ONE output carries the rendered form and every other the TeX an
 * author typed. THE SCOPE CONTROL COMES FIRST: every claim below is satisfied by a corpus with
 * no math, so one post WITH and one WITHOUT must exist. TWO DERIVATIONS OF `hasMath`, MADE TO
 * ARGUE, one from the mdast and one off the rendered html, which is what the ROUTE uses.
 *
 * @param {Array<{ slug: string, markdown: string, html: string, hasMath?: boolean,
 *   title: string, toc: any[], tags: string[], publishAt: any, draft: boolean }>} posts
 */
function checkMath(posts) {
  /** @type {string[]} */
  const problems = [];

  const withMath = posts.filter((post) => post.hasMath === true);
  const withoutMath = posts.filter((post) => post.hasMath !== true);

  if (withMath.length === 0 || withoutMath.length === 0) {
    console.error(
      `check:content failed. the corpus has ${withMath.length} post(s) with math and ` +
        `${withoutMath.length} without. Every math assertion below passes trivially over ` +
        `a corpus missing either side: with none, "no markdown carries KaTeX" is true of ` +
        `nothing, and with all, "a mathless post links no stylesheet" is. The fixture ` +
        `content/posts/math-typesetting-fixture.md exists to keep both sides populated.`,
    );
    process.exit(1);
    return;
  }

  for (const post of posts) {
    const astSaysMath = post.hasMath === true;
    const htmlSaysMath = htmlHasMath(post.html);
    if (astSaysMath !== htmlSaysMath) {
      problems.push(
        `${post.slug}: the renderer's AST flag says ${astSaysMath} and htmlHasMath says ` +
          `${htmlSaysMath}. The route reads the second, so they cannot differ.`,
      );
    }

    /* NO ERROR BOX, EVER: the validator exists so rehype-katex's `katex-error` path is unreachable. */
    if (post.html.includes("katex-error")) {
      problems.push(
        `${post.slug}: the rendered html carries a katex-error span. An expression ` +
          `reached rehype-katex's fallback render, which remarkMathValidate is supposed ` +
          `to make impossible.`,
      );
    }

    /*
     * THE MARKDOWN SIDE, four outputs at once: `posts.body` is what the twin, llms-full, the JSON
     * feed and the Accept representation all serve unmodified.
     */
    if (post.markdown.includes("katex")) {
      problems.push(
        `${post.slug}: the stored markdown carries the string "katex". The four outputs ` +
          `that serve posts.body verbatim would carry it too.`,
      );
    }
    if (astSaysMath && !/\$/.test(post.markdown)) {
      problems.push(
        `${post.slug}: the renderer found math but the stored markdown has no "$" in it, ` +
          `so the .md twin, llms-full.txt and the JSON feed carry no expression at all.`,
      );
    }

    /* THE HTML SIDE, carrying BOTH trees: a silent drop to html-only takes the MathML away. */
    if (astSaysMath) {
      if (!post.html.includes("<math")) {
        problems.push(
          `${post.slug}: the rendered html carries no <math> element, so the output mode ` +
            `is no longer htmlAndMathml and a screen reader gets the layout tree only.`,
        );
      }
      if (!post.html.includes('<annotation encoding="application/x-tex">')) {
        problems.push(
          `${post.slug}: the rendered html carries no x-tex annotation. That annotation is ` +
            `what mathToTex reads to put the feeds back to source, so the feeds would ` +
            `silently keep their markup.`,
        );
      }
    }

    /* THE FEED SIDE, through the transform the feeds call, over the REAL corpus. */
    const feedBody = mathToTex(post.html);
    if (feedBody.includes("katex")) {
      problems.push(
        `${post.slug}: mathToTex left KaTeX markup in the feed body, so RSS and Atom ` +
          `would ship an expression rendered twice and garbled both times.`,
      );
    }
    if (astSaysMath && !feedBody.includes("$")) {
      problems.push(`${post.slug}: mathToTex removed the math and left no TeX behind.`);
    }
  }

  /*
   * THE SEARCH AND ASK SIDE: both indexes are built from the MARKDOWN, so markup would be span
   * soup in a snippet and in the Ask context.
   */
  const records = recordsForPosts(
    posts.map((post) => ({
      slug: post.slug,
      title: post.title,
      markdown: post.markdown,
      body: post.markdown,
      toc: post.toc,
      tags: post.tags,
      publishAt: post.publishAt,
      draft: post.draft,
    })),
  );
  if (records.length === 0) {
    console.error(
      `check:content failed. recordsForPosts produced 0 record(s) over ${posts.length} ` +
        `post(s), so every search assertion below is about an empty set.`,
    );
    process.exit(1);
    return;
  }
  const markupRecords = records.filter((r) => String(r.body ?? "").includes("katex"));
  if (markupRecords.length > 0) {
    problems.push(
      `${markupRecords.length} search record(s) carry KaTeX markup, starting with ` +
        `${markupRecords[0].uid}. The index is built from markdown and should carry TeX.`,
    );
  }

  if (problems.length > 0) {
    console.error(`check:content failed. ${problems.length} math output problem(s):`);
    console.error(nameThem(problems));
    process.exit(1);
    return;
  }

  const expressions = withMath.reduce(
    (n, post) => n + (post.html.match(/<annotation encoding="application\/x-tex">/g) ?? []).length,
    0,
  );
  console.log(
    `check:content ok. math outputs agree across ${posts.length} post(s): ` +
      `${withMath.length} with math (${expressions} expression(s)), ${withoutMath.length} ` +
      `without, ${records.length} search record(s) carrying TeX rather than markup.`,
  );
}

/**
 * REQUIRED, not tidiness: a post DOCUMENTING the directive writes it inside a fence, where it is
 * literal text, so matching raw markdown fails a correct post. Hard rule 10's satisfied anchor.
 *
 * @param {string} markdown
 */
function prosePart(markdown) {
  return markdown.replace(/^```[\s\S]*?^```/gm, "").replace(/`[^`\n]*`/g, "");
}

/**
 * THE FIFTH SUBJECT: swatches. **The rendered chip exists in the HTML and NOWHERE ELSE**, since
 * `posts.body` is served verbatim to six consumers. TWO DERIVATIONS, MADE TO ARGUE: one checked
 * against itself passes on a pipeline that had stopped running.
 *
 * @param {Array<{ slug: string, markdown: string, html: string }>} posts
 */
function checkSwatches(posts) {
  /** @type {string[]} */
  const problems = [];

  const withSwatch = posts.filter((post) => post.html.includes('class="swatch-chip"'));
  const withoutSwatch = posts.filter((post) => !post.html.includes('class="swatch-chip"'));

  if (withSwatch.length === 0 || withoutSwatch.length === 0) {
    console.error(
      `check:content failed. the corpus has ${withSwatch.length} post(s) carrying a rendered ` +
        `swatch and ${withoutSwatch.length} without. Every assertion below passes trivially ` +
        `over a corpus missing either side: with none, "no markdown carries chip markup" is ` +
        `true of nothing, and with all, "a swatchless post renders no chip" is. The fixture ` +
        `content/posts/swatches-in-prose-fixture.md exists to keep both sides populated.`,
    );
    process.exit(1);
    return;
  }

  let chips = 0;
  for (const post of posts) {
    const htmlSaysSwatch = post.html.includes('class="swatch-chip"');
    const sourceSaysSwatch = /:swatch\[/.test(prosePart(post.markdown));

    if (sourceSaysSwatch !== htmlSaysSwatch) {
      problems.push(
        `${post.slug}: the markdown ${sourceSaysSwatch ? "carries" : "carries no"} :swatch ` +
          `directive outside code, and the rendered html ${htmlSaysSwatch ? "carries" : "carries no"} ` +
          `chip. One of the two is wrong: a directive that renders nothing is a colour the ` +
          `reader never sees, and a chip with no directive behind it is markup from somewhere ` +
          `this pipeline does not control.`,
      );
    }

    /*
     * THE MARKDOWN SIDE, which is SIX outputs at once: if `posts.body` held chip markup, all six
     * would.
     */
    if (post.markdown.includes("swatch-chip") || post.markdown.includes('class="swatch"')) {
      problems.push(
        `${post.slug}: the stored markdown carries the rendered chip's markup. The .md twin, ` +
          `llms-full.txt, the JSON feed, the text/markdown representation and both indexes ` +
          `serve posts.body verbatim, so all of them would ship a <span> where the source ` +
          `should carry :swatch[...].`,
      );
    }
    if (htmlSaysSwatch && !post.markdown.includes(":swatch[")) {
      problems.push(
        `${post.slug}: the html carries a chip but the stored markdown has no ":swatch[" in ` +
          `it, so the .md twin, the feeds and llms-full.txt carry no colour at all.`,
      );
    }

    /* THE CASE FOLD, on the OUTPUT rather than the validator, so it is a property of the artifact. */
    for (const match of post.html.matchAll(/--swatch:(#[0-9A-Fa-f]+)/g)) {
      chips += 1;
      if (match[1] !== match[1].toUpperCase()) {
        problems.push(
          `${post.slug}: a chip carries ${match[1]}, which is not upper case. Two spellings ` +
            `of one colour would render as two different pages.`,
        );
      }
    }
  }

  /* THE SEARCH AND ASK SIDE, same builder, same reason: chip markup is span soup in a snippet. */
  const records = recordsForPosts(
    posts.map((post) => ({
      slug: post.slug,
      title: /** @type {any} */ (post).title,
      markdown: post.markdown,
      body: post.markdown,
      toc: /** @type {any} */ (post).toc,
      tags: /** @type {any} */ (post).tags,
      publishAt: /** @type {any} */ (post).publishAt,
      draft: /** @type {any} */ (post).draft,
    })),
  );
  if (records.length === 0) {
    console.error(
      `check:content failed. recordsForPosts produced 0 record(s) over ${posts.length} ` +
        `post(s), so the search assertion below is about an empty set.`,
    );
    process.exit(1);
    return;
  }
  const markupRecords = records.filter((r) => String(r.body ?? "").includes("swatch-chip"));
  if (markupRecords.length > 0) {
    problems.push(
      `${markupRecords.length} search record(s) carry chip markup, starting with ` +
        `${markupRecords[0].uid}. The index is built from markdown and should carry ` +
        `the directive source.`,
    );
  }

  if (problems.length > 0) {
    console.error(`check:content failed. ${problems.length} swatch output problem(s):`);
    console.error(nameThem(problems));
    process.exit(1);
    return;
  }

  console.log(
    `check:content ok. swatch outputs agree across ${posts.length} post(s): ` +
      `${withSwatch.length} with swatches (${chips} chip(s), every hex upper case), ` +
      `${withoutSwatch.length} without, ${records.length} search record(s) carrying the ` +
      `directive source rather than markup.`,
  );
}

/**
 * THE FIFTH GENERATED ARTIFACT: the math stylesheet and its faces, derived from the INSTALLED
 * katex, so a bump without a rebuild emits a class the stylesheet has no rule for. Faces
 * reconciled BOTH ways: a missing one is a silent system font, a stale one a binary nobody deletes.
 */
async function checkKatexArtifact() {
  /** @type {{ css: string, faces: string[], version: string }} */
  let derived;
  try {
    derived = generateKatexCss();
  } catch (error) {
    console.error(
      `check:content failed. the math stylesheet could not be derived from the installed ` +
        `katex package: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
    return;
  }

  /** @type {string} */
  let committed;
  try {
    committed = await readFile(KATEX_CSS_PATH, "utf8");
  } catch {
    console.error(
      `check:content failed. ${KATEX_CSS_PATH} is missing or unreadable. ` +
        `Run npm run build:katex.`,
    );
    process.exit(1);
    return;
  }

  if (committed !== derived.css) {
    const diff = firstDifference(committed, derived.css);
    console.error(
      `check:content failed. ${KATEX_CSS_PATH} differs from a fresh derivation of ` +
        `katex ${derived.version} plus app/styles/katex-overrides.css.`,
    );
    if (diff) {
      console.error(`  first difference at line ${diff.line}`);
      console.error(`  committed: ${diff.committed.trim().slice(0, 200)}`);
      console.error(`  fresh:     ${diff.fresh.trim().slice(0, 200)}`);
    }
    console.error("  Run npm run build:katex and commit the result.");
    process.exit(1);
    return;
  }

  /* SCOPE, ASSERTED first: a derivation naming zero faces agrees with an empty directory. */
  if (derived.faces.length < 20) {
    console.error(
      `check:content failed. the math stylesheet names ${derived.faces.length} font face(s), ` +
        `floor 20, measured 20 for katex ${derived.version}. Fewer means the woff2 trim in ` +
        `build-katex.mjs has started removing faces rather than formats.`,
    );
    process.exit(1);
    return;
  }

  /** @type {string[]} */
  let onDisk;
  try {
    onDisk = (await readdir(KATEX_FONT_DIR)).sort();
  } catch {
    console.error(
      `check:content failed. ${KATEX_FONT_DIR}/ is missing. Run npm run build:katex.`,
    );
    process.exit(1);
    return;
  }

  const missing = derived.faces.filter((face) => !onDisk.includes(face));
  const orphaned = onDisk.filter((face) => !derived.faces.includes(face));
  if (missing.length > 0 || orphaned.length > 0) {
    console.error(
      `check:content failed. ${KATEX_FONT_DIR}/ does not match the faces the stylesheet ` +
        `names.`,
    );
    if (missing.length > 0) {
      console.error(`  named and not on disk (a 404 and a silent system-font fallback):`);
      console.error(nameThem(missing));
    }
    if (orphaned.length > 0) {
      console.error(`  on disk and not named (stale binaries after a version bump):`);
      console.error(nameThem(orphaned));
    }
    console.error("  Run npm run build:katex and commit the result.");
    process.exit(1);
    return;
  }

  const bytes = (
    await Promise.all(derived.faces.map((f) => stat(join(KATEX_FONT_DIR, f))))
  ).reduce((n, s) => n + s.size, 0);

  console.log(
    `check:content ok. ${KATEX_CSS_PATH} matches a fresh derivation of katex ` +
      `${derived.version} (${Buffer.byteLength(committed)} bytes), and ${onDisk.length} ` +
      `woff2 face(s) totalling ${bytes} bytes reconcile with it in both directions.`,
  );
}

/**
 * EVERY `/blog/` LINK IN `further_reading` NAMES A POST THAT EXISTS: the schema decides a url's
 * SHAPE and not its TARGET. A BUILD FAILURE rather than a warning, and **the examined count is
 * printed**, because no corpus post sets the field.
 *
 * @param {Array<{ slug: string, furtherReading?: Array<{ title: string, url: string }> }>} posts
 */
function checkInternalFurtherReading(posts) {
  const known = new Set(posts.map((post) => post.slug));
  /** @type {string[]} */
  const dead = [];
  let examined = 0;

  for (const post of posts) {
    for (const item of post.furtherReading ?? []) {
      const target = internalLinkSlug(item.url);
      // External links are out of scope: a check that fails on somebody else's outage is not a gate.
      if (target === null) continue;
      examined += 1;
      if (!known.has(target)) dead.push(`${post.slug} -> ${item.url}`);
    }
  }

  if (dead.length > 0) {
    console.error(
      `check:content failed. ${dead.length} further_reading link(s) point at a post ` +
        `that does not exist:`,
    );
    console.error(nameThem(dead));
    process.exit(1);
    return;
  }

  console.log(
    `check:content ok. ${examined} internal further_reading link(s) resolve to a post ` +
      `(${known.size} slug(s) in the corpus).`,
  );
}

/**
 * THE SECOND GENERATED ARTIFACT. A stale `template-refs.json` prints a SENTENCE ABOUT EVIDENCE
 * that no longer matches it. **The scope numbers are asserted separately**, because a scan that
 * read zero files and one that found zero references print the same empty `refs`.
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
  // SCOPE, ASSERTED: an empty `refs` from a broken walk and one from a repository that cites
  // nothing are the same bytes. Floors rather than equalities. SET BY HAND, because this gate is
  // not in the sweep, so nothing re-measures them and the trigger is touching this file.
  if (!(parsed.filesRead >= 221)) {
    console.error(
      `check:content failed. the template scan read ${parsed.filesRead} source file(s), ` +
        `floor 221, measured 233. A zero-scope scan reports "no references" and looks correct.`,
    );
    process.exit(1);
    return;
  }
  if (!(parsed.assetsConsidered >= 56)) {
    console.error(
      `check:content failed. the template scan considered ${parsed.assetsConsidered} asset(s), ` +
        `floor 56, measured 59. The asset manifest is empty or was not loaded.`,
    );
    process.exit(1);
    return;
  }
  /*
   * AND THE ONE CASE THE FEATURE EXISTS FOR: the cohort photographs are referenced by a data
   * module and no post. Named explicitly, because a byte comparison passes when BOTH sides are wrong.
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
 * THE THIRD GENERATED ARTIFACT. **A Worker cannot list its own static assets**, so the media
 * rebuild reads this file to discover what exists, and a missing entry is a file never indexed.
 * WHAT IT CANNOT SEE: it compares the manifest to THE FILESYSTEM; manifest-to-D1 is check:media's.
 */
async function checkAssetManifest() {
  const files = await walkPublic();

  // FAILS CLOSED ON AN EMPTY WALK: a broken walk and an empty directory produce the same array.
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
  /** @type {Record<string, { sha?: string, lqip?: string }>} */
  let manifestPlaceholders;
  try {
    const parsed = JSON.parse(await readFile(ASSET_MANIFEST_PATH, "utf8"));
    // `?? []` is deliberately absent: it turns a broken artifact into "every file is missing".
    if (!Array.isArray(parsed.paths)) throw new Error("no `paths` array");
    // Same rule for the second half: absent is broken, not empty.
    if (!parsed.placeholders || typeof parsed.placeholders !== "object") {
      throw new Error("no `placeholders` object");
    }
    manifestPaths = parsed.paths;
    manifestPlaceholders = parsed.placeholders;
  } catch (error) {
    console.error(
      `check:content failed. ${ASSET_MANIFEST_PATH} is missing or unparseable ` +
        `(${error instanceof Error ? error.message : String(error)}). Run npm run build:assets.`,
    );
    process.exit(1);
    return;
  }

  // Order as well as membership, compared as JSON: `walkPublic()` sorts, so unsorted is a hand edit.
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
  await checkManifestPlaceholders(files, manifestPlaceholders);

  console.log(
    `check:content ok. ${ASSET_MANIFEST_PATH} matches ${PUBLIC_DIR}/ ` +
      `(${files.length} file(s), none of them gitignored, ` +
      `${Object.keys(manifestPlaceholders).length} with a body placeholder).`,
  );
}

/**
 * THE PLACEHOLDER HALF OF THE MANIFEST, reconciled three ways. A placeholder is baked into the
 * HTML this gate byte-compares, so a stale one is a value both writers agree on.
 *
 *   1. MEMBERSHIP, both directions, by the same function `build:assets` uses.
 *   2. THE SOURCE DIGEST, because membership cannot see a file EDITED IN PLACE.
 *   3. THE STORED VALUE, through the SAME function check:image-weight uses on D1.
 *
 * IT DOES NOT RE-ENCODE: that compares this machine's sharp against the writer's.
 *
 * @param {string[]} files every path under public/, from the walk
 * @param {Record<string, { sha?: string, lqip?: string }>} placeholders
 */
async function checkManifestPlaceholders(files, placeholders) {
  const wanted = placeholderPaths(files);

  // FAILS CLOSED ON AN EMPTY EXPECTATION: a classifier naming nothing agrees with an empty manifest.
  if (wanted.length === 0) {
    console.error(
      `check:content failed. the walk found 0 content raster image(s) under ` +
        `${PUBLIC_DIR}/, so every placeholder assertion would pass vacuously.`,
    );
    process.exit(1);
    return;
  }

  const have = new Set(Object.keys(placeholders));
  const missing = wanted.filter((p) => !have.has(p));
  const extra = [...have].filter((p) => !wanted.includes(p));
  /** @type {string[]} */
  const stale = [];
  /** @type {string[]} */
  const malformed = [];
  let verified = 0;

  for (const p of wanted) {
    const entry = placeholders[p];
    if (!entry) continue;
    const bytes = await readFile(path.join(PUBLIC_DIR, p.slice(1)));
    const sha = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    if (entry.sha !== sha) {
      stale.push(`${p}: manifest records ${entry.sha}, the file hashes ${sha}`);
      continue;
    }
    malformed.push(...placeholderProblems(p, String(entry.lqip ?? "")));
    verified += 1;
  }

  if (missing.length + extra.length + stale.length + malformed.length > 0) {
    console.error(`check:content failed. ${ASSET_MANIFEST_PATH} placeholders are out of date.`);
    if (missing.length > 0) {
      console.error(`  ${missing.length} content image(s) with no placeholder:`);
      console.error(nameThem(missing));
    }
    if (extra.length > 0) {
      console.error(`  ${extra.length} placeholder(s) for a path that is not a content image:`);
      console.error(nameThem(extra));
    }
    for (const s of stale) console.error(`  STALE  ${s}`);
    for (const m of malformed) console.error(`  BAD    ${m}`);
    console.error("  Run npm run build:assets and commit the result.");
    process.exit(1);
    return;
  }

  // The executed count, paired with the content check, so "0 problems" cannot mean "0 examined".
  if (verified !== wanted.length) {
    console.error(
      `check:content failed. ${verified} of ${wanted.length} placeholder(s) were verified.`,
    );
    process.exit(1);
  }
}

/**
 * A path may not be BOTH gitignored and in the manifest: the manifest is committed, so a
 * gitignored file enters it on one machine and exists in no clone, and the artifact has started
 * describing A DISK. Two things make that live: `npm run deploy` builds from the WORKING TREE,
 * and `check:head` extracts a ref into a worktree where the file is absent. `git check-ignore`
 * rather than parsing `.gitignore`: a second implementation would be wrong invisibly.
 *
 * @param {string[]} manifestPaths site-absolute, as the manifest stores them
 */
async function checkManifestIsRepoWide(manifestPaths) {
  // SCOPE, ASSERTED FIRST: "nothing ignored" is also what an empty list and a silent git report.
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

  // Exit 0 means at least one path IS ignored, 1 none, anything else git failing. FAIL CLOSED on
  // the third, the branch that would turn a missing git into a silent pass forever.
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
