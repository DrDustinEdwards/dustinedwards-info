// Public pages, light and dark at desktop width, for the before/after comparison.
// usage: ORIGIN=http://localhost:4174 node .review/admin-redesign/shoot-public.mjs before|after
import puppeteer from "puppeteer";
const ORIGIN = process.env.ORIGIN;
const OUT = new URL(`./public/${process.argv[2]}/`, import.meta.url).pathname;
const PAGES = [
  ["home", "/"],
  ["post-with-chart", "/writing/site-search-on-d1"],
  ["protocol", "/research/protocols/phage-dna-extraction"],
  ["cv", "/cv"],
  ["not-found", "/this-page-is-not-here"],
  ["post-not-found", "/writing/nope-post"],
];
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
for (const [name, path] of PAGES) {
  for (const theme of ["light", "dark"]) {
    await page.setViewport({ width: 1280, height: 900 });
    await page.setCookie({ name: "theme", value: theme, url: ORIGIN });
    const res = await page.goto(`${ORIGIN}${path}`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: `${OUT}${name}-${theme}.png`, type: "png", fullPage: true });
    console.log(res?.status(), name, theme);
  }
}
await browser.close();
