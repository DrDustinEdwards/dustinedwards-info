import { useEffect } from "react";
import { useFetcher } from "react-router";

/**
 * THE PICKER. Shape 3 of media-module-architecture.md.
 *
 * One component, consumed by the editor drawer today and usable by any later
 * consumer. The drawer contains no picker logic of its own: it renders this and
 * receives a chosen object back, which is the difference between one media
 * surface and two that drift.
 *
 * It reads the media page's loader rather than a listing endpoint of its own,
 * so what a picker shows and what the library shows come from the same query.
 */

export type PickedMedia = {
  key: string;
  url: string;
  /** The record's alt, which insertion pre-fills. Empty when unmeasured. */
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

  // Loaded on demand, so no consumer's first paint ever waits on R2.
  useEffect(() => {
    if (media.state === "idle" && !media.data) media.load("/admin/media?picker=1");
  }, [media]);

  if (media.state === "loading" && !media.data) {
    return <p className="muted">Loading media...</p>;
  }

  const objects = media.data?.objects ?? [];

  if (objects.length === 0) {
    return (
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
    );
  }

  return (
    <>
      <ul className="media-picker-grid">
        {objects.map((object) => (
          <li key={object.key}>
            <button
              type="button"
              className="media-picker-item"
              onClick={() => onPick({ key: object.key, url: object.url, alt: object.alt })}
            >
              {/* The THUMBNAIL, never the original. `thumb` carries the
                  transform URL the server built, so the grid cannot
                  accidentally pull full-resolution bytes. */}
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
