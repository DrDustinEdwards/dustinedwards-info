import { Link } from "react-router";

import { sortHref } from "~/lib/media/view.mjs";

const LIST_COLUMNS: Array<[sortKey: string | null, label: string, align: "start" | "end"]> = [
  ["name", "Name", "start"],
  ["usage", "Usage", "start"],
  [null, "Dims", "end"],
  ["size", "Size", "end"],
  ["added", "Added", "end"],
];

// Dims is not sortable: half the library has no dimensions, which would collapse into one block.
export function MediaListHeader({
  view,
}: {
  view: Parameters<typeof sortHref>[0];
}) {
  const arrow = view.dir === "asc" ? "↑" : "↓";

  return (
    <div className="media-list-head" role="row">
      <span />
      <span />
      {LIST_COLUMNS.map(([key, label, align]) =>
        key === null ? (
          <span key={label} className="media-col-head is-unsortable" data-align={align}>
            {label}
          </span>
        ) : (
          <Link
            key={key}
            to={sortHref(view, key, { toggle: true })}
            className={`media-col-head${view.sort === key ? " is-active" : ""}`}
            // Alignment as data, not nth-of-type: this row mixes anchors and spans, so type counts disagree.
            data-align={align}
            data-sort={key}
            // `none` on the other columns is what says they are sortable.
            aria-sort={
              view.sort === key ? (view.dir === "asc" ? "ascending" : "descending") : "none"
            }
          >
            {label}
            <span aria-hidden="true" className="media-col-arrow">
              {view.sort === key ? arrow : ""}
            </span>
          </Link>
        ),
      )}
      <span />
    </div>
  );
}
