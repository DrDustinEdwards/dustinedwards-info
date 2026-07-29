import { Link } from "react-router";

/**
 * Public site footer. The Login link is the only doorway to the private plane,
 * kept quiet on purpose: muted, small, lock icon, bottom right.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      {/* The affiliation left this line on 2026-07-29. It is stated once, in
          the homepage hero, and the footer no longer repeats a claim the rest
          of the site stopped making. It survives in the Person JSON-LD, which
          is where a machine looks for an employer. */}
      <p className="muted">© {new Date().getFullYear()} Dustin Edwards</p>
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
