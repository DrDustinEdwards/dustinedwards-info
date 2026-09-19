import { useRef } from "react";

import { useDisclosure } from "./disclosure";

/**
 * The cockpit's overflow menu: a labelled button that reveals a panel of
 * secondary actions. Its keyboard and dismissal behaviour live in
 * `useDisclosure`, shared with `RowMenu`; the grounds for the disclosure pattern
 * and the ARIA choice are beside the hook.
 */
export function OverflowMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDisclosure(ref);

  return (
    <details className="overflow-menu" ref={ref}>
      <summary className="overflow-menu-button">
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
      </summary>
      <div className="overflow-menu-panel">{children}</div>
    </details>
  );
}
