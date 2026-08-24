/*
 * THE LIST VIEW'S HEADER ROW.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, body and
 * comments unchanged. The route now imports it.
 */

import { Link } from "react-router";

import { sortHref } from "~/lib/media/view.mjs";

/**
 * The columns, in track order, and whether each one sorts.
 *
 * ONE LIST, so the header cannot grow a column the row does not have or lose
 * one the row still renders. `null` is Dims, which is a label rather than a
 * link; see the note above for why there is no `dims` sort key to point it at.
 */
const LIST_COLUMNS: Array<[sortKey: string | null, label: string, align: "start" | "end"]> = [
  ["name", "Name", "start"],
  ["usage", "Usage", "start"],
  [null, "Dims", "end"],
  ["size", "Size", "end"],
  ["added", "Added", "end"],
];

/**
 * THE LIST'S HEADER ROW, and every cell in it is a LINK.
 *
 * The whole display state is a URL on this page, so a sort control has an
 * address and must be an anchor: it is shareable, bookmarkable, restored by the
 * back button and works with scripting off, which a click handler on a `<th>`
 * is none of. That is the same reasoning the Display popover's segmented
 * controls were built on, applied to the other control that changes a sort.
 *
 * **BOTH CONTROLS CALL `sortHref`, WHICH IS THE POINT.** A header and a popover
 * that build their own URLs are two implementations of one destination, and
 * they drift the way `q` and `role` drifted off their links. One builder means
 * choosing Size in the popover and pressing the Size header land on the same
 * page by construction; `check:admin-ui` asserts the two hrefs are byte-equal
 * per column over the rendered markup, and `test/media-view.test.mjs` asserts
 * the same property on the function.
 *
 * DIMS IS NOT SORTABLE AND SAYS SO BY BEING A SPAN. There is no `dims` sort
 * key, because half the library has no dimensions at all: 31 documents and
 * every SVG would collapse into one undifferentiated block at whichever end of
 * the order nulls land. So the column is a label rather than a dead link, which
 * is the mockup's own choice (its Dims entry carries no arrow and a no-op
 * handler) expressed in markup instead of in a disabled state.
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
            /* ALIGNMENT AS DATA, never as `nth-of-type`. It was positional for
               one render and it was already wrong: `nth-of-type` counts among
               siblings of the SAME ELEMENT TYPE, and this row mixes anchors
               with spans, so "the fourth heading" and "the fourth anchor" are
               different cells. Size sat at the left of its track against a
               right-aligned Dims and the two headings collided. A column
               declares its own alignment beside its own label. */
            data-align={align}
            /* The key, so the narrow-viewport query can drop a heading BY NAME
               alongside the cell it labels, rather than by counting. */
            data-sort={key}
            // The SORT STATE, as the property assistive technology reads for a
            // sortable column. `none` on the others is not noise: it is what
            // says this column can be sorted and currently is not.
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
