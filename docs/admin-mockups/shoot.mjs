/*
 * Screenshots the two mockups at 1280 and 375, in both themes.
 *
 * check:admin-ui cannot do this: it is a markup harness (esbuild plus
 * renderToStaticMarkup) with no browser at all, so it has no viewport and no
 * screenshot. This drives Puppeteer directly, which is the same engine
 * check:browser uses.
 *
 * Not a gate and not in any tier. Run it from the repo root when a mockup
 * changes: `node docs/admin-mockups/shoot.mjs`.
 */
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import puppeteer from "puppeteer";

const dir = join(process.cwd(), "docs", "admin-mockups");
const pages = ["posts", "overview"];
const widths = [1280, 375];
const themes = ["light", "dark"];

const browser = await puppeteer.launch({ headless: true });
const written = [];
try {
  for (const name of pages) {
    for (const width of widths) {
      for (const theme of themes) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: width === 1280 ? 900 : 812 });
        await page.goto(pathToFileURL(join(dir, `${name}.html`)).href, {
          waitUntil: "load",
        });
        await page.evaluate((t) => {
          document.documentElement.setAttribute("data-theme", t);
        }, theme);
        /*
         * THE PAGE BODY MUST NOT SCROLL SIDEWAYS. Asserted rather than
         * eyeballed: a fullPage screenshot silently widens to scrollWidth, so
         * an overflowing page produces a WIDER png that still looks fine.
         */
        const scrollWidth = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        if (scrollWidth > width) {
          throw new Error(
            `${name} at ${width}: document scrollWidth is ${scrollWidth}`,
          );
        }
        const out = join(dir, `${name}-${width}-${theme}.png`);
        await page.screenshot({ path: out, fullPage: true });
        written.push(out);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

// Counted, so "wrote everything" cannot quietly mean "wrote nothing".
if (written.length !== pages.length * widths.length * themes.length) {
  console.error(`Expected 8 files, wrote ${written.length}`);
  process.exit(1);
}
for (const f of written) console.log(f);
