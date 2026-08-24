/*
 * THE DOCUMENT TILE.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, body and
 * comments unchanged. The route now imports it.
 */

import { docTitle } from "~/lib/media/view.mjs";

/**
 * The file extension, uppercased, off the key. PDF, SVG, PNG.
 *
 * Read from the KEY rather than from the mime type, because the key is what the
 * reader sees everywhere else on this page and a mime type disagreeing with a
 * filename is a distinction nobody wants explained on a tile. Falls back to the
 * mime subtype when a key genuinely carries no extension.
 */
function extensionOf(object: { key: string; mime: string | null }) {
  const fromKey = /\.([a-z0-9]{1,5})$/i.exec(object.key.split("/").pop() ?? "")?.[1];
  if (fromKey) return fromKey.toUpperCase();
  return (object.mime ?? "file").split("/").pop()?.toUpperCase() ?? "FILE";
}

/**
 * WHAT A DOCUMENT TILE SHOWS INSTEAD OF A PICTURE.
 *
 * **31 of the 70 rows are documents and they currently read as damage.** The
 * tile was a label floating in an empty band, so a folder of five papers
 * rendered as five identical grey boxes whose only distinguishing text was
 * `edw...omics.pdf` against `edw...lysis.pdf`: the middle-elision working
 * correctly on a string that should never have been the identifying one.
 *
 * The mockup's answer, verified in its source rather than in a description of
 * it: a small extension label top left, the TITLE in words, a few faint ruled
 * lines standing in for the text of the page, and one fact along the bottom.
 * A reader scanning that grid sees five different papers.
 *
 * **THERE IS NO BOTTOM LINE, BECAUSE THE FACT IT WOULD CARRY DOES NOT EXIST.**
 *
 * The mockup's card ends with "24 pages". In the mockup that string is FIXTURE
 * DATA, typed into its row table beside the size, and nothing computes it.
 * Nothing in this system stores a page count either: `media` carries bytes,
 * mime, width and height, and width and height are null for every PDF. Getting
 * one would mean fetching the object out of R2 and parsing it, per row, per
 * render, which is a network read for a decoration.
 *
 * The SIZE was put there instead for one render and it was worse, which is why
 * this note is longer than the code it explains. The mockup's tile has NO BODY:
 * the card IS the whole tile. This page's tile has always had a body, and that
 * body's meta line already prints the size, so a card foot carrying it too
 * rendered `1.4 MB` twice inside sixty pixels. A fact repeated is not a fact
 * confirmed; it reads as a bug, and it read as one on a screenshot.
 *
 * So the space is left empty, and the card is the extension, the title and the
 * suggestion of text. A page count goes in when a column holds one.
 * `check:admin-ui` holds both halves meanwhile: no invented page count, and the
 * size stated exactly ONCE per tile.
 *
 * THE RULED LINES ARE DECORATION and are marked so: `aria-hidden`, no text, no
 * meaning carried. They are the one thing here that suggests rather than states.
 */
export function DocumentCard({
  object,
}: {
  object: { key: string; mime: string | null; originalName: string | null };
}) {
  const base = object.originalName ?? object.key.split("/").pop() ?? object.key;
  return (
    <span className="media-doc">
      <span className="media-doc-ext">{extensionOf(object)}</span>
      <span className="media-doc-main">
        <span className="media-doc-title">{docTitle(base)}</span>
        {/* Three rules, the last one short, which is what a paragraph of text
            looks like from across a room. Decoration only: it says nothing, so
            it is hidden from anything that reads rather than looks. */}
        <span className="media-doc-rules" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </span>
    </span>
  );
}
