import { Form } from "react-router";

/**
 * The site search box: a plain GET to /search with the query in `q`, so it works with no script.
 * The search page and the 404 page both render it. `children` sits inside the form after the input
 * row, for the search page's hidden filter fields and its operator hint. The `#q` id and the
 * `.search-form` class are what app/enhance/search.ts attaches to on the search page.
 */
export function SearchForm({
  defaultValue,
  children,
}: {
  defaultValue?: string;
  children?: React.ReactNode;
}) {
  return (
    <Form method="get" action="/search" role="search" className="search-form">
      <label className="search-label" htmlFor="q">
        Search this site
      </label>
      <div className="search-input-row">
        <input
          type="search"
          id="q"
          name="q"
          defaultValue={defaultValue}
          placeholder="Try: d1, tag:cloudflare, 2026, or a quoted phrase"
          autoComplete="off"
          className="search-input"
        />
        <button type="submit" className="search-submit">
          Search
        </button>
      </div>
      {children}
    </Form>
  );
}
