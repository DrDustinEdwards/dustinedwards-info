/**
 * Gate for the posts: the corpus and the About page render, render deterministically, and their
 * math, swatches and internal further-reading links are valid.
 *
 *   npm run check:content
 *
 * BOUNDARY: it renders locally, never in a Worker and never against D1, so whether the rows match
 * what it rendered is ship's drift report's. It does not compare committed generated files against
 * a fresh build (ruling 150); the build scripts regenerate them.
 */

import { ABOUT_ARTIFACT_PATH, ABOUT_SOURCE, buildAbout, buildArtifact } from "./build-content.mjs";
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
 * literal text, so matching raw markdown fails a correct post. The vacuity rule's satisfied anchor.
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
          `chip. One of the two is wrong: a directive that renders nothing is a color the ` +
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
          `it, so the .md twin, the feeds and llms-full.txt carry no color at all.`,
      );
    }

    /* THE CASE FOLD, on the OUTPUT rather than the validator, so it is a property of the artifact. */
    for (const match of post.html.matchAll(/--swatch:(#[0-9A-Fa-f]+)/g)) {
      chips += 1;
      if (match[1] !== match[1].toUpperCase()) {
        problems.push(
          `${post.slug}: a chip carries ${match[1]}, which is not upper case. Two spellings ` +
            `of one color would render as two different pages.`,
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

main().catch((/** @type {unknown} */ error) => {
  console.error(
    `check:content failed. ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
