/**
 * Capture the DEPLOYED site as reference images for the Claude Design project.
 *
 * Local only. The output directory is gitignored: these are observations of a
 * deployment at a moment, not artifacts of the repository, and a committed copy
 * would be a dated claim nothing can re-derive.
 *
 * THE SMOKE TOKEN IS NEVER PRINTED. It is read here and attached as an
 * `authorization` header exactly as `scripts/check-browser.mjs` does; nothing
 * writes it to stdout, to a filename, or into a screenshot.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const OUT = join(REPO, "ds-shots");
const ORIGIN = "https://dustinedwards.dustin-edwards.workers.dev";

const TOKEN_PATH = process.env.SMOKE_TOKEN_FILE ?? join(REPO, ".smoke-token");
const SMOKE = existsSync(TOKEN_PATH) ? readFileSync(TOKEN_PATH, "utf8").trim() : "";
if (!SMOKE) console.error("! no smoke token, admin routes will be SKIPPED");

/** name is the filename stem; plane decides whether the smoke header is attached. */
const ROUTES = [
  ["home", "/", "public"],
  ["blog", "/blog", "public"],
  ["blog-post", "/blog/agent-write-access-to-a-live-site", "public"],
  ["blog-tag", "/blog/tags/cloudflare", "public"],
  ["phage-discovery", "/phage-discovery", "public"],
  ["publications", "/publications", "public"],
  ["publication", "/publications/10-1128-jmbe-00313-25/", "public"],
  ["about", "/about", "public"],
  ["colophon", "/colophon", "public"],
  ["privacy", "/privacy", "public"],
  ["projects", "/projects", "public"],
  ["playground", "/playground", "public"],
  ["search", "/search", "public"],
  ["login", "/login", "public"],
  ["not-found", "/this-route-does-not-exist", "public"],
  ["admin", "/admin", "admin"],
  ["admin-origin-requests", "/admin/origin-requests", "admin"],
  ["admin-mentions", "/admin/mentions", "admin"],
  ["admin-tools", "/admin/tools", "admin"],
  ["admin-media", "/admin/media", "admin"],
  ["admin-posts", "/admin/posts", "admin"],
  ["admin-posts-new", "/admin/posts/new", "admin"],
  ["admin-post-edit", "/admin/posts/agent-write-access-to-a-live-site/edit", "admin"],
  ["admin-post-history", "/admin/posts/agent-write-access-to-a-live-site/history", "admin"],
  ["admin-post-revisions", "/admin/posts/agent-write-access-to-a-live-site/revisions", "admin"],
];

const WIDTHS = [375, 1280];
const THEMES = ["light", "dark"];

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const results = [];

for (const [name, path, plane] of ROUTES) {
  if (plane === "admin" && !SMOKE) {
    results.push({ name, path, plane, status: null, note: "skipped, no smoke token" });
    continue;
  }
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
        if (plane === "admin") await page.setExtraHTTPHeaders({ authorization: `Bearer ${SMOKE}` });
        await page.setCookie({ name: "theme", value: theme, domain: new URL(ORIGIN).hostname, path: "/" });
        const res = await page.goto(ORIGIN + path, { waitUntil: "networkidle2", timeout: 45000 });
        const status = res?.status() ?? 0;
        // The attribute the server wrote, which is the theme actually rendered.
        const attr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        const file = `${name}-${width}-${theme}.png`;
        await page.screenshot({ path: join(OUT, file), fullPage: true });
        results.push({ name, path, plane, width, theme, status, attr, file });
        console.error(`  ${String(status).padEnd(3)} ${file}${attr === theme ? "" : `  ! data-theme=${attr}`}`);
      } catch (e) {
        results.push({ name, path, plane, width, theme, error: String(e).split("\n")[0] });
        console.error(`  ERR ${name}-${width}-${theme}: ${String(e).split("\n")[0]}`);
      } finally {
        await page.close();
      }
    }
  }
}

await browser.close();
writeFileSync(join(OUT, "shots.json"), JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.file).length;
const bad = results.filter((r) => r.error || (r.status && r.status >= 400 && r.name !== "not-found"));
console.error(`\ncaptured ${ok} shot(s); ${bad.length} problem row(s)`);
for (const b of bad) console.error(`  ! ${b.name} ${b.width ?? ""} ${b.theme ?? ""} status=${b.status ?? "-"} ${b.error ?? ""}`);
