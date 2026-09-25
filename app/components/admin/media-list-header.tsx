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
    // No row role and no aria-sort: the list is not a grid or a table, so neither would mean anything.
    // The sorted column says so in words inside its link.
    <div className="media-list-head">
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
          >
            {label}
            <span aria-hidden="true" className="media-col-arrow">
              {view.sort === key ? arrow : ""}
            </span>
            {view.sort === key ? (
              <span className="sr-only">
                , sorted {view.dir === "asc" ? "ascending" : "descending"}
              </span>
            ) : null}
          </Link>
        ),
      )}
      <span />
    </div>
  );
}
