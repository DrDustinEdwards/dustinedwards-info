import { Link } from "react-router";

// Links, not a select: each option is a URL, so display state is shareable and works with no script.
export function MediaDisplayGroup({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: Array<[string, string]>;
  current: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <div className="media-display-group">
      <span className="media-display-label">{label}</span>
      <nav className="media-display-options" aria-label={label}>
        {options.map(([id, text]) => (
          <Link
            key={id}
            to={hrefFor(id)}
            className={`admin-chip${current === id ? " is-active" : ""}`}
            aria-current={current === id ? "true" : undefined}
          >
            {text}
          </Link>
        ))}
      </nav>
    </div>
  );
}
