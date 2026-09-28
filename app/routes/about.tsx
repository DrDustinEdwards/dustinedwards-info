import { PageShell } from "~/components/page-shell";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { OWNER_PHOTO, SITE, SITE_ORIGIN, pageMeta, profilePageJsonLd, publicHtmlHeaders } from "~/lib/seo";

import about from "../../content/generated/about.json";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "~/styles/prose.css";
import "~/styles/about.css";

const PHOTO_SRC = `/media/${OWNER_PHOTO.key}`;

/**
 * The prose is markdown rendered at build time, so the Worker carries no markdown renderer.
 * The JSON-LD is a ProfilePage whose mainEntity is the home page's Person, by the same `@id`.
 */
export function headers() {
  return new Headers(publicHtmlHeaders());
}

export function meta() {
  return pageMeta({
    title: `${SITE.name} | About the virologist at Tarleton State`,
    description: about.description,
    path: "/about",
  });
}

export default function About() {
  return (
    <PageShell
      trail={
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              profilePageJsonLd(SITE_ORIGIN, { path: "/about", description: about.description }),
            ),
          }}
        />
      }
    >
      <header className="page-head">
        <h1>{about.title}</h1>
      </header>

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

      {/* Build-time HTML from repo markdown, URL allowlist already applied; no third-party input. */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: about.html }} />
    </PageShell>
  );
}
