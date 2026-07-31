import { useEffect, useRef } from "react";

/**
 * The cockpit's overflow menu: a labelled button that reveals a panel of
 * secondary actions.
 *
 * It is built on `<details>`/`<summary>` rather than on a click handler, and
 * that is load bearing rather than a shortcut. What hides in here are REPAIR
 * operations, which is exactly the set you reach for when something is already
 * broken, so hiding them behind a control that needs script to open would put
 * the recovery path on the far side of the failure. As markup it opens, closes
 * and reports its own expanded state with nothing loaded; the effect below only
 * adds the three behaviours a bare disclosure does not have.
 *
 * ARIA: this is deliberately a DISCLOSURE, not `role="menu"`. Every item in it
 * is a submit button inside its own form, and a `role="menu"` container owes
 * `menuitem` children it directly owns; interleaving forms breaks that, and the
 * menu roles would also suppress the native button semantics the items already
 * have. APG says to use a disclosure once the contents are form controls, so
 * `<summary>` carries the name and the expanded state and nothing overrides it.
 */
export function OverflowMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;

    const summary = details.querySelector("summary");
    const items = () =>
      Array.from(details.querySelectorAll<HTMLElement>("[data-menu-item]"));

    const close = (restoreFocus: boolean) => {
      if (!details.open) return;
      details.open = false;
      if (restoreFocus && summary instanceof HTMLElement) summary.focus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Focus goes back to the control that opened the panel, because the
        // element the reader was on is about to stop existing.
        close(true);
        return;
      }
      if (!details.open) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const list = items();
      const here = list.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "ArrowDown"
          ? here < 0
            ? 0
            : (here + 1) % list.length
          : here < 0
            ? list.length - 1
            : (here - 1 + list.length) % list.length;
      list[next]?.focus();
      event.preventDefault();
    };

    // pointerdown rather than click: a click that lands outside should close
    // the panel before the thing it landed on reacts, not after.
    const onPointerDown = (event: PointerEvent) => {
      if (!details.contains(event.target as Node)) close(false);
    };

    // An item submits a real form, so the page navigates and revalidates while
    // this element survives. Closing on activation stops the panel hanging
    // open over the result of the action it just ran.
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-menu-item]")) close(false);
    };

    details.addEventListener("keydown", onKeyDown);
    details.addEventListener("click", onClick);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      details.removeEventListener("keydown", onKeyDown);
      details.removeEventListener("click", onClick);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

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
