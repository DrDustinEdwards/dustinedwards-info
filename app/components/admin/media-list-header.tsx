import { Link } from "react-router";

import { sortHref } from "~/lib/media/view.mjs";

const LIST_COLUMNS: Array<[sortKey: string | null, label: string, num: boolean]> = [
  ["name", "Name", false],
  ["usage", "Usage", false],
  [null, "Dims", true],
  ["size", "Size", true],
  ["added", "Added", true],
];

// Dims is not sortable: half the library has no dimensions, which would collapse into one block.
export function MediaListHeader({
  view,
}: {
  view: Parameters<typeof sortHref>[0];
}) {
  const arrow = view.dir === "asc" ? "↑" : "↓";

  return (
    <tr>
      <th scope="col">
        <span className="cap-sr-only">Select</span>
      </th>
      {LIST_COLUMNS.map(([key, label, num]) =>
        key === null ? (
          <th key={label} scope="col" data-num={num || undefined}>
            {label}
          </th>
        ) : (
          <th key={key} scope="col" data-num={num || undefined}>
            <Link to={sortHref(view, key, { toggle: true })} data-sort={key}>
              {label}
              <span aria-hidden="true">{view.sort === key ? ` ${arrow}` : ""}</span>
              {/* The sorted column says so in words inside its link. */}
              {view.sort === key ? (
                <span className="cap-sr-only">
                  , sorted {view.dir === "asc" ? "ascending" : "descending"}
                </span>
              ) : null}
            </Link>
          </th>
        ),
      )}
      <th scope="col">
        <span className="cap-sr-only">Copy the address</span>
      </th>
    </tr>
  );
}
