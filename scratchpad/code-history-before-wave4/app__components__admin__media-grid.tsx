/*
 * THE LIBRARY ITSELF: one markup tree, two layouts.
 *
 * Grid and list are the same elements under different data attributes, so the layout cannot change which submissions the page can issue.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24, markup and
 * comments unchanged.
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
 * The loader returns a UNION of three shapes: the picker, the palette and the
 * library listing. Only the listing carries these fields, so the member is
 * selected rather than the property read off the union. One owner: the loader.
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
        // A plain list. NOT role="grid": positional information is meaningless
        // to a screen reader here, because the number of columns depends on the
        // container width, and directional navigation does not help anyone find
        // a specific picture. Semantic elements first; the only ARIA on this
        // page is the nav label above and aria-current on the active chip.
        /*
          ONE MARKUP TREE, TWO LAYOUTS, selected by data attributes.
          The list view is CSS over the same elements rather than a second
          branch of JSX: a second tree is a second place for a control to go
          missing, and check:admin-ui would then have to prove both carry the
          same submissions instead of the layout being unable to change them.
          Tile size is a class exactly as ruled, never an inline style.
        */
        <Form method="post">
      {/*
        THE BULK BAR, and the FORM WRAPS THE GRID so the checkboxes are part of
        the same submission. Nesting this inside the toolbar above would put a
        form inside a form, which the browser drops; the posts index solved it
        the same way and this is that solution, not a new one.

        Rendered only when something is selected, which is also why the two
        bulk intents appear in the fixture only under the seeded-selection
        state: an unselected page genuinely cannot issue them.
      */}
        {chosen.length > 0 ? (
          <div className="posts-bulk" role="group" aria-label="Bulk actions">
            <p className="posts-bulk-count" aria-live="polite">
              {chosen.length} selected
              {/*
                THE SIZE OF WHAT IS SELECTED, which is the number the mockup puts
                beside the count and the one that answers the question somebody
                selecting a dozen files is actually asking: how much is this.
                A count of twelve says nothing about whether they are thumbnails
                or a conference poster.
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
              COPY ADDRESSES, one per line, for the selection.

              `type="button"` so it never submits the form it sits inside, and
              the only client-side control in this bar: everything beside it is a
              real submission. One address per line because that is what pastes
              usefully into a document, and a comma-separated list is not
              something anybody wants.
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
              MOVE TO TRASH, for the selection. Reversible, touches no object and
              no public URL, so it takes a plain confirmation rather than the
              type-the-count ceremony reserved for the irreversible delete.

              A `type="button"` that opens the confirmation, because the confirm
              lives in the modal and submitting from here would skip it. The
              modal's own submit carries the same form's selected keys.
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
          GROUPED PAGE-LOCAL. Each page buckets the rows IT HAS; a group never
          spans a page boundary. That is a ruling, not a shortcut, and the
          grounds are on `groupRows`: fetching the whole library to group
          globally is fine at 70 rows and wrong at 700, and letting a group
          resume on page two reads as a bug to everyone who sees it.

          The heading therefore counts THIS PAGE and says so, because a count
          that looked like a library total would be the over-promise again.

          BRACED. Without the braces this is JSX CHILDREN TEXT, not a comment,
          and the whole paragraph renders on the page. It did, and it was
          caught by looking rather than by any gate: check:admin-ui reads
          submissions and structure, and a comment leaking into the document
          changes neither.
        */}
        {/*
          THE HEADER ROW, ONCE, above every group rather than once per group.

          Column headings describe the TABLE, and a heading repeated above each
          folder would say the same five words four times while making each
          group look like a table of its own. The grouping is still real: the
          folder headings sit below this, and the columns line up across all of
          them because every row is laid out on the same fixed track list rather
          than on a shared grid.
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
                THE NOTE, right-aligned and quiet, and it is the reason this
                grouping exists. "Placed by the roster page template" is the
                sentence that stops somebody deleting nine photographs because
                a post-level tracker called them unreferenced.

                Quiet by SIZE and WEIGHT, never by an unreadable grey: the
                mockup's #A79C8A measures 2.34 to 1 and does not ship. This
                resolves to --text-muted.
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
             * THE THREE-STATE DESCRIPTOR AND THE PER-ROW FLAGS, from the pure
             * module. The row does not decide either: `usage` arrives from the
             * loader, and `flagsFor` is the one definition of what a flag is, so
             * the lens that selects rows and the badge that labels them cannot
             * drift.
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
             * WHETHER THIS TILE WEARS THE CAPTION BAR.
             *
             * **NO NEW CLIENT STATE.** Both halves already exist and neither is
             * invented here: `chosen` is the selection this page has carried
             * since bulk actions landed, and `view.key` is the inspector, which
             * is a URL parameter like every other. So the caption is a function
             * of state the page already holds, which is why it costs nothing.
             *
             * GRID ONLY. In the list a row already has columns for the size and
             * the dimensions, so a bar laid over a 44px thumbnail would be the
             * same three facts a second time, in less room.
             *
             * Deliberately NOT on hover. Hover is not a state the server can
             * render, and reaching it would mean either script or a CSS rule
             * that reveals a control the keyboard cannot get to first. The
             * mockup shows it on hover AND on the active tile; this page keeps
             * the half that has an address.
             */
            const showCaption =
              view.view === "grid" && (chosen.includes(object.key) || view.key === object.key);
            return (
              <li
                key={object.key}
                className="media-card"
                /* The keyboard navigator addresses tiles by this attribute and
                   reads their rendered boxes for the grid geometry. It is the
                   only thing tying the island to the markup, and it is the key
                   rather than an index so a reflow cannot change what it means. */
                data-tile={object.key}
                data-selected={chosen.includes(object.key) || undefined}
                data-active={view.key === object.key || undefined}
                data-kind={object.viewable ? "image" : "document"}
              >
                {/* The checkbox carries `key`, which is what the bulk action
                    reads with form.getAll("key"). Same shape as the posts
                    index's `slug`, so the two bulk surfaces are one grammar. */}
                <label className="media-check-label">
                  <input
                    type="checkbox"
                    name="key"
                    value={object.key}
                    checked={chosen.includes(object.key)}
                    onChange={(event) =>
                      selectRange(
                        object.key,
                        // `nativeEvent` carries the modifier a change event
                        // does not expose directly. Keyboard activation reports
                        // shiftKey false, so Space still toggles one row, which
                        // is the behaviour a keyboard reader expects.
                        (event.nativeEvent as MouseEvent | undefined)?.shiftKey === true,
                      )
                    }
                  />
                  <span className="sr-only">Select {name}</span>
                </label>
                {/* A FIXED BOX, declared as aspect-ratio on the wrapper rather
                    than left to the image.

                    The grid was ragged because it mixes 1200x630 cards, 3:2
                    photos and 1:1 icons and nothing constrained them, which also
                    made the cards tall enough to clip the Save button. An
                    explicit ratio on the wrapper reserves the space before the
                    image arrives, so a lazily-loaded tile cannot reflow the rows
                    below it as it lands. */}
                {/*
                  THE FRAME EXISTS SO THE CAPTION CAN BE A SIBLING OF THE LINK
                  RATHER THAN A CHILD OF IT.
                  The caption carries the copy control, and a <button> inside an
                  <a> is invalid HTML that browsers resolve differently: the
                  press either navigates or copies depending on who you ask.
                  Wrapping both in one positioned box is what lets the bar sit
                  over the picture while staying outside the anchor.
                */}
                <span className="media-thumb-frame">
                {/*
                  `preventScrollReset` is what stops opening a file throwing the
                  reader back to the top of the library.

                  `<Link>` is a CLIENT-SIDE transition, so there is no document
                  reload, but `<ScrollRestoration>` in root treats every new
                  location as a new place and scrolls to top. Opening an
                  inspector is not going somewhere else, it is looking closer at
                  where you already are, and the grid behind the drawer must
                  still be showing the tile you clicked.
                */}
                <Link
                  to={linkTo({ key: object.key })}
                  className="media-thumb-link"
                  preventScrollReset
                  /*
                    SHIFT OR META CLICK SELECTS INSTEAD OF OPENING.

                    This is the mockup's behaviour and it is what every file
                    manager does: a modified click extends or toggles a
                    selection rather than navigating. Without it, building a
                    selection in the grid means hunting for 31 small checkboxes,
                    and shift-clicking a range is impossible because the first
                    click navigates away.

                    `preventDefault` only inside the branch, so an UNMODIFIED
                    click is untouched and still a plain link: with no script it
                    navigates as it always did, and ctrl-click to open in a new
                    tab still works because that is meta on this platform and
                    lands on the same guard the mockup uses.

                    The range logic is `selectRange`, already written for the
                    checkbox, so shift-click in the grid and shift-click on a
                    checkbox extend the same way from the same anchor.
                  */
                  onClick={(event) => {
                    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) return;
                    event.preventDefault();
                    selectRange(object.key, event.shiftKey);
                  }}
                >
                  <span
                    className="media-thumb-box"
                    // LQIP as a CSS background BEHIND the real image. The element
                    // paints immediately and the image covers it on arrival, so
                    // the tile is never empty, the swap needs no script and no
                    // onload, and the box never changes size.
                    //
                    // ELEVEN OF SEVENTY ROWS HAVE NO PLACEHOLDER: the Images
                    // binding does not rasterize vectors, so every SVG has a null
                    // one. Those must degrade to the surface colour rather than
                    // render as a black or empty hole, which is why this is set
                    // conditionally over a token background rather than always
                    // written as `url(null)`.
                    style={
                      object.placeholder
                        ? { backgroundImage: `url("${object.placeholder}")` }
                        : undefined
                    }
                    data-placeholder={object.placeholder ? "lqip" : "none"}
                    /*
                     * A DOCUMENT USED TO GET A SHORTER BOX, and it no longer
                     * does. The old reason was written down and was true at the
                     * time: "there is nothing to look at, so it must not claim
                     * the same height as a picture", and 5:2 kept a wall of
                     * empty bands from claiming a picture's canvas.
                     *
                     * THERE IS SOMETHING TO LOOK AT NOW. `DocumentCard` puts a
                     * title, a suggestion of text and a size in that space, so
                     * the premise the squash was built on is gone, and a squashed
                     * card would crush the thing that fixed it. Back to 3:2,
                     * which is also the ratio every tile has in the mockup.
                     */
                    data-kind={object.viewable ? "image" : "document"}
                  >
                    {/* A document has no thumbnail the Images binding can ever
                        produce, so it gets a CARD rather than an <img> pointed
                        at something that cannot render one. 31 of the 70 rows
                        are documents; an empty box for each read as 31 loading
                        failures, which is what this replaces. */}
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
                  THE CORNER FLAG, one dot, on the tile.

                  `tileFlagFor` picks the single most urgent of the row's flags
                  rather than stacking three on a 150px tile. Its `title` is the
                  sentence; the dot is the glance. Rendered outside the caption
                  so a selected tile shows both.
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
                  THE CAPTION BAR, over the picture, on the tile the reader has
                  picked out. Filename, size and dimensions, and the page's one
                  job in the corner of it.

                  It is the tile's ONLY copy control when it renders: the body's
                  copy button is suppressed below rather than drawn twice. Two
                  buttons with the same accessible name on one card is a thing
                  a screen reader reads twice and a pointer picks between for no
                  reason, and the payload is identical either way, so there is
                  nothing to trade off.
                */}
                {showCaption ? (
                  <span className="media-caption">
                    <span className="media-caption-text">
                      <span className="media-caption-name">{name}</span>
                      {/* Size, then the dimensions WHEN THERE ARE ANY. A
                          document has none and never will, and "1.4 MB · not
                          measured" spends the caption's second line saying that
                          a PDF is not a picture. The list has a Dims column
                          where an absence belongs, because there a blank cell
                          is a value; here it is just a phrase in the way. */}
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
                  THE BODY IS `display: contents` IN BOTH LAYOUTS, so its
                  children are laid out by the CARD rather than by it.

                  That is what keeps this ONE MARKUP TREE while the list becomes
                  a real eight-column table. A row's cells have to be grid items
                  of the row, and they cannot be if a wrapper sits between them;
                  a second JSX branch for the list would be a second place for a
                  control to go missing, which is exactly what this page's
                  layout rule forbids. The wrapper stays because it names the
                  group, and it stops laying anything out.
                */}
                <div className="media-card-body">
                  {/* THE NAME CELL. In the grid it is the line under the
                      picture; in the list it is column three, and it carries
                      the directory underneath, which is the half the grid
                      cannot afford to show. */}
                  <div className="media-name-row">
                    {/* The LAST SEGMENT, linking to the detail view, which is
                        also the no-script route to the address. A
                        content-addressed key is an ADDRESS and reads as noise,
                        so the name the author gave the file identifies it to a
                        human; the full key stays in the title and in the
                        detail view. */}
                    <Link
                      to={linkTo({ key: object.key })}
                      className="media-name"
                      title={object.key}
                      preventScrollReset
                    >
                      {/*
                        THE CLAMP IS THE GRID'S, AND ONLY THE GRID'S.

                        Found by LOOKING at the list view rather than by
                        measuring it: with a 13 character middle clamp applied
                        to a full-width row, `microscope-plate-2019.png` and
                        `microscope-plate-2020.png` both render as
                        "mic...-2019.png" style stubs and the reader cannot tell
                        two files apart in a view with 1200px of empty space
                        beside the name.

                        The clamp exists because every truncation cuts the END,
                        which is the half that distinguishes, and a narrow tile
                        genuinely has no room. A list row does. So the clamp is
                        applied per LAYOUT rather than per name, and the list
                        shows the whole thing.
                      */}
                      {view.view === "list" ? name : middleTruncate(name)}
                    </Link>
                    {/* THE DIRECTORY, under the name, LIST ONLY.

                        `displayName` drops the directory because nine roster
                        photographs share every character of theirs and the tile
                        had 109px to spend. A list row is not a tile: it has the
                        width, and without the folder two files with the same
                        basename in different directories are one row printed
                        twice. So the half the grid throws away comes back
                        exactly where there is room for it. */}
                    <span className="media-name-dir">{folderPrefix(object.key)}</span>
                  </div>
                  {/*
                    The grid's meta line. Hidden in the list, where the same
                    facts have columns of their own.

                    **IT SAID "unused" AND THAT WORD IS FORBIDDEN HERE.** The
                    line was written when the page had two states and it
                    survived the three-state model landing, so a tile could read
                    `content 189 kB · unused` while the row beneath it in the
                    list view said `in template` about the same file. Worse than
                    inconsistent: "unused" is the exact claim the usage ruling
                    says this page may never make, because the repository scan
                    cannot see a constructed path and nothing here can see an
                    external site linking a file. Nine roster photographs the
                    site serves on every visit were labelled unused.

                    It now reads the SAME descriptor every other surface reads,
                    so the tile, the row and the inspector cannot disagree.
                  */}
                  <p className="media-meta">
                    <span className="chip">{object.role}</span> {byteSize(object.size)}
                    {scanComplete ? ` · ${usage.label}` : ""}
                  </p>
                </div>

                {/*
                  THE LIST'S REMAINING COLUMNS. Hidden in the grid by CSS rather
                  than omitted from the markup, per the one-tree rule above.

                  A cell that reads "not measured" is doing work: 31 documents
                  and every SVG have no dimensions, and printing 0x0 or an empty
                  cell would both read as a value rather than as an absence.
                */}
                {/*
                  THE USAGE CELL, three states rather than two, with its flags
                  underneath. `used` and `unattached` were the whole vocabulary
                  and it could not express the roster photographs, which the site
                  places on every visit and no post cites.

                  The dot is a SECOND CHANNEL beside a word, never the signal
                  itself, so a reader who cannot separate the hues loses nothing.
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
                  THE COPY CONTROL, ONE PER CARD, as the card's last child.

                  It was inside the name row, which made the name row two cells
                  wide and left the list with no eighth column to put it in.
                  Explicit grid placement puts it back beside the name in the
                  grid view, so the tile is unchanged to look at while the row
                  gains its column. It renders here only when the caption bar is
                  not already carrying it.
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
