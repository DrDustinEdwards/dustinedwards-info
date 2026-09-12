/**
 * Pagination previews.
 *
 * The component returns `null` when `pageCount <= 1`, so there is deliberately
 * no cell for that case: it would render an empty card that reads as a broken
 * preview rather than as the correct behaviour it is.
 *
 * `hrefFor` is a required prop because the two listings paginate at different
 * URLs. These cells pass the two real shapes rather than one invented one.
 */

import { Pagination } from "dustinedwards-info";

/** Mid-listing: both directions present. */
export function BothDirections() {
  return <Pagination page={3} pageCount={7} hrefFor={(p) => `/blog?page=${p}`} />;
}

/** The first page, where "Newer" is absent and the row must not lurch. */
export function FirstPage() {
  return <Pagination page={1} pageCount={7} hrefFor={(p) => `/blog?page=${p}`} />;
}

/** The last page, the mirror case. */
export function LastPage() {
  return <Pagination page={7} pageCount={7} hrefFor={(p) => `/blog?page=${p}`} />;
}

/** The tag archive's shape: a path with `?page=` appended rather than a composed query. */
export function OnATagArchive() {
  return <Pagination page={2} pageCount={4} hrefFor={(p) => `/blog/tags/cloudflare?page=${p}`} />;
}

/** Dark theme, on the surface it actually sits on. */
export function DarkTheme() {
  return (
    <div data-theme="dark" style={{ background: "var(--surface)", color: "var(--text)", padding: "1.5rem" }}>
      <Pagination page={3} pageCount={7} hrefFor={(p) => `/blog?page=${p}`} />
    </div>
  );
}
