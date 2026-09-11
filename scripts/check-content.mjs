/**
 * Gate for the content build and the committed artifacts under
 * `content/generated/`.
 *
 * OBSERVATION BOUNDARY: it renders and compares locally. It never renders a
 * page in a Worker, never queries D1, and cannot tell whether the rows the
 * sync writes match what it rendered; that comparison is ship's drift report
 * and the content-drift health check.
 *
 * FIVE subjects. The first three are the artifact arc's; the last two arrived
 * with math on 2026-09-06 and are 4 and 5 below.
 *
 *   1. THE CORPUS RENDER IS VALID AND DETERMINISTIC. posts.json stopped being
 *      committed (git holds markdown; D1 holds the only rendered copy), so
 *      there is no committed copy to byte-compare. What replaced the byte
 *      gate: the corpus is rendered TWICE in one process and the two outputs
 *      must be byte-identical, because a nondeterministic render is exactly
 *      what would surface later as false render-drift between the Worker and
 *      the Node build. A slug whose two renders differ is named. Rendering at
 *      all is also the validation half: a post the pipeline refuses fails
 *      here, offline, before any writer meets it.
 *   1b. THE ABOUT PAGE, on the corpus's footing: rendered twice and
 *      byte-compared, and the render is the validation. It is a build
 *      product, gitignored like `posts.json` and `stack.json`, but unlike
 *      those two its bytes go into the WORKER BUNDLE, because
 *      `app/routes/about.tsx` imports it statically. A nondeterministic
 *      render of it is therefore a deploy that differs from the one before
 *      it for no reason anybody wrote down.
 *   2. `template-refs.json`, byte-compared against a fresh scan. STILL
 *      COMMITTED, deliberately: it is a repo fact with no database owner.
 *   3. `assets.json`, byte-compared against a walk of `public/`, with the
 *      gitignore tripwire. Also still committed.
 *   4. MATH OUTPUTS. One output carries the rendered form and every other one
 *      carries the TeX an author typed, and that distinction lives in five
 *      modules with nothing else comparing them. Includes the scope control
 *      that keeps the whole section from passing over a corpus with no math in
 *      it, and the two independent derivations of `hasMath` made to argue.
 *   5. `katex.generated.css` AND ITS FACES, byte-compared against a fresh
 *      derivation from the installed katex package, faces reconciled both ways.
 *
 * This check fails closed: a generator that throws is a failure, never a pass.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path, { join } from "node:path";
import { createHash } from "node:crypto";

import { ABOUT_ARTIFACT_PATH, ABOUT_SOURCE, buildAbout, buildArtifact } from "./build-content.mjs";
import { TEMPLATE_REFS_PATH, scanTemplateRefs } from "./build-template-refs.mjs";
import { ASSET_MANIFEST_PATH, PUBLIC_DIR, placeholderPaths, walkPublic } from "./build-assets.mjs";
/* The one statement of what a stored placeholder IS, imported rather than
   restated. That gate owns the assertion for the D1 column; this artifact has
   to satisfy the same one, and a second copy here is how the two would come to
   disagree about a defect they were both written for. */
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
  /*
   * TWICE, IN ONE PROCESS. Rendering once proves validity; rendering twice
   * and comparing proves the render depends on the sources alone. Any clock,
   * counter or iteration-order dependence shows up as a byte difference
   * between two back-to-back runs, and that same dependence is what would
   * later read as Worker-versus-Node render drift in ship's report with
   * nothing at fault but this pipeline. One process on purpose: a module
   * memo (the highlighter, the WASM engine) is shared, so a difference here
   * is the render's own, not an environment's.
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
 * The About page renders, renders the same way twice, and says something.
 *
 * ## THE SAME CLAIMS THE CORPUS GETS, AND ONE MORE
 *
 * RENDERING AT ALL IS THE VALIDATION. `buildAbout` throws on missing
 * frontmatter, on an image (there is no resolver on this page), and on a link
 * the URL allowlist demoted. A page that cannot be built fails here, offline,
 * rather than shipping with a dead anchor or an empty title tag.
 *
 * TWICE, BYTE-COMPARED, for the corpus's reason and one of its own. The
 * general reason is that a clock, a counter or an iteration order in the
 * pipeline shows up as a difference between two back-to-back runs. The
 * specific one is that `content/generated/about.json` is imported STATICALLY
 * by `app/routes/about.tsx`, so its bytes sit inside the Worker bundle: a
 * nondeterministic render here makes two deploys of one commit differ, which
 * is the property blocking `npm run deploy` from a dirty tree exists to
 * protect.
 *
 * NOT EMPTY, and this is the extra claim. `renderBody` over an empty body
 * returns an empty string and throws nothing, so a truncated or mis-parsed
 * `content/about.md` produces a perfectly valid artifact describing a blank
 * page. That is the failure here that looks most like success.
 *
 * THE FLOOR IS DELIBERATELY LOW. It is a scope check against nothing at all,
 * not a word count: a page whose length a gate polices is a page nobody can
 * edit, and this one exists to be edited on taste.
 *
 * WHAT IT DOES NOT CHECK: whether a single sentence is true. Nothing can.
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
 * THE FOURTH SUBJECT: math, and what each output carries of it.
 *
 * The determinism pass above already covers KaTeX for free, because a
 * nondeterministic renderer would move the bytes between two runs. What it
 * cannot see is the thing the math arc actually decided, which is that ONE
 * output carries the rendered form and every other one carries the TeX an
 * author typed. That distinction lives in five different modules and nothing
 * else compares them.
 *
 * ## THE SCOPE CONTROL COMES FIRST, and it is the assertion that matters most
 *
 * Every claim below is of the form "no post's markdown carries KaTeX markup",
 * and a corpus with no math in it satisfies every one of them perfectly. That
 * is the clean-sweep-over-an-empty-scope shape this file already guards against
 * for `further_reading`. So the first thing asserted is that the corpus
 * contains at least one post WITH math and at least one WITHOUT: the fixture
 * `math-typesetting-fixture` provides the first and the other twelve the
 * second. Delete the fixture and this gate fails rather than going quietly
 * vacuous.
 *
 * ## TWO DERIVATIONS OF `hasMath`, MADE TO ARGUE
 *
 * `remarkMathValidate` sets the flag from the mdast, before anything is
 * rendered. `htmlHasMath` reads it back off the rendered html, and is what the
 * ROUTE uses to decide whether to link the stylesheet. They are computed at
 * different times from different artifacts by different code, and if they ever
 * disagree the page is either downloading 3 kB it does not need or rendering
 * math with no stylesheet. Comparing them is the only thing that can notice.
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

    /*
     * NO ERROR BOX, EVER, on any post. This is the assertion that proves
     * `remarkMathValidate` is doing its job rather than merely existing:
     * rehype-katex's own failure path emits `class="katex-error"`, and the
     * validator exists precisely so that path is unreachable. If this ever
     * fires, an expression got past the validator and shipped a red box.
     */
    if (post.html.includes("katex-error")) {
      problems.push(
        `${post.slug}: the rendered html carries a katex-error span. An expression ` +
          `reached rehype-katex's fallback render, which remarkMathValidate is supposed ` +
          `to make impossible.`,
      );
    }

    /*
     * THE MARKDOWN SIDE, which is FOUR outputs at once and is why it is
     * asserted on the record rather than per route: `posts.body` is what
     * `/blog/:slug.md`, `llms-full.txt`, the JSON feed's `content_text` and the
     * `Accept: text/markdown` representation all serve, unmodified. If the
     * source held markup, all four would.
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

    /* THE HTML SIDE. The one output that carries the rendered form, and it
       carries BOTH trees, because htmlAndMathml is the ruled output mode and a
       silent drop to html-only would take the MathML away from a screen reader
       with nothing else noticing. */
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

    /* THE FEED SIDE, asserted through the transform the feeds actually call.
       `test/math-outputs.test.mjs` owns the item markup; this owns the claim
       over the REAL corpus, which no fixture can make. */
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
   * THE SEARCH AND ASK SIDE. Both indexes are built by `recordsForPosts` from
   * the MARKDOWN, so what they carry is the TeX source; this proves it over the
   * corpus rather than by reading that module. A record carrying markup would
   * put span soup into a search snippet and into the Ask context window.
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
 * The prose of a post, with every code fence and code span removed.
 *
 * REQUIRED, not tidiness. A post that DOCUMENTS the directive writes
 * `:swatch[#6B4FBB]` inside a fence, where it is literal text and renders no
 * chip. Matching the raw markdown would read that as a swatch that failed to
 * render and fail the build on a post that is correct, which is the
 * comment-satisfied-anchor class in hard rule 10 wearing a different syntax:
 * strip the region that cannot mean what you are looking for, then match.
 *
 * The swatch fixture carries exactly that case on purpose, so this stripping is
 * exercised by the corpus rather than only asserted here.
 *
 * @param {string} markdown
 */
