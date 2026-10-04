import { DisclosureMenu } from "./disclosure";

export function OverflowMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DisclosureMenu
      summary={
        <>
          {label}
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>
      }
    >
      {children}
    </DisclosureMenu>
  );
}
