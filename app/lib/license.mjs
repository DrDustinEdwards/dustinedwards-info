/**
 * The site's terms are the license on every data set it publishes (Dustin, 2026-10-04): no open license for
 * now, so what may be done with the data is stated in one place. The address is stored once, here; the
 * Dataset JSON-LD names it as `license` (app/lib/seo.ts LICENSE_URL), and every download carries it as a
 * `Link: rel="license"` header, relative so a plain-node caller needs no origin.
 */
export const TERMS_PATH = "/terms";

/** The `Link` header value a data download carries: the CSV, JSON, RIS and BibTeX exports have no room for a field. */
export const LICENSE_LINK = `<${TERMS_PATH}>; rel="license"`;
