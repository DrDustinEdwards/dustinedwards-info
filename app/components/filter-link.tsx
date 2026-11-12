import { Link } from "react-router";

/** One link chip in a filter row (capsomer/chips.css link chips): the current one carries aria-current. */
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
  return (
    <li>
      <Link to={to} className="cap-chip" aria-current={active ? "true" : undefined} title={title}>
        {label}
        {count === undefined ? null : <span className="cap-chip-count">{count}</span>}
      </Link>
    </li>
  );
}
