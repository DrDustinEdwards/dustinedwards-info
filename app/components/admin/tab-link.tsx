import type { ReactNode } from "react";
import { Link } from "react-router";

/** Capsomer's tab-link markup on the router's Link, so a filter tab navigates without a page load. */
export function TabLink({
  to,
  current,
  count,
  children,
  ...rest
}: {
  to: string;
  current?: boolean;
  count?: number;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link to={to} className="cap-tab" aria-current={current ? "page" : undefined} {...rest}>
      {children}
      {count != null ? <span className="cap-tab-count">{count}</span> : null}
    </Link>
  );
}
