// The CV's PDF: rendered in the Worker by Browser Run after each CV save, kept as ONE object in the OG bucket,
// and served at /dustin-edwards-cv.pdf by app/routes/cv-pdf.ts (docs/CV.md, "The PDF").
//
// THE OBJECT IS DERIVED (hard rule 18). The CV rows are the source and the PDF is a function of them, stamped with
// the fingerprint of the data it was drawn from (cvFingerprint, in custom metadata and on the PDF's last line). A
// failed render never reverts a save: the save has already committed and written D1, and the stale or missing
// object shows as the `cv-pdf-drift` health check, which the watchdog repairs through `sync_cv_pdf`.
//
// WHY OG, NOT MEDIA. OG is the bucket for derived, regenerable objects, with no backup mirror and no site code
// that treats it as irreplaceable. MEDIA is the irreplaceable bucket: a put there queues a backup copy and a
// delete there is policed (check:destructive). The key sits under `derived/`, not `og/`, because build:og prunes
// everything under `og/` that no post references, and would delete this.

import { readCv } from "~/db/cv";
import { purgeCv, type PurgeOutcome } from "~/lib/cache-purge.server";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { cvFingerprint, cvPdfOptions, fontFaceRule, PDF_FONTS, renderCvHtml } from "~/lib/cv/pdf-html.mjs";
import { errorMessage } from "~/lib/error-message.mjs";
import interNormalUrl from "~/fonts/inter-latin-normal.woff2?url";
import serifItalicUrl from "~/fonts/source-serif-4-latin-italic.woff2?url";
import serifNormalUrl from "~/fonts/source-serif-4-latin-normal.woff2?url";

/** The one key. `dustin-edwards-` is ruling 127's prefix for a file the site serves under a name. */
export const CV_PDF_KEY = "derived/dustin-edwards-cv.pdf";

/** The custom-metadata field that carries the fingerprint of the CV data the object was drawn from. */
export const FINGERPRINT_FIELD = "fingerprint";

/** The font URLs the client build emits, by the file name PDF_FONTS names. */
const FONT_URLS: Record<(typeof PDF_FONTS)[number]["file"], string> = {
  "source-serif-4-latin-normal.woff2": serifNormalUrl,
  "source-serif-4-latin-italic.woff2": serifItalicUrl,
  "inter-latin-normal.woff2": interNormalUrl,
};

/** A render that finds a newer CV after it started tries again, this many times at most. */
const MAX_ATTEMPTS = 3;

let fontCssCache: Promise<string> | undefined;

/** The `@font-face` rules, read through the ASSETS binding from the hashed font files the site already serves. */
function fontCss(env: Env): Promise<string> {
  // A failed read is not cached, so one bad fetch is not every later render's error.
  fontCssCache ??= Promise.all(
    PDF_FONTS.map(async ({ file, family, style }) => {
      const url = FONT_URLS[file];
      // The ASSETS binding ignores the hostname and matches only the pathname.
      const response = await env.ASSETS.fetch(new Request(`https://assets.local${url}`));
      if (!response.ok) throw new Error(`The font ${file} is not in the assets (${url} answered ${response.status}).`);
      return fontFaceRule(family, new Uint8Array(await response.arrayBuffer()), style);
    }),
  )
    .then((rules) => rules.join("\n"))
    .catch((error) => {
      fontCssCache = undefined;
      throw error;
    });
  return fontCssCache;
}

