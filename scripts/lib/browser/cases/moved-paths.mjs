// The 2026-09-27 moves (/blog to /writing, /publications to /research/publications), read off the
// running site: every URL the sitemap lists answers 200, every page's old address answers one 301
// straight to it, and the old feeds keep answering with the feed. Plain fetches, not the browser page,
// because redirects are what is being read and a page would follow them.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { movedPathTarget } from "../../../../app/lib/path-moves.mjs";
import { BASE, ok, root } from "../harness.mjs";

/** @param {string} path */
const head = (path) => fetch(`${BASE}${path}`, { redirect: "manual" });

/** @param {import("../harness.mjs").CaseContext} _ctx */
export async function run(_ctx) {
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  ok("the sitemap lists pages to check", paths.length > 20, `${paths.length} <loc> entries`);

  /** @type {string[]} */
  const notOk = [];
  for (const path of paths) {
    const res = await head(path);
    if (res.status !== 200) notOk.push(`${path} ${res.status}`);
  }
  ok("every sitemap URL answers 200", notOk.length === 0, notOk.slice(0, 10).join(", "));
  ok(
    "no sitemap URL is still at an old address",
    !paths.some((p) => movedPathTarget(p) !== null),
    paths.filter((p) => movedPathTarget(p) !== null).slice(0, 5).join(", "),
  );

  // Each moved page's old address, read back from its new one.
  const moved = paths
    .map((p) =>
      p.startsWith("/writing")
        ? { old: `/blog${p.slice("/writing".length)}`, now: p }
        : p.startsWith("/research/publications")
          ? { old: p.slice("/research".length), now: p }
          : null,
    )
    .filter((m) => m !== null);
  ok("the sitemap has moved pages to check", moved.length > 10, `${moved.length}`);

  /** @type {string[]} */
  const badMoves = [];
  for (const { old, now } of moved) {
    const res = await head(old);
    const location = res.headers.get("location") ?? "";
    const target = location ? new URL(location, BASE).pathname : "";
    if (res.status !== 301 || target !== now) badMoves.push(`${old} ${res.status} -> ${target || "(none)"}`);
  }
  ok("every old address answers one 301 straight to its new page", badMoves.length === 0, badMoves.slice(0, 10).join(", "));

  // The old feeds answer with the feed itself.
  /** @type {string[]} */
  const feeds = [];
  for (const path of ["/blog/rss.xml", "/blog/feed.json", "/blog/atom.xml"]) {
    const res = await head(path);
    const type = res.headers.get("content-type") ?? "";
    if (res.status !== 200 || !/xml|json/.test(type)) feeds.push(`${path} ${res.status} ${type}`);
  }
  ok("the old feed addresses keep answering with the feed", feeds.length === 0, feeds.join(", "));

  // An old PDF name under the old section still reaches its file in one hop.
  const redirects = JSON.parse(readFileSync(join(root, "content", "redirects.json"), "utf8"));
  const [oldPdf, newPdf] = Object.entries(redirects.pdfs)[0];
  const legacy = oldPdf.replace(/^\/research/, "");
  const pdf = await head(legacy);
  const pdfTarget = new URL(pdf.headers.get("location") ?? "/", BASE).pathname;
  ok(
    "an old PDF name under /publications reaches its file in one 301",
    pdf.status === 301 && pdfTarget === newPdf,
    `${legacy} ${pdf.status} -> ${pdfTarget}, expected ${newPdf}`,
  );
  console.log(`  moved paths: ${paths.length} sitemap URLs at 200, ${moved.length} old addresses at 301`);
}
