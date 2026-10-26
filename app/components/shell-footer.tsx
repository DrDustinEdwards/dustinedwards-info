import { Link, useLocation } from "react-router";

import { GermomicsMark } from "~/components/germomics-mark";
import { CapsidIcon, FlaskIcon, GearIcon, LampIcon, LockIcon } from "~/components/private-tool-icons";
import {
  BRAND_PROFILES,
  type FooterLink,
  PRIVATE_TOOLS,
  type PrivateTool,
  SITE_HEADING,
  SITE_LINKS,
  SOCIAL_LINKS,
  TOOLS_HEADING,
} from "~/lib/footer";
import { sectionOf } from "~/lib/running-head";
import { SITE } from "~/lib/seo";

const PRIVATE_ICONS: Record<PrivateTool["icon"], typeof LampIcon> = {
  lamp: LampIcon,
  gear: GearIcon,
  capsid: CapsidIcon,
  flask: FlaskIcon,
};

/** Where the department is: Tarleton's main campus. */
const ADDRESS_PLACE = "Stephenville, Texas";

/** X's own logo path, unaltered, in the footer's ink. */
function XMark() {
  return (
    <svg className="footer-social-mark" viewBox="0 0 1200 1227" width="27" height="28" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
      />
    </svg>
  );
}

/** A route through Link; a file, feed or other site as a plain anchor, which Link would try to route. */
function FooterAnchor({ link }: { link: FooterLink }) {
  const routed = !link.external && !/\.[a-z]+$/.test(link.to);
  if (routed) return <Link to={link.to}>{link.label}</Link>;
  return (
    <a href={link.to} rel={link.me ? "me" : undefined}>
      {link.label}
    </a>
  );
}

/**
 * The links live in app/lib/footer.ts, where test/footer.test.mjs checks each one. The profile links carry
 * rel="me", and `check:machine-readable` asserts that set equals `OWNER_PROFILES`. The bottom line is the
 * copyright and nothing else (Dustin, 2026-10-11).
 */
export function ShellFooter() {
  const { pathname } = useLocation();
  // The folio is the section's whole number, as the manual numbers a page by its part.
  const folio = pathname === "/" ? "1" : sectionOf(pathname).no.split(".")[0];
  return (
    <footer className="site-shell-footer">
      <div className="tracks">
        {/* The letterhead (capsomer/manual.css): the name as the logotype, the address beside it, the folio. */}
        <div className="cap-letterhead">
          <Link to="/" className="cap-letterhead-logo">
            {SITE.name.split(" ").map((word) => (
              <span key={word}>{word}</span>
            ))}
          </Link>
          <p className="cap-letterhead-address">
            <b>{SITE.department}</b>
            <br />
            {SITE.affiliation}
            <br />
            {ADDRESS_PLACE}
          </p>
          <span className="cap-letterhead-folio">{folio}</span>
        </div>
        <div className="footer-grid">
          {/* Social marks, then the profile links and the feed. */}
          <div className="footer-identity">
            <ul className="footer-social" aria-label="Social media">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.to}>
                  <a href={link.to} className="footer-social-link">
                    {link.mark === "germomics" ? (
                      <span className="footer-social-glyph">
                        <GermomicsMark className="footer-social-mark" />
                      </span>
                    ) : (
                      <span className="footer-social-glyph">
                        <XMark />
                      </span>
                    )}
                    <span className="footer-social-label">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            <ul className="footer-links footer-profiles">
              {BRAND_PROFILES.map((link) => (
                <li key={link.to}>
                  <FooterAnchor link={link} />
                </li>
              ))}
            </ul>
          </div>

          {/* Beside the brand block: Workspace, then Site (Dustin, 2026-10-11). */}
          <div className="footer-columns">
            <nav className="footer-col" aria-labelledby="footer-workspace">
              <h2 className="footer-heading" id="footer-workspace">
                {TOOLS_HEADING}
              </h2>
              <ul className="footer-links">
                {PRIVATE_TOOLS.map((tool) => {
                  const Icon = PRIVATE_ICONS[tool.icon];
                  const content = (
                    <>
                      <Icon className="footer-private-icon" />
                      {tool.label}
                      <LockIcon className="footer-private-lock" strokeWidth={2} />
                    </>
                  );
                  return (
                    <li key={tool.to}>
                      {tool.external ? (
                        <a href={tool.to} rel="nofollow" className="footer-private-link" aria-label={tool.name} title={tool.hover}>
                          {content}
                        </a>
                      ) : (
                        <Link to={tool.to} rel="nofollow" className="footer-private-link" aria-label={tool.name} title={tool.hover}>
                          {content}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
            <nav className="footer-col" aria-labelledby="footer-site">
              <h2 className="footer-heading" id="footer-site">
                {SITE_HEADING}
              </h2>
              <ul className="footer-links">
                {SITE_LINKS.map((item) => (
                  <li key={item.to}>
                    <FooterAnchor link={item} />
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        {/* The end year is computed at render: an edge-cached page can show last year's for a few days after
            January 1, which Dustin accepted (2026-09-27) over a year that is edited by hand. */}
        <p className="site-shell-footer-note">
          &copy; 2006&ndash;{new Date().getFullYear()} {SITE.name}
        </p>
      </div>
    </footer>
  );
}
