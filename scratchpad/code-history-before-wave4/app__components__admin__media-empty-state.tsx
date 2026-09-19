/*
 * THE EMPTY LIBRARY, and there are three of them.
 *
 * Which one renders is decided here rather than by the caller, because the three differ only in what the reader should do next.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, markup and
 * comments unchanged.
 */

import { Link } from "react-router";

import type { hrefWith } from "~/lib/media/view.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

/*
 * The loader returns a UNION of three shapes: the picker, the palette and the
 * library listing. Only the listing carries these fields, so the member is
 * selected rather than the property read off the union. One owner: the loader.
 */
type Listing = Extract<Route.ComponentProps["loaderData"], { detail: unknown }>;

export function MediaEmptyState({
  q,
  lensCounts,
  linkTo,
}: {
  q: Listing["q"];
  lensCounts: Listing["lensCounts"];
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
}) {
  return (
        /*
          THREE EMPTY STATES, NOT ONE, because they mean three different things
          and the reader needs a different next step from each.

          The page had one muted sentence for all of them, which is the shape
          that tells somebody with an empty library to "try all media" and
          somebody with a typo to do the same thing.

            LIBRARY EMPTY   nothing has ever been here. Explain what the library
                            is FOR and offer the one action that fills it. This
                            is the only state that gets a heading and a button,
                            because it is the only one where the reader has
                            nothing to undo.

            SEARCH MISS     the query matched nothing. Name the query back, say
                            what was searched so the reader can tell a typo from
                            a wrong assumption, and offer to clear it.

            LENS EMPTY      the lens found nothing, which is GOOD NEWS and reads
                            as an error unless it says so. "Every file passes
                            this check" is the mockup's line and it is the right
                            one.
        */
        <div className="media-empty" data-empty={q ? "search" : lensCounts.all === 0 ? "library" : "lens"}>
          {lensCounts.all === 0 && !q ? (
            <>
              <p className="media-empty-title">Nothing here yet</p>
              <p className="media-empty-body">
                Files you upload get a content-hashed address you can paste into
                any post. Anything committed to the repository shows up
                automatically after a deploy.
              </p>
              <label className="btn media-empty-action" htmlFor="media-file">
                Upload the first file
              </label>
            </>
          ) : q ? (
            <>
              <p className="media-empty-title">
                Nothing matches &ldquo;{q}&rdquo;
              </p>
              <p className="media-empty-body">
                Searched paths, names, alt text and tags.{" "}
                <Link to={linkTo({ q: "", page: 1 })}>Clear the search</Link>, or
                look in <Link to={linkTo({ q: "", role: "all", lens: "", page: 1 })}>every group</Link>.
              </p>
            </>
          ) : (
            <>
              <p className="media-empty-title">Nothing in this view</p>
              <p className="media-empty-body">
                Every file passes this check.{" "}
                <Link to={linkTo({ lens: "", role: "all", page: 1 })}>Show everything</Link>.
              </p>
            </>
          )}
        </div>
  );
}
