import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { SITE, SITE_ORIGIN, pageMeta, personJsonLd, publicHtmlHeaders } from "~/lib/seo";

import about from "../../content/generated/about.json";

// This page renders into `.prose`, and prose.css is route-scoped since the
// per-route CSS split. A page that uses the class and does not import the sheet
// renders unstyled, which `check:page-payload`'s coverage half catches.
import "~/styles/prose.css";

/**
 * Who this is, in the first person.
 *
 * WHY THE PROSE IS IN MARKDOWN: `/privacy` and `/colophon` are prose in JSX and
 * that is right for them, because every sentence there is tied to a file a reader
 * can check. This page changes on taste, by the person it is about, and asking him
 * to edit a component to move a comma is how a page like this goes stale.
 *
 * THE JSON-LD IS THE HOME PAGE'S, THE SAME FUNCTION. Two `Person` objects for one
 * person, differing in a field, is worse for a machine reader than one of them not
 * existing.
 */
export function headers() {
  // The SHARED builder, never a hand-written pair. check:headers refuses the
  // latter by name.
  return new Headers(publicHtmlHeaders());
}

export function meta() {
  return pageMeta({
    title: `About | ${SITE.name}`,
    description: about.description,
    path: "/about",
  });
}

export default function About() {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <div className="page-inner">
          <header className="page-head">
            <h1>{about.title}</h1>
          </header>

          {/*
           * RENDERED HTML FROM THE BUILD, injected the way a post body is: produced at
           * build time from markdown in this repository, with no third-party input. The URL
           * allowlist ran over it at build time and `buildAbout` refuses on a blocked link
           * rather than shipping a demoted one.
           */}
          <div className="prose" dangerouslySetInnerHTML={{ __html: about.html }} />
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd(SITE_ORIGIN)) }}
        />
      </main>
      <ShellFooter />
    </>
  );
}
