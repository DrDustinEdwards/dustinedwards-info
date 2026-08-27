/**
 * The FIRST body image is eager and high priority. Every later one is lazy.
 *
 * ## The defect this replays
 *
 * Every body image carried `loading="lazy"`, which is right for every image
 * except the one already on screen. On a post that opens with a figure, that
 * image is the LCP element, and lazy loading it tells the browser to wait for
 * layout before it will even request the largest thing on the page. The audit
 * that opened this arc measured LCP on a post at 4.1 to 5.7 s on a throttled
 * cold load, with the hero image among the last things requested.
 *
 * ## Why the test is here rather than on a route
 *
 * Both writers get the rule BY CONSTRUCTION. The repository build and the
 * operator API's publish path are two callers of one `renderBody`, so a rule
 * applied in either caller would be a rule the other silently lacked. This
 * asserts against the shared module, which is the same footing
 * `post-image-links.test.mjs` stands on and for the same reason.
 *
 * ## Why the assertions are shaped this way
 *
 * The pair is asserted TOGETHER and in both directions. `loading="eager"` alone
 * still leaves the image queued behind whatever the preload scanner found
 * first, and `fetchpriority="high"` on more than one image is the same as on
 * none, because it is a budget rather than a dial. So the first image must have
 * both, and the second must have NEITHER, and an assertion that only checked
 * the first would pass on a pipeline that made every image eager.
 *
 * @see app/lib/content/pipeline.mjs, rehypeImageSources
 */

import test from "node:test";
import assert from "node:assert/strict";

import { renderBody } from "../app/lib/content/pipeline.mjs";

const FIRST = "/media/a1b2c3d4e5f60718-1600x900.webp";
const SECOND = "/publications/measured-latency.png";

/** @param {string} body */
const render = (body) =>
  renderBody({
    file: "test.md",
    body,
    resolveImage: async () => ({ width: 1280, height: 720 }),
  });

/** Every `<img>` tag in document order, as raw tag strings. */
const images = (/** @type {string} */ html) => html.match(/<img\b[^>]*>/g) ?? [];

/** One attribute off a tag string, or null when absent. */
function attr(/** @type {string} */ tag, /** @type {string} */ name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

const FIXTURE = [
  `![The opening figure, which is the LCP element](${FIRST})`,
  "",
  "Some prose between them, so the two images are not siblings.",
  "",
  `![A later image, well below the fold](${SECOND})`,
  "",
].join("\n");

test("CONTROL: the fixture renders two images, in order", async () => {
  // Without this, every assertion below could pass by examining nothing: a
  // pipeline that stopped emitting images has no wrong attribute to find, and
  // one that emitted them in the other order would make "first" a lie.
  const { html } = await render(FIXTURE);
  const tags = images(html);
  assert.equal(tags.length, 2, `expected 2 images, got: ${html}`);
  assert.ok(attr(tags[0], "src")?.includes(FIRST), `first image is ${attr(tags[0], "src")}`);
  assert.ok(attr(tags[1], "src")?.includes(SECOND), `second image is ${attr(tags[1], "src")}`);
});

test("THE FIRST IMAGE IS EAGER AND HIGH PRIORITY", async () => {
  const { html } = await render(FIXTURE);
  const [first] = images(html);
  assert.equal(attr(first, "loading"), "eager", first);
  assert.equal(attr(first, "fetchpriority"), "high", first);
});

test("every later image stays lazy and claims no priority", async () => {
  const { html } = await render(FIXTURE);
  const [, second] = images(html);
  assert.equal(attr(second, "loading"), "lazy", second);
  assert.equal(
    attr(second, "fetchpriority"),
    null,
    `a second high-priority image spends the budget the first one needed: ${second}`,
  );
});

test("a post with ONE image gives it the eager pair", async () => {
  const { html } = await render(`![Only image](${FIRST})\n`);
  const [only] = images(html);
  assert.equal(attr(only, "loading"), "eager", only);
  assert.equal(attr(only, "fetchpriority"), "high", only);
});

test("THE COUNTER RESETS BETWEEN DOCUMENTS", async () => {
  /*
   * The counter lives in the plugin's closure, and the plugin is constructed
   * per render. If it were ever hoisted to module scope, the first document in
   * a build would get an eager image and every document after it would not,
   * which is a defect that only appears in a multi-post build and never in a
   * single-post test. The repository build renders twelve posts in one process.
   */
  await render(FIXTURE);
  const { html } = await render(FIXTURE);
  const [first] = images(html);
  assert.equal(attr(first, "loading"), "eager", `second render lost the eager image: ${first}`);
});

test("decoding stays async on every image", async () => {
  // The eager change must not have cost the hint that was already right.
  const { html } = await render(FIXTURE);
  for (const tag of images(html)) assert.equal(attr(tag, "decoding"), "async", tag);
});
