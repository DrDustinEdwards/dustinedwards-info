import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import type { hrefWith } from "~/lib/media/view.mjs";

/** The three confirmations an action can open: bulk trash, a rebuild and a single delete. */
export function MediaConfirmDialogs({
  chosen,
  confirmingTrash,
  setConfirmingTrash,
  confirmRebuild,
  confirmDelete,
  linkTo,
}: {
  chosen: string[];
  confirmingTrash: boolean;
  setConfirmingTrash: (value: boolean) => void;
  confirmRebuild: number | undefined;
  confirmDelete: string | undefined;
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
}) {
  return (
    <>
      {confirmingTrash && chosen.length > 0 ? (
        <ConfirmDialog
          title={`Move ${chosen.length} file${chosen.length === 1 ? "" : "s"} to the trash`}
          body={
            <p>
              They stop showing in the library. Every address keeps working and no
              published page changes, so nothing here can cost a post its image.
              Restore puts them back.
            </p>
          }
          confirmLabel="Move to trash"
          onCancel={() => setConfirmingTrash(false)}
        >
          <input type="hidden" name="intent" value="bulk-trash" />
          {chosen.map((key) => (
            <input key={key} type="hidden" name="key" value={key} />
          ))}
        </ConfirmDialog>
      ) : null}

      {confirmRebuild !== undefined ? (
        <ConfirmDialog
          title="Re-derive the whole media index"
          body={
            <>
              <p>
                Every derived column is recomputed from the buckets and every
                authored one is preserved. Rows whose source object is GONE are
                removed, so running this against a bucket that is only partly
                readable prunes the index to whatever it managed to see.
              </p>
              <p>
                The index currently holds{" "}
                <strong>{confirmRebuild ?? 0}</strong> row(s).
              </p>
            </>
          }
          requireTyped="1"
          confirmLabel="Rebuild the index"
          cancelHref={linkTo({})}
        >
          <input type="hidden" name="intent" value="rebuild" />
        </ConfirmDialog>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Permanently delete ${confirmDelete}`}
          body={
            <p>
              This removes the object from R2. Addresses are content hashes, so a
              deleted file cannot be restored by re-uploading it under the same
              URL.
            </p>
          }
          requireTyped="1"
          confirmLabel="Delete permanently"
          cancelHref={linkTo({ key: confirmDelete })}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="key" value={confirmDelete} />
        </ConfirmDialog>
      ) : null}
    </>
  );
}
