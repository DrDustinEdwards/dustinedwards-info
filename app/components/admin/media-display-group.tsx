/*
 * ONE ROW OF THE DISPLAY POPOVER.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, body and
 * comments unchanged. The route now imports it.
 */

import { Link } from "react-router";

/**
 * LINKS, not buttons, and not a `<select>`. Every one is a different URL, so
 * making them links is what lets the whole display state be shared, bookmarked and
 * restored by the back button with no script at all. A select would need an
 * `onChange` to navigate.
 */

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
