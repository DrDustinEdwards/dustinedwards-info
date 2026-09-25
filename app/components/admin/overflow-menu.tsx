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
      name="overflow-menu"
      summary={
        <>
          {label}
          <svg
            className="overflow-menu-chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </>
      }
    >
      {children}
    </DisclosureMenu>
  );
}
