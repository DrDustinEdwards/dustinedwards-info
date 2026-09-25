import { useState } from "react";

import { toast } from "~/components/admin/toast";
import { copyText } from "~/lib/clipboard";

// An icon, not the word: the word cost a third of the row and pushed the filename into truncation.
export function CopyButton({
  value,
  label,
  name,
  showLabel,
}: { value: string; label: string; name?: string; showLabel?: boolean }) {
  return (
    <button
      type="button"
      className="btn-ghost media-copy"
      title={value}
      onClick={(event) => {
        const button = event.currentTarget;
        copyText(value)
          .then(() => {
            button.dataset.copied = "yes";
            // Announced too: the data attribute drives a ::after that assistive technology cannot see.
            toast(`Copied ${value}`);
            window.setTimeout(() => {
              delete button.dataset.copied;
            }, 1500);
          })
          .catch(() => {
            button.dataset.copied = "no";
            toast(`Copy failed. The address is ${value}`);
          });
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      {showLabel ? <span className="media-copy-label">{label}</span> : null}
      {/* Always named: the visible label is absent on a tile and only a fragment elsewhere. */}
      <span className="sr-only">{name ?? `Copy the address for ${label}`}</span>
    </button>
  );
}

/** A text button whose own label reports the outcome, for rows where a toast has nowhere to show. */
export function CopyTextButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState<"" | "copied" | "failed">("");
  return (
    <button
      type="button"
      className="row-action"
      onClick={() => {
        copyText(value).then(
          () => setCopied("copied"),
          () => setCopied("failed"),
        );
      }}
    >
      {copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : label}
    </button>
  );
}
