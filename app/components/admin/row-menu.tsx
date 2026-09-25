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
      name="row-menu"
      summaryLabel={label}
      summary={
        /* Drawn rather than U+22EE, which renders at the mercy of whatever font has it. */
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      }
    >
      {children}
    </DisclosureMenu>
  );
}
