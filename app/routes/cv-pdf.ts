import { getEnv } from "~/lib/context";
import { CV_PDF_KEY } from "~/lib/cv/pdf.server";
import { CV_CACHE_TAG } from "~/lib/cv/route";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";

import type { Route } from "./+types/cv-pdf";

/**
 * The CV's PDF at /dustin-edwards-cv.pdf, the address it has always had. It was a committed static file; it is now
 * the one object the Worker renders after each CV save and keeps in R2 (app/lib/cv/pdf.server.ts, docs/CV.md). A
 * static file here would win over this route, so the committed PDF is gone.
 *
 * Served as the static file was: `application/pdf`, inline, with an ETag and byte ranges. The cache tag `cv` is what
 * a regenerate purges, with the page, its twin and its charts.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);

  if (request.method === "HEAD") {
    const head = await env.OG.head(CV_PDF_KEY);
    if (!head) return missing();
    return new Response(null, { status: 200, headers: headersFor(head, head.size) });
  }

  const rangeRequested = request.headers.has("range");
  const object = await env.OG.get(CV_PDF_KEY, rangeRequested ? { range: request.headers } : undefined);
  if (!object) return missing();

  if (!rangeRequested && request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, { status: 304, headers: { etag: object.httpEtag, "cache-tag": CV_CACHE_TAG } });
  }

  const headers = headersFor(object, object.size);
  if (object.range && rangeRequested) {
    const size = object.size;
    const range = object.range as { offset?: number; length?: number; suffix?: number };
    const start = range.suffix !== undefined ? Math.max(0, size - range.suffix) : (range.offset ?? 0);
    const length = range.suffix !== undefined ? Math.min(range.suffix, size) : (range.length ?? size - start);
    headers.set("content-range", `bytes ${start}-${start + length - 1}/${size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { status: 200, headers });
}

function headersFor(object: R2Object, size: number) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "application/pdf");
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("content-length", String(size));
  headers.set("cache-control", SHARED_CACHE_CONTROL);
  headers.set("cache-tag", CV_CACHE_TAG);
  return headers;
}

/** The object is made by the first CV save after the binding exists, or by sync_cv_pdf; until then, say so. */
function missing() {
  return new Response(
    "The CV PDF has not been rendered yet. It is made after a CV save, or by the operator's sync_cv_pdf; " +
      "the same CV is at /cv and /cv.md.",
    { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } },
  );
}
