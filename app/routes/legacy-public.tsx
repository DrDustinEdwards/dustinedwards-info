import { Outlet } from "react-router";

import { SiteErrorPage } from "~/components/error-page";

import type { Route } from "./+types/legacy-public";

/*
 * TEMPORARY, and the ONE place the old public design's global CSS is loaded. The admin is Capsomer's and
 * loads none of it (an unlayered reset would override Capsomer's layered rules), so every route outside
 * /admin and /api nests under this layout. When the public site is rebuilt on Capsomer, delete this file,
 * its `layout(...)` wrapper in routes.ts, routes/not-found.tsx's reason to exist, and the old sheets it
 * imports; nothing in the admin reads any of them.
 */
import "~/app.css";

// Capsomer's site header (site-header.tsx) and what it is built on, on every public page: its tokens, the
// shared popover (the panels' placing and the tips) and dialog (the phone's sheet). Layered, so the site's
// unlayered sheets below win wherever they touch the same thing.
import "capsomer/fonts.css";
import "capsomer/tokens.css";
import "capsomer/site-dustinedwards.css";
import "capsomer/popover.css";
import "capsomer/dialog.css";
import "capsomer/site-header.css";
// Capsomer's utilities without its base: the family arrow on the footer's links.
import "capsomer/utilities.css";
// Capsomer's link system: the mark for a link that leaves the site, opens a file or sends mail (app.css draws
// the rest of each link from Capsomer's link tokens).
import "capsomer/link.css";
import "capsomer/theme-switch.css";
// The manual theme, public pages only: running head, parts, form boxes, index, checklist, plate, signs, letterhead.
import "capsomer/manual.css";
import "capsomer/family-footer.css";
// The error page (components/error-page.tsx): Capsomer's, the failed Empty with its buttons.
import "capsomer/button.css";
import "capsomer/empty.css";
import "capsomer/error-page.css";

// Module imports, not @import in app.css, which CSS drops after any rule.
// The order is the cascade: do not sort.
import "~/styles/public-chrome.css";
import "~/styles/page-shell.css";
import "~/styles/chrome-nav.css";
import "~/styles/skip-link.css";
import "~/styles/motion-print.css";
// Last: shell.css must win where it and page-shell.css touch the same thing.
import "~/styles/shell.css";

export default function PublicLayout() {
  return <Outlet />;
}

/*
 * The public pages' error page, here and not only in root.tsx: React Router links the stylesheets of the routes
 * down to the boundary that renders, so a boundary in root.tsx would show a public error page with none of the
 * old public CSS. root.tsx renders the same ErrorPage for an error above this layout.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <SiteErrorPage error={error} />;
}
