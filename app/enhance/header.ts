const MOBILE = "(max-width: 43.99rem)";

// A pointer that hovers, so a touch screen's synthesized hover never opens a panel under a tap.
const HOVER = "(hover: hover) and (pointer: fine)";

// The menu design's timings: a pass over a word opens nothing, and a short slip off it closes nothing.
const OPEN_AFTER = 500;
const CLOSE_AFTER = 500;

const RETURN_AFTER = 8;

const HIDE_BELOW = 64;

type Menu = { item: HTMLElement; chevron: HTMLButtonElement; panel: HTMLElement };

function nav(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-site-nav]");
}

function isShowing(element: HTMLElement) {
  return element.matches(":popover-open");
}

/** Whether `p` lies inside the triangle `a b c`: the same side of all three edges. */
function inTriangle(p: DOMPointReadOnly, a: DOMPointReadOnly, b: DOMPointReadOnly, c: DOMPointReadOnly) {
  const side = (u: DOMPointReadOnly, v: DOMPointReadOnly) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
  const [ab, bc, ca] = [side(a, b), side(b, c), side(c, a)];
  return (ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0);
}

/*
 * The Menu the phone header opens is the nav itself, a popover, so the browser already opens it, closes
 * it on Escape or an outside click, and returns focus to the button. What it does not do is close when
 * a link inside is chosen or when Tab leaves it.
 */
function enhanceMenu(element: HTMLElement) {
  const button = document.querySelector<HTMLButtonElement>("[data-header-menu]");
  if (!button) throw new Error("header: the nav is here but its Menu button is not");

  const sync = () => button.setAttribute("aria-expanded", String(isShowing(element)));
  sync();

  element.addEventListener("toggle", () => {
    sync();
    if (isShowing(element)) document.documentElement.removeAttribute("data-header-hidden");
  });

  // A link click leaves the page, and a page restored from the back/forward cache would still show it.
  element.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest("a");
    if (link && isShowing(element)) element.hidePopover();
  });

  /*
   * Tabbing out closes the panel, or it stays open over the next things focus lands on (WCAG 2.4.11).
   * Only when focus went somewhere, and not to the Menu button, whose own click would reopen it.
   */
  element.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (!isShowing(element) || !(next instanceof Node) || element.contains(next) || next === button) return;
    element.hidePopover();
  });
}

/*
 * Each chevron's panel is a popover it opens with no script. On a wide screen this adds hover, a click
 * that pins the panel, Escape back to the chevron, and aria-expanded; on a phone, where the panels sit
 * inside the Menu, the chevron expands its section in place instead.
 */
