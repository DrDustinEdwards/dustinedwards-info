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
 *   image lightbox      the image itself, at its rendered size
 *   copy as markdown    the button is an anchor to the .md twin
 *
 * Every animation checks prefers-reduced-motion. Nothing here writes to the
 * network or to storage.
 *
 * The image row said "images already link to their original" until 2026-08-11
 * and that was FALSE, contradicted by this file's own comment on lightbox()
 * below. Measured against content/generated/posts.json: 6 images across 12
 * posts, ZERO wrapped in an anchor. The same false claim is in Capsid's
 * progressive-enhancement.md inventory. The machine-readable inventory is
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

/** Language label and a copy button on every code block. */
function codeBlocks() {
  for (const pre of document.querySelectorAll<HTMLElement>(".prose pre[data-lang]")) {
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
      } catch {
        button.textContent = "Press Ctrl C";
      }
      setTimeout(() => {
        button.textContent = "Copy";
      }, 2000);
    });
    pre.appendChild(button);
  }
}

/** Turns the existing heading anchors into copy-link buttons on hover. */
function headingLinks() {
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>(
    ".prose .heading-anchor",
  )) {
    anchor.addEventListener("click", (event) => {
      // The anchor still navigates for anyone who prefers that; this only adds
      // the clipboard copy alongside it.
      if (!navigator.clipboard) return;
      event.preventDefault();
      const url = new URL(anchor.getAttribute("href") ?? "", location.href);
      void navigator.clipboard.writeText(url.href).then(() => {
        history.replaceState(null, "", url.hash);
        anchor.setAttribute("data-copied", "true");
        setTimeout(() => anchor.removeAttribute("data-copied"), 1500);
      });
    });
  }
}

/** Hover and focus previews for footnote references. */
function footnotePreviews() {
  const notes = document.querySelector(".prose .footnotes");
  if (!notes) return;

  let bubble: HTMLElement | null = null;
  const hide = () => {
    bubble?.remove();
    bubble = null;
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
      document.body.appendChild(bubble);
      const box = ref.getBoundingClientRect();
      bubble.style.top = `${box.bottom + window.scrollY + 8}px`;
      bubble.style.left = `${Math.max(8, box.left + window.scrollX - 20)}px`;
    };
    ref.addEventListener("mouseenter", show);
    ref.addEventListener("focus", show);
    ref.addEventListener("mouseleave", hide);
    ref.addEventListener("blur", hide);
  }
  addEventListener("scroll", hide, { passive: true });
}

/**
 * Lightbox for post images.
 *
 * The markup already wraps nothing: an image is just an image, so the fallback
 * is the image itself at its rendered size. The enhancement opens the full
 * original, which for editor uploads is the R2 object behind /media.
 */
function lightbox() {
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>(".prose img"),
  );
  if (images.length === 0) return;

  for (const image of images) {
    image.classList.add("zoomable");
    image.addEventListener("click", () => {
      const overlay = document.createElement("div");
      overlay.className = "lightbox";
      overlay.tabIndex = -1;
      if (reduceMotion.matches) overlay.setAttribute("data-reduced", "true");

      const full = document.createElement("img");
      full.src = image.currentSrc || image.src;
      full.alt = image.alt;
      overlay.appendChild(full);

      const close = () => {
        overlay.remove();
        image.focus({ preventScroll: true });
      };
      overlay.addEventListener("click", close);
      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
      document.body.appendChild(overlay);
      overlay.focus();
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
