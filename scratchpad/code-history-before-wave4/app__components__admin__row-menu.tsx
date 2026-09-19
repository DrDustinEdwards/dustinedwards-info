import { useRef } from "react";

import { useDisclosure } from "./disclosure";

/**
 * ONE ACTIONS MENU PER ROW, and it is borderless.
 *
 * The list used to carry a row of loose buttons per row: Edit, View, Unpublish,
 * Duplicate across fifteen rows is fifty-odd controls competing with the fifteen
 * NAMES the reader came to find. The design rule is one control per row holding
 * every action for it, and a bordered box on every row is fifteen more
 * rectangles to look past, so the trigger draws only its dots until it is
 * hovered or focused.
 *
 * Behaviour is `useDisclosure`, shared with `OverflowMenu`. It opens with no
 * script because it is a `<details>`, and every item inside is a real link or a
 * real submit button, so the whole menu works with nothing loaded.
 *
 * The accessible name NAMES THE ROW, never just "Actions". Fifteen controls all
 * announcing "Actions" tell a screen reader user which control they are on and
 * nothing about which post it acts on.
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
        {/* Three dots, drawn rather than typed: the character U+22EE renders at
            the mercy of whatever font has it, and this is a 24px target that
            has to line up with the 32px controls beside it. */}
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
