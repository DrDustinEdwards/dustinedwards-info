import { useEffect, useRef } from "react";

// Deliberately a disclosure, not role="menu": each item is a submit in its own form, which breaks
// menuitem ownership. The <details> stays markup so these repair actions open without script.
function useDisclosure(ref: React.RefObject<HTMLDetailsElement | null>) {
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

    // pointerdown, not click: close before the thing it landed on reacts.
    const onPointerDown = (event: PointerEvent) => {
      if (!details.contains(event.target as Node)) close(false);
    };

    // Items submit real forms and this element survives the navigation, so close on activation.
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

/**
 * The shared shell of the overflow and row menus. `name` is the class prefix: the details element,
 * its `-button` summary and its `-panel`. `summaryLabel` names a summary whose content is only an icon.
 */
export function DisclosureMenu({
  name,
  summary,
  summaryLabel,
  children,
}: {
  name: string;
  summary: React.ReactNode;
  summaryLabel?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDisclosure(ref);

  return (
    <details className={name} ref={ref}>
      <summary className={`${name}-button`} aria-label={summaryLabel} title={summaryLabel}>
        {summary}
      </summary>
      <div className={`${name}-panel`}>{children}</div>
    </details>
  );
}
