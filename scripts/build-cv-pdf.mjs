// The CV's PDF, public/dustin-edwards-cv.pdf, rendered from the same markdown as the /cv.md twin
// (app/lib/cv/markdown.mjs), through the site's markdown pipeline, by the headless Chrome the browser
// gate already uses. Committed, like the diagram SVGs and the paper PDFs, because a Worker cannot run
// Chrome: the build that deploys only copies it. It prints the twin's fingerprint on its last page, and
// test/cv.test.mjs reads that back out of the committed file, so a CV change nobody re-rendered the PDF
// for fails CI instead of shipping a stale PDF.
//
//   npm run build:cv-pdf, then build:assets and build:template-refs

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

import { CV, CV_PDF_PATH } from "../app/lib/cv/entries.mjs";
import { cvMarkdownBody, cvMarkdownDocument } from "../app/lib/cv/markdown.mjs";
import { renderBody } from "../app/lib/content/pipeline.mjs";
import { OWNER_ORCID, SITE_ORIGIN } from "../app/lib/seo.ts";
import { isMain } from "./lib/is-main.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CV_PDF_DISK_PATH = path.join(ROOT, "public", ...CV_PDF_PATH.slice(1).split("/"));

/**
 * Eight hex characters of the twin's source. The PDF prints it, and test/cv.test.mjs reads it back out
 * of the committed PDF, so a CV change nobody re-rendered the PDF for fails a test.
 */
export function cvFingerprint() {
  return createHash("sha256").update(cvMarkdownDocument()).digest("hex").slice(0, 8);
}

/** The words test/cv.test.mjs looks for; the fingerprint follows them. */
export const FINGERPRINT_LABEL = "CV data";

/** @param {string} family @param {string} name @param {string} style */
async function fontFace(family, name, style) {
  const bytes = await readFile(path.join(ROOT, "app", "fonts", name));
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2");font-style:${style};font-weight:100 900;}`;
}

/** @param {string} text */
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PRINT_CSS = `
@page { size: Letter; margin: 0.8in 0.85in 0.85in; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #1f1a17; font-family: "Source Serif 4", Georgia, serif; font-size: 10.5pt; line-height: 1.42; }
a { color: inherit; text-decoration: none; }
.letterhead { border-bottom: 1.5pt solid #4f2d7f; padding-bottom: 10pt; margin-bottom: 4pt; }
.letterhead h1 { margin: 0; color: #4f2d7f; font-size: 24pt; font-weight: 650; letter-spacing: -0.01em; line-height: 1.1; }
.letterhead p { margin: 4pt 0 0; font-family: "Inter", Arial, sans-serif; font-size: 9pt; color: #4a423b; line-height: 1.45; }
.letterhead .edition { text-transform: uppercase; letter-spacing: 0.08em; font-size: 7.5pt; font-weight: 600; color: #6a6159; margin: 0 0 6pt; }
h2 { margin: 16pt 0 6pt; padding-bottom: 3pt; border-bottom: 0.6pt solid #b9ada0; color: #4f2d7f; font-size: 13pt; font-weight: 650; break-after: avoid; }
h3 { margin: 10pt 0 4pt; font-family: "Inter", Arial, sans-serif; font-size: 8pt; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: #4a423b; break-after: avoid; }
h4 { margin: 10pt 0 2pt; font-size: 10.5pt; font-weight: 650; break-after: avoid; }
.heading-anchor { display: none; }
p { margin: 3pt 0; }
ul, ol { margin: 3pt 0; padding-left: 16pt; }
li { margin: 0 0 3.5pt; break-inside: avoid; }
ul li::marker { color: #8a7d6e; }
ul:has(> li > strong:first-child) { padding-left: 0; }
ul > li:has(> strong:first-child) { list-style: none; padding-left: 6.4em; text-indent: -6.4em; }
ul > li > strong:first-child { display: inline-block; width: 6.4em; text-indent: 0; font-family: "Inter", Arial, sans-serif; font-size: 8.5pt; font-weight: 600; color: #4a423b; }
ol li::marker { color: #6a6159; font-family: "Inter", Arial, sans-serif; font-size: 8.5pt; }
strong { font-weight: 650; }
em { font-style: italic; }
.fingerprint { margin-top: 18pt; font-family: "Inter", Arial, sans-serif; font-size: 7.5pt; color: #6a6159; }
`;

export async function renderHtml() {
  const rendered = await renderBody({
    file: "app/data/cv.ts",
    body: cvMarkdownBody({ pdf: true }),
    resolveImage: async (src) => {
      throw new Error(`the CV references an image (${src}) and its PDF has no image pipeline.`);
    },
  });
  if (rendered.blockedUrls.length > 0) {
    throw new Error(`the CV carries link(s) the URL allowlist refused: ${rendered.blockedUrls.map((b) => b.url).join(", ")}`);
  }
  const fonts = (
    await Promise.all([
      fontFace("Source Serif 4", "source-serif-4-latin-normal.woff2", "normal"),
      fontFace("Source Serif 4", "source-serif-4-latin-italic.woff2", "italic"),
      fontFace("Inter", "inter-latin-normal.woff2", "normal"),
    ])
  ).join("\n");
  const { person } = CV;
  const host = new URL(SITE_ORIGIN).host;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(`${person.name}, Curriculum Vitae`)}</title>
<style>${fonts}${PRINT_CSS}</style></head><body>
<header class="letterhead">
<p class="edition">Curriculum Vitae · ${escapeHtml(CV.edition)}</p>
<h1>${escapeHtml(`${person.name}, ${person.degree}`)}</h1>
<p>${escapeHtml(`${person.title}, ${person.department}, ${person.org}`)}</p>
<p><a href="${SITE_ORIGIN}/cv">${escapeHtml(`${host}/cv`)}</a> · <a href="${OWNER_ORCID}">ORCID ${OWNER_ORCID.split("/").pop()}</a></p>
</header>
${rendered.html}
<p class="fingerprint">Generated from the same data as ${escapeHtml(`${host}/cv`)}, where every entry can be searched and filtered. ${FINGERPRINT_LABEL} ${cvFingerprint()}.</p>
</body></html>`;
}

async function main() {
  const html = await renderHtml();
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;padding:0 0.85in;font-family:Arial,sans-serif;font-size:7.5pt;color:#6a6159;display:flex;justify-content:space-between"><span>${escapeHtml(`${CV.person.name}, Curriculum Vitae, ${CV.edition}`)}</span><span><span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      tagged: true,
      outline: true,
    });
    await writeFile(CV_PDF_DISK_PATH, pdf);
    console.log(`build:cv-pdf wrote ${path.relative(ROOT, CV_PDF_DISK_PATH)} (${pdf.length} bytes, ${FINGERPRINT_LABEL} ${cvFingerprint()})`);
  } finally {
    await browser.close();
  }
  // A new or changed PDF is a changed public file: the committed manifests follow it.
  console.log("  then: npm run build:assets and npm run build:template-refs, and commit all three.");
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`build:cv-pdf failed. ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
