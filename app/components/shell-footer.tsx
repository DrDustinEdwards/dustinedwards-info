import { Link } from "react-router";

import { CapsidIcon, LampIcon, PadlockIcon } from "~/components/private-tool-icons";
import { SiteLogoHeader } from "~/components/site-logo";
import { FOOTER_COLUMNS, type FooterLink, PRIVATE_TOOLS, type PrivateTool, SOCIAL_LINKS, isPair } from "~/lib/footer";
import { SITE } from "~/lib/seo";

const PRIVATE_ICONS: Record<PrivateTool["icon"], typeof LampIcon> = {
  lamp: LampIcon,
  padlock: PadlockIcon,
  capsid: CapsidIcon,
};

/** X's own logo path, unaltered; only the fill changes, between the two colors X allows. */
function XMark() {
  return (
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
 * The links live in app/lib/footer.ts, where test/footer.test.mjs checks each one. `/llms.txt` and the
 * feeds stay in every footer: they are how an agent reads this site. The profile links carry rel="me",
 * and `check:machine-readable` asserts that set equals `OWNER_PROFILES`.
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
              {SOCIAL_LINKS.map((link) => (
                <a key={link.to} href={link.to} className="footer-social-link" aria-label={link.label}>
                  {link.mark === "germomics" ? (
                    <img
                      src="/dustin-edwards-germomics-mark.svg"
                      alt=""
                      width="28"
                      height="28"
                      className="footer-social-mark"
                    />
                  ) : (
                    <XMark />
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Beside the brand block on desktop: the link columns, three across and two rows deep. */}
          <div className="footer-columns">
            {FOOTER_COLUMNS.map((column) => (
              <nav key={column.id} className="footer-col" aria-labelledby={`footer-${column.id}`}>
                <h2 className="footer-heading" id={`footer-${column.id}`}>
                  {column.heading}
                </h2>
                <ul className="footer-links">
                  {column.items.map((item) =>
                    isPair(item) ? (
                      <li key={item.label} className="footer-pair">
                        <span>{item.label}</span>
                        {item.links.map((link) => (
                          <FooterAnchor key={link.to} link={link} />
                        ))}
                      </li>
                    ) : (
                      <li key={item.to}>
                        <FooterAnchor link={item} />
                      </li>
                    ),
                  )}
                </ul>
                {column.id === "site" ? (
                  <ul className="footer-links footer-private" aria-label="Private tools">
                    {PRIVATE_TOOLS.map((tool) => {
                      const Icon = PRIVATE_ICONS[tool.icon];
                      const content = (
                        <>
                          <Icon className="footer-private-icon" />
                          {tool.label}
                        </>
                      );
                      return (
                        <li key={tool.to}>
                          {tool.external ? (
                            <a href={tool.to} className="footer-private-link" aria-label={tool.name}>
                              {content}
                            </a>
                          ) : (
                            <Link to={tool.to} className="footer-private-link" aria-label={tool.name}>
                              {content}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </nav>
            ))}
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
