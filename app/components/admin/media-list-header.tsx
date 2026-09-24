/*
 * THE LIST VIEW'S HEADER ROW.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, body and
 * comments unchanged. The route now imports it.
 */

import { Link } from "react-router";

import { sortHref } from "~/lib/media/view.mjs";

/**
 * ONE LIST, so the header cannot grow a column the row does not have or lose one
 * the row still renders. `null` is Dims, which is a label rather than a link.
 */
const LIST_COLUMNS: Array<[sortKey: string | null, label: string, align: "start" | "end"]> = [
  ["name", "Name", "start"],
  ["usage", "Usage", "start"],
  [null, "Dims", "end"],
  ["size", "Size", "end"],
  ["added", "Added", "end"],
];

/**
 * EVERY CELL IS A LINK. The whole display state is a URL on this page, so a sort
 * control has an address and must be an anchor: shareable, bookmarkable, restored
 * by the back button, and working with scripting off.
 *
 * BOTH CONTROLS CALL `sortHref`. A header and a popover that build their own URLs
 * are two implementations of one destination; the two hrefs must be byte-equal
 * per column.
 *
 * DIMS IS NOT SORTABLE AND SAYS SO BY BEING A SPAN: half the library has no
 * dimensions, so they would collapse into one undifferentiated block at whichever
 * end nulls land.
 */
export function MediaListHeader({
  view,
}: {
  view: Parameters<typeof sortHref>[0];
}) {
  /** The arrow the ACTIVE column carries, and no other column carries one. */
  const arrow = view.dir === "asc" ? "↑" : "↓";

  return (
    <div className="media-list-head" role="row">
      {/* Two empty leading cells, matching the checkbox and thumbnail tracks.
          They head nothing, so they say nothing. */}
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
            /*
             * ALIGNMENT AS DATA, never `nth-of-type`: that counts among siblings of the SAME
             * ELEMENT TYPE, and this row mixes anchors with spans, so "the fourth heading" and
             * "the fourth anchor" are different cells. A column declares its own alignment
             * beside its own label.
             */
            data-align={align}
            /* The key, so the narrow-viewport query can drop a heading BY NAME
               alongside the cell it labels, rather than by counting. */
            data-sort={key}
            // THE SORT STATE, as the property assistive technology reads. `none` on the
            // others is not noise: it is what says this column can be sorted and currently is
            // not.
            aria-sort={
              view.sort === key ? (view.dir === "asc" ? "ascending" : "descending") : "none"
            }
          >
            {label}
            {/* The glyph is decoration over a state already announced above, so
                it is hidden rather than read out as an arrow. */}
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
