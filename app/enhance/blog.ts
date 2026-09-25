import { copyText } from "../lib/clipboard";
import { textFragment } from "../lib/text-fragment.mjs";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function onIdle(fn: () => void) {
  // Not in this tsconfig's DOM lib, so it is typed as an optional extra; the `in` guard decides.
  const idle = window as typeof window & {
    requestIdleCallback?: (cb: () => void) => void;
  };
  if ("requestIdleCallback" in window && idle.requestIdleCallback) {
    idle.requestIdleCallback(fn);
  } else {
    setTimeout(fn, 1);
  }
}

// Two viewports, not one: at one the bar describes a few pixels of scroll and jumps from empty to full.
const PROGRESS_MIN_VIEWPORTS = 2;

function readingProgress() {
  const article = document.querySelector<HTMLElement>(".post .prose");
  if (!article) return;

  const worthDrawing = () => article.offsetHeight >= window.innerHeight * PROGRESS_MIN_VIEWPORTS;
  if (!worthDrawing()) return;

  const bar = document.createElement("div");
  bar.className = "reading-progress";
  bar.setAttribute("role", "presentation");
  document.body.insertBefore(bar, document.body.firstChild);

  let ticking = false;
  const update = () => {
    bar.hidden = !worthDrawing();
    const start = article.offsetTop;
    const height = article.offsetHeight - window.innerHeight;
    const scrolled = height > 0 ? (window.scrollY - start) / height : 0;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, scrolled))})`;
    ticking = false;
  };

  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  addEventListener("scroll", schedule, { passive: true });
  /* A rotation changes both the viewport and the article's height, so it re-asks the question. */
  addEventListener("resize", schedule, { passive: true });
  update();
}

function scrollSpy() {
  const toc = document.querySelector<HTMLElement>(".post-toc");
  if (!toc) return;

  const links = Array.from(toc.querySelectorAll<HTMLAnchorElement>("a[href^='#']"));
  const targets = links
    .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
    .filter((el): el is HTMLElement => el !== null);
  if (targets.length === 0) return;

  const seen = new Map<string, boolean>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
      const active = targets.find((t) => seen.get(t.id));
      for (const link of links) {
        const isActive = active !== undefined && link.hash === `#${active.id}`;
        // The state itself, not a styling hook, so a screen reader hears which section is current.
        if (isActive) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    },
    { rootMargin: "0px 0px -70% 0px" },
  );
  for (const target of targets) observer.observe(target);
}

/**
 * One shared live region for every copy control: a live region announces changes to its own
 * contents, so one per control would compete. `role="status"` so it never interrupts reading.
 */
let statusRegion: HTMLElement | null = null;

function announce(message: string) {
  if (!statusRegion) {
    statusRegion = document.createElement("p");
    statusRegion.className = "sr-only";
    statusRegion.setAttribute("role", "status");
    document.body.appendChild(statusRegion);
  }
  // Cleared first: a live region announces a change, so writing the same string twice would be silent.
  statusRegion.textContent = "";
  requestAnimationFrame(() => {
    if (statusRegion) statusRegion.textContent = message;
  });
}

