// What the admin and lab shells share (routes/admin.tsx, routes/workspace.tsx): the theme bootstrap, the icon frame and
// the shell's link.

import type { ReactNode } from "react";
import { Link } from "react-router";
import type { LinkProps } from "capsomer/react/admin-shell";

/**
 * Capsomer's own one-liner (theme-switch.md), run before first paint so a remembered theme never
 * flashes the other one. The plane's nonce is what lets the policy run it.
 */
export const THEME_SCRIPT =
  'try{var t=localStorage.getItem("cap-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}';

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
