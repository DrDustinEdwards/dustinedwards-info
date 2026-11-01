import test from "node:test";
import assert from "node:assert/strict";

import { altTextFailures } from "../scripts/check-alt-text.mjs";
import { fixedSize, render } from "./lib/render.mjs";

/** @param {string} html @param {{ src: string, alt: string } | null} [cover] */
const post = (html, cover = null) => ({ slug: "sample-post", title: "Sample post", draft: false, html, cover });

await test("an image drawn with an empty alt fails, naming the post and the image", async () => {
  // Prelum 0.28 refuses a bare image at render, so the empty alt comes from stored HTML, not from the renderer.
  const { html: rendered } = await render("![A described photograph](/media/sample/described-1280x720.webp)\n", fixedSize);
  const html = `${rendered}<p><img src="/media/sample/bare-1280x720.webp" alt=""></p>`;
  const { images, failures } = altTextFailures({ posts: [post(html)], pages: [] });
  assert.equal(images, 2);
  assert.deepEqual(failures, [
    'The post "Sample post" (/writing/sample-post) uses the image /media/sample/bare-1280x720.webp with no alt text; add its alt text in Carrel.',
  ]);
});

await test("a cover whose alt is only spaces fails, though the frontmatter schema accepts it", () => {
  const { failures } = altTextFailures({ posts: [post("<p>text</p>", { src: "/media/sample/cover.webp", alt: "  " })], pages: [] });
  assert.equal(failures.length, 1);
  assert.match(failures[0] ?? "", /cover image \/media\/sample\/cover\.webp with no alt text/);
});
