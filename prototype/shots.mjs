// Screenshots of every prototype page, light and dark, at 1440 and 390 wide.
// Needs the server running (npm start) and Playwright; set PLAYWRIGHT and CHROMIUM to override paths.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "/opt/node-tools/node_modules/playwright");
const BASE = process.env.BASE || "http://localhost:4321";
const OUT = process.env.OUT || "shots";
const PAGES = [
  ["home", "/"], ["research", "/research/"], ["publication", "/research/publications/10-1371-journal-ppat-1004454/"],
  ["software", "/software/"], ["product-foxhound", "/software/foxhound/"], ["writing", "/writing/"],
  ["article", "/writing/carrel-a-writing-desk-apart-from-the-site/"], ["cv", "/cv/"], ["about", "/about/"],
];
const only = process.argv[2];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1, colorScheme: theme });
    const page = await ctx.newPage();
    for (const [name, path] of PAGES) {
      if (only && only !== name) continue;
      await page.goto(`${BASE}${path}?theme=${theme}`, { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        await document.fonts.ready;
        // walk the page so every scroll reveal and count-up has run, then return to the top
        for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
        scrollTo(0, 0);
        document.querySelectorAll(".rv").forEach((e) => e.classList.add("in"));
        document.querySelector(".bar")?.classList.remove("hide");
      });
      await page.waitForTimeout(2200);
      const file = `${OUT}/${name}-${theme}-${w}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    if (!only || only === "index") {
      // the Index overlay, open, as one viewport-sized shot
      await page.goto(`${BASE}/?theme=${theme}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.click("[data-open-index]");
      await page.waitForTimeout(1400);
      const file = `${OUT}/index-overlay-${theme}-${w}.png`;
      await page.screenshot({ path: file });
      console.log(file);
    }
    await ctx.close();
  }
}
await browser.close();
