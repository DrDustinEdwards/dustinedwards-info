/**
 * Progressive enhancement for blog reading. One file, loaded only on blog routes, and nothing here
 * is required for the page to work.
 *
 * Every public blog route is fully readable, navigable and linkable with JavaScript disabled. This
 * file only upgrades markup that already functions:
 *
 *   progress bar        decorative, absent without script
 *   scroll-spy TOC      the TOC is anchor links either way
 *   code copy + label   the code is already highlighted and selectable
 *   heading copy-link   the anchors are already navigable
 *   footnote previews   the footnote jump links already work
 *   image lightbox      the image is an anchor to the original file
 *   copy as markdown    the button is an anchor to the .md twin
 *   link to selection   the permalink beside it is the whole-post equivalent
 *
 * Every animation checks prefers-reduced-motion. Nothing here writes to the network or to storage.
 * The machine-readable inventory is `content/enhancements.json`, gated by `check:features`.
 */

import { textFragment } from "../lib/text-fragment.mjs";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function onIdle(fn: () => void) {
  // Not in this tsconfig's DOM lib, so it is named as an optional extra on the same object
  // rather than asserted through unknown. The `in` guard is still what decides.
  const idle = window as typeof window & {
    requestIdleCallback?: (cb: () => void) => void;
  };
  if ("requestIdleCallback" in window && idle.requestIdleCallback) {
    idle.requestIdleCallback(fn);
  } else {
    setTimeout(fn, 1);
  }
}

/**
 * How much taller than the viewport a post must be before the bar is worth drawing.
 *
 * LONG POSTS ONLY was always the rule and was never implemented: the bar was created for every
 * post. On one that fits in a viewport there is nothing to scroll, so `height` below is zero or
 * negative and the bar sat permanently at `scaleX(0)`: a decoration that is always empty, telling
 * the reader they have read none of a page they have finished.
 *
 * Two viewports, not one. At exactly one the bar exists to describe a few pixels of scroll and
 * jumps from empty to full, which is worse than absent.
 */
const PROGRESS_MIN_VIEWPORTS = 2;

/** Reading progress. Purely decorative, so it is created by script or not at all. */
function readingProgress() {
  const article = document.querySelector<HTMLElement>(".post .prose");
  if (!article) return;

  /* Long enough NOW. Re-checked on every frame below, because a rotation changes the answer. */
  const worthDrawing = () => article.offsetHeight >= window.innerHeight * PROGRESS_MIN_VIEWPORTS;
  if (!worthDrawing()) return;

  const bar = document.createElement("div");
  bar.className = "reading-progress";
  bar.setAttribute("role", "presentation");
  document.body.insertBefore(bar, document.body.firstChild);

  let ticking = false;
  const update = () => {
    /*
     * HIDDEN RATHER THAN REMOVED when a resize makes the post short: removing it would mean
     * rebuilding it on the next rotation, and `hidden` is one property on an element that is
     * already there.
     */
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

/** Marks the TOC entry for the section currently on screen. */
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
        link.toggleAttribute("data-current", isActive);
      }
    },
    { rootMargin: "0px 0px -70% 0px" },
  );
  for (const target of targets) observer.observe(target);
}

/**
 * Language label and a copy button on one code block.
 *
 * IDEMPOTENT, and the guard tests for the BUTTON rather than for the `data-enhanced` attribute it
 * also sets. The attribute is a proxy that can be lost while the thing it stands for survives, so
 * stripping it alone would append a second button to a block that already had one.
 *
 * `data-enhanced` is then purely the CSS hook: the reserved padding and the thing occupying it
 * arrive together, so a reader without script is not left with a gap.
 */
/**
 * The ONE live region the three copy controls announce through. WCAG 2.2 4.1.3.
 *
 * WHY A SHARED REGION AND NOT ONE PER CONTROL: a live region announces CHANGES to its own contents,
 * so three of them compete, each tied to an element whose visible label changes for another reason.
 *
 * `role="status"`, never assertive: a copy confirmation must not interrupt what is being read.
 *
 * The `::after` text and the button relabel STAY. They are the sighted feedback and they work; this
 * adds the half that was missing. Created lazily and once, hidden with the site's own `.sr-only`.
 */
let statusRegion: HTMLElement | null = null;

function announce(message: string) {
  if (!statusRegion) {
    statusRegion = document.createElement("p");
    statusRegion.className = "sr-only";
    statusRegion.setAttribute("role", "status");
    document.body.appendChild(statusRegion);
  }
  /*
   * CLEARED FIRST, and this is not superstition. A live region announces a CHANGE, so writing the
   * same string twice in a row would be silent; emptying it and setting it on the next frame makes
   * every copy an announcement, including an identical one.
   */
  statusRegion.textContent = "";
  requestAnimationFrame(() => {
    if (statusRegion) statusRegion.textContent = message;
  });
}