function enhanceMenus() {
  const mobile = window.matchMedia(MOBILE);
  const hover = window.matchMedia(HOVER);

  const menus: Menu[] = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-menu]"), (item) => {
    const chevron = item.querySelector<HTMLButtonElement>("[data-nav-chevron]");
    const panel = item.querySelector<HTMLElement>("[data-nav-panel]");
    if (!chevron || !panel) throw new Error("header: a nav menu is missing its chevron or its panel");
    return { item, chevron, panel };
  });

  let pinned: Menu | null = null;
  let openTimer = 0;
  let closeTimer = 0;
  // Where the pointer left the word of the open panel: one corner of the triangle it may cross.
  let exit: DOMPointReadOnly | null = null;

  const isOpen = (menu: Menu) =>
    mobile.matches ? menu.item.hasAttribute("data-expanded") : isShowing(menu.panel);
  const sync = (menu: Menu) => menu.chevron.setAttribute("aria-expanded", String(isOpen(menu)));
  const showing = () => menus.find((menu) => isShowing(menu.panel));

  const clearTimers = () => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
  };

  /*
   * An auto popover closes any other one as it opens, so there is only ever one panel to track. Both
   * sync at once: the toggle event that also syncs arrives a task later, after a reader could look.
   */
  const show = (menu: Menu, pin: boolean) => {
    clearTimers();
    if (!isShowing(menu.panel)) menu.panel.showPopover();
    pinned = pin ? menu : null;
    menus.forEach(sync);
  };

  const hide = (menu: Menu) => {
    clearTimers();
    if (isShowing(menu.panel)) menu.panel.hidePopover();
    sync(menu);
  };

  for (const menu of menus) {
    sync(menu);

    // Every way a panel closes, the browser's own light dismiss and Escape included, passes through here.
    menu.panel.addEventListener("toggle", () => {
      if (!isShowing(menu.panel) && pinned === menu) pinned = null;
      sync(menu);
    });

    // Cancelled, so the popover's own toggle never runs: a click on a panel hover opened pins it open.
    menu.chevron.addEventListener("click", (event) => {
      event.preventDefault();
      if (mobile.matches) {
        menu.item.toggleAttribute("data-expanded");
        sync(menu);
        return;
      }
      if (isShowing(menu.panel) && pinned === menu) hide(menu);
      else show(menu, true);
    });

    menu.item.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !hover.matches || mobile.matches) return;
      const open = showing();
      // Back on the word or on its panel, which is inside this item, so it is not closing after all.
      if (open === menu) {
        window.clearTimeout(closeTimer);
        return;
      }
      if (pinned) return;
      window.clearTimeout(openTimer);
      if (!open) {
        openTimer = window.setTimeout(() => show(menu, false), OPEN_AFTER);
        return;
      }
      /*
       * Another panel is open. Along the row, move straight to this one; on the way down to the open
       * panel, crossing this word is not a choice, so switch only if the pointer rests here.
       */
      const box = open.panel.getBoundingClientRect();
      const here = new DOMPointReadOnly(event.clientX, event.clientY);
      const heading =
        exit !== null &&
        inTriangle(here, exit, new DOMPointReadOnly(box.left, box.top), new DOMPointReadOnly(box.right, box.top));
      if (heading) openTimer = window.setTimeout(() => show(menu, false), OPEN_AFTER);
      else show(menu, false);
    });

    menu.item.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse" || mobile.matches) return;
      window.clearTimeout(openTimer);
      if (!isShowing(menu.panel) || pinned === menu) return;
      exit = new DOMPointReadOnly(event.clientX, event.clientY);
      closeTimer = window.setTimeout(() => hide(menu), CLOSE_AFTER);
    });

    // Tabbing out of the word, chevron and panel closes it, as the Menu does (WCAG 2.4.11).
    menu.item.addEventListener("focusout", (event) => {
      const next = event.relatedTarget;
      if (mobile.matches || !(next instanceof Node) || menu.item.contains(next)) return;
      hide(menu);
    });
  }

  // On the document, because a panel hover opened may have no focus inside it at all.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || mobile.matches) return;
    const open = showing();
    if (!open) return;
    event.preventDefault();
    hide(open);
    open.chevron.focus();
  });

  // Crossing the breakpoint changes what open means, so start the new layout with everything closed.
  mobile.addEventListener("change", () => {
    const element = nav();
    if (element && isShowing(element)) element.hidePopover();
    for (const menu of menus) {
      hide(menu);
      menu.item.removeAttribute("data-expanded");
      sync(menu);
    }
  });
}

/**
 * The attribute goes on `<html>` so the stylesheet owns what hiding looks like; a transform written
 * from here would be a second owner of the header's geometry.
 */
function enhancePersistence() {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  if (!header) return;

  const root = document.documentElement;
  let last = window.scrollY;
  let ticking = false;

  const settle = () => {
    ticking = false;
    const y = window.scrollY;
    const element = nav();
    const open = element ? isShowing(element) : false;

    if (y <= HIDE_BELOW || open) {
      root.removeAttribute("data-header-hidden");
      last = y;
      return;
    }

    if (y > last) {
      root.setAttribute("data-header-hidden", "");
      last = y;
      return;
    }

    if (last - y >= RETURN_AFTER) {
      root.removeAttribute("data-header-hidden");
      last = y;
    }
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(settle);
    },
    { passive: true },
  );
}

const element = nav();
if (element) {
  enhanceMenu(element);
  enhanceMenus();
}

// Reduced motion gets no hiding at all, not a slower one: a jump without a transition is worse.
if (
  window.matchMedia(MOBILE).matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  enhancePersistence();
}
