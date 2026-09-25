import { Link } from "react-router";

import { CopyButton } from "~/components/admin/copy-button";
import { DocumentCard } from "~/components/admin/media-document-card";
import { byteSize } from "~/lib/media/byte-size.mjs";
import { flagsFor, tileFlagFor, usageDescriptor } from "~/lib/media/usage.mjs";
import {
  displayName,
  folderPrefix,
  formatAdded,
  formatDims,
  middleTruncate,
} from "~/lib/media/view.mjs";
import type { hrefWith, sortHref } from "~/lib/media/view.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

type Listing = Extract<Route.ComponentProps["loaderData"], { detail: unknown }>;

/** One file in the library: a grid tile or a list row, the same markup under both layouts. */
export function MediaTile({
  object,
  chosen,
  selectRange,
  linkTo,
  view,
  scanComplete,
  tabStop,
}: {
  object: Listing["objects"][number];
  chosen: string[];
  selectRange: (key: string, shift: boolean) => void;
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
  view: Parameters<typeof sortHref>[0];
  scanComplete: boolean;
  /** Grid only: whether this tile's controls are in the tab order. The arrows move between tiles. */
  tabStop: boolean;
}) {
  const name = displayName(object);
  const usage = usageDescriptor(object.usage);
  const flags = flagsFor({
    viewable: object.viewable,
    alt: object.alt,
    size: object.size,
    twinCount: object.twinCount,
  });
  const tileFlag = tileFlagFor({
    flags,
    usage: object.usage,
    twin: object.twinCount > 0 ? name : null,
  });
  // Not on hover: the server cannot render hover, and it would reveal a control the keyboard cannot reach first.
  const showCaption =
    view.view === "grid" && (chosen.includes(object.key) || view.key === object.key);
  const grid = view.view === "grid";
  // Roving: in the grid only one tile's controls take Tab; the list keeps every row in the tab order.
  const roving = grid && !tabStop ? -1 : undefined;
  return (
    <li
      key={object.key}
      className="media-card"
      /* The keyboard navigator addresses tiles by key, not index, so a reflow cannot change what it means. */
      data-tile={object.key}
      data-selected={chosen.includes(object.key) || undefined}
      data-active={view.key === object.key || undefined}
      data-kind={object.viewable ? "image" : "document"}
    >
      <label className="media-check-label">
        <input
          type="checkbox"
          name="key"
          value={object.key}
          tabIndex={roving}
          checked={chosen.includes(object.key)}
          onChange={(event) =>
            selectRange(
              object.key,
              // Keyboard activation reports shiftKey false, so Space still toggles one row.
              (event.nativeEvent as MouseEvent | undefined)?.shiftKey === true,
            )
          }
        />
        <span className="sr-only">Select {name}</span>
      </label>
      {/* `aspect-ratio` on the wrapper reserves the space, so a lazily-loaded tile cannot reflow the rows below. */}
      {/* The caption is a sibling of the link, not a child: a `<button>` inside an `<a>` is invalid
          HTML that browsers resolve differently. */}
      <span className="media-thumb-frame">
      {/* Without `preventScrollReset`, `<ScrollRestoration>` throws the reader back to the top. */}
      <Link
        to={linkTo({ key: object.key })}
        className="media-thumb-link"
        preventScrollReset
        /* The grid's tab stop, named for the file. In the list the name link is the stop, so this
           duplicate of it leaves the tab order and the accessibility tree. */
        {...(grid
          ? { "aria-label": name, tabIndex: roving }
          : { "aria-hidden": true, tabIndex: -1 })}
        /* preventDefault only on modified clicks, so a plain click stays a link that works without script. */
        onClick={(event) => {
          if (!event.shiftKey && !event.metaKey && !event.ctrlKey) return;
          event.preventDefault();
          selectRange(object.key, event.shiftKey);
        }}
      >
        <span
          className="media-thumb-box"
          // Set only when present: the Images binding does not rasterize SVGs, so the placeholder can be null and url(null) renders black.
          style={
            object.placeholder
              ? { backgroundImage: `url("${object.placeholder}")` }
              : undefined
          }
          data-placeholder={object.placeholder ? "lqip" : "none"}
          data-kind={object.viewable ? "image" : "document"}
        >
          {/* The Images binding can never thumbnail a document, so it gets a card, not a broken `<img>`. */}
          {object.viewable ? (
            <img
              className="media-thumb"
              src={object.thumb}
              alt=""
              loading="lazy"
              decoding="async"
              width={320}
              height={320}
            />
          ) : (
            <DocumentCard object={object} />
          )}
        </span>
      </Link>

      {tileFlag ? (
        <span
          className="media-tile-flag"
          data-flag={tileFlag.id}
          title={tileFlag.title}
        >
          <span className="sr-only">{tileFlag.title}</span>
        </span>
      ) : null}

      {/* The tile's only copy control when it renders: two same-named buttons would be read twice. */}
      {showCaption ? (
        <span className="media-caption">
          <span className="media-caption-text">
            <span className="media-caption-name">{name}</span>
            <span className="media-caption-meta">
              {byteSize(object.size)}
              {object.width && object.height
                ? ` · ${formatDims(object.width, object.height)}`
                : ""}
            </span>
          </span>
          <CopyButton value={object.url} label={name} tabIndex={roving} />
        </span>
      ) : null}
      </span>

      {/* `display: contents` in both layouts: a row's cells must be grid items of the row, so no
          wrapper may sit between them. */}
      <div className="media-card-body">
        <div className="media-name-row">
          {/* Content-addressed keys read as noise, so the author's name identifies the file. */}
          <Link
            to={linkTo({ key: object.key })}
            className="media-name"
            title={object.key}
            preventScrollReset
            /* In the grid the thumbnail is the stop and carries this name, so this one steps aside. */
            {...(grid ? { "aria-hidden": true, tabIndex: -1 } : {})}
          >
            {view.view === "list" ? name : middleTruncate(name)}
          </Link>
          {/* Without the directory, two same-named files in different directories read as one row twice. */}
          <span className="media-name-dir">{folderPrefix(object.key)}</span>
        </div>
        {/* Never say "unused": the repository scan cannot see a constructed path or an external site
            linking the file. */}
        <p className="media-meta">
          <span className="chip">{object.role}</span> {byteSize(object.size)}
          {scanComplete ? ` · ${usage.label}` : ""}
        </p>
      </div>

      {/* "not measured" rather than 0x0 or blank, which would read as a value, not an absence. */}
      {/* The dot is a second channel beside the word, never the signal alone, for readers who cannot
          separate the hues. */}
      <span className="media-col media-col-usage">
        <span className="media-usage-line">
          <span
            className="media-usage-dot"
            data-usage={scanComplete ? object.usage : "unknown"}
            aria-hidden="true"
          />
          <span title={scanComplete ? usage.title : undefined}>
            {scanComplete ? usage.label : "unknown"}
          </span>
        </span>
        {flags.length > 0 ? (
          <span className="media-row-flags">
            {flags.map((f) => f.label).join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="media-col media-col-dims">
        {formatDims(object.width, object.height)}
      </span>
      <span className="media-col media-col-size">{byteSize(object.size)}</span>
      <span className="media-col media-col-added">{formatAdded(object.uploaded)}</span>

      {showCaption ? null : (
        <span className="media-col-copy">
          <CopyButton value={object.url} label={name} tabIndex={roving} />
        </span>
      )}
    </li>
  );
}
