import { Link } from "react-router";

import { SITE } from "~/lib/seo";

/**
 * The Paper, Glass, Light footer.
 *
 * TONAL, not a second bar: no purple fill, no logo repeat, no social row. A footer
 * that repeats the header's brand is a second header, and this one exists to hold
 * the links that are not destinations.
 *
 * THE MACHINE LINKS ARE NOT DECORATION. `/llms.txt` and the per-post markdown
 * twins are how an agent reads this site, and agents are the audience the brief
 * names as mattering most, so they are in every page's footer rather than on the
 * colophon alone.
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
           * A DATED STRING, not a computed year. `new Date()` in a component body differs
           * between the server render and any later render, and on an unhydrated public page
           * it would be the only thing that could disagree with the cached copy.
           */}
          &copy; 2026 {SITE.name}. Built on Cloudflare; the stack is on the{" "}
          <Link to="/colophon">colophon</Link>.
        </p>
      </div>
    </footer>
  );
}
