import { Link } from "react-router";
import { Status } from "capsomer/react/status";

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

type TileProps = {
  object: Listing["objects"][number];
  chosen: string[];
  selectRange: (key: string, shift: boolean) => void;
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
  view: Parameters<typeof sortHref>[0];
  scanComplete: boolean;
  /** Grid only: whether this tile's controls are in the tab order. The arrows move between tiles. */
  tabStop: boolean;
};

const FLAG_TONE: Record<string, "warn" | "info"> = {
  duplicate: "info",
  unattached: "warn",
  "no-alt": "warn",
};

const USAGE_TONE: Record<string, "ok" | "warn" | "nodata"> = {
  used: "ok",
  unattached: "warn",
  unknown: "nodata",
};

/** The select box: a real checkbox, which the bulk form reads, on Capsomer's media markup. */
function SelectBox({
  object,
  name,
  chosen,
  selectRange,
  tabIndex,
}: {
  object: TileProps["object"];
  name: string;
  chosen: string[];
  selectRange: TileProps["selectRange"];
  tabIndex: number | undefined;
}) {
  return (
    <label className="cap-media-check">
      <input
        type="checkbox"
        name="key"
        value={object.key}
        tabIndex={tabIndex}
        checked={chosen.includes(object.key)}
        onChange={(event) =>
          selectRange(
            object.key,
            // Keyboard activation reports shiftKey false, so Space still toggles one row.
            (event.nativeEvent as MouseEvent | undefined)?.shiftKey === true,
          )
        }
      />
      <span className="cap-media-check-box" aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="cap-media-check-word" aria-hidden="true">
        Selected
      </span>
      <span className="cap-sr-only">Select {name}</span>
    </label>
  );
}

/** The thumbnail, or the card a document gets because the Images binding can never thumbnail it. */
function Thumb({ object }: { object: TileProps["object"] }) {
  return (
    <span
      className="cap-media-thumb"
      // Set only when present: the Images binding does not rasterize SVGs, so the placeholder can be null and url(null) renders black.
      style={object.placeholder ? { backgroundImage: `url("${object.placeholder}")` } : undefined}
    >
      {object.viewable ? (
        <img src={object.thumb} alt="" loading="lazy" decoding="async" width={320} height={320} />
      ) : (
        <DocumentCard object={object} />
      )}
    </span>
  );
}

/** One file in the grid: Capsomer's tile, with the site's keys, flags, selection and copy. */
export function MediaTile({
  object,
  chosen,
  selectRange,
  linkTo,
  view,
  scanComplete,
  tabStop,
}: TileProps) {
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
  const active = view.key === object.key;
  // Roving: in the grid only one tile's controls take Tab.
  const roving = !tabStop ? -1 : undefined;

  return (
    <li
      className="cap-media-tile"
      /* The keyboard navigator addresses tiles by key, not index, so a reflow cannot change what it means. */
      data-tile={object.key}
      data-state="ready"
      data-selected={chosen.includes(object.key) || undefined}
      data-active={active || undefined}
      data-kind={object.viewable ? "image" : "document"}
    >
      {/* Without `preventScrollReset`, `<ScrollRestoration>` throws the reader back to the top. */}
      <Link
        to={linkTo({ key: object.key })}
        className="cap-media-open"
        preventScrollReset
        aria-label={name}
        aria-current={active ? "true" : undefined}
        tabIndex={roving}
        /* preventDefault only on modified clicks, so a plain click stays a link that works without script. */
        onClick={(event) => {
          if (!event.shiftKey && !event.metaKey && !event.ctrlKey) return;
          event.preventDefault();
          selectRange(object.key, event.shiftKey);
        }}
      >
        <Thumb object={object} />
        <span className="cap-media-name" title={object.key}>
          {middleTruncate(name)}
        </span>
        <span className="cap-media-meta">
          {byteSize(object.size)}
          {object.width && object.height ? ` · ${formatDims(object.width, object.height)}` : ""}
          {/* Never say "unused": the repository scan cannot see a constructed path or an external
              site linking the file. */}
          {scanComplete ? ` · ${usage.label}` : ""}
        </span>
      </Link>

      {tileFlag ? (
        <span className="cap-media-flags">
          <Status tone={FLAG_TONE[tileFlag.id] ?? "info"}>{tileFlag.title}</Status>
        </span>
      ) : null}

      <SelectBox object={object} name={name} chosen={chosen} selectRange={selectRange} tabIndex={roving} />

      {/* The tile's only copy control: two same-named buttons would be read twice. */}
      <CopyButton value={object.url} label={name} tabIndex={roving} />
    </li>
  );
}

/** One file in the list: a table row, so its facts are columns a screen reader can navigate. */
export function MediaRow({ object, chosen, selectRange, linkTo, view, scanComplete }: TileProps) {
  const name = displayName(object);
  const usage = usageDescriptor(object.usage);
  const flags = flagsFor({
    viewable: object.viewable,
    alt: object.alt,
    size: object.size,
    twinCount: object.twinCount,
  });
  const active = view.key === object.key;

  return (
    <tr
      data-tile={object.key}
      data-selected={chosen.includes(object.key) || undefined}
      aria-selected={chosen.includes(object.key) || undefined}
    >
      <td>
        <label className="cap-check">
          <input
            type="checkbox"
            name="key"
            value={object.key}
            checked={chosen.includes(object.key)}
            onChange={(event) =>
              selectRange(object.key, (event.nativeEvent as MouseEvent | undefined)?.shiftKey === true)
            }
          />
          <span className="cap-sr-only">Select {name}</span>
        </label>
      </td>
      <th scope="row">
        {/* Content-addressed keys read as noise, so the author's name identifies the file. */}
        <Link
          to={linkTo({ key: object.key })}
          className="cap-table-open"
          title={object.key}
          preventScrollReset
          aria-current={active ? "true" : undefined}
        >
          {name}
        </Link>
        {/* Without the directory, two same-named files in different directories read as one row twice. */}
        <span className="cap-table-aside">{folderPrefix(object.key)}</span>
      </th>
      {/* "not measured" rather than 0x0 or blank, which would read as a value, not an absence. */}
      <td>
        <Status tone={USAGE_TONE[scanComplete ? object.usage : "unknown"] ?? "nodata"}>
          <span title={scanComplete ? usage.title : undefined}>
            {scanComplete ? usage.label : "unknown"}
          </span>
        </Status>
        {flags.length > 0 ? (
          <span className="cap-table-aside">{flags.map((f) => f.label).join(" · ")}</span>
        ) : null}
      </td>
      <td data-num>{formatDims(object.width, object.height)}</td>
      <td data-num>{byteSize(object.size)}</td>
      <td data-num>{formatAdded(object.uploaded)}</td>
      <td>
        <CopyButton value={object.url} label={name} />
      </td>
    </tr>
  );
}
