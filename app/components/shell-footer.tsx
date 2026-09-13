import { Link } from "react-router";

import { SITE } from "~/lib/seo";

/**
 * The Paper, Glass, Light footer. Ruling 65, Part A step 6b.
 *
 * TONAL, not a second bar. Limestone ground, one dust rule above it,
 * sentence-case purple links. No purple fill, no logo repeat, no social row, no
 * tracked caps: a footer that repeats the header's brand is a second header,
 * and this one exists to hold the links that are not destinations.
 *
 * `.tracks` goes on the inner div as well as on `main`, so footer content sits
 * in the same column as the prose above it without a second grid definition.
 *
 * THE THREE NAV LINKS ARE THE THREE THAT ARE NOT DESTINATIONS: a policy page, a
 * sandbox and an auth entry. Playground moved here from the header in this
 * build, which is also what took the old header's fourth nav link out of the
 * row step 3's 768 measurement was taken against.
 *
 * THE MACHINE LINKS ARE NOT DECORATION. `/llms.txt` and the per-post markdown
 * twins are how an agent reads this site, and the brief names AI agents and
 * crawlers as the audience that matters most, so they are in the footer of
 * every page rather than on the colophon alone.
 */
export function ShellFooter() {
  return (
    <footer className="site-shell-footer">
      <div className="tracks">
        <nav className="site-shell-footer-nav" aria-label="Elsewhere">
          <Link to="/privacy">Privacy</Link>
          <Link to="/playground">Playground</Link>
          <Link to="/colophon">Colophon</Link>
          <Link to="/login">Log in</Link>
        </nav>
        <nav className="site-shell-footer-nav" aria-label="Feeds and machine formats">
          <a href="/blog/rss.xml">RSS</a>
          <a href="/blog/feed.json">JSON feed</a>
          <a href="/llms.txt">llms.txt</a>
          <a href="/llms-full.txt">llms-full.txt</a>
        </nav>
        <p className="site-shell-footer-note">
          {/*
            A DATED STRING, not a computed year. `new Date()` in a component
            body is a value that differs between the server render and any
            later render of the same document, and on an unhydrated public page
            it would also be the only thing on the page that could disagree
            with the cached copy. The copyright year moves when somebody edits
            it, which is once a year and is not a defect.
          */}
          &copy; 2026 {SITE.name}. Built on Cloudflare; the stack is on the{" "}
          <Link to="/colophon">colophon</Link>.
        </p>
      </div>
    </footer>
  );
}
