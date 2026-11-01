// What the admin and lab shells share (routes/admin.tsx, routes/workspace.tsx): the icon frame and the shell's link. The
// theme bootstrap is Capsomer's own themeScript (capsomer/theme-server), run before first paint by each shell.

import type { ReactNode } from "react";
import { Link } from "react-router";
import type { LinkProps } from "capsomer/react/admin-shell";
import type { BreadcrumbProps } from "capsomer/react/breadcrumb";

/* The shell's own family: a 24 box, a 1.6 stroke, drawn in currentColor (admin-shell.md, "Icons"). */
export function Icon({ d }: { d: string }) {
  return (
    <svg className="cap-admin-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

/**
 * The shell's link for one plane. A link out of the plane is a document navigation: the public pages bring their own
 * stylesheets, which would otherwise be loaded beside Capsomer's.
 */
export function shellLink(prefix: string) {
  return function ShellLink({ href, children, ...rest }: LinkProps): ReactNode {
    return (
      <Link to={href} reloadDocument={!href.startsWith(prefix)} {...rest}>
        {children}
      </Link>
    );
  };
}

/** A breadcrumb level as a router link, for Capsomer's PageHead. */
export const crumbLink: BreadcrumbProps["renderLink"] = ({ href, className, children }) => (
  <Link to={href} className={className}>
    {children}
  </Link>
);
