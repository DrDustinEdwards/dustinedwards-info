import { data } from "react-router";

import { PageShell } from "~/components/page-shell";
import { getPageByPath } from "~/db/pages";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import { OWNER_PHOTO, SITE, SITE_ORIGIN, pageMeta, profilePageJsonLd, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/about";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "~/styles/prose.css";
import "~/styles/about.css";

const PHOTO_SRC = `/media/${OWNER_PHOTO.key}`;

/**
 * The prose is the page's D1 row (docs/PAGES.md): content/pages/about.md, compiled by the one page
 * compile and rendered by the site's pipeline, so the Worker carries no markdown renderer and an edit
 * saved through Carrel is live at the next request with no deploy. The layout and the JSON-LD stay here:
 * only the front matter and the body moved. The JSON-LD is a ProfilePage whose mainEntity is the home
 * page's Person, by the same `@id`.
 */
export function headers() {
  // The content pages' tag, so a page save purges it (app/lib/cache-purge.server.ts).
  return new Headers(publicHtmlHeaders(CONTENT_PAGE_HTML_TAGS));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const row = await getPageByPath(env, "/about");
  // No row: the content sync has not written it yet. A draft is the signed-in admin's alone, like any page.
  if (!row) throw data(null, { status: 404 });
  if (row.status === "draft" && !(await isAdminViewer(env, request))) throw data(null, { status: 404 });
  const { title, seoTitle, description, html } = row.record;
  return { title, seoTitle, description, html, draft: row.status === "draft" };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  return [
    ...pageMeta({ title: loaderData.seoTitle, description: loaderData.description, path: "/about" }),
    ...(loaderData.draft ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

export default function About({ loaderData }: Route.ComponentProps) {
  const { title, description, html, draft } = loaderData;
  return (
    <PageShell
      trail={
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(profilePageJsonLd(SITE_ORIGIN, { path: "/about", description })),
          }}
        />
      }
    >
      <header className="page-head">
        <h1>{title}</h1>
      </header>
      {draft ? <p>Draft: only you can see this page.</p> : null}

      {/* The same photo the Person record names; the 320 and 640 widths are the thumbnail set /media serves. */}
      <img
        className="about-photo"
        src={`${PHOTO_SRC}?w=640`}
        srcSet={`${PHOTO_SRC}?w=320 320w, ${PHOTO_SRC}?w=640 640w`}
        sizes="(min-width: 46rem) 14rem, 11rem"
        width={OWNER_PHOTO.width}
        height={OWNER_PHOTO.height}
        alt={SITE.name}
        fetchPriority="high"
      />

      {/* The row's HTML: the site's pipeline with the URL allowlist already applied, no third-party input. */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </PageShell>
  );
}
