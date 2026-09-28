const MOBILE = "(max-width: 43.99rem)";

// A pointer that hovers, so a touch screen's synthesized hover never opens a panel under a tap.
const HOVER = "(hover: hover) and (pointer: fine)";

const REDUCE = "(prefers-reduced-motion: reduce)";

// A pass across the bar opens nothing. Once a panel is open, moving along the bar switches in the
// same frame. The only delay is the safe path: while the pointer is aimed at the panel already on
// screen, another word does not take it. Reduced motion opens and closes with no wait and no morph;
// a few frames remain only while the pointer is traveling into the panel, or that path could not be crossed.
const OPEN_INTENT = 100;
const SKIP_FOR = 350;
const AIM_REST = 280;
const CLOSE_AWAY = 80;
const CLOSE_TOWARD = 140;
const MORPH_MS = 200;

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
 * Each panel is a card hung from its own word (chrome-nav.css). The first open grows the card down
 * from the header; switching to another word swaps cards at once, since the next card hangs from a
 * different place and a morph between them would travel. The height is inline and cleared when the
 * grow ends, so a card the script never opened still has no height of its own.
 */
function enhanceMenus() {
  const mobile = window.matchMedia(MOBILE);
  const hover = window.matchMedia(HOVER);
  const motion = window.matchMedia(REDUCE);
  const reduced = () => motion.matches;

  const menus: Menu[] = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-menu]"), (item) => {
    const chevron = item.querySelector<HTMLButtonElement>("[data-nav-chevron]");
    const panel = item.querySelector<HTMLElement>("[data-nav-panel]");
    if (!chevron || !panel) throw new Error("header: a nav menu is missing its chevron or its panel");
    return { item, chevron, panel };
  });

  let pinned: Menu | null = null;
  let pending: Menu | null = null;
  let openTimer = 0;
  let closeTimer = 0;
  let morphGen = 0;
  // When the last panel closed. A return inside SKIP_FOR opens with no intent wait.
  let warmed = -SKIP_FOR;
  // Where the pointer left the open word: the apex of the triangle it may cross to reach the panel.
  let exit: DOMPointReadOnly | null = null;
  let lastX = 0;
  let lastY = 0;
  let prevX = 0;
  let prevY = 0;

  const isOpen = (menu: Menu) =>
    mobile.matches ? menu.item.hasAttribute("data-expanded") : isShowing(menu.panel);
  const sync = (menu: Menu) => menu.chevron.setAttribute("aria-expanded", String(isOpen(menu)));
  const showing = () => menus.find((menu) => isShowing(menu.panel));

  const clearTimers = () => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    openTimer = 0;
    closeTimer = 0;
    pending = null;
  };

  const resetMorph = (panel: HTMLElement) => {
    panel.style.height = "";
    panel.style.overflow = "";
    panel.style.transition = "";
    panel.style.opacity = "";
    for (const child of panel.children) {
      if (!(child instanceof HTMLElement)) continue;
      child.style.transition = "";
      child.style.opacity = "";
    }
  };

  /* The first open grows the card from the header. Reduced motion keeps the popover's own instant show. */
  const grow = (panel: HTMLElement) => {
    if (reduced()) return;
    const gen = ++morphGen;
    const content = [...panel.children].filter((el): el is HTMLElement => el instanceof HTMLElement);
    panel.style.transition = "none";
    panel.style.overflow = "hidden";
    panel.style.height = "auto";
    const target = panel.offsetHeight;
    if (target === 0) {
      resetMorph(panel);
      return;
    }
    panel.style.height = "0px";
    panel.style.opacity = "0";
    for (const el of content) {
      el.style.transition = "none";
      el.style.opacity = "1";
    }
    void panel.offsetHeight;
    requestAnimationFrame(() => {
      if (gen !== morphGen || !isShowing(panel)) return;
      panel.style.transition = `height ${MORPH_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease`;
      for (const el of content) el.style.transition = "opacity 140ms ease";
      void panel.offsetHeight;
      panel.style.height = `${target}px`;
      panel.style.opacity = "1";
      for (const el of content) el.style.opacity = "1";
    });
    window.setTimeout(() => {
      if (gen !== morphGen) return;
      resetMorph(panel);
    }, MORPH_MS + 80);
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

  const overOwn = (menu: Menu, x: number, y: number) =>
    rectHas(menu.item.getBoundingClientRect(), x, y) || rectHas(menu.panel.getBoundingClientRect(), x, y);

  // The gap under the word, plus the triangle from `exit` to the panel's top edge.
  const inSafe = (menu: Menu, x: number, y: number) => {
    const item = menu.item.getBoundingClientRect();
    const box = menu.panel.getBoundingClientRect();
    const top = Math.min(item.bottom, box.top);
    const bottom = Math.max(item.bottom, box.top);
    if (x >= item.left && x <= item.right && y >= top - 2 && y <= bottom + 2) return true;
    if (!exit || box.bottom <= box.top) return false;
    return inTriangle(
      new DOMPointReadOnly(x, y),
      exit,
      new DOMPointReadOnly(box.left, box.top),
      new DOMPointReadOnly(box.right, box.top),
    );
  };

  // A jump's leave event is reported at the destination. The apex has to be the last point on the word,
  // or that destination is "inside" the triangle and the close cancels itself.
  const onPath = (menu: Menu, x: number, y: number) => {
    if (!exit) return false;
    return Math.hypot(x - exit.x, y - exit.y) > 6 && inSafe(menu, x, y);
  };

  // The leave point is the triangle's apex, so it is always "inside". Project one step of travel.
  const headingIn = (menu: Menu) => {
    const dx = lastX - prevX;
    const dy = lastY - prevY;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return false;
    const step = 28;
    return inSafe(menu, lastX + (dx / len) * step, lastY + (dy / len) * step);
  };

  /*
   * An auto popover closes any other one as it opens, so there is only ever one panel to track. Both
   * sync at once: the toggle event that also syncs arrives a task later, after a reader could look.
   */
  const show = (menu: Menu, pin: boolean) => {
    const switching = showing() !== undefined;
    clearTimers();
    exit = null;
    if (!isShowing(menu.panel)) {
      if (switching) {
        morphGen += 1;
        menus.forEach((other) => resetMorph(other.panel));
      }
      menu.panel.showPopover();
      place(menu);
      if (!switching) grow(menu.panel);
    }
    pinned = pin ? menu : null;
    menus.forEach(sync);
    syncPage();
  };

  const hide = (menu: Menu) => {
    clearTimers();
    morphGen += 1;
    resetMorph(menu.panel);
    if (isShowing(menu.panel)) menu.panel.hidePopover();
    sync(menu);
    syncPage();
  };

  const scheduleClose = (menu: Menu) => {
    window.clearTimeout(closeTimer);
    const toward = headingIn(menu);
    const delay = reduced() ? (toward ? 48 : 0) : toward ? CLOSE_TOWARD : CLOSE_AWAY;
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      if (pinned === menu || pending || !isShowing(menu.panel)) return;
      if (overOwn(menu, lastX, lastY)) return;
      if (onPath(menu, lastX, lastY)) return;
      hide(menu);
    }, delay);
  };

  const openDelay = () => {
    if (reduced() || performance.now() - warmed < SKIP_FOR) return 0;
    return OPEN_INTENT;
  };

  const notePointer = (x: number, y: number) => {
    prevX = lastX;
    prevY = lastY;
    lastX = x;
    lastY = y;
  };

  for (const menu of menus) {
    sync(menu);

    // Every way a panel closes, the browser's own light dismiss and Escape included, passes through here.
    menu.panel.addEventListener("toggle", () => {
      if (!isShowing(menu.panel)) {
        if (pinned === menu) pinned = null;
        resetMorph(menu.panel);
        warmed = performance.now();
      }
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

    menu.item.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !hover.matches || mobile.matches) return;
      notePointer(event.clientX, event.clientY);
      const open = showing();
      // Back on the word or on its panel, which is inside this item, so it is not closing after all.
      if (open === menu) {
        window.clearTimeout(closeTimer);
        closeTimer = 0;
        window.clearTimeout(openTimer);
        openTimer = 0;
        pending = null;
        return;
      }
      window.clearTimeout(openTimer);
      openTimer = 0;
      if (!open) {
        const delay = openDelay();
        if (delay === 0) show(menu, false);
        else openTimer = window.setTimeout(() => show(menu, false), delay);
        return;
      }
      // Aimed at the open panel: crossing this word is not a choice. Resting here is.
      if (inSafe(open, event.clientX, event.clientY)) {
        window.clearTimeout(closeTimer);
        closeTimer = 0;
        pending = menu;
        openTimer = window.setTimeout(() => {
          pending = null;
          show(menu, false);
        }, reduced() ? 0 : AIM_REST);
        return;
      }
      show(menu, false);
    });

    menu.item.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse" || mobile.matches) return;
      window.clearTimeout(openTimer);
      openTimer = 0;
      if (pending === menu) pending = null;
      if (!isShowing(menu.panel) || pinned === menu) return;
      const next = event.relatedTarget;
      if (next instanceof Node && menu.item.contains(next)) return;
      const itemBox = menu.item.getBoundingClientRect();
      const apex = rectHas(itemBox, lastX, lastY)
        ? { x: lastX, y: lastY }
        : rectHas(itemBox, prevX, prevY)
          ? { x: prevX, y: prevY }
          : { x: itemBox.left + itemBox.width / 2, y: itemBox.top + itemBox.height / 2 };
      exit = new DOMPointReadOnly(apex.x, apex.y);
      if (event.clientX !== lastX || event.clientY !== lastY) notePointer(event.clientX, event.clientY);
      scheduleClose(menu);
    });

    // Tabbing out of the word, chevron and panel closes it, as the Menu does (WCAG 2.4.11).
    menu.item.addEventListener("focusout", (event) => {
      const next = event.relatedTarget;
      if (mobile.matches || !(next instanceof Node) || menu.item.contains(next)) return;
      hide(menu);
    });
  }

  // Keeps the safe path honest between the events above: a move along the bar leaves the triangle
  // and switches at once, and a move into the panel cancels the close.
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || mobile.matches || !hover.matches) return;
    notePointer(event.clientX, event.clientY);
    const open = showing();
    if (!open) return;
    if (overOwn(open, lastX, lastY)) {
      window.clearTimeout(closeTimer);
      closeTimer = 0;
      window.clearTimeout(openTimer);
      openTimer = 0;
      pending = null;
      return;
    }
    if (onPath(open, lastX, lastY) || (inSafe(open, lastX, lastY) && headingIn(open))) {
      window.clearTimeout(closeTimer);
      closeTimer = 0;
      return;
    }
    if (pending && pending !== open) {
      show(pending, false);
      return;
    }
    if (pinned === open) return;
    if (closeTimer === 0) scheduleClose(open);
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
