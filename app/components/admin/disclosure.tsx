import { useEffect, useId, useRef } from "react";

/*
 * Deliberately a disclosure, not role="menu": each item is a submit in its own form, which breaks
 * menuitem ownership. The panel is a native popover opened by `popovertarget`, so these repair
 * actions open without script, the panel sits in the top layer (nothing clips it, the posts table's
 * scroll box included), and the browser light-dismisses it on an outside click. CSS anchor
 * positioning puts it under its button; where that is unsupported this hook places it on open.
 */
function useDisclosure(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = ref.current;
    const button = root?.querySelector<HTMLButtonElement>("button[popovertarget]");
    const panel = root?.querySelector<HTMLElement>("[popover]");
    if (!root || !button || !panel) return;

    const isOpen = () => panel.matches(":popover-open");
    const items = () => Array.from(panel.querySelectorAll<HTMLElement>("[data-menu-item]"));

    const close = (restoreFocus: boolean) => {
      if (!isOpen()) return;
      panel.hidePopover();
      if (restoreFocus) button.focus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isOpen()) return;
        // Stopped, or the same press also reaches the page's own Escape (the media grid clears its selection).
        event.stopPropagation();
        event.preventDefault();
        close(true);
        return;
      }
      if (!isOpen()) return;
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

    // Tabbing out closes it, or the open panel sits over the next control focus lands on.
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && !root.contains(next)) close(false);
    };

    // Items submit real forms and this element survives the navigation, so close on activation.
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-menu-item]")) close(false);
    };

    // The fallback for a browser without anchor positioning: under the button, right edges aligned.
    const place = (event: Event) => {
      if ((event as ToggleEvent).newState !== "open") return;
      const at = button.getBoundingClientRect();
      panel.style.inset = "auto";
      panel.style.margin = "0";
      panel.style.top = `${at.bottom + 4}px`;
      panel.style.right = `${document.documentElement.clientWidth - at.right}px`;
    };
    const anchored = CSS.supports("anchor-name: --menu");

    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("click", onClick);
    root.addEventListener("focusout", onFocusOut);
    if (!anchored) panel.addEventListener("beforetoggle", place);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("click", onClick);
      root.removeEventListener("focusout", onFocusOut);
      panel.removeEventListener("beforetoggle", place);
    };
  }, [ref]);
}

/**
 * The shared shell of the overflow and row menus. `name` is the class prefix: the wrapper, its
 * `-button` popover invoker and its `-panel` popover. `summaryLabel` names a button whose content is
 * only an icon.
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
  const ref = useRef<HTMLDivElement>(null);
  useDisclosure(ref);
  const id = useId();
  // One anchor name per menu, or every panel on the page would sit under the last button.
  const anchor = `--menu${id.replace(/[^A-Za-z0-9_-]/g, "")}`;

  return (
    <div className={name} ref={ref} style={{ "--menu-anchor": anchor } as React.CSSProperties}>
      <button
        type="button"
        className={`${name}-button`}
        popoverTarget={`${id}-panel`}
        aria-label={summaryLabel}
        title={summaryLabel}
      >
        {summary}
      </button>
      <div className={`${name}-panel`} id={`${id}-panel`} popover="auto">
        {children}
      </div>
    </div>
  );
}
