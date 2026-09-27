// A body image links to the original, and that link serves an image.

import { readArtifact } from "../artifact.mjs";
import { check, get } from "./client.mjs";

export async function run() {
  /* Only the deployed origin shows an R2 target. No image is reported, not failed. */
  {
    const artifact = readArtifact();
    const slugs = artifact.posts
      .filter((/** @type {any} */ p) => p.draft !== true)
      .map((/** @type {any} */ p) => p.slug);

    check(
      "image-link: the published corpus is non-empty",
      slugs.length > 0,
      "no published post to search, so the search below would report a clean absence",
    );

    /** @type {{ slug: string, href: string } | null} */
    let found = null;
    /** @type {string[]} */
    const unserved = [];
    for (const slug of slugs) {
      const { text, status } = await get(`/writing/${slug}`);
      if (status !== 200) {
        unserved.push(`/writing/${slug} (${status})`);
        continue;
      }
      const match = text.match(/<a class="image-link" href="([^"]+)"><img\b/);
      if (match) {
        found = { slug, href: match[1] };
        break;
      }
    }

    /* The search stops at the first image, so this covers the posts it reached. */
    check(
      "image-link: every published post the search reached serves 200",
      unserved.length === 0,
      `${unserved.join(", ")}. A post that errors was skipped by the search, so "no body image" ` +
        `could be "no post rendered".`,
    );

    if (found === null) {
      console.log(
        `  REPORT  no body image in the live corpus (${slugs.length} published post(s) ` +
          `searched), so the image-link fallback has no instance on the wire. The ` +
          `pipeline wrap is covered by test/post-image-links.test.mjs.`,
      );
    } else {
      const { res, status } = await get(found.href);
      const type = res.headers.get("content-type") ?? "";
      check(
        `image-link: /writing/${found.slug} wraps its image in an anchor to ${found.href}`,
        !found.href.includes("?"),
        `the href carries a query, so it is a transform of the original rather than ` +
          `the original: ${found.href}`,
      );
      check(
        `image-link: ${found.href} serves an image`,
        status === 200 && type.startsWith("image/"),
        `answered ${status} ${JSON.stringify(type)}`,
      );
    }
  }
}
