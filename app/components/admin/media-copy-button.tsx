/*
 * THE COPY BUTTON.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, body and
 * comments unchanged. The route now imports it.
 */

import { toast } from "~/components/admin/media-keyboard";

/**
 * THE PAGE'S ONE JOB, as one small button beside the name it copies.
 *
 * The clipboard needs script, which is why the filename beside it links to the
 * detail view where the same string sits in a readonly input. Feedback is a data
 * attribute rather than component state: the page holds no client state by
 * ruling, and a copy button with no acknowledgement reads as broken.
 *
 * AN ICON RATHER THAN THE WORD, and the reason is measured rather than
 * fashionable. It shipped as a full-width block under every tile, which at 24
 * tiles is 24 slabs competing with the pictures they belong to. Compacting it
 * to the WORD "Copy" beside the name was measured next: the word cost 41px of a
 * 131px row and left the name 85, which the browser then ellipsised from the
 * end, undoing the truncation fix in the same commit that made it. The glyph
 * costs 22 and leaves the name 109.
 *
 * `title` carries the address for a pointer, and the visually hidden span
 * carries the accessible name for everything else. An icon with neither is a
 * button that says nothing to a screen reader.
 */
export function CopyButton({
  value,
  label,
  /**
   * The accessible name, when the visible label is not a sentence.
   *
   * Defaults to the old shape, which is right for a tile whose label is a
   * filename ("Copy the address for plate-2019.png"). The inspector passes one
   * explicitly, because there the label is already an imperative and the default
   * produced "Copy the address for Copy address".
   */
  name,
  /**
   * Render the label as TEXT beside the glyph.
   *
   * **THE DEFAULT IS GLYPH-ONLY AND THAT IS MEASURED**: on a tile the word
   * "Copy" cost 41px of a 131px row and pushed the filename back into the
   * end-truncation this design exists to avoid. The inspector has the room, and
   * more importantly it NEEDS the words: three identical glyphs in a row are
   * three controls a reader has to press to tell apart, and the whole point of
   * the adaptive labels is that "HTML link" and "HTML tag" warn you which one
   * you are about to copy. A label only a screen reader can hear cannot do that.
   *
   * Found by `check:admin-ui`: the labels were computed, passed in, and rendered
   * nowhere, so the adaptive naming shipped invisible for one commit.
   */
  showLabel,
}: { value: string; label: string; name?: string; showLabel?: boolean }) {
  return (
    <button
      type="button"
      className="btn-ghost media-copy"
      title={value}
      onClick={(event) => {
        const button = event.currentTarget;
        navigator.clipboard
          .writeText(value)
          .then(() => {
            button.dataset.copied = "yes";
            // ANNOUNCED as well as drawn. The data attribute drives a `::after`,
            // which is invisible to assistive technology; the toast is a live
            // region, so this is the half a screen reader actually gets.
            toast(`Copied ${value}`);
            window.setTimeout(() => {
              delete button.dataset.copied;
            }, 1500);
          })
          .catch(() => {
            button.dataset.copied = "no";
          });
      }}
    >
      {/* Two rounded rectangles, one behind the other: the copy glyph every
          admin surface uses, drawn in currentColor so it takes the button's
          own token and adds no colour of its own. */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      {showLabel ? <span className="media-copy-label">{label}</span> : null}
      {/* The accessible name always, because the visible label is absent on a
          tile and is a fragment ("Markdown") even where it is present. */}
      <span className="sr-only">{name ?? `Copy the address for ${label}`}</span>
    </button>
  );
}
