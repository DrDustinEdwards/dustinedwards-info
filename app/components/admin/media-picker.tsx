import { useEffect } from "react";
import { useFetcher } from "react-router";

type PickedMedia = {
  key: string;
  url: string;
  alt: string;
};

type PickerRow = {
  key: string;
  url: string;
  thumb: string;
  alt: string;
};

export function MediaPicker({
  onPick,
  onCancel,
}: {
  onPick: (picked: PickedMedia) => void;
  onCancel?: () => void;
}) {
  const media = useFetcher<{ objects: PickerRow[]; truncated: boolean }>();

  useEffect(() => {
    if (media.state === "idle" && !media.data) media.load("/admin/media?picker=1");
  }, [media]);

  const objects = media.data?.objects ?? [];
  // Before the first answer, the idle render included: without data, "no images" would be a guess.
  const loading = !media.data;
  /* Mounted empty on the first render and filled after, so the loading and the result are both announced. */
  const status = (
    <p className="sr-only" role="status">
      {media.state === "loading" && loading
        ? "Loading media"
        : loading
          ? ""
          : objects.length === 0
            ? "No images yet"
            : `${objects.length} image${objects.length === 1 ? "" : "s"}`}
    </p>
  );

  if (loading) {
    return (
      <>
        {status}
        <p className="muted">Loading media...</p>
      </>
    );
  }

  if (objects.length === 0) {
    return (
      <>
      {status}
      <div className="media-picker-empty">
        <p className="muted">
          No images in the bucket yet. Upload one from the body editor by dropping
          or pasting it, and it will appear here.
        </p>
        {onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Close
          </button>
        ) : null}
      </div>
      </>
    );
  }

  return (
    <>
      {status}
      <ul className="media-picker-grid">
        {objects.map((object) => (
          <li key={object.key}>
            <button
              type="button"
              className="media-picker-item"
              onClick={() => onPick({ key: object.key, url: object.url, alt: object.alt })}
            >
              {/* The thumbnail, never the original, so the grid cannot pull full-resolution bytes. */}
              <img src={object.thumb} alt="" loading="lazy" width={160} height={160} />
              <span className="media-picker-key">{object.key.replace(/^posts\//, "")}</span>
            </button>
          </li>
        ))}
      </ul>
      {media.data?.truncated ? (
        <p className="muted">
          Showing the first page. Open the media library to page through the rest.
        </p>
      ) : null}
      {onCancel ? (
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </>
  );
}
