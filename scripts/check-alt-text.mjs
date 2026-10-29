// Fails when published content shows an image with no alt text (media idea 9, after Astro, which fails a build on one).
// It reads what the renderer wrote, not the source, so every form the renderer accepts is covered by the one rule: a
// Markdown image, an image reference, a :::figure (both themed halves) and a diagram. A post's cover is drawn by the
// route from its frontmatter, so it is read from the record.
//
// OBSERVATION BOUNDARY: the renderer takes alt from the reference only and never from the media index (no image in a
// post, page or the CV falls back to media.alt), so this needs no database and is offline. It has no decorative form to
// honor: the renderer marks no image decorative, so an empty alt is a missing one. It sees what build:content compiled
// (posts from content/generated/posts.json, pages and the CV through the page compile), so a draft is skipped, and an
// image a component draws (a procedure, the roster) is held by its own validator, not here.

import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";

import { assertFloor } from "./lib/floor.mjs";
import { isMain } from "./lib/is-main.mjs";

/**
 * The src of every <img> in an HTML fragment whose alt is missing or blank.
 *
 * @param {string} html
 * @returns {{ images: number, undescribed: string[] }}
 */
export function undescribedImages(html) {
  let images = 0;
  /** @type {string[]} */
  const undescribed = [];
  visit(fromHtml(html, { fragment: true }), "element", (/** @type {any} */ node) => {
    if (node.tagName !== "img") return;
    images += 1;
    const alt = node.properties?.alt;
    if (typeof alt !== "string" || alt.trim() === "") undescribed.push(String(node.properties?.src ?? "an image with no src"));
  });
  return { images, undescribed };
}

/**
 * One sentence per undescribed image in the published posts and pages.
 *
 * @param {{
 *   posts: Array<{ slug: string, title: string, draft: boolean, html: string, cover: { src: string, alt: string } | null }>,
 *   pages: Array<{ path: string, title: string, draft: boolean, html: string }>,
 * }} content
 * @returns {{ documents: number, images: number, failures: string[] }}
 */
export function altTextFailures({ posts, pages }) {
  let documents = 0;
  let images = 0;
  /** @type {string[]} */
  const failures = [];
  const fix = "add its alt text in Carrel.";

  for (const post of posts) {
    if (post.draft) continue;
    documents += 1;
    const name = `The post "${post.title}" (/writing/${post.slug})`;
    if (post.cover) {
      images += 1;
      if (!post.cover.alt.trim()) failures.push(`${name} has the cover image ${post.cover.src} with no alt text; ${fix}`);
    }
    const found = undescribedImages(post.html);
    images += found.images;
    for (const src of found.undescribed) failures.push(`${name} uses the image ${src} with no alt text; ${fix}`);
  }

  for (const page of pages) {
    if (page.draft) continue;
    documents += 1;
    const found = undescribedImages(page.html);
    images += found.images;
    for (const src of found.undescribed) {
      failures.push(`The page "${page.title}" (${page.path}) uses the image ${src} with no alt text; ${fix}`);
    }
  }

  return { documents, images, failures };
}

async function main() {
  const { readArtifact } = await import("./lib/artifact.mjs");
  const { renderContentPages, renderOwnRoutePages } = await import("./build-content.mjs");

  console.log("\ncheck:alt-text\n");
  const pages = [...(await renderContentPages()), ...(await renderOwnRoutePages())];
  const { documents, images, failures } = altTextFailures({ posts: readArtifact().posts, pages });

  /* Proves the gate read the content; not a count of it, so removing an image in Carrel never fails the build (2026-10-29: 50 documents, 6 images). */
  const breaches = [
    assertFloor("check:alt-text", "published documents read", documents, 1),
    assertFloor("check:alt-text", "images read", images, 1),
  ].filter(Boolean);

  for (const failure of failures) console.log(`  FAIL  ${failure}`);
  for (const breach of breaches) console.log(`  FAIL  ${breach}`);
  console.log(`\n  ${images} image(s) in ${documents} published post(s) and page(s), ${failures.length} with no alt text.\n`);
  if (failures.length > 0 || breaches.length > 0) process.exit(1);
}

if (isMain(import.meta.url)) await main();
