import { Link } from "react-router";

import type { hrefWith } from "~/lib/media/view.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

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
