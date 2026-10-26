import { ConfirmModal } from "capsomer/react/confirm-dialog";
import { Form, useNavigate } from "react-router";

// Capsomer's ConfirmModal, opened by the server's answer, so the second step exists without script too. This
// file is only the router glue: the post is a client navigation through <Form>, and Cancel keeps the scroll
// position, since the page behind the dialog is where the reader still is. The typed value posts as
// CONFIRM_FIELD ("confirm"), which each action checks again.
export function ConfirmDialog({
  title,
  body,
  stake,
  requireTyped,
  confirmLabel,
  /** Where Cancel goes. Carry the current query so filters survive. */
  cancelHref,
  /** Cancel for a dialog opened from client state rather than the URL, which has nowhere to go. */
  onCancel,
  children,
}: {
  title: string;
  body: React.ReactNode;
  stake?: string[];
  /** Absent for a reversible action: the dialog then confirms without a typed value. */
  requireTyped?: string;
  confirmLabel: string;
  children: React.ReactNode;
} & ({ cancelHref: string; onCancel?: never } | { cancelHref?: never; onCancel: () => void })) {
  const navigate = useNavigate();
  return (
    <ConfirmModal
      title={title}
      lead={body}
      body={stake}
      typeToConfirm={requireTyped}
      action_label={confirmLabel}
      cancelHref={cancelHref ?? ""}
      onCancel={onCancel ?? (() => void navigate(cancelHref, { preventScrollReset: true }))}
      renderForm={(props) => <Form {...props} />}
    >
      {children}
    </ConfirmModal>
  );
}
