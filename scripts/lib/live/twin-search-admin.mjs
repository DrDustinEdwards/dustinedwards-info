// The markdown twin, the search page and its JSON twin, the admin redirects and the static assets.

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { readArtifact } from "../artifact.mjs";
import { check, get, ORIGIN, root, SLUG, strip, TIMEOUT_MS, UA } from "./client.mjs";

export async function run() {
  {
    const { res: liveRes, text: live, status } = await get(`/blog/${SLUG}.md`);
    check(`md twin: /blog/${SLUG}.md serves`, status === 200);

    // The artifact's body, not the repo file, which also carries frontmatter.
    const artifact = readArtifact();
    const record = artifact.posts.find((/** @type {any} */ p) => p.slug === SLUG);
    const norm = (/** @type {string} */ s) => s.replace(/\r\n/g, "\n").trim();

    check("md twin: the post is in the artifact", Boolean(record));
    check(
      "md twin: byte-identical to the artifact (tokens did not touch content)",
      Boolean(record) && norm(live) === norm(record.markdown),
      `live ${norm(live).length} chars, artifact ${record ? norm(record.markdown).length : 0} chars`,
    );
    const twinType = liveRes.headers.get("content-type") ?? "";
    check(
      "md twin: content-type is text/markdown",
      twinType.includes("text/markdown"),
      `got ${twinType || "(none)"}`,
    );
  }

  {
    const { text, status } = await get("/search?q=blog");
    check("search: page renders", status === 200);
    // Scoped: the zero state lists the same links.
    const results = strip(text).match(/<ol class="search-results"[\s\S]*?<\/ol>/) ?? [""];
    check("search: results list present", results[0].includes("search-result"));
    check("search: a mark is rendered", results[0].includes("<mark>"));

    const json = await get("/search?q=blog", { accept: "application/json" });
    check(
      "search: JSON twin negotiates",
      (json.res.headers.get("content-type") ?? "").includes("json"),
    );
    check("search: Vary: Accept is set", (json.res.headers.get("vary") ?? "").includes("Accept"));
  }

  for (const path of ["/admin", "/admin/posts", `/admin/posts/${SLUG}/edit`]) {
    const { status } = await get(path);
    check(`admin: ${path} redirects unauthenticated`, status === 302, `got ${status}`);
  }

  {
    const pdfs = readdirSync(join(root, "public", "publications")).filter((f) => f.endsWith(".pdf"));
    // Images only: a desktop.ini or Thumbs.db is not served and is not an asset.
    const photos = readdirSync(join(root, "public", "phage-hunters")).filter((f) =>
      /\.(?:jpe?g|png|webp|avif|gif|svg)$/i.test(f),
    );
    let ok = 0;
    for (const f of pdfs) {
      const r = await fetch(`${ORIGIN}/publications/${encodeURIComponent(f)}`, {
        method: "HEAD",
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (r.status === 200) ok += 1;
      else check(`asset 404: /publications/${f} (${r.status})`, false);
    }
    for (const f of photos) {
      const r = await fetch(`${ORIGIN}/phage-hunters/${encodeURIComponent(f)}`, {
        method: "HEAD",
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (r.status === 200) ok += 1;
      else check(`asset 404: /phage-hunters/${f} (${r.status})`, false);
    }
    const total = pdfs.length + photos.length;
    check(
      `assets: ${ok}/${total} PDFs and photos serve 200`,
      pdfs.length > 0 && photos.length > 0 && ok === total,
      `${pdfs.length} PDF(s) and ${photos.length} photo(s) listed; an empty listing checks nothing`,
    );
    console.log(`  assets checked: ${ok}/${total}`);
  }
}
