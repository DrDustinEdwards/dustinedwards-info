import { Link } from "react-router";

/**
 * Public site footer. Three regions, three roles, deliberately not merged:
 *
 *   left    copyright, alone
 *   middle  colophon: how this site is built and how to consume it
 *   right   Login, the only doorway to the private plane
 *
 * The Login link is muted, small, lock icon, bottom right ON PURPOSE. It is
 * kept OUT of the colophon nav rather than grouped with it, because the two
 * pull in opposite directions: merged, either Login inherits the colophon's
 * weight and stops being quiet, or the colophon inherits Login's muting and
 * gets ignored. As the footer grows, this is the first thing that will get
 * accidentally normalised into just another link. Do not.
 *
 * The nav carries an aria-label because the header has one too, and two
 * unlabelled navigation landmarks on a page are indistinguishable to a screen
 * reader. The header's gets away with being unlabelled today only because it
 * is currently the only one; that stops being true with this commit.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      {/* The affiliation left this line on 2026-07-29. It is stated once, in
          the homepage hero, and the footer no longer repeats a claim the rest
          of the site stopped making. It survives in the Person JSON-LD, which
          is where a machine looks for an employer. */}
      <p className="muted">© {new Date().getFullYear()} Dustin Edwards</p>

      {/* MIXED ON PURPOSE, and the difference is not a style choice.
          llms.txt and RSS are RESOURCE routes returning a raw Response, so a
          client-side navigation would ask the router for a route module that
          does not exist; they must stay plain anchors. /colophon IS a route
          module, so it takes <Link> like any other page and gets the client-side
          navigation. Do not normalise these to match each other in either
          direction. */}
      <nav className="footer-colophon" aria-label="Colophon">
        <Link to="/colophon">Colophon</Link>
        <a href="/llms.txt">llms.txt</a>
        <a href="/blog/rss.xml">RSS</a>
      </nav>

      <Link to="/login" className="footer-login">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Login
      </Link>
    </footer>
  );
}
