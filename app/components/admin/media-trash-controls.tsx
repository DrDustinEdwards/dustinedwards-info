import { Link } from "react-router";

import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import type { hrefWith, sortHref } from "~/lib/media/view.mjs";

/** The trash view's note, its Empty trash link and the typed confirmation that link opens. */
export function MediaTrashControls({
  view,
  trashedCount,
  linkTo,
}: {
  view: Parameters<typeof sortHref>[0];
  trashedCount: number;
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
}) {
  return (
    <>
      {view.trash ? (
        <p className="media-usage-note">
          This is a library view, not a takedown. A trashed file keeps its
          address, and any published page using it is unchanged. Restore puts it
          back in the library.{" "}
          <strong>Only Empty trash deletes anything, and it still refuses
          anything a post cites.</strong>
        </p>
      ) : null}

      {view.trash && trashedCount > 0 ? (
        <p className="media-empty-trash">
          {/* A link, not `prompt()`, so the confirmation holds without script. */}
          <Link to={linkTo({ confirm: "empty-trash" })} className="btn-danger">
            Empty trash
          </Link>
          <span className="media-facet-hint">
            Deletes the objects. Anything a post cites is kept and named.
          </span>
        </p>
      ) : null}

      {view.confirm === "empty-trash" && trashedCount > 0 ? (
        <ConfirmDialog
          title={`Permanently delete ${trashedCount} file${trashedCount === 1 ? "" : "s"}`}
          body={
            <p>
              Addresses are content hashes, so a deleted file cannot be restored
              by re-uploading it under the same URL. Anything a post cites is
              kept and named.
            </p>
          }
          requireTyped={String(trashedCount)}
          confirmLabel="Delete permanently"
          cancelHref={linkTo({ confirm: "" })}
        >
          <input type="hidden" name="intent" value="empty-trash" />
        </ConfirmDialog>
      ) : null}
    </>
  );
}
