import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { SITE, SITE_ORIGIN, pageMeta, personJsonLd, publicHtmlHeaders } from "~/lib/seo";

import about from "../../content/generated/about.json";

// This page renders into `.prose`, and prose.css is route-scoped since the
// per-route CSS split. A page that uses the class and does not import the sheet
// renders unstyled, which check:page-payload's coverage half is what catches.
import "~/styles/prose.css";

/**
 * Who this is, in the first person.
 *
 * ## WHY IT EXISTS, and it is the one finding in the audit that was not a bug
 *
 * The pre-cutover audit's fourth part asked what a stranger does not
 * understand, and the first three questions off the home page were: who is
 * this, where do they work, and how do I contact them. The university was in
 * the `Person` JSON-LD and in no human-visible text anywhere on the site. The
 * footer offered Colophon, Privacy, llms.txt, RSS and Login, and no address.
 * A site whose front page is an evidence table and whose deepest page is a
 * generated inventory of its own bindings had nowhere to say what the person
 * does for a living.
 *
 * ## WHY THE PROSE IS IN MARKDOWN
 *
 * `content/about.md`, rendered at build time by `build:content` through the
 * same `renderBody` the corpus uses. `/privacy` and `/colophon` are prose in
 * JSX and that is right for them: every sentence on those pages is tied to a
 * file a reader can check, so they change when the code changes. This page
 * changes on taste, by the person it is about, and asking him to edit a
 * component to move a comma is how a page like this goes stale.
 *
 * The grounds for rendering it at build time rather than in the Worker are on
 * `buildAbout` in `scripts/build-content.mjs`: the public plane must not grow
 * a second markdown renderer and must not pay for the first one on a static
 * page.
 *
 * ## THE JSON-LD IS THE HOME PAGE'S, THE SAME FUNCTION
 *
 * `personJsonLd`, not a second graph assembled here. Two `Person` objects for
 * one person, differing in a field, is worse for a machine reader than one of
 * them not existing: it is the mirror problem with a search engine holding the
 * stale copy. `url` stays the site origin on both for the same reason, because
 * it identifies the person's site and not the page they are described on.
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
            RENDERED HTML FROM THE BUILD, injected the way a post body is, and
            the reasoning at `blog.$slug.tsx` applies unchanged: this markup is
            produced at build time from markdown in this repository, it
            contains no third-party input, and injecting it is the point of
            having one pipeline. The URL allowlist ran over it at build time
            and `buildAbout` refuses on a blocked link rather than shipping a
            demoted one.
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