function decorateCodeBlock(pre: HTMLElement) {
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
      await navigator.clipboard.writeText(code);
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
 * Language label and a copy button on every code block, AND AGAIN AFTERWARDS.
 *
 * The rewrite this observer was built against is GONE, and the observer is kept anyway: it costs
 * nothing at rest, `decorateCodeBlock` is idempotent, and it makes the decoration independent of
 * WHEN this bundle runs relative to any future subtree rewrite, which is exactly the assumption that
 * broke last time.
 *
 * It terminates. Every write happens inside `decorateCodeBlock`, which does nothing to a `pre`
 * already carrying `data-enhanced`, so the mutations it causes produce a pass that writes nothing.
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

/** Turns the existing heading anchors into copy-link buttons on hover. */
function headingLinks() {
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>(
    ".prose .heading-anchor",
  )) {
    anchor.addEventListener("click", (event) => {
      /*
       * BOTH THINGS HAPPEN: the URL is copied AND the reader lands on the heading, which is what an
       * in-page anchor is for and what 2.4.3 expects of a link that changes the URL. The note here once
       * claimed the anchor still navigated, three lines above a `preventDefault()`, which is hard rule 7's
       * own example of a boundary note that ages.
       *
       * `focus()` on the heading rather than `scrollIntoView`, because moving focus is what a screen
       * reader announces and what the next Tab continues from; scrolling alone moves the eye and leaves
       * the keyboard behind. Headings are not focusable by default, so `tabindex="-1"` is set for the
       * duration and removed afterwards: `-1` and never `0`, because it makes the heading programmatically
       * focusable without adding it to the tab order.
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

      void navigator.clipboard
        .writeText(url.href)
        .then(() => {
          anchor.setAttribute("data-copied", "true");
          setTimeout(() => anchor.removeAttribute("data-copied"), 1500);
          announce("Link copied");
        })
        // A refused clipboard must not cost the reader the navigation they
        // asked for, so landing happens either way.
        .catch(() => {})
        .finally(land);
    });
  }
}


/** Hover and focus previews for footnote references. */
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
   * WCAG 2.2 1.4.13, HOVERABLE. Leaving the reference schedules a hide rather than performing one,
   * and entering the bubble cancels it. Without that the bubble vanishes the moment the pointer moves
   * toward it, so nobody can read a footnote longer than a glance or select text from one. The delay
   * is long enough to cross the gap the bubble is positioned with.
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

      // The bubble is part of the hover target, not a separate thing that
      // steals the pointer. Without these two the grace period above would
      // expire while the reader is inside the bubble reading it.
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

  /*
   * DISMISSIBLE. Escape removes the bubble WITHOUT moving focus, which is what 1.4.13 asks for: a
   * reader who cannot move the pointer away, or whose bubble covers the text, needs a way out that
   * does not cost them their place.
   */
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bubble) {
      event.stopPropagation();
      hide();
    }
  });

  /*
   * PERSISTENT. Nothing hides the bubble on scroll, and nothing needs to: it is positioned in
   * DOCUMENT coordinates, so it travels with the reference rather than staying stuck to the viewport.
   */
}


/**
 * Opens one image over the page. Returns focus where it came from on close.
 *
 * `src` is passed in rather than read off the image on screen: `currentSrc` returns whichever rung
 * of the `srcset` ladder the browser already downloaded, so the overlay would show a resized copy
 * at a larger CSS size and call it full size.
 */
