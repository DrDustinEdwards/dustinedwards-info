import { Form, Link } from "react-router";

import { MediaPalette } from "~/components/admin/media-palette";
import type { hrefWith, sortHref } from "~/lib/media/view.mjs";

/** The library search, which carries every other view axis along, and its palette. */
export function MediaSearch({
  q,
  total,
  view,
  linkTo,
}: {
  q: string;
  total: number;
  view: Parameters<typeof sortHref>[0];
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
}) {
  return (
    <>
      <Form method="get" action="/admin/media" className="media-search" role="search">
        {/* A visible label, not the placeholder alone, which disappears once anything is typed. The
            input's fuller aria-label starts with the same word. */}
        <label htmlFor="media-q" className="media-search-label">
          Search
        </label>
        <input
          id="media-q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder={`Search ${total} files`}
          aria-label={`Search ${total} files by name, address, alt text or caption`}
          className="media-search-input"
        />
        {/* Other axes ride as hidden fields, or searching would drop the lens and folder. */}
        <input type="hidden" name="lens" value={view.lens} />
        <input type="hidden" name="group" value={view.group} />
        <input type="hidden" name="view" value={view.view} />
        <input type="hidden" name="sort" value={view.sort} />
        <input type="hidden" name="dir" value={view.dir} />
        <input type="hidden" name="size" value={view.size} />
        <input type="hidden" name="role" value={view.role} />
        <input type="hidden" name="tag" value={view.tag} />
        <input type="hidden" name="trash" value={view.trash ? "1" : ""} />
        {q ? (
          <Link to={linkTo({ q: "", page: 1 })} className="btn-ghost">
            Clear
          </Link>
        ) : null}
        <span className="media-search-kbd" aria-hidden="true">
          {"⌘K"}
        </span>
      </Form>
      <MediaPalette inputId="media-q" />
    </>
  );
}
