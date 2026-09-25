import { ConfirmDialog } from "~/components/admin/confirm-dialog";

/** The two typed confirmations the action can ask for: an Ask sync and a bulk delete. */
export function PostsConfirmDialogs({
  confirmSyncAsk,
  confirmDelete,
  cancelHref,
}: {
  confirmSyncAsk: number | undefined;
  confirmDelete: { slugs: string[]; count: number; typed: string } | undefined;
  cancelHref: string;
}) {
  return (
    <>
      {confirmSyncAsk !== undefined ? (
        <ConfirmDialog
          title="Rebuild the search answer index?"
          body={
            <p>
              Every record not in this run is removed from the index, and saved
              answers are dropped. The site currently has{" "}
              <strong>{confirmSyncAsk}</strong> post(s), so that is
              what the index will hold afterwards.
            </p>
          }
          requireTyped="1"
          confirmLabel="Rebuild the index"
          cancelHref={cancelHref}
        >
          <input type="hidden" name="intent" value="sync-ask" />
        </ConfirmDialog>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${confirmDelete.count} post${
            confirmDelete.count === 1 ? "" : "s"
          }`}
          body={
            <p>
              This removes each markdown file and its rows. Git still has them;
              nothing else does.
            </p>
          }
          stake={confirmDelete.slugs}
          requireTyped={String(confirmDelete.count)}
          confirmLabel="Delete permanently"
          cancelHref={cancelHref}
        >
          {/* The intent is a field: a disabled submitter sends neither its name nor its value. */}
          <input type="hidden" name="intent" value="bulk-delete" />
          {confirmDelete.slugs.map((slug) => (
            <input key={slug} type="hidden" name="slug" value={slug} />
          ))}
        </ConfirmDialog>
      ) : null}
    </>
  );
}
