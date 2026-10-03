import { Outlet } from "react-router";

/*
 * The public plane's stylesheets live here, not in root.tsx, so the admin plane (which is Capsomer's,
 * and whose layered CSS an unlayered reset would override) never loads them. Every route outside
 * /admin and /api nests under this layout.
 */
import "~/app.css";

// Module imports, not @import in app.css, which CSS drops after any rule.
// The order is the cascade: do not sort.
import "~/styles/public-chrome.css";
import "~/styles/page-shell.css";
import "~/styles/chrome-nav.css";
import "~/styles/skip-link.css";
import "~/styles/motion-print.css";
import "~/styles/search-trigger.css";
// Last: shell.css must win where it and page-shell.css touch the same thing.
import "~/styles/shell.css";

export default function PublicLayout() {
  return <Outlet />;
}
