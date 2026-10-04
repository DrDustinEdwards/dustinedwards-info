import { Link } from "react-router";
import { Empty } from "capsomer/react/empty";

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
  if (lensCounts.all === 0 && !q) {
    return (
      <Empty
        kind="nothing-yet"
        title="Nothing here yet"
        action={
          /* A button, not a label: a label cannot take focus, so the keyboard could not reach it. */
          <button
            type="button"
            className="cap-btn"
            data-variant="primary"
            onClick={() => document.getElementById("media-file")?.click()}
          >
            Upload the first file
          </button>
        }
      >
        Files you upload get a content-hashed address you can paste into any post. Anything committed
        to the repository shows up automatically after a deploy.
      </Empty>
    );
  }
  if (q) {
    return (
      <Empty kind="no-match" title={<>Nothing matches &ldquo;{q}&rdquo;</>}>
        Searched paths, names, alt text and tags.{" "}
        <Link to={linkTo({ q: "", page: 1 })}>Clear the search</Link>, or look in{" "}
        <Link to={linkTo({ q: "", role: "all", lens: "", page: 1 })}>every group</Link>.
      </Empty>
    );
  }
  return (
    <Empty kind="all-clear" title="Nothing in this view">
      Every file passes this check.{" "}
      <Link to={linkTo({ lens: "", role: "all", page: 1 })}>Show everything</Link>.
    </Empty>
  );
}
