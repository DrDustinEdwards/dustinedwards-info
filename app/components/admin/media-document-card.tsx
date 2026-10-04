// Not classify.mjs's extensionOf: that takes a string and returns the "" classify() relies on to throw.
function extensionLabel(object: { key: string; mime: string | null }) {
  const fromKey = /\.([a-z0-9]{1,5})$/i.exec(object.key.split("/").pop() ?? "")?.[1];
  if (fromKey) return fromKey.toUpperCase();
  return (object.mime ?? "file").split("/").pop()?.toUpperCase() ?? "FILE";
}

// No page count: nothing stores one, and the size is already on the tile's meta line.
export function DocumentCard({
  object,
}: {
  object: { key: string; mime: string | null; originalName: string | null };
}) {
  return (
    <span className="cap-media-doc" aria-hidden="true">
      {extensionLabel(object)}
    </span>
  );
}
