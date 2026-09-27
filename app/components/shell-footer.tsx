import { Link } from "react-router";

import { CapsidIcon, LampIcon, PadlockIcon } from "~/components/private-tool-icons";
import { SiteLogoHeader } from "~/components/site-logo";
import { FOOTER_COLUMNS, type FooterLink, PRIVATE_TOOLS, type PrivateTool, isPair } from "~/lib/footer";
import { GERMOMICS_URL, SITE } from "~/lib/seo";

const PRIVATE_ICONS: Record<PrivateTool["icon"], typeof LampIcon> = {
  lamp: LampIcon,
  padlock: PadlockIcon,
  capsid: CapsidIcon,
};

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
              <a href={GERMOMICS_URL} className="footer-social-link" aria-label="Germomics podcast">
                <img
                  src="/dustin-edwards-germomics-mark.svg"
                  alt=""
                  width="28"
                  height="28"
                  className="footer-social-mark"
                />
              </a>
            </div>
          </div>

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
        <p className="site-shell-footer-note">
          {/* A dated string, not `new Date()`: a computed year could disagree with the cached copy. */}
          &copy; 2026 {SITE.name}. Built on Cloudflare; the stack is on the{" "}
          <Link to="/colophon">colophon</Link>.
        </p>
      </div>
    </footer>
  );
}
