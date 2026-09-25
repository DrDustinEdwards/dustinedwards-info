import { AdminKitSection } from "~/components/playground-ui/admin-kit";
import { CompositesSection } from "~/components/playground-ui/composites";
import { FoundationSection } from "~/components/playground-ui/foundation";
import { GapsSection } from "~/components/playground-ui/gaps";
import { PaletteTokensSection } from "~/components/playground-ui/palette-tokens";
import { PaperKitSection } from "~/components/playground-ui/paper-kit";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { SITE, pageMeta, publicHtmlHeaders } from "~/lib/seo";

import "~/styles/prose.css";
import "~/styles/playground-ui.css";

/**
 * A fixture: three gates measure composited pixels, so the page carries the composites (a photo
 * under a scrim, a social card, code in prose). Nothing can force :hover in a screenshot, so every
 * state rule also has a `data-demo` selector sharing its block. Every form is a GET: a public page
 * must not carry the Admin kit's real POSTs.
 */
export function headers() {
  return new Headers(publicHtmlHeaders());
}

export function meta() {
  return pageMeta({
    title: `UI inventory | ${SITE.name}`,
    description:
      "Every component of the foundation, the Paper kit and the Admin kit, in both themes and " +
      "every state, with one swatch per palette token.",
    path: "/playground/ui",
  });
}

export default function PlaygroundUi() {
  return (
    <>
      <SiteHeader />
      <main className="pgui-page" id="main" tabIndex={-1}>
        <header className="pgui-intro">
          <h1>UI inventory</h1>
          <p>
            Every component of the foundation, the Paper kit and the Admin kit, rendered in both
            themes and in every state each one has. It is a fixture before it is a page: what is
            on it is what the browser and contrast gates can see.
          </p>
          <p>
            Hover, focus and active cannot be held open for a screenshot, so each of those
            specimens carries a <code>data-demo</code> attribute that shares one declaration
            block with the real pseudo-class. Every form on this page is a GET back to this page.
          </p>
        </header>

        <FoundationSection />

        <PaperKitSection />

        <AdminKitSection />

        <CompositesSection />

        <PaletteTokensSection />

        <GapsSection />

        {/* Room below the fold, so a capture can scroll the page rather than fit it. */}
        <div className="pgui-scroll-room" aria-hidden="true" />
      </main>
      <ShellFooter />
    </>
  );
}
