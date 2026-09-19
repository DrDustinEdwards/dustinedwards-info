import { data } from "react-router";

import { getDraftPostForPreview, listSeriesParts } from "~/db";
import { blogPostView } from "~/lib/blog-view";
import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import {
  PREVIEW_RATE_LIMIT,
  PREVIEW_RATE_WINDOW_SECONDS,
  checkPreviewRate,
  readPreviewRecord,
} from "~/lib/preview-links.server";
import { resolvePreview } from "~/lib/preview-token.mjs";
import { SITE } from "~/lib/seo";
import type { Route } from "./+types/preview.$token";

/**
 * A draft, shown to whoever holds the link.
 *
 * WHY THIS ROUTE IS TOP LEVEL, AND WHY THAT IS THE SECURITY DESIGN. Workers Cache
 * sits in front of this Worker and THE CACHE KEY DOES NOT INCLUDE COOKIES. What
 * makes the public post route safe is the cookieless-only downgrade: a request
 * carrying a cookie is never stored. A REVIEWER HOLDING A PREVIEW LINK CARRIES NO
 * COOKIE, so they are exactly the request shape the downgrade does not fire for.
 * Had the preview shared a route with the public post, one unauthenticated preview
 * fetch would have been stored under a public cache entry and served to anyone
 * asking for that path. So the placement is the control, and `PREVIEW_HEADERS` has
 * no public branch to reach.
 *
 * The token is a lookup key, not a claim: the slug comes out of the KV record it
 * names and never out of the URL.
 *
 * EVERY failure returns the same 404, byte for byte. Unknown, expired, revoked,
 * malformed, deleted, published: one response, so a caller cannot learn whether a
 * token ever existed.
 *
 * The page renders through the REAL path: the same component, the same projection,
 * the same stored column. There is no preview-shaped approximation, which is the
 * only thing that makes "this is what will publish" true rather than hopeful.
 */

/**
 * ONE declaration read by `headers()` and by the 429. `check:headers` parses
 * this constant and compares it against its own transcription, which is why the
 * values are literals rather than imported constants: importing the shared one is
 * the exact mistake a copy-paste from `blog.$slug.tsx` would make.
 */
const PREVIEW_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  Vary: "Cookie",
};

/**
 * A document route's loader cannot return a raw Response, and throwing would
 * reach the ErrorBoundary and lose the headers.
 *
 * It runs BEFORE anything is looked up, so a refusal reveals nothing: at this point
 * the Worker has not read KV, has not read D1, and does not know whether the token
 * means anything.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    // The edge-set client IP; one statement of the read and its fallback in
    // app/lib/client-ip.ts.
    const ip = clientIp(request);
    const rate = await checkPreviewRate(getEnv(context), ip);
    if (rate.ok) return next();

    return new Response(
      `Too many preview requests. The limit is ${PREVIEW_RATE_LIMIT} per ` +
        `${PREVIEW_RATE_WINDOW_SECONDS} seconds.`,
      {
        status: 429,
        headers: {
          ...PREVIEW_HEADERS,
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": String(rate.retryAfter),
        },
      },
    );
  },
];

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);

  // ONE refusal, reached from six places, so no branch can accidentally answer
  // differently from the others. Identical to what `blog.$slug.tsx` throws.
  const notFound = () => data("Not found", { status: 404 });

  // Shape-checked and read in one call; a malformed token costs no KV read.
  const record = await readPreviewRecord(env, params.token);

  // The slug is the RECORD'S, never the URL's.
  const post = record ? await getDraftPostForPreview(env, record.slug) : null;

  const verdict = resolvePreview({ token: params.token, record, post });
  if (!verdict.ok || !post) throw notFound();

  const seriesParts = post.series ? await listSeriesParts(env, post.series) : [];

  /*
   * `mentions: []`, AND ITS ABSENCE WAS A 500 ON EVERY PREVIEW. The component reads
   * `mentions.length` to decide whether to render the section, and `blogPostView`
   * deliberately does not carry the field: a draft has no readers and therefore no
   * approved mentions.
   */
  return { ...blogPostView(post, seriesParts), mentions: [] };
}

export function headers() {
  return new Headers(PREVIEW_HEADERS);
}

export function meta({ loaderData: loaded }: Route.MetaArgs) {
  if (!loaded) {
    return [{ title: `Not found | ${SITE.name}` }];
  }

  /*
   * NOINDEX IN THE MARKUP AS WELL AS ON THE WIRE. The header is the control,
   * because a crawler that never renders still sees it; the meta tag is the belt.
   *
   * NO CANONICAL: pointing at `/blog/<slug>` would name a URL that 404s while the
   * post is a draft, and pointing here would be asking to have this indexed. No
   * `og:` tags either: a link unfurling an unpublished title in a chat window is the
   * leak this feature exists to control.
   */
  return [
    { title: `Preview: ${loaded.post.title} | ${SITE.name}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/**
 * THE SAME COMPONENT, re-exported rather than imported and wrapped, so there is
 * exactly one function on this site that renders a post page. A wrapper would be a
 * second place for the two to differ, and the whole claim of a preview is that they
 * cannot.
 */
export { default } from "./blog.$slug";
