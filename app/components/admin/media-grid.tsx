import { Form } from "react-router";

import { BulkBar } from "~/components/admin/media-bulk-bar";
import { MediaListHeader } from "~/components/admin/media-list-header";
import { MediaTile } from "~/components/admin/media-tile";
import { groupRows } from "~/lib/media/view.mjs";
import type { hrefWith, sortHref } from "~/lib/media/view.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

type Listing = Extract<Route.ComponentProps["loaderData"], { detail: unknown }>;

export function MediaGrid({
  objects,
  chosen,
  selectRange,
  setSelected,
  setConfirmingTrash,
  linkTo,
  view,
  pending,
  scanComplete,
  tagCounts,
}: {
  objects: Listing["objects"];
  chosen: string[];
  selectRange: (key: string, shift: boolean) => void;
  setSelected: (keys: string[]) => void;
  setConfirmingTrash: (value: boolean) => void;
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
  view: Parameters<typeof sortHref>[0];
  pending: boolean;
  scanComplete: boolean;
  tagCounts: Listing["tagCounts"];
}) {
  return (
        // Not role="grid": the column count follows the container width, so positions mean nothing to a screen reader.
        <Form method="post">
      {/* The form wraps the grid so the checkboxes submit with it; nested in the toolbar it would be
          a form inside a form, which the browser drops. */}
        {chosen.length > 0 ? (
          <BulkBar
            objects={objects}
            chosen={chosen}
            setSelected={setSelected}
            setConfirmingTrash={setConfirmingTrash}
            tagCounts={tagCounts}
          />
        ) : null}

        {/* Grouped page-locally: a group never spans a page, so the heading counts this page. */}
        {view.view === "list" && objects.length > 0 ? (
          <MediaListHeader view={view} />
        ) : null}

        {groupRows(objects, view.group).map((bucket) => (
        <section key={bucket.label || "ungrouped"} className="media-group">
          {bucket.label ? (
            <h2 className="media-group-heading">
              <span className="media-group-title">{bucket.label}</span>
              <span className="media-group-count">
                {bucket.rows.length} on this page
              </span>
              {bucket.note ? (
                <span className="media-group-note">{bucket.note}</span>
              ) : null}
            </h2>
          ) : null}
        <ul
          className="media-grid"
          data-view={view.view}
          data-size={view.size}
          data-pending={pending || undefined}
          aria-busy={pending || undefined}
        >
          {bucket.rows.map((object) => (
            <MediaTile
              key={object.key}
              object={object}
              chosen={chosen}
              selectRange={selectRange}
              linkTo={linkTo}
              view={view}
              scanComplete={scanComplete}
            />
          ))}
        </ul>
        </section>
        ))}
        </Form>
  );
}
