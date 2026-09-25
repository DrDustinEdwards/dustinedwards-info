/* `fetchpriority="high"` on more than one image is the same as on none (it is a budget), so the
 * first image must get it with eager loading and the second must get NEITHER. */

import test from "node:test";
import assert from "node:assert/strict";

import { attr, fixedSize, images, render as renderWith, twoImages } from "./lib/render.mjs";

const FIRST = "/media/dustin-edwards-a1b2c3d4e5f60718-1600x900.webp";
const SECOND = "/publications/measured-latency.png";

/** @param {string} body */
const render = (body) => renderWith(body, fixedSize);

const FIXTURE = twoImages(
  ["The opening figure, which is the LCP element", FIRST],
  ["A later image, well below the fold", SECOND],
  "Some prose between them, so the two images are not siblings.",
);

test("CONTROL: the fixture renders two images, in order", async () => {
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
  /* The counter lives in the per-render plugin closure. Hoisted to module scope, only the
   * first post of a multi-post build would get an eager image. */
  await render(FIXTURE);
  const { html } = await render(FIXTURE);
  const [first] = images(html);
  assert.equal(attr(first, "loading"), "eager", `second render lost the eager image: ${first}`);
});

test("decoding stays async on every image", async () => {
  const { html } = await render(FIXTURE);
  for (const tag of images(html)) assert.equal(attr(tag, "decoding"), "async", tag);
});
