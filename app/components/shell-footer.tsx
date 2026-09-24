import { Link } from "react-router";

import { SiteLogoHeader } from "~/components/site-logo";
import {
  GERMOMICS_URL,
  GERMOMICS_X_URL,
  OWNER_FACULTY_PAGE,
  OWNER_ORCID,
  OWNER_PUBMED,
  OWNER_SCHOLAR,
  SITE,
} from "~/lib/seo";

/**
 * THE FOOTER (ruling 135): the identity block on the left, then five link columns in the order
 * Dustin set, left-aligned on the grid. On a phone they stack, identity first.
 *
 * THE MACHINE LINKS ARE NOT DECORATION. `/llms.txt` and the feeds are how an agent reads this site,
 * so they stay in every page's footer, now under Writing.
 *
 * THE PROFILE LINKS CARRY rel="me", and `check:machine-readable` asserts that set equals
 * `OWNER_PROFILES`. The same URLs are the Person record's sameAs, from the same constants.
 *
 * THE X MARK IS X's OWN PATH, from its brand toolkit's logo.svg, unaltered. Only the fill changes,
 * between the two colors X allows: black on the light theme, white on the dark.
 */
export function ShellFooter() {
  return (
    <footer className="site-shell-footer">
      <div className="tracks">
        <div className="footer-grid">
          <div className="footer-identity">
            <Link to="/" className="footer-home">
              <SiteLogoHeader className="footer-logo" />
              <span className="footer-name">{SITE.name}</span>
            </Link>
            <div className="footer-social">
              <a href={GERMOMICS_URL} className="footer-social-link" aria-label="Germomics podcast">
                <img
                  src="/dustin-edwards-germomics-mark.svg"
                  alt=""
                  width="28"
                  height="28"
                  className="footer-social-mark"
                />
              </a>
              <a href={GERMOMICS_X_URL} className="footer-social-link" aria-label="Germomics on X">
                <svg
                  className="footer-social-mark footer-x"
                  viewBox="0 0 1200 1227"
                  width="27"
                  height="28"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    fill="currentColor"
                    d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
                  />
                </svg>
              </a>
            </div>
          </div>

          <nav className="footer-col" aria-labelledby="footer-research">
            <h2 className="footer-heading" id="footer-research">
              Research
            </h2>
            <ul className="footer-links">
              <li>
                <Link to="/publications">Publications</Link>
              </li>
              <li>
                <Link to="/projects">Projects</Link>
              </li>
              <li>
                <Link to="/playground">Playground</Link>
              </li>
              <li className="footer-pair">
                <span>Citations</span>
                <a href="/publications.bib">BibTeX</a>
                <a href="/publications.ris">RIS</a>
              </li>
            </ul>
          </nav>

          <nav className="footer-col" aria-labelledby="footer-writing">
            <h2 className="footer-heading" id="footer-writing">
              Writing
            </h2>
            <ul className="footer-links">
              <li>
                <Link to="/blog">Blog</Link>
              </li>
              <li>
                <Link to="/search">Search</Link>
              </li>
              <li className="footer-pair">
                <span>Feeds</span>
                <a href="/blog/rss.xml">RSS</a>
                <a href="/blog/atom.xml">Atom</a>
                <a href="/blog/feed.json">JSON</a>
              </li>
              <li className="footer-pair">
                <span>For machines</span>
                <a href="/llms.txt">llms.txt</a>
                <a href="/llms-full.txt">llms-full.txt</a>
              </li>
            </ul>
          </nav>

          <nav className="footer-col" aria-labelledby="footer-students">
            <h2 className="footer-heading" id="footer-students">
              Students
            </h2>
            <ul className="footer-links">
              <li>
                <Link to="/phage-discovery">Phage discovery</Link>
              </li>
            </ul>
          </nav>

          <nav className="footer-col footer-col-profiles" aria-labelledby="footer-profiles">
            <h2 className="footer-heading" id="footer-profiles">
              Profiles
            </h2>
            <ul className="footer-links">
              <li>
                <a href={OWNER_SCHOLAR} rel="me">
                  Google Scholar
                </a>
              </li>
              <li>
                {/* ORCID's display convention: the iD icon beside the full https address. */}
                <a href={OWNER_ORCID} rel="me" className="footer-orcid">
                  <img
                    src="/dustin-edwards-orcid-id.svg"
                    alt="ORCID iD"
                    width="16"
                    height="16"
                    className="footer-orcid-icon"
                  />
                  <span>{OWNER_ORCID}</span>
                </a>
              </li>
              <li>
                <a href={OWNER_PUBMED} rel="me">
                  PubMed
                </a>
              </li>
            </ul>
          </nav>

          <nav className="footer-col" aria-labelledby="footer-site">
            <h2 className="footer-heading" id="footer-site">
              Site
            </h2>
            <ul className="footer-links">
              <li>
                <Link to="/about">About</Link>
              </li>
              <li>
                <a href={OWNER_FACULTY_PAGE}>Contact</a>
              </li>
              <li>
                <Link to="/colophon">Colophon</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy</Link>
              </li>
              <li>
                <Link to="/login">Log in</Link>
              </li>
            </ul>
          </nav>
        </div>
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
