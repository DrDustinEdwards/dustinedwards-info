// The CV's PDF, rendered OFFLINE from the files in content/cv/ by the headless Chrome the browser gate already
// uses. This is NOT how the site's PDF is made: the Worker renders it after each CV save through Browser Run
// (app/lib/cv/pdf.server.ts) and serves one R2 object at /dustin-edwards-cv.pdf (docs/CV.md). This script exists to
// look at the document without a save (a layout change, a font change) and to give anyone a PDF from a checkout.
// It draws the SAME HTML the Worker does (renderCvHtml, app/lib/cv/pdf-html.mjs), so a PDF made here and one made
// there differ only by the browser that printed them. It writes under build/ and never into public/: a static file
// at the PDF's address would win over the Worker route.
//
//   npm run build:cv-pdf [-- --out <path>]

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

import { renderBody } from "../app/lib/content/pipeline.mjs";
import { FINGERPRINT_LABEL, PDF_FONTS, cvFingerprint, cvPdfOptions, fontFaceRule, renderCvHtml } from "../app/lib/cv/pdf-html.mjs";
import { isMain } from "./lib/is-main.mjs";
import { loadCv } from "./lib/cv.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CV_PDF_DEFAULT_OUT = path.join(ROOT, "build", "dustin-edwards-cv.pdf");

/** The `@font-face` rules for the print document, read from app/fonts/. */
async function fontCss() {
  const rules = await Promise.all(
    PDF_FONTS.map(async ({ file, family, style }) =>
      fontFaceRule(family, await readFile(path.join(ROOT, "app", "fonts", file)), style),
    ),
  );
  return rules.join("\n");
}

/**
 * The print document for a resolved CV, through the site's markdown pipeline.
 *
 * @param {import("../app/lib/cv/entries.mjs").Cv} CV
 */
export async function renderHtml(CV) {
  return renderCvHtml(CV, { renderBody, fontCss: await fontCss() });
}

/**
 * The PDF bytes for a resolved CV, through headless Chrome. The Worker does the same through Browser Run.
 *
 * @param {import("../app/lib/cv/entries.mjs").Cv} CV
 * @returns {Promise<Uint8Array>}
 */
export async function renderPdf(CV) {
  const html = await renderHtml(CV);
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready");
    return await page.pdf(cvPdfOptions(CV));
  } finally {
    await browser.close();
  }
}

async function main() {
  const flag = process.argv.indexOf("--out");
  const given = flag === -1 ? null : process.argv[flag + 1];
  if (flag !== -1 && !given) throw new Error("--out needs a path.");
  const out = given ? path.resolve(given) : CV_PDF_DEFAULT_OUT;
  const CV = await loadCv();
  const pdf = await renderPdf(CV);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, pdf);
  console.log(`build:cv-pdf wrote ${path.relative(ROOT, out)} (${pdf.length} bytes, ${FINGERPRINT_LABEL} ${await cvFingerprint(CV)})`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`build:cv-pdf failed. ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
