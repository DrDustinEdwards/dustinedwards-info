const MOBILE = "(max-width: 43.99rem)";

// A pointer that hovers, so a touch screen's synthesized hover never opens a panel under a tap.
const HOVER = "(hover: hover) and (pointer: fine)";

// Hover opens at once and moving to another word switches at once; nothing waits on intent and nothing
// animates the card in. The one wait is the close grace: leaving the word or its card starts it, and
// entering the word, its card, or another word ends it, so the pointer can cross the header's foot
// between the word and the card. Grace is not motion, so reduced motion keeps it.
const CLOSE_GRACE = 150;

const RETURN_AFTER = 8;

const HIDE_BELOW = 64;

type Menu = { item: HTMLElement; chevron: HTMLButtonElement; panel: HTMLElement };

function nav(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-site-nav]");
}

function isShowing(element: HTMLElement) {
  return element.matches(":popover-open");
}

/*
 * While a card or the phone Menu is open, the page under it is inert: nothing there takes a click,
 * focus or a screen reader's cursor, and the header stays live. Every way anything opens or closes
 * ends here, and it reads what is open rather than being told, so it cannot be left stuck.
 */
function syncPage() {
  const element = nav();
  const open =
    (element !== null && isShowing(element)) ||
    Array.from(document.querySelectorAll<HTMLElement>("[data-nav-panel]")).some(isShowing);
  for (const region of document.querySelectorAll<HTMLElement>("#main, .site-shell-footer")) {
    region.toggleAttribute("inert", open);
  }
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
    syncPage();
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
 *
 * Each panel is a card hung from its own word (chrome-nav.css). It shows whole on the frame it opens,
 * with no grow or fade, and switching to another word swaps cards in that same frame.
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
  let closeTimer = 0;
  let lastX = 0;
  let lastY = 0;

  const isOpen = (menu: Menu) =>
    mobile.matches ? menu.item.hasAttribute("data-expanded") : isShowing(menu.panel);
  const sync = (menu: Menu) => menu.chevron.setAttribute("aria-expanded", String(isOpen(menu)));
  const showing = () => menus.find((menu) => isShowing(menu.panel));

  const cancelClose = () => {
    window.clearTimeout(closeTimer);
    closeTimer = 0;
  };

  /*
   * Where anchor positioning is missing, the card's x from the word's box, held inside the header's
   * inset as the stylesheet's clamp does. Where it exists the stylesheet owns x and this writes nothing.
   */
  const anchored = CSS.supports("anchor-name: --a") && CSS.supports("anchor-scope: --a");
  const place = (menu: Menu) => {
    if (anchored || mobile.matches) return;
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    const inset = header ? parseFloat(getComputedStyle(header).paddingInlineStart) : 0;
    const pad = parseFloat(getComputedStyle(menu.panel).paddingInlineStart);
    const right = document.documentElement.clientWidth - menu.panel.offsetWidth - inset;
    const x = Math.max(inset, Math.min(menu.item.getBoundingClientRect().left - pad, right));
    menu.panel.style.setProperty("--nav-card-x", `${x}px`);
  };

  const rectHas = (rect: DOMRect, x: number, y: number) =>
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

  // The word, its card, and the strip of header between them, where a pointer resting on its way down
  // is still on its way.
  const overOwn = (menu: Menu, x: number, y: number) => {
    const item = menu.item.getBoundingClientRect();
    const box = menu.panel.getBoundingClientRect();
    if (rectHas(item, x, y) || rectHas(box, x, y)) return true;
    return x >= item.left && x <= item.right && y >= item.bottom - 2 && y <= box.top + 2;
  };

  /*
   * An auto popover closes any other one as it opens, so there is only ever one panel to track. Both
   * sync at once: the toggle event that also syncs arrives a task later, after a reader could look.
   */
  const show = (menu: Menu, pin: boolean) => {
    cancelClose();
    if (!isShowing(menu.panel)) {
      menu.panel.showPopover();
      place(menu);
    }
    pinned = pin ? menu : null;
    menus.forEach(sync);
    syncPage();
  };

  const hide = (menu: Menu) => {
    cancelClose();
    if (isShowing(menu.panel)) menu.panel.hidePopover();
    sync(menu);
    syncPage();
  };

  const scheduleClose = (menu: Menu) => {
    cancelClose();
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      if (pinned === menu || !isShowing(menu.panel)) return;
      if (overOwn(menu, lastX, lastY)) return;
      hide(menu);
    }, CLOSE_GRACE);
  };

  for (const menu of menus) {
    sync(menu);

    // Every way a panel closes, the browser's own light dismiss and Escape included, passes through here.
    menu.panel.addEventListener("toggle", () => {
      if (!isShowing(menu.panel) && pinned === menu) pinned = null;
      sync(menu);
      syncPage();
    });

    // A chosen link leaves the page, and a page restored from the back/forward cache would still show the card.
    menu.panel.addEventListener("click", (event) => {
      if ((event.target as Element | null)?.closest("a") && isShowing(menu.panel)) hide(menu);
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

    // The card is inside its item, so this fires on the word and on the card alike: open or keep it.
    menu.item.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !hover.matches || mobile.matches) return;
      lastX = event.clientX;
      lastY = event.clientY;
      if (showing() === menu) cancelClose();
      else show(menu, false);
    });

    menu.item.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse" || mobile.matches) return;
      lastX = event.clientX;
      lastY = event.clientY;
      if (!isShowing(menu.panel) || pinned === menu) return;
      const next = event.relatedTarget;
      if (next instanceof Node && menu.item.contains(next)) return;
      scheduleClose(menu);
    });

    // Tabbing out of the word, chevron and panel closes it, as the Menu does (WCAG 2.4.11).
    menu.item.addEventListener("focusout", (event) => {
      const next = event.relatedTarget;
      if (mobile.matches || !(next instanceof Node) || menu.item.contains(next)) return;
      hide(menu);
    });
  }

  // Where the pointer is when the grace runs out: on its way down the strip under the word, the card stays.
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  // The pointer left the page. A move onto the panel also leaves elements under it, and the panel is
  // in the top layer, so only a point outside the viewport counts as leaving.
  document.documentElement.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse" || mobile.matches) return;
    if (event.relatedTarget instanceof Node) return;
    if (
      event.clientX >= 0 &&
      event.clientY >= 0 &&
      event.clientX <= window.innerWidth &&
      event.clientY <= window.innerHeight
    ) {
      return;
    }
    const open = showing();
    if (!open || pinned === open) return;
    hide(open);
  });

  // On the document, because a panel hover opened may have no focus inside it at all.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || mobile.matches) return;
    const open = showing();
    if (!open) return;
    event.preventDefault();
    hide(open);
    open.chevron.focus();
  });

  /*
   * The veil takes the click. The popover's light dismiss already closes the card on it; this closes
   * it where that does not run, and keeps the click from going anywhere else.
   */
  const veil = document.querySelector<HTMLElement>("[data-nav-veil]");
  if (!veil) throw new Error("header: the nav menus are here but their veil is not");
  veil.addEventListener("pointerdown", (event) => event.preventDefault());
  veil.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const open = showing();
    if (open) hide(open);
  });

  window.addEventListener("resize", () => {
    const open = showing();
    if (open) place(open);
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
    syncPage();
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
  // A page restored from the back/forward cache comes back as it was left; read it again.
  window.addEventListener("pageshow", syncPage);
}

// Reduced motion gets no hiding at all, not a slower one: a jump without a transition is worse.
if (
  window.matchMedia(MOBILE).matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  enhancePersistence();
}
