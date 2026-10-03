// Screenshots every admin page, light and dark, desktop and phone, against the local preview with the smoke token.
// usage: node .review/admin-redesign/shoot.mjs before|after [pageName ...]
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer";

const OUT = new URL(`./${process.argv[2]}/`, import.meta.url).pathname;
const only = process.argv.slice(3);
const ORIGIN = process.env.ORIGIN ?? "http://localhost:4173";
const TOKEN = readFileSync(new URL("../../.smoke-token", import.meta.url), "utf8").trim();
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
for (const [name, path] of PAGES) {
  if (only.length && !only.includes(name)) continue;
  for (const [view, w, h, theme] of VIEWS) {
    await page.setViewport({ width: w, height: h });
    await page.setCookie({ name: "theme", value: theme, url: ORIGIN });
    const res = await page.goto(`${ORIGIN}${path}`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${OUT}${name}-${view}.jpg`, type: "jpeg", quality: 80, fullPage: !name.endsWith("inspector") });
    console.log(res?.status(), name, view);
  }
}
await browser.close();
