import { docTitle } from "~/lib/media/view.mjs";

// Not classify.mjs's extensionOf: that takes a string and returns the "" classify() relies on to throw.
function extensionLabel(object: { key: string; mime: string | null }) {
  const fromKey = /\.([a-z0-9]{1,5})$/i.exec(object.key.split("/").pop() ?? "")?.[1];
  if (fromKey) return fromKey.toUpperCase();
  return (object.mime ?? "file").split("/").pop()?.toUpperCase() ?? "FILE";
}

// No bottom line: nothing stores a page count, and the size is already on the tile's meta line.
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
        <span className="media-doc-rules" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </span>
    </span>
  );
}
