/*
 * Screenshots the two mockups at 1280 and 375, in both themes.
 *
 * A markup harness (esbuild plus renderToStaticMarkup) cannot do this: it has
 * no browser, so no viewport and no screenshot. This drives Puppeteer directly, which is the same engine
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
        /*
         * THE VIEWPORT IS GROWN TO THE DOCUMENT, then captured WITHOUT
         * `fullPage`.
         *
         * `fullPage` captures beyond the viewport, and anything painted
         * relative to the viewport stays the size the viewport was: a modal
         * dialog's `::backdrop` and the drawer's scrim both stop partway down
         * the image and leave the rest of the page undimmed. That reads as a
         * broken design in the screenshot and is purely an artifact of how the
         * capture works. Resizing first means the viewport IS the document, so
         * every fixed layer covers what it covers in a browser.
         */
        const docHeight = await page.evaluate(
          () => document.documentElement.scrollHeight,
        );
        await page.setViewport({ width, height: docHeight });
        const out = join(dir, `${name}-${width}-${theme}.png`);
        await page.screenshot({ path: out });
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
