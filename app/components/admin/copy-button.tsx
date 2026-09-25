import { useEffect, useRef, useState } from "react";

import { LiveNotice } from "~/components/admin/live-notice";
import { toast } from "~/components/admin/toast";
import { copyText } from "~/lib/clipboard";

// An icon, not the word: the word cost a third of the row and pushed the filename into truncation.
export function CopyButton({
  value,
  label,
  name,
  showLabel,
  tabIndex,
}: {
  value: string;
  label: string;
  name?: string;
  showLabel?: boolean;
  /** -1 on a grid tile that is not the grid's tab stop. */
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      className="btn-ghost media-copy"
      title={value}
      tabIndex={tabIndex}
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
            // Cleared like success, or "failed" stays on the button after a later copy works.
            window.setTimeout(() => {
              delete button.dataset.copied;
            }, 2400);
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

/**
 * A text button whose own label reports the outcome, for rows where a toast has nowhere to show.
 * The label is only what a sighted author sees; a screen reader hears the outcome from LiveNotice's
 * regions, which are in the document before any copy, and both reset so a stale "Copied" never
 * describes a later press.
 */
export function CopyTextButton({
  value,
  label,
  name,
  subject,
}: {
  value: string;
  label: string;
  /** Read after the label and never shown, so a row of identical "Copy" buttons each says which. */
  name?: string;
  /** What was copied, for the announcement: "the link starting abc123". */
  subject: string;
}) {
  const [copied, setCopied] = useState<"" | "copied" | "failed">("");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const settle = (outcome: "copied" | "failed") => {
    setCopied(outcome);
    window.clearTimeout(timer.current);
    // A failure stays longer: it asks the author to do something.
    timer.current = window.setTimeout(() => setCopied(""), outcome === "copied" ? 2000 : 5000);
  };

  return (
    <>
      <button
        type="button"
        className="row-action"
        onClick={() => {
          // Emptied first, so a second copy of the same thing is announced again.
          window.clearTimeout(timer.current);
          setCopied("");
          copyText(value).then(
            () => settle("copied"),
            () => settle("failed"),
          );
        }}
      >
        {copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : label}
        {name ? <span className="sr-only"> {name}</span> : null}
      </button>
      <div className="sr-only">
        <LiveNotice
          status={copied === "copied" ? `Copied ${subject}.` : null}
          alert={copied === "failed" ? `Could not copy ${subject}. The browser blocked the clipboard.` : null}
        />
      </div>
    </>
  );
}
