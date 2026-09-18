// Does the public header nav lay out at 1280? Grok's review said the old comment at
// check-browser.mjs carried a live finding that the cut lost, so the finding was re-measured
// before anything was written back (hard rule 10: re-measure a carried claim).
//
//   node scratchpad/nav-1280.mjs [origin] [shot.png]
//
// Reads the computed display of `.site-header-nav` on the deployed site at 1280 in light, with
// the link boxes, and writes one screenshot of `.site-header`.
import puppeteer from "puppeteer";

const ORIGIN = process.argv[2] ?? "https://dustinedwards.dustin-edwards.workers.dev";
const OUT = process.argv[3] ?? "scratchpad/header-1280-light.png";

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await page.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

const report = await page.evaluate(() => {
  const nav = document.querySelector(".site-header-nav");
  const box = nav?.getBoundingClientRect();
  return {
    navPresent: Boolean(nav),
    display: nav ? getComputedStyle(nav).display : null,
    visibility: nav ? getComputedStyle(nav).visibility : null,
    box: box ? { w: box.width, h: box.height, x: box.left, y: box.top } : null,
    links: [...(nav?.querySelectorAll("a") ?? [])].map((a) => ({
      href: a.getAttribute("href"),
      w: a.getBoundingClientRect().width,
      h: a.getBoundingClientRect().height,
    })),
    // Build 2's overflow menu, which check-browser.mjs still falls back to.
    overflowPresent: Boolean(document.querySelector("details.site-shell-overflow")),
    menuLinkPresent: Boolean(document.querySelector('.site-shell-menu a[href="/blog"]')),
    theme: document.documentElement.getAttribute("data-theme"),
    viewport: { w: innerWidth, h: innerHeight },
  };
});

console.log(JSON.stringify(report, null, 2));
await (await page.$(".site-header"))?.screenshot({ path: OUT });
console.log(`shot: ${OUT}`);
await browser.close();
