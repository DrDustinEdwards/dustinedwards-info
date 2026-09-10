import { useEffect } from "react";

/**
 * The three behaviours a bare `<details>` disclosure does not have.
 *
 * EXTRACTED 2026-09-10, when the row kebab was added. It was the whole body of
 * `OverflowMenu`'s effect and it is now shared with `RowMenu`, because the
 * alternative was two implementations of Escape, arrow keys and close-on-
 * outside-click that would drift the first time one of them was fixed. Neither
 * component's markup changed, so `check:admin-ui`'s fixture is untouched.
 *
 * The disclosure itself stays markup. What hides behind these controls are
 * REPAIR operations, which is exactly the set you reach for when something is
 * already broken, so opening one must not require script. As markup it opens,
 * closes and reports its own expanded state with nothing loaded; this only adds
 * the keyboard and dismissal manners on top.
 *
 * ARIA: deliberately a DISCLOSURE, not `role="menu"`. Every item is a submit
 * button inside its own form, and a `role="menu"` container owes `menuitem`
 * children it directly owns; interleaving forms breaks that, and the menu roles
 * would suppress the native button semantics the items already have. APG says
 * to use a disclosure once the contents are form controls, so `<summary>`
 * carries the name and the expanded state and nothing overrides it.
 *
 * @param ref The `<details>` element this manages.
 */
export function useDisclosure(ref: React.RefObject<HTMLDetailsElement | null>) {
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
  }, [ref]);
}
