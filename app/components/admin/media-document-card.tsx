/*
 * THE DOCUMENT TILE.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, body and
 * comments unchanged. The route now imports it.
 */

import { docTitle } from "~/lib/media/view.mjs";

/**
 * Read from the KEY rather than the mime type, because the key is what the reader
 * sees everywhere else and a mime type disagreeing with a filename is a
 * distinction nobody wants explained on a tile.
 *
 * NOT `classify.mjs`'s `extensionOf`, which takes a string, returns lowercase, and
 * returns the empty string that `classify()` depends on to THROW. Two functions,
 * one name, different inputs and outputs is a vacuity machine; they are not merged
 * because the difference is real.
 */
function extensionLabel(object: { key: string; mime: string | null }) {
  const fromKey = /\.([a-z0-9]{1,5})$/i.exec(object.key.split("/").pop() ?? "")?.[1];
  if (fromKey) return fromKey.toUpperCase();
  return (object.mime ?? "file").split("/").pop()?.toUpperCase() ?? "FILE";
}

/**
 * WHAT A DOCUMENT TILE SHOWS INSTEAD OF A PICTURE: an extension label, the TITLE
 * in words, a suggestion of text.
 *
 * THERE IS NO BOTTOM LINE, BECAUSE THE FACT IT WOULD CARRY DOES NOT EXIST. Nothing
 * stores a page count, and getting one would mean fetching the object out of R2 per
 * render. The size was tried there and was worse: the body's meta line already
 * prints it, and a fact repeated reads as a bug. Both halves hold: no invented
 * page count, and the size stated exactly ONCE per tile.
 *
 * THE RULED LINES ARE DECORATION and are marked so.
 */
export function DocumentCard({
  object,
}: {
  object: { key: string; mime: string | null; originalName: string | null };
}) {
  const base = object.originalName ?? object.key.split("/").pop() ?? object.key;
  return (
    <span className="media-doc">
      <span className="media-doc-ext">{extensionLabel(object)}</span>
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
