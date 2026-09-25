import { Form, Link } from "react-router";

import { CopyButton } from "~/components/admin/copy-button";
import { DocumentCard } from "~/components/admin/media-document-card";
import { MediaListHeader } from "~/components/admin/media-list-header";
import { toast } from "~/components/admin/toast";
import { copyText } from "~/lib/clipboard";
import { byteSize } from "~/lib/media/byte-size.mjs";
import { flagsFor, tileFlagFor, usageDescriptor } from "~/lib/media/usage.mjs";
import {
  displayName,
  folderPrefix,
  formatAdded,
  formatDims,
  groupRows,
  middleTruncate,
} from "~/lib/media/view.mjs";
import type { hrefWith, sortHref } from "~/lib/media/view.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

type Listing = Extract<Route.ComponentProps["loaderData"], { detail: unknown }>;

export function MediaGrid({
  objects,
  chosen,
  selectRange,
  setSelected,
  setConfirmingTrash,
  linkTo,
  view,
  pending,
  scanComplete,
  tagCounts,
}: {
  objects: Listing["objects"];
  chosen: string[];
  selectRange: (key: string, shift: boolean) => void;
  setSelected: (keys: string[]) => void;
  setConfirmingTrash: (value: boolean) => void;
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
  view: Parameters<typeof sortHref>[0];
  pending: boolean;
  scanComplete: boolean;
  tagCounts: Listing["tagCounts"];
}) {
  return (
        // Not role="grid": the column count follows the container width, so positions mean nothing to a screen reader.
        <Form method="post">
      {/* The form wraps the grid so the checkboxes submit with it; nested in the toolbar it would be
          a form inside a form, which the browser drops. */}
        {chosen.length > 0 ? (
          <div className="posts-bulk" role="group" aria-label="Bulk actions">
            <p className="posts-bulk-count" aria-live="polite">
              {chosen.length} selected
              <span className="posts-bulk-size">
                {byteSize(
                  objects
                    .filter((o) => chosen.includes(o.key))
                    .reduce((sum, o) => sum + o.size, 0),
                )}
              </span>
            </p>
            {/* `type="button"` so it never submits the form it sits in. One address per line: that pastes usefully. */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                const addresses = objects
                  .filter((o) => chosen.includes(o.key))
                  .map((o) => o.url)
                  .join("\n");
                copyText(addresses)
                  .then(() =>
                    toast(
                      `Copied ${chosen.length} address${chosen.length === 1 ? "" : "es"}`,
                    ),
                  )
                  .catch(() => toast("The clipboard refused. Open a file to copy its address."));
              }}
            >
              Copy addresses
            </button>
            <label className="posts-bulk-tag">
              <span>Tag</span>
              <input
                type="text"
                name="tag"
                list="media-bulk-tags"
                autoComplete="off"
                placeholder="tag name"
              />
            </label>
            <datalist id="media-bulk-tags">
              {tagCounts.map((t) => (
                <option key={t.tag} value={t.tag} />
              ))}
            </datalist>
            <button type="submit" name="intent" value="bulk-add-tag" className="btn">
              Add tag
            </button>
            <button type="submit" name="intent" value="bulk-remove-tag" className="btn">
              Remove tag
            </button>
            {/* A `type="button"` opens the modal, because submitting from here would skip it. */}
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmingTrash(true)}
            >
              Move to trash
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          </div>
        ) : null}

        {/* Grouped page-locally: a group never spans a page, so the heading counts this page. */}
        {view.view === "list" && objects.length > 0 ? (
          <MediaListHeader view={view} />
        ) : null}

        {groupRows(objects, view.group).map((bucket) => (
        <section key={bucket.label || "ungrouped"} className="media-group">
          {bucket.label ? (
            <h3 className="media-group-heading">
              <span className="media-group-title">{bucket.label}</span>
              <span className="media-group-count">
                {bucket.rows.length} on this page
              </span>
              {bucket.note ? (
                <span className="media-group-note">{bucket.note}</span>
              ) : null}
            </h3>
          ) : null}
        <ul
          className="media-grid"
          data-view={view.view}
          data-size={view.size}
          data-pending={pending || undefined}
          aria-busy={pending || undefined}
        >
          {bucket.rows.map((object) => {
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
                    <CopyButton value={object.url} label={name} />
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
                    <CopyButton value={object.url} label={name} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        </section>
        ))}
        </Form>
  );
}
