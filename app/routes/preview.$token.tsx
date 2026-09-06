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
 * A draft, shown to whoever holds the link. Feature G.
 *
 * ## WHY THIS ROUTE IS TOP LEVEL, AND WHY THAT IS THE SECURITY DESIGN
 *
 * The obvious placement is under the post route, as a query parameter or a
 * second path segment on `/blog/:slug`. That would be wrong, and not by a
 * little.
 *
 * `blog.$slug.tsx` exports `headers()` returning `SHARED_CACHE_CONTROL` with
 * `Vary: Accept, Cookie`. Workers Cache sits in front of this Worker and THE
 * CACHE KEY DOES NOT INCLUDE COOKIES. What makes that safe today is the
 * cookieless-only downgrade in `workers/app.ts`: a request that carries a cookie
 * gets `private, no-store` and is never stored, so the only variant that can
 * exist is the one for readers who are not signed in.
 *
 * **A reviewer holding a preview link carries no cookie.** They are exactly the
 * shape of request the downgrade does not fire for. Had the preview shared a
 * route with the public post, one unauthenticated preview fetch would have been
 * stored under a public cache entry and served to anyone who asked for that path
 * for the next ten minutes, with no session and no token. That is an unpublished
 * post on a shared cache, arrived at without anybody making a mistake in this
 * file.
 *
 * So the placement is the control. `PREVIEW_HEADERS` below has NO public branch
 * to reach: there is no condition under which this route emits a cacheable
 * response, because the alternative does not exist in the module. `Vary: Cookie`
 * is declared for correctness rather than as protection, since `no-store` has
 * already settled the question.
 *
 * ## Everything else
 *
 * The token is a lookup key, not a claim. The slug comes out of the KV record it
 * names and never out of the URL, so nothing a caller types selects a post.
 *
 * EVERY failure returns the same 404 the post route returns, byte for byte,
 * because `data("Not found", { status: 404 })` is the same call and the root
 * ErrorBoundary renders it identically. Unknown token, expired token, revoked
 * token, malformed token, deleted post, published post: one response. A caller
 * cannot learn whether a token ever existed, and cannot learn whether a slug is
 * a real post, because they never get to name a slug in the first place.
 *
 * The page renders through the REAL path: the same component `/blog/:slug`
 * renders, from the same projection, over the same stored `html` column that the
 * publish pipeline wrote. There is no second renderer and no preview-shaped
 * approximation of one, which is the only thing that makes "this is what will
 * publish" true rather than hopeful.
 */

/**
 * The three headers, as ONE declaration read by `headers()` and by the 429.
 *
 * `check:headers` parses this constant and compares it against its own
 * transcription of the ratification, which is why the values are literals here
 * rather than imported constants. Importing `SHARED_CACHE_CONTROL` is the exact
 * mistake a copy-paste from `blog.$slug.tsx` would make, and the gate is written
 * to name it.
 */
const PREVIEW_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  Vary: "Cookie",
};

/**
 * The rate limit, as middleware rather than as the first lines of the loader.
 *
 * A document route's loader cannot return a raw Response: React Router hands it
 * to the component as `loaderData`, which 500s on the first property read. That
 * is measured and is recorded on `blog.$slug.tsx`, which uses middleware for the
 * same reason. Throwing would reach the ErrorBoundary and lose the headers.
 *
 * It runs BEFORE anything is looked up, so a refusal reveals nothing: at this
 * point the Worker has not read KV, has not read D1, and does not know whether
 * the token means anything.
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
   * `mentions: []`, AND ITS ABSENCE WAS A 500 ON EVERY PREVIEW.
   *
   * MEASURED 2026-09-06, the first time anything drove this route: every
   * `/preview/:token` answered 500 with `TypeError: Cannot read properties of
   * undefined (reading 'length')` from `BlogPost`. It had been doing so since
   * `e839bfc` on 2026-09-04, and it shipped.
   *
   * The component reads `mentions.length` to decide whether to render the
   * section. `blogPostView` does not carry the field, deliberately and for the
   * reason recorded on the read in `blog.$slug.tsx`: a draft has no readers and
   * therefore no approved mentions, so the query has no business running here.
   * That reasoning is intact. What was missing is the SHAPE: the projection's
   * whole claim is that a reviewer sees what a reader would see, and a
   * component rendered against a payload missing a field it destructures does
   * not see anything at all.
   *
   * **TYPECHECK CANNOT SEE THIS AND WILL NOT START.** `preview.$token.tsx`
   * re-exports `blog.$slug`'s default export, so the component is typed against
   * THAT route's `loaderData` while being rendered with this one's. The
   * re-export is what makes the two pages provably identical and is also what
   * hides the mismatch, which is why the gate that found it is a browser
   * driving a seeded token (`check:browser`, section 4a) rather than `tsc`.
   *
   * Empty rather than read, and empty is the honest value: an unpublished post
   * has no approved mention by construction.
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
   * NOINDEX IN THE MARKUP AS WELL AS ON THE WIRE, and the redundancy is the
   * point. `X-Robots-Tag` is the control, because a crawler that never renders
   * still sees it and because a header cannot be stripped by anything between
   * here and the reader. The meta tag is the belt: it survives the page being
   * saved, re-served, or fetched by something that reads HTML and ignores
   * headers.
   *
   * NO CANONICAL, deliberately. Pointing at /blog/<slug> would name a URL that
   * 404s while the post is a draft, and pointing here would be asking to have
   * this indexed. The page also carries no og: tags: there is nothing to preview
   * and a link unfurling an unpublished title in a chat window is the leak this
   * feature exists to control.
   */
  return [
    { title: `Preview: ${loaded.post.title} | ${SITE.name}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/**
 * THE SAME COMPONENT, not a copy of it and not a variant of it.
 *
 * Re-exported rather than imported and wrapped, so there is exactly one function
 * on this site that renders a post page. A wrapper would be a second place for
 * the two to differ, and the whole claim of a preview is that they cannot.
 *
 * It works because the loader above returns `blogPostView`'s output, which is
 * what `/blog/:slug`'s loader returns, from the same function.
 */
export { default } from "./blog.$slug";
