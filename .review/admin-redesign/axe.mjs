// axe-core, WCAG 2.2 A and AA, over every admin page in both themes at desktop and phone width.
// usage: AXE=/path/to/axe.min.js node .review/admin-redesign/axe.mjs [before|after-label]
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer";

const ORIGIN = process.env.ORIGIN ?? "http://localhost:4173";
const TOKEN = readFileSync(new URL("../../.smoke-token", import.meta.url), "utf8").trim();
const AXE = readFileSync(process.env.AXE, "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const VIEWS = [
  ["desktop-light", 1280, 900, "light"],
  ["desktop-dark", 1280, 900, "dark"],
  ["phone-light", 390, 844, "light"],
  ["phone-dark", 390, 844, "dark"],
];
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setExtraHTTPHeaders({ authorization: `Bearer ${TOKEN}` });
await page.goto(`${ORIGIN}/admin/posts`, { waitUntil: "networkidle0" });
const edit = await page.evaluate(() => document.querySelector('a[href*="/edit"]')?.getAttribute("href"));
const slug = edit?.match(/posts\/([^/]+)\/edit/)?.[1] ?? "site-search-on-d1";
const PAGES = [
  ["overview", "/admin"],
  ["posts", "/admin/posts"],
  ["posts-new", "/admin/posts/new"],
  ["posts-edit", `/admin/posts/${slug}/edit`],
  ["posts-history", `/admin/posts/${slug}/history`],
  ["media-grid", "/admin/media?view=grid"],
  ["media-list", "/admin/media?view=list"],
  ["media-inspector", "/admin/media?view=grid&key=posts%2Fa1b2c3d4e5f60718-phage-plaque-assay.webp"],
  ["mentions", "/admin/mentions"],
  ["tools", "/admin/tools"],
];
let total = 0;
const seen = new Map();
for (const [name, path] of PAGES) {
  for (const [view, w, h, theme] of VIEWS) {
    await page.setViewport({ width: w, height: h });
    await page.setCookie({ name: "theme", value: theme, url: ORIGIN });
    await page.goto(`${ORIGIN}${path}`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(AXE);
    const result = await page.evaluate((tags) => axe.run(document, { runOnly: { type: "tag", values: tags } }), TAGS);
    for (const v of result.violations) {
      for (const n of v.nodes) {
        total += 1;
        const key = `${v.id} | ${name} | ${n.target.join(" ")}`;
        const entry = seen.get(key) ?? { views: [], impact: v.impact, help: v.help, html: n.html.slice(0, 160), summary: n.failureSummary?.split("\n").slice(0, 3).join(" ") };
        entry.views.push(view);
        seen.set(key, entry);
      }
    }
    console.log(`${name} ${view}: ${result.violations.length} rule(s) violated, ${result.passes.length} passed`);
  }
}
console.log(`\n${total} violating node(s) across ${PAGES.length * VIEWS.length} views, ${seen.size} distinct.`);
for (const [key, e] of seen) console.log(`\n${e.impact} ${key}\n  ${e.help}\n  views: ${e.views.join(", ")}\n  ${e.html}\n  ${e.summary}`);
await browser.close();
