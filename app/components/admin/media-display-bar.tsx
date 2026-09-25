import { Link } from "react-router";

import { MediaDisplayGroup } from "~/components/admin/media-display-group";
import { displaySummary, sortHref } from "~/lib/media/view.mjs";
import type { hrefWith } from "~/lib/media/view.mjs";

const MEDIA_SHORTCUTS = [
  { keys: "cmd K", what: "Focus search from anywhere" },
  { keys: "/", what: "Focus search" },
  { keys: "up down", what: "Move through results" },
  { keys: "enter", what: "Copy the address" },
  { keys: "shift enter", what: "Open details" },
  { keys: "arrows", what: "Move through the grid" },
  { keys: "x", what: "Select the tile under the cursor" },
  { keys: "c", what: "Copy the address of the tile under the cursor" },
  { keys: "escape", what: "Clear the search or the selection" },
] as const;

/** Select all, the layout toggle, the display options and the keyboard shortcuts. */
export function MediaDisplayBar({
  visible,
  allShown,
  setSelected,
  q,
  filter,
  modified,
  view,
  linkTo,
}: {
  visible: string[];
  allShown: boolean;
  setSelected: (keys: string[]) => void;
  q: string;
  filter: string;
  modified: boolean;
  view: Parameters<typeof sortHref>[0];
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
}) {
  return (
      <div className="media-display-bar">
        {/* No `name`, so it stays out of the bulk form's submission. */}
        {visible.length > 0 ? (
          <label className="media-select-all">
            <input
              type="checkbox"
              checked={allShown}
              onChange={() => setSelected(allShown ? [] : visible)}
            />
            <span>
              {view.tag || q || filter !== "all"
                ? `Select all ${visible.length} shown`
                : `Select all ${visible.length}`}
            </span>
          </label>
        ) : null}

        <nav className="media-view-toggle" aria-label="Layout">
          {[
            ["list", "List"],
            ["grid", "Grid"],
          ].map(([id, label]) => (
            <Link
              key={id}
              to={linkTo({ view: id })}
              className={`admin-chip${view.view === id ? " is-active" : ""}`}
              aria-current={view.view === id ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <details className="media-display">
          <summary className="row-action">Display: {displaySummary(view)}</summary>
          <div className="media-display-panel">
            <MediaDisplayGroup
              label="Group by"
              options={[
                ["flat", "Flat"],
                ["folder", "Folder"],
                ["month", "Month"],
              ]}
              current={view.group}
              hrefFor={(id) => linkTo({ group: id })}
            />
            <MediaDisplayGroup
              label="Sort"
              options={[
                ["added", "Newest"],
                ["name", "A to Z"],
                ["size", "Largest"],
                ["usage", "Usage"],
              ]}
              current={view.sort}
              hrefFor={(id) => sortHref(view, id)}
            />
            <MediaDisplayGroup
              label="Direction"
              options={[
                ["desc", "Descending"],
                ["asc", "Ascending"],
              ]}
              current={view.dir}
              hrefFor={(id) => linkTo({ dir: id, page: 1 })}
            />
            <MediaDisplayGroup
              label="Tile size"
              options={[
                ["s", "S"],
                ["m", "M"],
                ["l", "L"],
              ]}
              current={view.size}
              hrefFor={(id) => linkTo({ size: id })}
            />
            {modified ? (
              <Link to="/admin/media" className="row-action">
                Reset to defaults
              </Link>
            ) : null}
          </div>
        </details>

        <details className="media-display media-shortcuts">
          <summary className="row-action" title="Keyboard shortcuts" aria-label="Keyboard shortcuts">
            ?
          </summary>
          <div className="media-display-panel media-shortcuts-panel">
            <span className="media-display-label">Keyboard</span>
            <dl className="media-shortcut-list">
              {MEDIA_SHORTCUTS.map((s) => (
                <div key={s.keys} className="media-shortcut">
                  <dt>
                    <kbd>{s.keys}</kbd>
                  </dt>
                  <dd>{s.what}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      </div>
  );
}
