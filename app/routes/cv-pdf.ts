import { r2ObjectResponse } from "@dustinedwards/site-runtime/r2-object";
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
 * Served as the static file was (site-runtime r2ObjectResponse): `application/pdf`, with an ETag and byte ranges. The
 * cache tag `cv` is what a regenerate purges, with the page, its twin and its charts. The object is made by the first
 * CV save after the binding exists, or by sync_cv_pdf; until then, the 404 says so.
 */
export function loader({ request, context }: Route.LoaderArgs) {
  return r2ObjectResponse(request, getEnv(context).OG, CV_PDF_KEY, {
    contentType: "application/pdf",
    cacheControl: SHARED_CACHE_CONTROL,
    tags: [CV_CACHE_TAG],
    notFound:
      "The CV PDF has not been rendered yet. It is made after a CV save, or by the operator's sync_cv_pdf; " +
      "the same CV is at /cv and /cv.md.",
  });
}
