/**
 * A body image carries its placeholder as a background, and only when it has one.
 *
 * ## The defect this replays
 *
 * LQIP had NEVER rendered on a body image, at any storage tier, while the
 * architecture document said it did. Two independent causes, either sufficient:
 * the pipeline wrote no placeholder onto an `<img>` at all, and uploads derived
 * none to write. This covers the first. The second is
 * `test/worker/media-events.test.ts`.
 *
 * ## Why the test is here rather than on a route
 *
 * Both writers get the rule BY CONSTRUCTION. The repository build and the
 * operator API's publish path are two callers of one `renderBody`, so a rule
 * applied in either caller would be a rule the other silently lacked. Same
 * footing as `post-image-eager.test.mjs` and for the same reason.
 *
 * ## Why the assertions are shaped this way
 *
 * The pair is asserted in BOTH directions. An image with a placeholder must get
 * the class and the background; an image without one must get NEITHER, because
 * the `/media/` exclusion is a rule and not an oversight, and an assertion that
 * only checked the first would pass on a pipeline that invented a background
 * for everything. The class matters on its own: the sizing lives in
 * `prose.css` under `.has-lqip`, so a background with no class is a placeholder
 * rendered at its native twenty pixels in the corner of the image.
 *
 * @see app/lib/content/pipeline.mjs, rehypeImageSources
 */

import test from "node:test";
import assert from "node:assert/strict";

import { renderBody } from "../app/lib/content/pipeline.mjs";

const STATIC_SRC = "/phage-hunters/dustin-edwards-2017.webp";
const MEDIA_SRC = "/media/dustin-edwards-a1b2c3d4e5f60718-1600x900.webp";

/** A stand-in for a real derived value. Its bytes are not the subject here. */
const LQIP = "data:image/webp;base64,UklGRhoAAABXRUJQ";

/**
 * The resolver answers with a placeholder for the static src and none for the
 * uploaded one, which is what the two real resolvers do.
 *
 * @param {string} body
 */
const render = (body) =>
  renderBody({
    file: "test.md",
    body,
    resolveImage: async (src) => ({
      width: 1280,
      height: 720,
      ...(src === STATIC_SRC ? { placeholder: LQIP } : {}),
    }),
  });

/** Every `<img>` tag in document order, as raw tag strings. */
const images = (/** @type {string} */ html) => html.match(/<img\b[^>]*>/g) ?? [];

/** One attribute off a tag string, or null when absent. */
function attr(/** @type {string} */ tag, /** @type {string} */ name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

const FIXTURE = [
  `![A static content image](${STATIC_SRC})`,
  "",
  "Prose between them, so the two images are not siblings.",
  "",
  `![An uploaded object](${MEDIA_SRC})`,
  "",
].join("\n");

test("CONTROL: the fixture renders two images, in order", async () => {
  // Without this every assertion below could pass by examining nothing: a
  // pipeline that stopped emitting images has no wrong attribute to find.
  const { html } = await render(FIXTURE);
  const tags = images(html);
  assert.equal(tags.length, 2, `expected 2 images, got: ${html}`);
  assert.ok(attr(tags[0], "src")?.includes(STATIC_SRC));
  assert.ok(attr(tags[1], "src")?.includes(MEDIA_SRC));
});

test("AN IMAGE WITH A PLACEHOLDER GETS THE CLASS AND THE BACKGROUND", async () => {
  const { html } = await render(FIXTURE);
  const [first] = images(html);

  const classes = (attr(first, "class") ?? "").split(/\s+/);
  assert.ok(classes.includes("has-lqip"), `class was "${attr(first, "class")}" in ${first}`);

  // The serializer escapes the quotes inside the url(), so the assertion is on
  // the payload rather than on a literal spelling of the CSS.
  const style = attr(first, "style") ?? "";
  assert.match(style, /^background-image:url\(/, `style was "${style}"`);
  assert.ok(style.includes(LQIP), `the style carries no placeholder: "${style}"`);
});

test("AN IMAGE WITHOUT ONE GETS NEITHER, which is the /media/ exclusion", async () => {
  const { html } = await render(FIXTURE);
  const [, second] = images(html);

  assert.equal(attr(second, "style"), null, `an uploaded key got a background: ${second}`);
  assert.ok(
    !(attr(second, "class") ?? "").split(/\s+/).includes("has-lqip"),
    `an uploaded key got the class: ${second}`,
  );
});

test("a figure directive's image gets it too", async () => {
  /*
   * The other form an author writes, and the one that carries a caption. There
   * is no case here for "the placeholder does not displace an existing class",
   * and its absence is measured rather than overlooked: nothing reaching this
   * plugin carries one. The figure directive sets no class on the image, raw
   * HTML is stripped before the plugin runs, and the diagram pair returns above
   * on the class test. A case for it would have asserted nothing, which a plant
   * proved: breaking the class merge left it green.
   */
  const { html } = await render(
    `:::figure{src="${STATIC_SRC}" alt="A static content image"}\nA caption.\n:::\n`,
  );
  const [tag] = images(html);
  assert.ok(
    (attr(tag, "class") ?? "").split(/\s+/).includes("has-lqip"),
    `class was "${attr(tag, "class")}" in ${tag}`,
  );
  assert.ok((attr(tag, "style") ?? "").includes(LQIP), `style was "${attr(tag, "style")}"`);
});
