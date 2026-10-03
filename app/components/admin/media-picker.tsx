import { useEffect } from "react";
import { useFetcher } from "react-router";
import { Empty } from "capsomer/react/empty";

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
    <p className="cap-sr-only" role="status">
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
        <p className="cap-muted">Loading media...</p>
      </>
    );
  }

  if (objects.length === 0) {
    return (
      <>
        {status}
        <Empty
          kind="nothing-yet"
          action={
            onCancel ? (
              <button type="button" className="cap-btn" onClick={onCancel}>
                Close
              </button>
            ) : undefined
          }
        >
          No images in the bucket yet. Upload one from the body editor by dropping or pasting it, and
          it will appear here.
        </Empty>
      </>
    );
  }

  return (
    <>
      {status}
      <div className="cap-media" data-size="s">
        <ul className="cap-media-grid" role="list" aria-label="Images in the library">
          {objects.map((object) => (
            <li key={object.key} className="cap-media-tile">
              <button
                type="button"
                className="cap-media-open"
                onClick={() => onPick({ key: object.key, url: object.url, alt: object.alt })}
              >
                {/* The thumbnail, never the original, so the grid cannot pull full-resolution bytes. */}
                <span className="cap-media-thumb">
                  <img src={object.thumb} alt="" loading="lazy" width={160} height={160} />
                </span>
                <span className="cap-media-name">{object.key.replace(/^posts\//, "")}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {media.data?.truncated ? (
        <p className="cap-muted">
          Showing the first page. Open the media library to page through the rest.
        </p>
      ) : null}
      {onCancel ? (
        <div>
          <button type="button" className="cap-btn" data-variant="quiet" onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : null}
    </>
  );
}