function openOverlay(src: string, alt: string, restoreFocus: () => void) {
  /*
   * A NATIVE <dialog>, OPENED WITH showModal(). It gives modality, Escape, focus containment and the
   * top layer from the platform, which is four hand-rolled behaviours removed rather than four written
   * correctly. Focus return is the platform's too, and `restoreFocus` is kept because the OPENER here
   * is not always the element focus should land on.
   */
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  /*
   * A NAME, because a dialog announces itself and then has nothing to say. The image's alt is the
   * only description there is; when the author left it empty the image is decorative, so the dialog is
   * labelled generically rather than with an empty string that announces as "dialog" and nothing.
   */
  dialog.setAttribute("aria-label", alt || "Full size image");
  if (reduceMotion.matches) dialog.dataset.reduced = "true";

  const full = document.createElement("img");
  full.src = src;
  full.alt = alt;
  dialog.appendChild(full);

  /*
   * A VISIBLE CLOSE BUTTON. Escape and a backdrop click are both real ways out and neither is
   * discoverable, so a touch reader with no keyboard had no announced way to close this at all.
   */
  const close = document.createElement("button");
  close.type = "button";
  close.className = "lightbox-close";
  close.textContent = "Close";
  dialog.appendChild(close);

  const dismiss = () => dialog.close();
  close.addEventListener("click", dismiss);

  /*
   * The backdrop click. On a `<dialog>` the element itself is the click target for its backdrop, so
   * this checks the target rather than wrapping the content. Clicking the image must NOT close it,
   * which is what the target check gives.
   */
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dismiss();
  });

  /*
   * One teardown, on the platform's own `close` event, so every route out lands here: the button, the
   * backdrop, Escape, and anything added later. The element is removed rather than reused, because the
   * next open builds a fresh one with its own src and label.
   */
  dialog.addEventListener("close", () => {
    dialog.remove();
    restoreFocus();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
}


/**
 * Lightbox for post images.
 *
 * THE ANCHOR IS THE SUBJECT, not the image. The shared pipeline wraps every body image in an
 * `a.image-link` to the unsized file, so the click already did something useful before this file
 * loaded, and this intercepts that navigation rather than being the only way to reach the original.
 *
 * Binding the anchor is what makes the keyboard path free: Enter fires a click on it, and close
 * returns focus to the anchor the reader was already on.
 *
 * DIAGRAMS TAKE THE OTHER PATH. Their image pair is deliberately not wrapped, so they are bound
 * directly, and a diagram asset carries no `srcset`, so its `src` IS the original.
 */
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

  const diagrams = Array.from(
    document.querySelectorAll<HTMLImageElement>(".prose img.diagram-image"),
  );
  for (const image of diagrams) {
    image.classList.add("zoomable");
    image.addEventListener("click", () => {
      openOverlay(image.src, image.alt, () => image.focus({ preventScroll: true }));
    });
  }
}

/** Upgrades the markdown link into a clipboard copy, keeping the link intact. */
function copyMarkdown() {
  const trigger = document.querySelector<HTMLAnchorElement>("[data-copy-markdown]");
  if (!trigger || !navigator.clipboard) return;

  trigger.addEventListener("click", async (event) => {
    event.preventDefault();
    const original = trigger.textContent;
    try {
      const response = await fetch(trigger.getAttribute("href") ?? "");
      await navigator.clipboard.writeText(await response.text());
      trigger.textContent = "Copied";
      announce("Markdown copied");
    } catch {
      // Fall back to what the anchor would have done anyway.
      location.href = trigger.getAttribute("href") ?? "";
      return;
    }
    setTimeout(() => {
      trigger.textContent = original;
    }, 2000);
  });
}

/** The button's resting label, and the one it returns to after a copy. */
const SELECTION_LABEL = "Copy link to selection";

/**
 * A link to the passage a reader selected, as a URL text fragment.
 *
 * SCRIPT-ONLY WITH NO FALLBACK, AND THE PERMALINK IS WHY THAT IS ALLOWED. There is no scriptless
 * way to ask a reader what they highlighted, so this cannot have a fallback; what it has is an
 * equivalent path that is always present two blocks below, the permalink to the whole post. That
 * permalink is deliberately NOT a clipboard button, so this control does not duplicate one: it does
 * the one thing the permalink cannot say.
 *
 * IT IS PLACED IN THE FLOW AFTER THE SELECTED BLOCK, not floated over the text. A popover needs
 * coordinates, clamping and a scroll listener, and it still arrives at the END of the tab order; an
 * element after the block a reader just selected is the next tab stop for free, because a selection
 * sets the sequential focus navigation starting point.
 *
 * THE CANONICAL ORIGIN COMES FROM THE PERMALINK, never from `location`. The origin a reader is on
 * is not always the origin a link should carry, and the page already states the canonical one once.
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

  /** The article's own child that a node sits under, so the button lands between blocks. */
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
     * ONLY WHEN IT IS NOT ALREADY THERE, and this is not an optimisation. `insertBefore` REMOVES a
     * node that already has a parent before inserting it, so moving the button to the place it is
     * already in detaches it: `pointerup` fires between mousedown and click, and a target detached
     * in that window never receives the click at all. Measured in a browser; the button looked
     * right and did nothing.
     *
     * insertBefore, never .after(): the global Element here is HTMLRewriter's, whose after takes a
     * string or a Response. search.ts records the same trap for prepend.
     */
    if (block && block.nextSibling !== button) article.insertBefore(button, block.nextSibling);
  };

  /*
   * The selection has to survive the click. A mousedown on the button collapses it and takes the
   * button away with it, so the click would land on nothing.
   */
  button.addEventListener("mousedown", (event) => event.preventDefault());

  button.addEventListener("click", () => {
    void navigator.clipboard.writeText(url).then(() => {
      // The same two words the heading link announces, and one string in the bundle for both.
      button.textContent = "Link copied";
      announce("Link copied");
      setTimeout(() => {
        button.textContent = SELECTION_LABEL;
      }, 2000);
    });
  });

  /*
   * `selectionchange` alone fires on every character of a drag, so the button would hop down the
   * page under the pointer. The pointer pair holds it still until the reader lets go, and keyboard
   * selection still arrives through `selectionchange` with no pointer down.
   */
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
