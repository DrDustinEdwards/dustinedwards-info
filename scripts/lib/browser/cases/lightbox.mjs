/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { readArtifact } from "../../artifact.mjs";
import { BASE, clickOrFail, FETCH_TIMEOUT_MS, firstPathWith, ok, skip } from "../harness.mjs";

/* The overlay's href is compared raw, attribute to attribute: `currentSrc` is absolute. */
/** @param {import("../harness.mjs").CaseContext} ctx */
export async function run({ page, browser }) {
  /* A deployed origin may lack a named post, so a candidate without the anchor skips, not fails. */
  const artifact = readArtifact();
  const candidates = artifact.posts
    .filter((/** @type {any} */ p) => p.draft !== true)
    .filter((/** @type {any} */ p) => String(p.html ?? "").includes('class="image-link"'))
    .map((/** @type {any} */ p) => `/blog/${p.slug}`);

  const { found: imagePost } = await firstPathWith(page, candidates, ".prose a.image-link > img");

  if (imagePost === null) {
    /* No body image in the corpus is a content fact, not a defect, so this skips loudly. */
    skip(
      "post images link to their originals, and the lightbox opens the link",
      candidates.length === 0
        ? `the artifact's ${artifact.posts.length}-post corpus carries no body image ` +
            `at all, so there is no anchor on any page to look at. The pipeline wrap ` +
            `is proven by test/post-image-links.test.mjs; this is the WIRE half and ` +
            `it stays unobserved until a post cites an image.`
        : `the artifact names ${candidates.length} post(s) carrying an image-link ` +
            `(${candidates.join(", ")}) and NONE of them served one. Against a ` +
            `deployed origin that means the disk is ahead of the deployment; against ` +
            `the preview build it is a real defect and should be read as one.`,
    );
  } else {
    /* Closed in a finally, like the other scriptless pages: a throw here would leave it open. */
    const scriptless = await browser.newPage();
    // Overwritten below or the throw propagates, so these values are never read.
    let served = { image: false, anchor: false, klass: "", href: "" };
    try {
      await scriptless.setJavaScriptEnabled(false);
      await scriptless.goto(`${BASE}${imagePost}`, { waitUntil: "networkidle0" });
      served = await scriptless.evaluate(() => {
        const image = document.querySelector(".prose img");
        const parent = image?.parentElement ?? null;
        return {
          image: Boolean(image),
          anchor: parent?.tagName === "A",
          klass: parent?.className ?? "",
          href: parent?.getAttribute("href") ?? "",
        };
      });
    } finally {
      await scriptless.close();
    }

    ok(
      `${imagePost}: with script off, the image's parent is an image-link anchor`,
      served.image && served.anchor && served.klass.includes("image-link") && served.href !== "",
      `image ${served.image}, parent is an anchor ${served.anchor}, class ` +
        `${JSON.stringify(served.klass)}, href ${JSON.stringify(served.href)}. The ` +
        `pipeline stopped wrapping, or the wrap did not survive to the served HTML.`,
    );

    let delivered = { status: 0, type: "" };
    if (served.href) {
      const response = await fetch(new URL(served.href, BASE), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      delivered = {
        status: response.status,
        type: response.headers.get("content-type") ?? "",
      };
    }
    ok(
      `${imagePost}: the anchor's href serves an image`,
      delivered.status === 200 && delivered.type.startsWith("image/"),
      `${served.href} answered ${delivered.status} ${JSON.stringify(delivered.type)}. ` +
        `A fallback that 404s is worse than no fallback: the click used to do nothing.`,
    );

    // The page is already open on imagePost from the walk above.
    await clickOrFail(page, ".prose a.image-link", `${imagePost}: the image link is there to click`);
    await new Promise((r) => setTimeout(r, 250));
    const overlay = await page.evaluate(() => {
      const shown = document.querySelector(".lightbox img");
      return {
        open: shown instanceof HTMLImageElement,
        src: shown instanceof HTMLImageElement ? shown.getAttribute("src") : null,
      };
    });
    ok(
      `${imagePost}: clicking the link opens the overlay on the ORIGINAL`,
      overlay.open && overlay.src === served.href,
      `overlay open ${overlay.open}, overlay src ${JSON.stringify(overlay.src)}, ` +
        `anchor href ${JSON.stringify(served.href)}. A mismatch means the lightbox ` +
        `went back to reading currentSrc, which is the resized copy already on ` +
        `screen; overlay absent means the click navigated instead of being caught.`,
    );

    /*
     * A real modal dialog, asserted through `matches("dialog:modal")`, which only `showModal()`
     * satisfies: attributes on a div are a claim, modality is a behavior.
     */
    const modal = await page.evaluate(() => {
      const el = document.querySelector(".lightbox");
      return {
        tag: el?.tagName ?? "(absent)",
        isModal: el instanceof HTMLDialogElement && el.matches("dialog:modal"),
        label: el?.getAttribute("aria-label") ?? "",
        closeButton: Boolean(el?.querySelector("button.lightbox-close")),
        focusInside: Boolean(el && document.activeElement && el.contains(document.activeElement)),
      };
    });
    ok(
      `${imagePost}: the lightbox is a modal <dialog>, not a div`,
      modal.isModal,
      `element is <${modal.tag}> and dialog:modal is ${modal.isModal}. A div with ` +
        `role="dialog" passes an attribute check and still has no focus trap, no ` +
        `inert page behind it and no Escape unless focus is inside it.`,
    );
    ok(
      `${imagePost}: the lightbox carries an accessible name`,
      modal.label.length > 0,
      `aria-label ${JSON.stringify(modal.label)}. A dialog announces itself and then ` +
        `has nothing to say; the image's alt is the only description there is.`,
    );
    ok(
      `${imagePost}: the lightbox has a visible close control`,
      modal.closeButton,
      `no button.lightbox-close. Escape and a backdrop click are both real ways out ` +
        `and neither is discoverable, so a touch reader with no keyboard had none.`,
    );
    ok(
      `${imagePost}: opening the lightbox moves focus into it`,
      modal.focusInside,
      `focus is outside the dialog, so the platform's containment has nothing to ` +
        `contain and the next Tab leaves the modal.`,
    );

    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 200));
    const afterEscape = await page.evaluate(() => ({
      gone: document.querySelector(".lightbox") === null,
      focusedLink: document.activeElement?.classList.contains("image-link") ?? false,
    }));
    ok(
      `${imagePost}: Escape closes it and focus returns to the link`,
      afterEscape.gone && afterEscape.focusedLink,
      `dialog removed ${afterEscape.gone}, focus back on the image link ` +
        `${afterEscape.focusedLink}. Focus left behind on a removed element sends the ` +
        `next Tab to the top of the document.`,
    );
  }
}
