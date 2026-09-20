import { useRef } from "react";

import { useDisclosure } from "./disclosure";

/**
 * ONE ACTIONS MENU PER ROW, and it is borderless: a bordered box on every row is
 * fifteen more rectangles to look past, so the trigger draws only its dots until it
 * is hovered or focused.
 *
 * It opens with no script because it is a `<details>`, and every item inside is a
 * real link or a real submit button.
 *
 * THE ACCESSIBLE NAME NAMES THE ROW, never just "Actions": fifteen controls all
 * announcing "Actions" tell a screen reader user nothing about which post they act
 * on.
 */
export function RowMenu({
  label,
  children,
}: {
  /** The accessible name, which must identify the row. */
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDisclosure(ref);

  return (
    <details className="row-menu" ref={ref}>
      <summary className="row-menu-button" aria-label={label} title={label}>
        {/*
         * Three dots, drawn rather than typed: U+22EE renders at the mercy of whatever
         * font has it, and this is a 24px target that has to line up with the 32px controls
         * beside it.
         */}
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
      </summary>
      <div className="row-menu-panel">{children}</div>
    </details>
  );
}
