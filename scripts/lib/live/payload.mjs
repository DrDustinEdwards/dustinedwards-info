// What a public post page ships: enhancement bundles only, and an image link that serves an image.

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { chunkStem } from "../../check-page-payload.mjs";
import { readArtifact } from "../artifact.mjs";
import { check, get, root, SLUG } from "./client.mjs";

export async function run() {
  /* A modulepreload means a public page hydrates. */
  {
    const { text, status } = await get(`/blog/${SLUG}`);
    check("payload: post page fetched for the script-set comparison", status === 200);

    const enhanceStems = new Set(
      readdirSync(join(root, "app", "enhance"))
        .filter((f) => f.endsWith(".ts"))
        .map((f) => f.replace(/\.ts$/, "")),
    );
    check(
      "payload: the enhancement module listing is non-empty",
      enhanceStems.size > 0,
      "app/enhance/ lists no modules, so the comparison below would expect nothing",
    );

    /** @type {string[]} */
    const scriptSrcs = [];
    /** @type {string[]} */
    const offAssets = [];
    for (const script of text.match(/<script\b[^>]*\bsrc="[^"]*"[^>]*>/g) ?? []) {
      const src = /** @type {string} */ ((script.match(/\bsrc="([^"]*)"/) ?? [])[1]);
      const asset = src.match(/^\/assets\/([^"?#]+\.js)$/);
      if (asset) scriptSrcs.push(asset[1]);
      else offAssets.push(src);
    }
    check(
      "payload: every live script src is under /assets/",
      offAssets.length === 0,
      `script src(s) from elsewhere: [${offAssets.join(", ")}]. Only built enhancement bundles ` +
        `belong on a public page.`,
    );
    const preloads = text.match(/<link[^>]*rel="modulepreload"[^>]*>/g) ?? [];

    check(
      "payload: the live page references at least one script",
      scriptSrcs.length > 0,
      "zero script-src references found; the enhancement tags vanished or this extraction moved",
    );
    check(
      "payload: the live post page carries no modulepreload",
      preloads.length === 0,
      `${preloads.length} modulepreload link(s) on a public page: the framework is ` +
        `riding on the public plane again`,
    );
    const foreign = scriptSrcs.map(chunkStem).filter((stem) => !enhanceStems.has(stem)).sort();
    check(
      "payload: every live script src is an enhancement bundle",
      foreign.length === 0,
      `non-enhancement stem(s) on the wire: [${foreign.join(", ")}]`,
    );
  }

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
      const { text, status } = await get(`/blog/${slug}`);
      if (status !== 200) {
        unserved.push(`/blog/${slug} (${status})`);
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
        `image-link: /blog/${found.slug} wraps its image in an anchor to ${found.href}`,
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
