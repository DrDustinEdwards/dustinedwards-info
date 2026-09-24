import test from "node:test";
import assert from "node:assert/strict";

import { renderBody } from "../app/lib/content/pipeline.mjs";

const STATIC_SRC = "/phage-hunters/dustin-edwards-2017.webp";
const MEDIA_SRC = "/media/dustin-edwards-a1b2c3d4e5f60718-1600x900.webp";

const LQIP = "data:image/webp;base64,UklGRhoAAABXRUJQ";

/** @param {string} body */
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

const images = (/** @type {string} */ html) => html.match(/<img\b[^>]*>/g) ?? [];

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
