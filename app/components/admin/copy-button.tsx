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
      className="cap-btn"
      data-variant="quiet"
      data-size="sm"
      data-icon-only={showLabel ? undefined : ""}
      data-cap-copy=""
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
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
          d="M5.5 5.5h7v8h-7zM3.5 10.5h-1v-8h7v1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showLabel ? <span>{label}</span> : null}
      {/* Always named: the visible label is absent on a tile and only a fragment elsewhere. */}
      <span className="cap-sr-only">{name ?? `Copy the address for ${label}`}</span>
    </button>
  );
}