function prosePart(markdown) {
  return markdown.replace(/^```[\s\S]*?^```/gm, "").replace(/`[^`\n]*`/g, "");
}

/**
 * THE FIFTH SUBJECT: swatches, and what each output carries of one.
 *
 * The claim, in one line: **the rendered chip exists in the HTML and NOWHERE
 * ELSE.** `posts.body` is served verbatim by `/blog/:slug.md`, `llms-full.txt`,
 * the JSON feed's `content_text` and the `Accept: text/markdown`
 * representation, and it is what `recordsForPosts` indexes for search and Ask.
 * All six of those carry the directive as the author typed it. If a chip's
 * markup ever reached `posts.body`, every one of them would ship a `<span>` in
 * place of a colour.
 *
 * TWO DERIVATIONS, MADE TO ARGUE, which is the shape `checkMath` uses: the
 * source side reads the markdown for the directive, the html side reads the
 * rendered output for the chip, and a disagreement in either direction is a
 * failure. One derivation checked against itself would pass on a pipeline that
 * had stopped running entirely.
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
     * THE MARKDOWN SIDE, which is SIX outputs at once and is why it is asserted
     * on the record rather than per route. If `posts.body` held chip markup,
     * all six would.
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

    /*
     * THE CASE FOLD, asserted on the OUTPUT rather than on the validator. The
     * renderer uppercases every hex so two spellings of one colour produce one
     * page; this is what makes that a property of the artifact instead of a
     * claim in a docstring.
     */
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

  /*
   * THE SEARCH AND ASK SIDE, through the same builder `checkMath` uses and for
   * the same reason: both indexes are built from the MARKDOWN, so what they
   * carry is the directive source. A record carrying chip markup would put span
   * soup into a search snippet and into the Ask context window.
   */
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
 * THE FIFTH GENERATED ARTIFACT: the math stylesheet and its font faces.
 *
 * Same contract as `template-refs.json` above, and it exists for a failure that
 * is invisible in every other direction. `app/styles/katex.generated.css` is
 * derived from the INSTALLED katex package, and the markup it styles is
 * produced by that same package at build time. Bump katex without running
 * `npm run build:katex` and the two go out of step: the renderer starts
 * emitting a class the committed stylesheet has no rule for, and the symptom is
 * an equation that is slightly wrong on a page nobody is looking at.
 *
 * Byte-compared against a fresh derivation, and the FACES are reconciled in
 * BOTH directions: a face the stylesheet names and the repo does not hold is a
 * 404 that falls back to a system font silently, and a face on disk the
 * stylesheet no longer names is a stale binary nobody will ever delete.
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

  /*
   * SCOPE, ASSERTED, before either direction is compared. A derivation that
   * named zero faces would agree with an empty directory, and both would look
   * like a clean reconciliation.
   */
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
 * EVERY `/blog/` LINK IN `further_reading` NAMES A POST THAT EXISTS.
 *
 * The schema decides the SHAPE of a url and cannot decide its TARGET: nothing
 * in `frontmatterSchema` knows which slugs the corpus holds, so a link to a
 * post that was later deleted or renamed is valid frontmatter and a dead link
 * on a live page. Internal links only became expressible when the schema was
 * widened to accept a `/blog/` path, so this gate lands with the widening
 * rather than after the first dead link.
 *
 * A BUILD FAILURE rather than a warning, which is the point of the request: a
 * deleted post should stop the build, not ship. `check:content` runs in the
 * offline tier, so it fails before a deploy and before CI goes green.
 *
 * **THE EXAMINED COUNT IS PRINTED, and today it is zero.** No corpus post sets
 * `further_reading`, so a silent "ok" here would be the clean-sweep-over-an-
 * empty-scope shape in FAILURES.md: indistinguishable from a gate that checked
 * nothing because it was broken. The line says how many links it resolved, so
 * a reader can tell "none to check" from "all fine". The gate's real proof is
 * a planted dead link, not a green run over an empty corpus.
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
      // External links are out of scope: nothing offline can say whether a
      // third-party URL still resolves, and pretending otherwise would be a
      // check that fails on somebody else's outage.
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
  // RE-MEASURED 2026-09-06 through this gate by running it: 233 files read, 59
  // assets considered. Set to count minus check:floors' own tolerance,
  // max(3, ceil(count * 0.05)), which is the sweep's rule applied by hand.
  //
  // BY HAND BECAUSE THIS GATE IS NOT IN THE SWEEP. These are bespoke scope
  // floors rather than executed-count floors, so this file prints no
  // `floor check:content:...` line and check:floors names it in the gates it
  // deliberately does not read. Nothing re-measures them automatically; the
  // trigger is touching this file, which is what happened here.
  //
  // The drift they had accumulated is exactly what the sweep exists to catch:
  // the file floor was 168 against 183 when it was last set on 2026-08-24, and
  // the tree had grown to 233 by today with the floor unmoved, so 65 source
  // files could have stopped being walked and the assertion that exists to
  // notice that would have reported clean.
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
  /** @type {Record<string, { sha?: string, lqip?: string }>} */
  let manifestPlaceholders;
  try {
    const parsed = JSON.parse(await readFile(ASSET_MANIFEST_PATH, "utf8"));
    // `?? []` is deliberately absent. A manifest whose `paths` key is missing is
    // a broken artifact, and defaulting it to an empty array would turn that
    // into "every file is missing from the manifest", which is a true statement
    // that names the wrong defect.
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
  await checkManifestPlaceholders(files, manifestPlaceholders);

  console.log(
    `check:content ok. ${ASSET_MANIFEST_PATH} matches ${PUBLIC_DIR}/ ` +
      `(${files.length} file(s), none of them gitignored, ` +
      `${Object.keys(manifestPlaceholders).length} with a body placeholder).`,
  );
}

/**
 * THE PLACEHOLDER HALF OF THE MANIFEST, reconciled three ways.
 *
 * A placeholder is baked into the rendered HTML that this same gate byte
 * compares, so a stale one is not a cosmetic problem: it is a value both
 * writers agree on and neither can check, which is the shape finding B002 had.
 *
 *   1. MEMBERSHIP, both directions. The set is derived from the walk by
 *      `placeholderPaths`, the same function `build:assets` uses, so an image
 *      added to `public/` without a rebuild is named, and an entry whose file
 *      is gone is named. A one-directional check would pass on either.
 *   2. THE SOURCE DIGEST. Membership cannot see a file EDITED IN PLACE, and a
 *      `public/` path is not content addressed, so that is the one way a static
 *      asset changes. The file is re-hashed here and compared against the
 *      digest the manifest recorded.
 *   3. THE STORED VALUE IS A LOSSY WEBP DATA URI, through the SAME function
 *      `check:image-weight` uses on the D1 column. One statement of what a
 *      placeholder is, two artifacts that must satisfy it.
 *
 * IT DOES NOT RE-ENCODE. That would compare this machine's sharp against the
 * one that wrote the manifest, and two platforms differing by a byte in a WebP
 * encoder would make the gate fail on Linux and pass on Windows. The digest
 * answers staleness without asserting anything about the encoder.
 *
 * @param {string[]} files every path under public/, from the walk
 * @param {Record<string, { sha?: string, lqip?: string }>} placeholders
 */
async function checkManifestPlaceholders(files, placeholders) {
  const wanted = placeholderPaths(files);

  // FAILS CLOSED ON AN EMPTY EXPECTATION, the discipline this file applies to
  // every other derived set: if the classifier stopped calling anything a
  // content raster, every comparison below would agree with an empty manifest.
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

  // The executed count, paired with the content check, so "0 problems" cannot
  // mean "0 examined". `wanted.length` is floored above; this is what was
  // actually hashed and decoded.
  if (verified !== wanted.length) {
    console.error(
      `check:content failed. ${verified} of ${wanted.length} placeholder(s) were verified.`,
    );
    process.exit(1);
  }
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
