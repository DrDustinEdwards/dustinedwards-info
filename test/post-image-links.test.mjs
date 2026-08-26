/**
 * Every body image is a link to its ORIGINAL file.
 *
 * ## The defect this replays
 *
 * `srcset` hands the browser a closed ladder of widths, so what a reader has
 * downloaded is a resized copy, never the file the author uploaded. The
 * lightbox opened `image.currentSrc`, which is exactly that resized copy, so
 * the one control promising "full size" delivered the size already on screen,
 * and a reader with script off had no route to the original at all. Recorded
 * as false in `content/enhancements.json` on 2026-08-11 with the measurement
 * that found it: 6 images across 12 posts, ZERO wrapped in an anchor.
 *
 * The repair is markup, not script: the pipeline wraps the image, and the
 * lightbox intercepts a link that already worked. That puts the fix in the ONE
 * place both writers share, which is the property that matters here. The Node
 * build and the Worker's save path both call `renderBody`, so an anchor added
 * to one is an anchor added to both by construction, and this file asserts
 * against that shared module rather than against either caller.
 *
 * ## Why the assertions are shaped this way
 *
 * The href is asserted EXACTLY, not by "contains the key". `/media/<key>?w=640`
 * contains the key too, and it is the precise value the defect produced, so a
 * substring match would agree with the bug.
 *
 * The image's own attributes are asserted alongside, because "the anchor is
 * present" is satisfied by a wrap that dropped `srcset` on the way through, and
 * a wrap that costs the responsive ladder is a worse page than the one it
 * replaced.
 *
 * @see app/lib/content/pipeline.mjs, rehypeImageSources
 * @see app/enhance/blog.ts, lightbox
 * @see content/enhancements.json, image-lightbox
 */

import test from "node:test";
import assert from "node:assert/strict";

import { renderBody } from "../app/lib/content/pipeline.mjs";

/** An R2 object key in the content grammar: 16 hex digits, then WxH. */
const MEDIA_KEY = "a1b2c3d4e5f60718-1600x900.webp";
const MEDIA_SRC = `/media/${MEDIA_KEY}`;
/** A static asset. Its own path is the original; it never passes the transform route. */
const STATIC_SRC = "/publications/measured-latency.png";

/** @param {string} body */
const render = (body) =>
  renderBody({
    file: "test.md",
    body,
    // Fixed, and deliberately not the dimensions in the key: an assertion that
    // the width reached the img must be able to tell the two apart.
    resolveImage: async () => ({ width: 1280, height: 720 }),
  });

/** The anchor wrapping `src`, as a raw tag string, or null. */
function anchorFor(/** @type {string} */ html, /** @type {string} */ src) {
  for (const match of html.matchAll(/<a\b[^>]*>\s*<img\b[^>]*>/g)) {
    if (match[0].includes(`src="${src}"`)) return match[0];
  }
  return null;
}

/** One attribute off a tag string, or null. */
function attr(/** @type {string} */ tag, /** @type {string} */ name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

const FIXTURE = [
  `:::figure{src=${MEDIA_SRC} alt="A chart of the measured latency"}`,
  "The caption is author-written markdown.",
  ":::",
  "",
  `![A hand-drawn sketch of the same shape](${STATIC_SRC})`,
  "",
].join("\n");

test("CONTROL: the fixture renders both images", async () => {
  // Without this every assertion below could pass by examining nothing: a
  // pipeline that stopped emitting images at all has no wrong href to find.
  const { html } = await render(FIXTURE);
  assert.equal(
    (html.match(/<img\b/g) ?? []).length,
    2,
    `expected 2 images from the fixture, got: ${html}`,
  );
});

test("a media image is wrapped in an anchor to the UNSIZED original", async () => {
  const { html } = await render(FIXTURE);
  const anchor = anchorFor(html, MEDIA_SRC);
  assert.ok(anchor, `no anchor wraps the media image:\n${html}`);
  assert.equal(
    attr(anchor, "href"),
    MEDIA_SRC,
    "the href must be the unsized original, with no ?w= transform",
  );
  assert.equal(attr(anchor, "class"), "image-link");
});

test("a static image is wrapped in an anchor to its own path", async () => {
  const { html } = await render(FIXTURE);
  const anchor = anchorFor(html, STATIC_SRC);
  assert.ok(anchor, `no anchor wraps the static image:\n${html}`);
  assert.equal(attr(anchor, "href"), STATIC_SRC);
  assert.equal(attr(anchor, "class"), "image-link");
});

test("the wrap costs the image none of its own attributes", async () => {
  const { html } = await render(FIXTURE);

  const media = html.match(new RegExp(`<img\\b[^>]*src="${MEDIA_SRC}"[^>]*>`))?.[0];
  assert.ok(media, "the media img tag is missing");
  assert.equal(attr(media, "src"), MEDIA_SRC);
  assert.equal(
    attr(media, "srcset"),
    `${MEDIA_SRC}?w=640 640w, ${MEDIA_SRC}?w=1024 1024w, ${MEDIA_SRC}?w=1408 1408w`,
  );
  assert.equal(attr(media, "sizes"), "(min-width: 46rem) 704px, calc(100vw - 2rem)");
  assert.equal(attr(media, "width"), "1280");
  assert.equal(attr(media, "height"), "720");
  assert.equal(attr(media, "alt"), "A chart of the measured latency");

  const asset = html.match(new RegExp(`<img\\b[^>]*src="${STATIC_SRC}"[^>]*>`))?.[0];
  assert.ok(asset, "the static img tag is missing");
  assert.equal(attr(asset, "src"), STATIC_SRC);
  // A static asset gets NO srcset: the transform route would refuse those URLs.
  assert.equal(attr(asset, "srcset"), null);
  assert.equal(attr(asset, "width"), "1280");
  assert.equal(attr(asset, "height"), "720");
  assert.equal(attr(asset, "alt"), "A hand-drawn sketch of the same shape");
});

test("an image the author already linked keeps the author's href", async () => {
  // Their href is a decision; the wrap is a default, and a default that
  // overrode a decision would silently retarget every linked figure.
  const { html } = await render(`[![Linked by hand](${MEDIA_SRC})](https://example.com/paper)`);
  assert.equal((html.match(/<a\b/g) ?? []).length, 1, `expected one anchor:\n${html}`);
  assert.match(html, /<a href="https:\/\/example\.com\/paper"><img/);
  assert.ok(!html.includes("image-link"), "the pipeline wrapped an already-linked image");
});

test("a diagram's image pair is NOT wrapped", async () => {
  /*
   * Excluded for an accessibility reason rather than a tidiness one. A diagram
   * renders as two images with one hidden by `display: none`, chosen in
   * post.css precisely so the hidden half leaves the accessibility tree.
   * `display: none` on a child does not hide its parent, so an anchor around
   * the hidden image would be a focusable link with no accessible name in
   * every article carrying a diagram.
   */
  const { html } = await render(
    [
      ':::diagram{title="Two steps" alt="A flowchart with two boxes, one arrow from the first to the second."}',
      "```mermaid",
      "flowchart LR",
      "  A[One] --> B[Two]",
      "```",
      ":::",
    ].join("\n"),
  );
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  assert.equal(images.length, 2, `expected the light and dark pair, got:\n${html}`);
  assert.ok(
    images.every((tag) => (attr(tag, "class") ?? "").includes("diagram-image")),
    "the diagram pair lost its class, so this test is no longer about diagrams",
  );
  assert.ok(!html.includes("image-link"), "a diagram image was wrapped in an anchor");
});
