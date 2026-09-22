/*
 * THE LIBRARY ITSELF: one markup tree, two layouts. Grid and list are the same
 * elements under different data attributes, so the layout cannot change which
 * submissions the page can issue.
 */

import { Form, Link } from "react-router";

import { CopyButton } from "~/components/admin/media-copy-button";
import { DocumentCard } from "~/components/admin/media-document-card";
import { MediaListHeader } from "~/components/admin/media-list-header";
import { toast } from "~/components/admin/media-keyboard";
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

/*
 * The loader returns a UNION of three shapes and only the listing carries these
 * fields, so the member is selected rather than the property read off the union.
 * One owner: the loader.
 */
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
        // A plain list. NOT `role="grid"`: positional information is meaningless to a
        // screen reader here, because the column count depends on the container width and
        // directional navigation does not help anyone find a picture. SEMANTIC ELEMENTS
        // FIRST, and ARIA only where no element carries the meaning.
        /*
         * ONE MARKUP TREE, TWO LAYOUTS, selected by data attributes. A second branch of
         * JSX is a second place for a control to go missing, and `check:admin-ui` would
         * then have to prove both carry the same submissions.
         */
        <Form method="post">
      {/*
       * THE FORM WRAPS THE GRID so the checkboxes are part of the same submission.
       * Nesting it inside the toolbar would put a form inside a form, which the browser
       * drops. Rendered only when something is selected, which is why the two bulk
       * intents appear in the fixture only under the seeded-selection state.
       */}
        {chosen.length > 0 ? (
          <div className="posts-bulk" role="group" aria-label="Bulk actions">
            <p className="posts-bulk-count" aria-live="polite">
              {chosen.length} selected
              {/*
               * THE SIZE OF WHAT IS SELECTED, which is the question somebody selecting a dozen
               * files is actually asking: a count of twelve says nothing about whether they are
               * thumbnails or a conference poster.
               */}
              <span className="posts-bulk-size">
                {byteSize(
                  objects
                    .filter((o) => chosen.includes(o.key))
                    .reduce((sum, o) => sum + o.size, 0),
                )}
              </span>
            </p>
            {/*
             * `type="button"` so it never submits the form it sits inside, and the only
             * client-side control in this bar. One address per line, because that is what
             * pastes usefully and a comma-separated list is not.
             */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                const addresses = objects
                  .filter((o) => chosen.includes(o.key))
                  .map((o) => o.url)
                  .join("\n");
                navigator.clipboard
                  .writeText(addresses)
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
            {/* The vocabulary already in use, offered rather than enforced: a
                new tag is legitimate. */}
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
            {/*
             * Reversible, touches no object and no public URL, so it takes a plain
             * confirmation rather than the type-the-count ceremony reserved for the
             * irreversible delete. A `type="button"` opens the modal, because submitting from
             * here would skip it.
             */}
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmingTrash(true)}
            >
              Move to trash
            </button>
            {/* Escape clears too, and nobody discovers Escape. */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          </div>
        ) : null}

        {/*
         * GROUPED PAGE-LOCAL: each page buckets the rows IT HAS and a group never spans a
         * page boundary, so the heading counts THIS PAGE and says so.
         *
         * BRACED. Without the braces this is JSX CHILDREN TEXT and the whole paragraph
         * renders on the page.
         */}
        {/*
         * THE HEADER ROW, ONCE, above every group: column headings describe the TABLE,
         * and one per folder would say the same five words four times while making each
         * group look like a table of its own.
         */}
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
              {/*
               * The note is the reason this grouping exists: it is what stops somebody deleting
               * nine photographs because a post-level tracker called them unreferenced. Quiet by
               * SIZE and WEIGHT, never by an unreadable gray.
               */}
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
            /* `cited` was here and is gone with the two-state meta line that
               was its only reader. Usage is a three-state descriptor now. */
            /*
             * Both come from the pure module: `usage` arrives from the loader and
             * `flagsFor` is the one definition of what a flag is, so the lens that selects
             * rows and the badge that labels them cannot drift.
             */
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
            /*
             * NO NEW CLIENT STATE: both halves already exist, so the caption is a function of
             * state the page already holds.
             *
             * Deliberately NOT on hover. Hover is not a state the server can render, and
             * reaching it would mean script or a CSS rule revealing a control the keyboard
             * cannot get to first.
             */
            const showCaption =
              view.view === "grid" && (chosen.includes(object.key) || view.key === object.key);
            return (
              <li
                key={object.key}
                className="media-card"
                /*
                 * The keyboard navigator addresses tiles by this attribute and reads their
                 * rendered boxes for the geometry. The key rather than an index, so a reflow
                 * cannot change what it means.
                 */
                data-tile={object.key}
                data-selected={chosen.includes(object.key) || undefined}
                data-active={view.key === object.key || undefined}
                data-kind={object.viewable ? "image" : "document"}
              >
                {/*
                 * The checkbox carries `key`, which is what the bulk action reads. Same shape as
                 * the posts index's `slug`, so the two bulk surfaces are one grammar.
                 */}
                <label className="media-check-label">
                  <input
                    type="checkbox"
                    name="key"
                    value={object.key}
                    checked={chosen.includes(object.key)}
                    onChange={(event) =>
                      selectRange(
                        object.key,
                        // `nativeEvent` carries the modifier a change event does not expose. Keyboard
                        // activation reports `shiftKey` false, so Space still toggles one row, which is
                        // what a keyboard reader expects.
                        (event.nativeEvent as MouseEvent | undefined)?.shiftKey === true,
                      )
                    }
                  />
                  <span className="sr-only">Select {name}</span>
                </label>
                {/*
                 * A FIXED BOX, declared as `aspect-ratio` on the wrapper rather than left to the
                 * image: it reserves the space before the image arrives, so a lazily-loaded tile
                 * cannot reflow the rows below it as it lands.
                 */}
                {/*
                 * THE FRAME EXISTS SO THE CAPTION CAN BE A SIBLING OF THE LINK RATHER THAN A
                 * CHILD OF IT: a `<button>` inside an `<a>` is invalid HTML that browsers
                 * resolve differently, so the press either navigates or copies depending on who
                 * you ask.
                 */}
                <span className="media-thumb-frame">
                {/*
                 * `preventScrollReset` is what stops opening a file throwing the reader back to
                 * the top of the library: `<ScrollRestoration>` treats every new location as a new
                 * place, and opening an inspector is looking closer at where you already are.
                 */}
                <Link
                  to={linkTo({ key: object.key })}
                  className="media-thumb-link"
                  preventScrollReset
                  /*
                   * SHIFT OR META CLICK SELECTS INSTEAD OF OPENING. `preventDefault` only inside
                   * the branch, so an UNMODIFIED click is untouched and still a plain link: with no
                   * script it navigates as it always did. The range logic is `selectRange`, already
                   * written for the checkbox.
                   */
                  onClick={(event) => {
                    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) return;
                    event.preventDefault();
                    selectRange(object.key, event.shiftKey);
                  }}
                >
                  <span
                    className="media-thumb-box"
                    // LQIP as a CSS background BEHIND the real image, so the tile is never empty and
                    // the swap needs no script. Set CONDITIONALLY over a token background: the Images
                    // binding does not rasterize vectors, so an SVG has a null placeholder and
                    // `url(null)` would render as a black hole.
                    style={
                      object.placeholder
                        ? { backgroundImage: `url("${object.placeholder}")` }
                        : undefined
                    }
                    data-placeholder={object.placeholder ? "lqip" : "none"}
                    /*
                     * `DocumentCard` puts a title, a suggestion of text and a size in this space, so
                     * a squashed card would crush the thing that fixed it. 3:2, the ratio every tile
                     * has.
                     */
                    data-kind={object.viewable ? "image" : "document"}
                  >
                    {/*
                     * A document has no thumbnail the Images binding can ever produce, so it gets a
                     * CARD rather than an `<img>` pointed at something that cannot render one. An
                     * empty box per document read as a loading failure.
                     */}
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

                {/*
                 * `tileFlagFor` picks the single most urgent flag rather than stacking three on a
                 * small tile. Its `title` is the sentence, the dot is the glance. Outside the
                 * caption, so a selected tile shows both.
                 */}
                {tileFlag ? (
                  <span
                    className="media-tile-flag"
                    data-flag={tileFlag.id}
                    title={tileFlag.title}
                  >
                    <span className="sr-only">{tileFlag.title}</span>
                  </span>
                ) : null}

                {/*
                 * It is the tile's ONLY copy control when it renders: two buttons with the same
                 * accessible name on one card is a thing a screen reader reads twice and a pointer
                 * picks between for no reason.
                 */}
                {showCaption ? (
                  <span className="media-caption">
                    <span className="media-caption-text">
                      <span className="media-caption-name">{name}</span>
                      {/*
                       * Dimensions only WHEN THERE ARE ANY: a document has none, and spending the
                       * caption's second line saying a PDF is not a picture is a phrase in the way. The
                       * list has a column, where a blank cell is a value.
                       */}
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

                {/*
                 * THE BODY IS `display: contents` IN BOTH LAYOUTS, which is what keeps this one
                 * markup tree while the list becomes a real table: a row's cells have to be grid
                 * items of the row, and they cannot be if a wrapper sits between them.
                 */}
                <div className="media-card-body">
                  {/* THE NAME CELL. In the grid it is the line under the
                      picture; in the list it is column three, and it carries
                      the directory underneath, which is the half the grid
                      cannot afford to show. */}
                  <div className="media-name-row">
                    {/*
                     * The LAST SEGMENT, linking to the detail view, which is also the no-script route
                     * to the address. A content-addressed key is an ADDRESS and reads as noise, so the
                     * name the author gave identifies it to a human.
                     */}
                    <Link
                      to={linkTo({ key: object.key })}
                      className="media-name"
                      title={object.key}
                      preventScrollReset
                    >
                      {/*
                       * THE CLAMP IS THE GRID'S, AND ONLY THE GRID'S. Every truncation cuts the END,
                       * which is the half that distinguishes, and a narrow tile genuinely has no room
                       * where a list row does.
                       */}
                      {view.view === "list" ? name : middleTruncate(name)}
                    </Link>
                    {/*
                     * THE DIRECTORY, LIST ONLY. Without it, two files with the same basename in
                     * different directories are one row printed twice; the tile drops it because it
                     * has no width to spend.
                     */}
                    <span className="media-name-dir">{folderPrefix(object.key)}</span>
                  </div>
                  {/*
                   * **"unused" IS FORBIDDEN HERE.** It is the exact claim the usage ruling says this
                   * page may never make: the repository scan cannot see a constructed path and
                   * nothing here can see an external site linking a file. This reads the SAME
                   * descriptor every other surface reads.
                   */}
                  <p className="media-meta">
                    <span className="chip">{object.role}</span> {byteSize(object.size)}
                    {scanComplete ? ` · ${usage.label}` : ""}
                  </p>
                </div>

                {/*
                 * Hidden in the grid by CSS rather than omitted from the markup, per the one-tree
                 * rule. A cell reading "not measured" is doing work: printing 0x0 or an empty cell
                 * would both read as a value rather than an absence.
                 */}
                {/*
                 * Three states rather than two, because `used` and `unattached` could not
                 * express the roster photographs. The dot is a SECOND CHANNEL beside a word, never
                 * the signal itself, so a reader who cannot separate the hues loses nothing.
                 */}
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
                  {/* duplicate, no alt, over 1 MB. A file can carry all three,
                      which is why this is a list and not a badge. */}
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

                {/*
                 * THE COPY CONTROL, ONE PER CARD, as the card's last child. Explicit grid
                 * placement puts it beside the name in the grid view while the row gains its
                 * column. It renders here only when the caption bar is not already carrying it.
                 */}
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
