import { BulkTagControls } from "~/components/admin/bulk-tag-controls";
import { toast } from "~/components/admin/toast";
import { copyText } from "~/lib/clipboard";
import { byteSize } from "~/lib/media/byte-size.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

type Listing = Extract<Route.ComponentProps["loaderData"], { detail: unknown }>;

/** The bar over a selection: count and size, copy addresses, bulk tags, trash, clear. */
export function BulkBar({
  objects,
  chosen,
  setSelected,
  setConfirmingTrash,
  tagCounts,
}: {
  objects: Listing["objects"];
  chosen: string[];
  setSelected: (keys: string[]) => void;
  setConfirmingTrash: (value: boolean) => void;
  tagCounts: Listing["tagCounts"];
}) {
  return (

    <div className="posts-bulk" role="group" aria-label="Bulk actions">
      <p className="posts-bulk-count" aria-live="polite">
        {chosen.length} selected
        <span className="posts-bulk-size">
          {byteSize(
            objects
              .filter((o) => chosen.includes(o.key))
              .reduce((sum, o) => sum + o.size, 0),
          )}
        </span>
      </p>
      {/* `type="button"` so it never submits the form it sits in. One address per line: that pastes usefully. */}
      <button
        type="button"
        className="btn-ghost"
        onClick={() => {
          const addresses = objects
            .filter((o) => chosen.includes(o.key))
            .map((o) => o.url)
            .join("\n");
          copyText(addresses)
            .then(() =>
              toast(
                `Copied ${chosen.length} address${chosen.length === 1 ? "" : "es"}`,
              ),
            )
            .catch(() => toast("The clipboard refused. Open a file to copy its address."));
        }}
      >
        Copy addresses
      </button>
      <BulkTagControls listId="media-bulk-tags" options={tagCounts.map((t) => t.tag)} />
      {/* A `type="button"` opens the modal, because submitting from here would skip it. */}
      <button
        type="button"
        className="btn"
        onClick={() => setConfirmingTrash(true)}
      >
        Move to trash
      </button>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => setSelected([])}
      >
        Clear
      </button>
    </div>
  );
}
