import { useEffect } from "react";

/**
 * Drives a modal `<dialog>` from React state. Escape and the backdrop close it natively and fire
 * `close`, so the parent syncs from the element through `onClose`.
 */
export function useDialogOpen(
  ref: React.RefObject<HTMLDialogElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [ref, open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [ref, onClose]);
}