function decorateCodeBlock(pre: HTMLElement) {
  // Tests for the button, not `data-enhanced`: the attribute can be lost while the button survives.
  if (pre.querySelector(":scope > .code-copy")) return;

  const lang = pre.dataset.lang;
  if (lang && lang !== "text") {
    const label = document.createElement("span");
    label.className = "code-lang";
    label.textContent = lang;
    label.setAttribute("aria-hidden", "true");
    pre.appendChild(label);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "code-copy";
  button.textContent = "Copy";
  button.setAttribute("aria-label", "Copy code to clipboard");
  button.addEventListener("click", async () => {
    const code = pre.querySelector("code")?.textContent ?? "";
    try {
      await copyText(code);
      button.textContent = "Copied";
      announce("Code copied");
    } catch {
      button.textContent = "Press Ctrl C";
      announce("Copy failed. Press Control C to copy.");
    }
    setTimeout(() => {
      button.textContent = "Copy";
    }, 2000);
  });
  pre.appendChild(button);

  // Last, so the padding never arrives before the thing it makes room for.
  pre.setAttribute("data-enhanced", "");
}

/**
 * Keeps observing so decoration does not depend on when this bundle runs relative to a subtree
 * rewrite. It terminates: `decorateCodeBlock` writes nothing to a `pre` already carrying `data-enhanced`.
 */
function codeBlocks() {
  const prose = document.querySelector<HTMLElement>(".prose");
  const decorateAll = () => {
    for (const pre of document.querySelectorAll<HTMLElement>(".prose pre[data-lang]")) {
      decorateCodeBlock(pre);
    }
  };

  decorateAll();
  if (!prose) return;
  new MutationObserver(decorateAll).observe(prose, { childList: true, subtree: true });
}

function headingLinks() {
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>(
    ".prose .heading-anchor",
  )) {
    anchor.addEventListener("click", (event) => {
      /*
       * `focus()` rather than `scrollIntoView`, so a screen reader announces the heading and the next Tab
       * continues from it. `tabindex="-1"` makes it focusable without adding it to the tab order.
       */
      if (!navigator.clipboard) return;
      event.preventDefault();
      const url = new URL(anchor.getAttribute("href") ?? "", location.href);
      const heading = anchor.closest("h2, h3, h4") ?? document.getElementById(url.hash.slice(1));

      const land = () => {
        history.replaceState(null, "", url.hash);
        if (!(heading instanceof HTMLElement)) return;
        const had = heading.hasAttribute("tabindex");
        if (!had) heading.setAttribute("tabindex", "-1");
        heading.focus();
        // Removed on blur rather than immediately: taking it away while the
        // element still holds focus drops focus to the body in some engines.
        if (!had) heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), {
          once: true,
        });
      };

      void copyText(url.href)
        .then(() => {
          anchor.setAttribute("data-copied", "true");
          setTimeout(() => anchor.removeAttribute("data-copied"), 1500);
          announce("Link copied");
        })
        // A refused clipboard must not cost the reader the navigation, so landing happens either way.
        .catch(() => announce("Copy failed. The link is in the address bar."))
        .finally(land);
    });
  }
}

function footnotePreviews() {
  const notes = document.querySelector(".prose .footnotes");
  if (!notes) return;

  let bubble: HTMLElement | null = null;
  let pending: ReturnType<typeof setTimeout> | null = null;

  const cancelHide = () => {
    if (pending !== null) clearTimeout(pending);
    pending = null;
  };

  const hide = () => {
    cancelHide();
    bubble?.remove();
    bubble = null;
  };

  /*
   * WCAG 1.4.13 hoverable: leaving the reference schedules a hide and entering the bubble cancels it,
   * so the pointer can cross the gap to the bubble.
   */
  const HOVER_GRACE_MS = 220;
  const scheduleHide = () => {
    cancelHide();
    pending = setTimeout(hide, HOVER_GRACE_MS);
  };

  for (const ref of document.querySelectorAll<HTMLAnchorElement>(
    ".prose a[data-footnote-ref]",
  )) {
    const show = () => {
      const target = document.getElementById(decodeURIComponent(ref.hash.slice(1)));
      if (!target) return;
      hide();
      bubble = document.createElement("div");
      bubble.className = "footnote-preview";
      bubble.setAttribute("role", "note");
      bubble.innerHTML = target.innerHTML;
      for (const back of bubble.querySelectorAll("[data-footnote-backref]")) back.remove();

      bubble.addEventListener("mouseenter", cancelHide);
      bubble.addEventListener("mouseleave", scheduleHide);

      document.body.appendChild(bubble);
      const box = ref.getBoundingClientRect();
      bubble.style.top = `${box.bottom + window.scrollY + 8}px`;
      bubble.style.left = `${Math.max(8, box.left + window.scrollX - 20)}px`;
    };
    ref.addEventListener("mouseenter", show);
    ref.addEventListener("focus", show);
    ref.addEventListener("mouseleave", scheduleHide);
    ref.addEventListener("blur", scheduleHide);
  }

  // Escape dismisses WITHOUT moving focus, as 1.4.13 asks.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bubble) {
      event.stopPropagation();
      hide();
    }
  });
}


/**
 * `src` is passed in rather than read from `currentSrc`, which is whichever `srcset` rung the browser
 * downloaded: a resized copy shown as full size.
 */