/** The PDF bytes for a resolved CV, through Browser Run. Throws, naming what failed. */
export async function renderCvPdf(env: Env, CV: Awaited<ReturnType<typeof readCv>>): Promise<Uint8Array> {
  if (!env.BROWSER) {
    throw new Error("The BROWSER binding is not configured on this Worker, so the CV PDF cannot be rendered (wrangler.jsonc.example).");
  }
  const { renderBody } = await loadPipeline();
  const html = await renderCvHtml(CV, { renderBody, fontCss: await fontCss(env) });
  const response = await env.BROWSER.quickAction("pdf", {
    html,
    pdfOptions: cvPdfOptions(CV),
    gotoOptions: { waitUntil: "load" },
  });
  if (!response.ok) {
    throw new Error(`Browser Run answered ${response.status} for the CV PDF: ${(await response.text()).slice(0, 300)}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  // A 200 that is not a PDF must never replace the one that is.
  if (bytes.length < 1024 || String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error(`Browser Run answered 200 for the CV PDF with ${bytes.length} bytes that are not a PDF.`);
  }
  return bytes;
}

export type CvPdfOutcome =
  | { action: "current"; fingerprint: string }
  | { action: "stored"; fingerprint: string; bytes: number; purged: PurgeOutcome; attempts: number };

/**
 * Makes the stored PDF the one for the CV D1 holds NOW, and returns what it did. Reads D1 itself, so it renders
 * what the page serves whoever calls it.
 *
 * A LATER SAVE CANNOT BE OVERWRITTEN BY AN EARLIER RENDER, and the guarantee is two compares:
 *  1. after the render and before the put, D1's CV is read again; a render of anything but the CV D1 holds then is
 *     discarded and the loop starts over, so a slow render of save A never lands after save B changed the data;
 *  2. the put is conditional on the object being the one the loop read (`onlyIf`), so two renders that both pass
 *     the first compare cannot both win blindly: the loser's put returns null and it re-reads, finds the winner's
 *     fingerprint, and either stops (same data) or renders again (newer data).
 * So the last object standing was drawn from the CV D1 held when it was put.
 */
export async function ensureCvPdf(env: Env): Promise<CvPdfOutcome> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const cv = await readCv(env);
    const fingerprint = await cvFingerprint(cv);
    const stored = await env.OG.head(CV_PDF_KEY);
    if (stored?.customMetadata?.[FINGERPRINT_FIELD] === fingerprint) return { action: "current", fingerprint };

    const bytes = await renderCvPdf(env, cv);

    // Compare 1: the data changed under the render.
    if ((await cvFingerprint(await readCv(env))) !== fingerprint) continue;

    // Compare 2: a conditional put. An object that was not there must still not be there; one that was must
    // still be the one read above.
    const put = await env.OG.put(CV_PDF_KEY, bytes, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { [FINGERPRINT_FIELD]: fingerprint },
      onlyIf: stored ? { etagMatches: stored.etag } : { etagDoesNotMatch: "*" },
    });
    if (put === null) continue;

    return { action: "stored", fingerprint, bytes: bytes.length, purged: await purgeCv("regenerate CV PDF"), attempts: attempt };
  }
  throw new Error(
    `The CV changed (or the stored PDF did) during each of ${MAX_ATTEMPTS} renders, so the PDF was not replaced. ` +
      "Run sync_cv_pdf; if it keeps failing, something is saving the CV continuously.",
  );
}

/**
 * The work a CV save starts after its commit and D1 write. A failure is logged as an alert (the line a log
 * export or a person can find) AND rethrown, so the waitUntil task that carries it fails visibly; the drift check
 * then reports the stale object until sync_cv_pdf repairs it. It never reverts or fails the save.
 */
export async function regenerateCvPdfAfterSave(env: Env, why: string): Promise<CvPdfOutcome> {
  try {
    return await ensureCvPdf(env);
  } catch (error) {
    console.error(JSON.stringify({ alert: "cv-pdf-render-failed", why, detail: errorMessage(error) }));
    throw error;
  }
}

/** The fingerprint the stored object carries, or null when there is no object. For the drift check and the route. */
export async function storedCvPdfFingerprint(env: Env): Promise<string | null> {
  const stored = await env.OG.head(CV_PDF_KEY);
  return stored ? (stored.customMetadata?.[FINGERPRINT_FIELD] ?? "") : null;
}
