// The CV's print document and the numbers the PDF is stamped with, shared by the two renderers: the Worker
// (app/lib/cv/pdf.server.ts, Browser Run's quickAction after each CV save) and the offline script
// (scripts/build-cv-pdf.mjs, headless Chrome through puppeteer). One copy of the HTML, so the two cannot draw
// different documents. Nothing here needs a browser, a filesystem or a Worker binding: the markdown pipeline and
// the fonts come in as arguments, because the Worker reads them one way and the script another.

import { toHex } from "../bytes.mjs";
import { OWNER_ORCID, SITE_ORIGIN } from "../seo.ts";
import { cvMarkdownBody, cvMarkdownDocument } from "./markdown.mjs";

/** The words the PDF's last line carries before the fingerprint. */
export const FINGERPRINT_LABEL = "CV data";

/**
 * Eight hex characters of the twin's source (SHA-256, through Web Crypto so the Worker and Node compute the same).
 * The PDF prints it, and the stored object carries it as custom metadata, so a PDF rendered from other data than
 * the CV now holds is a difference two sides can compare.
 *
 * @param {import("./entries.mjs").Cv} CV
 * @returns {Promise<string>}
 */
export async function cvFingerprint(CV) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cvMarkdownDocument(CV)));
  return toHex(digest).slice(0, 8);
}

/** @param {Uint8Array} bytes */
function base64(bytes) {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(binary);
}

/** @param {string} text */
export function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** @param {string} family @param {Uint8Array} bytes @param {string} style */
export function fontFaceRule(family, bytes, style) {
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${base64(bytes)}) format("woff2");font-style:${style};font-weight:100 900;}`;
}

/** The three faces the print document uses: file name, family and style, for whoever reads them. */
export const PDF_FONTS = /** @type {const} */ ([
  { file: "source-serif-4-latin-normal.woff2", family: "Source Serif 4", style: "normal" },
  { file: "source-serif-4-latin-italic.woff2", family: "Source Serif 4", style: "italic" },
  { file: "inter-latin-normal.woff2", family: "Inter", style: "normal" },
]);

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

/**
 * The print document for a resolved CV: the letterhead, the twin's markdown through the site's pipeline, the
 * fonts inlined, and the fingerprint. A function of the CV alone, so whatever holds a CV (the script from the
 * files, the Worker from D1) renders the same page.
 *
 * @param {import("./entries.mjs").Cv} CV
 * @param {{ renderBody: (input: { file: string, body: string, resolveImage: (src: string) => Promise<never> }) => Promise<{ html: string, blockedUrls: Array<{ url: string }> }>, fontCss: string }} deps
 *   the site's markdown pipeline, and the `@font-face` rules for PDF_FONTS
 */
export async function renderCvHtml(CV, { renderBody, fontCss }) {
  const rendered = await renderBody({
    file: "content/cv",
    body: cvMarkdownBody(CV, { pdf: true }),
    resolveImage: async (src) => {
      throw new Error(`the CV references an image (${src}) and its PDF has no image pipeline.`);
    },
  });
  if (rendered.blockedUrls.length > 0) {
    throw new Error(`the CV carries link(s) the URL allowlist refused: ${rendered.blockedUrls.map((b) => b.url).join(", ")}`);
  }
  const { person } = CV;
  const host = new URL(SITE_ORIGIN).host;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(`${person.name}, Curriculum Vitae`)}</title>
<style>${fontCss}${PRINT_CSS}</style></head><body>
<header class="letterhead">
<p class="edition">Curriculum Vitae · ${escapeHtml(CV.edition)}</p>
<h1>${escapeHtml(`${person.name}, ${person.degree}`)}</h1>
<p>${escapeHtml(`${person.title}, ${person.department}, ${person.org}`)}</p>
<p><a href="${SITE_ORIGIN}/cv">${escapeHtml(`${host}/cv`)}</a> · <a href="${OWNER_ORCID}">ORCID ${OWNER_ORCID.split("/").pop()}</a></p>
</header>
${rendered.html}
<p class="fingerprint">Generated from the same data as ${escapeHtml(`${host}/cv`)}, where every entry can be searched and filtered. ${FINGERPRINT_LABEL} ${await cvFingerprint(CV)}.</p>
</body></html>`;
}

/**
 * The page.pdf() options, in the form puppeteer and Browser Run's quickAction("pdf") both read (every field is in
 * quickAction's documented pdfOptions). `format` is lower case, which both accept.
 *
 * @param {import("./entries.mjs").Cv} CV
 */
export function cvPdfOptions(CV) {
  return {
    format: /** @type {"letter"} */ ("letter"),
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;padding:0 0.85in;font-family:Arial,sans-serif;font-size:7.5pt;color:#6a6159;display:flex;justify-content:space-between"><span>${escapeHtml(`${CV.person.name}, Curriculum Vitae, ${CV.edition}`)}</span><span><span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    tagged: true,
    outline: true,
  };
}
