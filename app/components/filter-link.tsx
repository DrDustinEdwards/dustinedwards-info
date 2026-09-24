import type { CSSProperties } from "react";
import { Link } from "react-router";
import { interWidthEm } from "~/lib/inter-width";

/** One link in a `.list-filter` row: its name box is Inter's width, whichever face draws it. */
export function FilterLink({
  to,
  label,
  count,
  active,
  title,
}: {
  to: string;
  label: string;
  count?: number;
  active: boolean;
  title?: string;
}) {
  const width = { "--name-w": `${interWidthEm(label, active ? 600 : 400)}em` } as CSSProperties;
  return (
    <Link to={to} aria-current={active ? "true" : undefined} title={title}>
      <span className="filter-name" style={width}>
        {label}
      </span>
      {count === undefined ? null : <span className="filter-count">{count}</span>}
    </Link>
  );
}
