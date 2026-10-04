import { Link } from "react-router";
import { Disclosure } from "capsomer/react/disclosure";
import { TabsNav } from "capsomer/react/tabs";

import { TabLink } from "~/components/admin/tab-link";

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
    <div className="app-actions">
      {/* No `name`, so it stays out of the bulk form's submission. */}
      {visible.length > 0 ? (
        <label className="cap-check">
          <input
            type="checkbox"
            checked={allShown}
            onChange={() => setSelected(allShown ? [] : visible)}
          />
          {view.tag || q || filter !== "all"
            ? `Select all ${visible.length} shown`
            : `Select all ${visible.length}`}
        </label>
      ) : null}

      <TabsNav aria-label="Layout" size="sm">
        {[
          ["list", "List"],
          ["grid", "Grid"],
        ].map(([id, label]) => (
          <TabLink key={id} to={linkTo({ view: id })} current={view.view === id}>
            {label}
          </TabLink>
        ))}
      </TabsNav>

      <Disclosure summary={`Display: ${displaySummary(view)}`}>
        <div className="app-form">
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
            <div>
              <Link to="/admin/media" className="cap-btn" data-size="sm">
                Reset to defaults
              </Link>
            </div>
          ) : null}
        </div>
      </Disclosure>

      <Disclosure summary="Keyboard shortcuts">
        <dl className="app-facts">
          {MEDIA_SHORTCUTS.map((s) => (
            <div key={s.keys} className="app-fact">
              <dt>
                <kbd>{s.keys}</kbd>
              </dt>
              <dd>{s.what}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </div>
  );
}
