import { DisclosureMenu } from "./disclosure";

// The accessible name names the row: fifteen controls all announcing "Actions" tell a screen reader nothing.
export function RowMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DisclosureMenu
      summaryLabel={label}
      iconOnly
      summary={
        /* Drawn rather than U+22EE, which renders at the mercy of whatever font has it. */
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="3" r="1.4" fill="currentColor" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
          <circle cx="8" cy="13" r="1.4" fill="currentColor" />
        </svg>
      }
    >
      {children}
    </DisclosureMenu>
  );
}