function openOverlay(src: string, alt: string, restoreFocus: () => void, label?: string) {
  // `restoreFocus` is kept because the opener is not always the element focus should land on.
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  /*
   * Empty alt means decorative, so the dialog gets a generic label rather than an empty one. A
   * diagram passes its own short label: its alt describes every node and is too long for a name.
   */
  dialog.setAttribute("aria-label", label ?? (alt || "Full size image"));
  if (reduceMotion.matches) dialog.dataset.reduced = "true";

  const full = document.createElement("img");
  full.src = src;
  full.alt = alt;
  dialog.appendChild(full);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "lightbox-close";
  close.textContent = "Close";
  dialog.appendChild(close);

  const dismiss = () => dialog.close();
  close.addEventListener("click", dismiss);

  // On a `<dialog>` the element itself is the click target for its backdrop.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dismiss();
  });

  dialog.addEventListener("close", () => {
    dialog.remove();
    restoreFocus();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
}

function lightbox() {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(".prose a.image-link"),
  );
  for (const link of links) {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href) return;
      event.preventDefault();
      const image = link.querySelector("img");
      openOverlay(href, image?.alt ?? "", () => link.focus({ preventScroll: true }));
    });
  }

  // Diagram images are not wrapped in an anchor, and carry no `srcset`, so their `src` is the original.
  const diagrams = Array.from(
    document.querySelectorAll<HTMLImageElement>(".prose img.diagram-image"),
  );
  for (const image of diagrams) {
    image.classList.add("zoomable");
    /* A button to assistive technology and the keyboard too, not only to a pointer. */
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", `Enlarge diagram: ${image.alt}`);
    const open = () =>
      openOverlay(
        image.src,
        image.alt,
        () => image.focus({ preventScroll: true }),
        "Diagram, full size",
      );
    image.addEventListener("click", open);
    image.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  }
}

function copyMarkdown() {
  const trigger = document.querySelector<HTMLAnchorElement>("[data-copy-markdown]");
  if (!trigger || !navigator.clipboard) return;

  trigger.addEventListener("click", async (event) => {
    event.preventDefault();
    const original = trigger.textContent;
    try {
      const response = await fetch(trigger.getAttribute("href") ?? "");
      // An error page is not the markdown: fail over to opening the link, which shows what went wrong.
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await copyText(await response.text());
      trigger.textContent = "Copied";
      announce("Markdown copied");
    } catch {
      location.href = trigger.getAttribute("href") ?? "";
      return;
    }
    setTimeout(() => {
      trigger.textContent = original;
    }, 2000);
  });
}

const SELECTION_LABEL = "Copy link to selection";

/**
 * Script-only with no fallback: there is no scriptless way to read a selection, and the permalink
 * is the equivalent path. Placed in the flow after the selected block, it is the next tab stop.
 * The origin comes from the permalink, never `location`.
 */
function selectionLink() {
  const article = document.querySelector<HTMLElement>(".post .prose");
  const permalink = document.querySelector<HTMLAnchorElement>(".post-share .u-url");
  if (!article || !permalink || !navigator.clipboard) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "selection-link";
  button.textContent = SELECTION_LABEL;

  let url = "";
  let dragging = false;

  const blockOf = (node: Node) => {
    let element = node instanceof Element ? node : node.parentElement;
    while (element && element !== article && element.parentElement !== article) {
      element = element.parentElement;
    }
    return element === article ? null : element;
  };

  const update = () => {
    const selection = getSelection();
    const fragment = selection?.isCollapsed ? null : textFragment(selection?.toString() ?? "");
    if (!selection || !fragment || !article.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      button.remove();
      return;
    }
    url = `${permalink.href}#:~:text=${fragment}`;
    button.textContent = SELECTION_LABEL;
    const block = blockOf(selection.getRangeAt(0).endContainer);
    /*
     * Only when not already there: `insertBefore` detaches a node that has a parent, and a target
     * detached between pointerup and click never gets the click. Not `.after()`: the global Element
     * here is HTMLRewriter's.
     */
    if (block && block.nextSibling !== button) article.insertBefore(button, block.nextSibling);
  };

  // A mousedown on the button would collapse the selection and take the button away with it.
  button.addEventListener("mousedown", (event) => event.preventDefault());

  button.addEventListener("click", () => {
    const shown = (label: string) => {
      button.textContent = label;
      announce(label);
      setTimeout(() => {
        button.textContent = SELECTION_LABEL;
      }, 2000);
    };
    copyText(url).then(
      () => shown("Link copied"),
      () => shown("Copy failed"),
    );
  });

  // `selectionchange` fires on every character of a drag, so pointer drags update only on release.
  document.addEventListener("selectionchange", () => {
    if (!dragging) update();
  });
  document.addEventListener("pointerdown", () => {
    dragging = true;
  });
  document.addEventListener("pointerup", () => {
    dragging = false;
    update();
  });
}

readingProgress();
scrollSpy();
codeBlocks();
headingLinks();
onIdle(() => {
  footnotePreviews();
  lightbox();
  copyMarkdown();
  selectionLink();
});
