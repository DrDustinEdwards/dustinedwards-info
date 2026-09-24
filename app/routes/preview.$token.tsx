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
 * Top level for security: the cache key ignores cookies, and a reviewer holding a preview link
 * carries none, so under the public post route one preview fetch would be stored publicly. The slug
 * comes from the KV record, never the URL. Every failure is the same 404, byte for byte.
 */

/** Literals, not the shared constant: importing that is the mistake a copy from `blog.$slug.tsx` would make. */
const PREVIEW_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  Vary: "Cookie",
};

/**
 * Not a throw, which would reach the ErrorBoundary and lose the headers. Runs before any lookup, so
 * a refusal reveals nothing about the token.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
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

  // One refusal, identical to `blog.$slug.tsx`'s 404, so no branch can answer differently.
  const notFound = () => data("Not found", { status: 404 });

  const record = await readPreviewRecord(env, params.token);

  // The slug is the record's, never the URL's.
  const post = record ? await getDraftPostForPreview(env, record.slug) : null;

  const verdict = resolvePreview({ token: params.token, record, post });
  if (!verdict.ok || !post) throw notFound();

  const seriesParts = post.series ? await listSeriesParts(env, post.series) : [];

  /* `mentions: []`: the component reads `mentions.length`, and `blogPostView` omits the field. */
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
   * Noindex in the markup as well as the header. No canonical and no `og:` tags: an unfurled
   * unpublished title is the leak this feature exists to control.
   */
  return [
    { title: `Preview: ${loaded.post.title} | ${SITE.name}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/** Re-exported, not wrapped, so exactly one function renders a post page. */
export { default } from "./blog.$slug";
