import { useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "capsomer/react/popover";

/*
 * Deliberately a disclosure, not role="menu": each item is a submit in its own form, which breaks
 * menuitem ownership. The panel is a native popover opened by `popovertarget`, so these repair
 * actions open without script, the panel sits in the top layer (nothing clips it, the posts table's
 * scroll box included), and the browser light-dismisses it on an outside click. The surface and its
 * placement are Capsomer's popover; this hook adds the arrow keys and Escape.
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

    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("click", onClick);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("click", onClick);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, [ref]);
}

/**
 * The shared shell of the overflow and row menus, on Capsomer's popover. Items are `cap-option` buttons or
 * links carrying `data-menu-item`. `summaryLabel` names a button whose content is only an icon.
 */
export function DisclosureMenu({
  summary,
  summaryLabel,
  iconOnly,
  children,
}: {
  summary: React.ReactNode;
  summaryLabel?: string;
  iconOnly?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDisclosure(ref);

  return (
    <div ref={ref}>
      <Popover>
        <PopoverTrigger
          aria-label={summaryLabel}
          title={summaryLabel}
          {...(iconOnly ? { "data-icon-only": "", "data-variant": "quiet", "data-size": "sm" } : {})}
        >
          {summary}
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" size="auto" data-flush="" aria-label={summaryLabel ?? "Actions"}>
          <div className="cap-listbox">{children}</div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
