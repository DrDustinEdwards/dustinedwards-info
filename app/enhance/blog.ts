/**
 * Progressive enhancement for blog reading. One file, loaded only on blog
 * routes, and nothing here is required for the page to work.
 *
 * Every public blog route is fully readable, navigable and linkable with
 * JavaScript disabled. This file only upgrades markup that already functions:
 *
 *   progress bar        decorative, absent without script
 *   scroll-spy TOC      the TOC is anchor links either way
 *   code copy + label   the code is already highlighted and selectable
 *   heading copy-link   the anchors are already navigable
 *   footnote previews   the footnote jump links already work
 *   image lightbox      the image is an anchor to the original file
 *   copy as markdown    the button is an anchor to the .md twin
 *
 * Every animation checks prefers-reduced-motion. Nothing here writes to the
 * network or to storage.
 *
 * The image row claimed that anchor from before 2026-08-11, when it was
 * measured FALSE and corrected to say the fallback was the image itself. The
 * anchor now exists, written by the shared pipeline, so the original claim is
 * true for the first time. The machine-readable inventory is
 * content/enhancements.json, gated by check:features.
 */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function onIdle(fn: () => void) {
  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void })
      .requestIdleCallback(fn);
  } else {
    setTimeout(fn, 1);
  }
}

/** Reading progress. Purely decorative, so it is created by script or not at all. */
function readingProgress() {
  const article = document.querySelector<HTMLElement>(".post .prose");
  if (!article) return;

  const bar = document.createElement("div");
  bar.className = "reading-progress";
  bar.setAttribute("role", "presentation");
  document.body.insertBefore(bar, document.body.firstChild);

  let ticking = false;
  const update = () => {
    const start = article.offsetTop;
    const height = article.offsetHeight - window.innerHeight;
    const scrolled = height > 0 ? (window.scrollY - start) / height : 0;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, scrolled))})`;
    ticking = false;
  };

  addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
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
 * IDEMPOTENT, and the guard tests for the BUTTON rather than for the
 * `data-enhanced` attribute it also sets. The attribute is a proxy for the
 * thing we actually care about, and a proxy can be lost while the thing it
 * stands for survives: strip it alone and this would append a second button to
 * a block that already had one. Asking whether the furniture is there answers
 * the real question and cannot drift from it.
 *
 * `data-enhanced` is then purely the CSS hook. `app.css` reserves the top
 * padding for a `pre` carrying it, so the space and the thing occupying it
 * arrive together and a reader without script is not left with a gap.
 */
/**
 * The ONE live region the three copy controls announce through. WCAG 2.2 4.1.3.
 *
 * ## WHAT WAS WRONG
 *
 * All three said "Copied" VISUALLY and told a screen reader nothing. The code
 * button swapped its own `textContent`, the markdown trigger swapped its own,
 * and the heading permalink set a `data-copied` attribute that CSS renders
 * through `::after`. Generated content is not in the accessibility tree at all,
 * and a button that silently relabels itself is a change of name rather than a
 * status message: a reader who cannot see the swap has no way to learn whether
 * the copy worked.
 *
 * ## WHY A SHARED REGION AND NOT `aria-live` ON EACH CONTROL
 *
 * A live region announces CHANGES to its own contents. Putting one on each
 * control means three regions competing, and it means the announcement is tied
 * to an element whose visible label is changing for a different reason. One
 * region that all three write into is one thing for assistive technology to
 * watch, and it leaves each control's own name alone.
 *
 * `role="status"` rather than `aria-live="assertive"`: this is polite by
 * definition. A copy confirmation must not interrupt whatever is being read.
 *
 * ## THE VISUAL AND THE ANNOUNCED ARE SEPARATE ON PURPOSE
 *
 * The `::after` text and the button relabel STAY. They are the sighted
 * feedback and they work; this adds the half that was missing rather than
 * replacing the half that was not.
 *
 * Created lazily and once, so a page with no copy controls carries no extra
 * element, and the element is visually hidden with the site's own `.sr-only`
 * rather than a second definition of the same idea.
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
   * CLEARED FIRST, and this is not superstition. A live region announces a
   * CHANGE; writing the same string twice in a row is not a change, so copying
   * a second time would be silent. Emptying it and setting it on the next frame
   * makes every copy an announcement, including an identical one.
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
 * **The rewrite this observer was built against is GONE, and the observer is
 * kept anyway.** The post body is injected with `dangerouslySetInnerHTML` in
 * `blog.$slug.tsx`, and while public pages hydrated, react re-rendered the
 * container once after hydration and rewrote every child from the loader's
 * html string, destroying anything script had appended. MEASURED on
 * production, not reasoned: a MutationObserver installed before any page
 * script recorded all six nodes attaching, then `.prose` losing and regaining
 * all 67 of its children 23ms later, leaving zero buttons, with a control run
 * (the enhancement blocked at the network) showing the same replacement.
 * Decorating once was a race this file lost every time.
 *
 * The public plane stopped hydrating on 2026-08-26, so nothing rewrites the
 * subtree any more and a single pass would suffice. The observer stays
 * because it costs nothing at rest, `decorateCodeBlock` is idempotent, and it
 * makes the decoration independent of WHEN this bundle runs relative to any
 * future subtree rewrite, which is exactly the assumption that broke last
 * time.
 *
 * It terminates. Every write happens inside `decorateCodeBlock`, which does
 * nothing to a `pre` already carrying `data-enhanced`, so the mutations this
 * observer causes produce a pass that writes nothing and no further mutations.
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
       * THE COMMENT HERE USED TO SAY "the anchor still navigates for anyone who
       * prefers that", THREE LINES ABOVE A `preventDefault()`. It did not. The
       * copy replaced the navigation rather than joining it, so a reader who
       * clicked a heading permalink got a clipboard write and stayed exactly
       * where they were, with the URL bar changed under them and no focus
       * moved. That is a boundary note that was false in the commit that wrote
       * it, which is hard rule 7's own example.
       *
       * BOTH THINGS HAPPEN NOW. The URL is copied AND the reader lands on the
       * heading, which is what an in-page anchor is for and what 2.4.3 expects
       * of a link that changes the URL: focus follows.
       *
       * `focus()` on the heading rather than `scrollIntoView`, because moving
       * focus is what a screen reader announces and what the next Tab
       * continues from; scrolling alone moves the eye and leaves the keyboard
       * behind. Headings are not focusable by default, so `tabindex="-1"` is
       * set for the duration and removed afterwards: it makes the element
       * programmatically focusable without adding it to the tab order.
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
   * WCAG 2.2 1.4.13, all three parts, and all three were missing.
   *
   * HOVERABLE. `mouseleave` on the reference hid the bubble immediately, so the
   * bubble appeared BELOW the reference and vanished the moment the pointer
   * moved toward it. Nobody could ever read a footnote longer than one glance,
   * and nobody could select text from one. The grace period below is the fix:
   * leaving the reference schedules a hide rather than performing one, and
   * entering the bubble cancels it.
   *
   * The delay is short enough not to feel sticky and long enough to cross the
   * eight-pixel gap the bubble is positioned with, which is the distance the
   * pointer actually has to travel.
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
   * DISMISSIBLE. Escape removes the bubble WITHOUT moving focus, which is what
   * 1.4.13 asks for: a reader who cannot move the pointer away, or who has the
   * bubble covering the text they were reading, needs a way out that does not
   * cost them their place. There was none.
   */
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bubble) {
      event.stopPropagation();
      hide();
    }
  });

  /*
   * PERSISTENT. A `scroll` listener used to hide the bubble, so any scroll,
   * including the one a reader makes to bring a long footnote into view,
   * destroyed what they were reading. It is gone.
   *
   * Nothing replaces it, and nothing needs to: the bubble is positioned in
   * DOCUMENT coordinates (`window.scrollY` is added when it is placed), so it
   * travels with the reference rather than staying stuck to the viewport.
   */
}


/**
 * Opens one image over the page. Returns focus where it came from on close.
 *
 * `src` is passed in rather than read off the image on screen, and that is the
 * whole correction. Reading `currentSrc` returns whichever rung of the `srcset`
 * ladder the browser already downloaded, so the overlay showed the same resized
 * copy at a larger CSS size and called it full size.
 */
function openOverlay(src: string, alt: string, restoreFocus: () => void) {
  /*
   * A NATIVE <dialog>, OPENED WITH showModal(), SINCE 2026-08-28.
   *
   * It was a `div` with `tabIndex = -1` and nothing else: no role, no
   * `aria-modal`, no focus trap, no `inert` on the rest of the page and no
   * close button. Escape worked only while focus happened to be inside it,
   * which is until the reader presses Tab once, and a screen reader was never
   * told a dialog had opened at all. The palette next door has been a real
   * `<dialog>` since it was written, so the site had two modal patterns and
   * only one of them was accessible.
   *
   * `showModal()` gives modality, Escape, focus containment and the top layer
   * from the platform, which is four hand-rolled behaviours removed rather
   * than four written correctly. Focus return is also the platform's: it goes
   * back to whatever opened the dialog, and `restoreFocus` is kept because the
   * OPENER here is not always the element focus should land on.
   */
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  /*
   * A NAME, because a dialog announces itself and then has nothing to say. The
   * image's alt is the only description there is; when the author left it
   * empty the image is decorative, so the dialog is labelled generically
   * rather than with an empty string, which announces as "dialog" and nothing.
   */
  dialog.setAttribute("aria-label", alt || "Full size image");
  if (reduceMotion.matches) dialog.dataset.reduced = "true";

  const full = document.createElement("img");
  full.src = src;
  full.alt = alt;
  dialog.appendChild(full);

  /*
   * A VISIBLE CLOSE BUTTON. Escape and a backdrop click are both real ways
   * out and neither is discoverable: one is invisible and the other is a
   * gesture nobody is told about. A touch reader with no keyboard had no
   * announced way to close this at all.
   */
  const close = document.createElement("button");
  close.type = "button";
  close.className = "lightbox-close";
  close.textContent = "Close";
  dialog.appendChild(close);

  const dismiss = () => dialog.close();
  close.addEventListener("click", dismiss);

  /*
   * The backdrop click, kept. On a `<dialog>` the element itself is the click
   * target for its backdrop, so this checks the target rather than wrapping
   * the content in another element. Clicking the image must NOT close it,
   * which the target check is what gives us.
   */
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dismiss();
  });

  /*
   * One teardown, on the platform's own `close` event, so every route out
   * lands here: the button, the backdrop, Escape, and anything added later.
   * The element is removed rather than reused because the next open builds a
   * fresh one with its own src and label.
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
 * THE ANCHOR IS THE SUBJECT, not the image. The shared pipeline wraps every
 * body image in `<a class="image-link" href="<original>">`, so the click
 * already did something useful before this file loaded: it navigated to the
 * unsized file. This intercepts that navigation and shows the same URL in an
 * overlay instead, which makes the enhancement a genuine upgrade of a working
 * control rather than the only way to reach the original.
 *
 * Binding the anchor is also what makes the keyboard path free. An anchor is
 * focusable and Enter fires a click on it, so Enter opens the overlay through
 * this same listener with nothing keydown-shaped written here, and close
 * returns focus to the anchor the reader was already on.
 *
 * DIAGRAMS TAKE THE OTHER PATH. Their image pair is deliberately not wrapped
 * (pipeline.mjs says why: one of the two is `display: none` and an anchor
 * around it would be an unnamed focus stop), so they are bound directly. A
 * diagram asset carries no `srcset`, so its `src` IS the original and nothing
 * here has to ask the browser which copy it chose.
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

readingProgress();
scrollSpy();
codeBlocks();
headingLinks();
onIdle(() => {
  footnotePreviews();
  lightbox();
  copyMarkdown();
});

// Marks this file as a module so it can be dynamically imported.
export {};
